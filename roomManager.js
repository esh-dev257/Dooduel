const { assignAvatar } = require('./avatars');

// In-memory room store
const rooms = {};

function createRoom(roomId) {
  rooms[roomId] = {
    players: {},
    host: null,
    gameState: 'WAITING',
    currentPrompt: null,
    drawings: {},
    votes: {},
    round: 0,
    timer: null,
    roundHistory: [],
    playerStats: {}
  };
  return rooms[roomId];
}

function getRoom(roomId) {
  return rooms[roomId] || null;
}

function joinRoom(roomId, socketId, username) {
  let room = rooms[roomId];
  if (!room) {
    room = createRoom(roomId);
  }

  const avatar = assignAvatar(room.players);
  room.players[socketId] = {
    username,
    score: 0,
    avatar
  };

  room.playerStats[socketId] = room.playerStats[socketId] || {
    totalVotesReceived: 0,
    ratingSum: 0,
    roundsPlayed: 0
  };

  // First player becomes host
  if (!room.host || !room.players[room.host]) {
    room.host = socketId;
  }

  return room;
}

function leaveRoom(roomId, socketId) {
  const room = rooms[roomId];
  if (!room) return null;

  delete room.players[socketId];
  delete room.drawings[socketId];

  // Remove this player's vote
  delete room.votes[socketId];

  // Remove votes cast FOR this player
  for (const [voter, votedFor] of Object.entries(room.votes)) {
    if (votedFor === socketId) {
      delete room.votes[voter];
    }
  }

  const playerCount = Object.keys(room.players).length;

  // Clean up empty rooms
  if (playerCount === 0) {
    clearRoomTimer(roomId);
    delete rooms[roomId];
    return null;
  }

  // Reassign host if the host left
  if (room.host === socketId) {
    room.host = Object.keys(room.players)[0];
  }

  return room;
}

// Sanitized room state safe for broadcasting
function getRoomState(roomId) {
  const room = rooms[roomId];
  if (!room) return null;

  return {
    players: room.players,
    host: room.host,
    gameState: room.gameState,
    currentPrompt: room.currentPrompt,
    round: room.round
  };
}

function storeStroke(roomId, socketId, stroke) {
  const room = rooms[roomId];
  if (!room || room.gameState !== 'DRAWING') return;

  if (!room.drawings[socketId]) {
    room.drawings[socketId] = [];
  }
  room.drawings[socketId].push(stroke);
}

function clearPlayerDrawing(roomId, socketId) {
  const room = rooms[roomId];
  if (!room) return;
  room.drawings[socketId] = [];
}

function castVote(roomId, voterSocketId, targetSocketId) {
  const room = rooms[roomId];
  if (!room) return { success: false, error: 'Room not found' };
  if (room.gameState !== 'VOTING') return { success: false, error: 'Not in voting phase' };
  if (voterSocketId === targetSocketId) return { success: false, error: 'Cannot vote for yourself' };
  if (!room.players[targetSocketId]) return { success: false, error: 'Invalid target' };
  if (room.votes[voterSocketId]) return { success: false, error: 'Already voted' };

  room.votes[voterSocketId] = targetSocketId;
  return { success: true };
}

function tallyVotes(roomId) {
  const room = rooms[roomId];
  if (!room) return null;

  // Count votes per player
  const voteCounts = {};
  for (const targetId of Object.values(room.votes)) {
    voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
  }

  // Find winner(s)
  let maxVotes = 0;
  let winners = [];

  for (const [socketId, count] of Object.entries(voteCounts)) {
    if (count > maxVotes) {
      maxVotes = count;
      winners = [socketId];
    } else if (count === maxVotes) {
      winners.push(socketId);
    }
  }

  // Award points: 100 per vote received, +50 bonus for winner(s)
  // Track vote stats
  for (const [socketId, count] of Object.entries(voteCounts)) {
    if (room.players[socketId]) {
      room.players[socketId].score += count * 100;
      if (room.playerStats[socketId]) {
        room.playerStats[socketId].totalVotesReceived += count;
      }
    }
  }
  for (const winnerId of winners) {
    if (room.players[winnerId]) {
      room.players[winnerId].score += 50;
    }
  }

  return {
    voteCounts,
    winners: winners.map(id => ({
      socketId: id,
      username: room.players[id]?.username || 'Unknown',
      avatar: room.players[id]?.avatar || null,
      votes: voteCounts[id]
    })),
    scores: Object.fromEntries(
      Object.entries(room.players).map(([id, p]) => [
        id,
        { username: p.username, score: p.score, avatar: p.avatar }
      ])
    )
  };
}

function getAllDrawings(roomId) {
  const room = rooms[roomId];
  if (!room) return {};

  const drawings = {};
  for (const [socketId, strokes] of Object.entries(room.drawings)) {
    if (room.players[socketId]) {
      drawings[socketId] = {
        username: room.players[socketId].username,
        avatar: room.players[socketId].avatar,
        strokes
      };
    }
  }
  return drawings;
}

function resetRound(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.drawings = {};
  room.votes = {};
  room.currentPrompt = null;
}

function clearRoomTimer(roomId) {
  const room = rooms[roomId];
  if (!room || !room.timer) return;

  clearInterval(room.timer);
  clearTimeout(room.timer);
  room.timer = null;
}

function saveRoundWinner(roomId, { round, prompt, winnerSocketId, winnerUsername, winnerAvatar, strokes }) {
  const room = rooms[roomId];
  if (!room) return;

  room.roundHistory.push({ round, prompt, winnerSocketId, winnerUsername, winnerAvatar, strokes });
}

function getRoundHistory(roomId) {
  const room = rooms[roomId];
  return room ? room.roundHistory : [];
}

function updateRatingStats(roomId, socketId, ratingScore) {
  const room = rooms[roomId];
  if (!room || !room.playerStats[socketId]) return;

  room.playerStats[socketId].ratingSum += ratingScore;
  room.playerStats[socketId].roundsPlayed += 1;
}

function calculateAchievements(roomId) {
  const room = rooms[roomId];
  if (!room) return [];

  const achievements = [];
  const playerIds = Object.keys(room.players);
  if (playerIds.length === 0) return achievements;

  // Champion — highest total score
  let topScorer = null;
  let topScore = -1;
  for (const id of playerIds) {
    if (room.players[id].score > topScore) {
      topScore = room.players[id].score;
      topScorer = id;
    }
  }
  if (topScorer) {
    achievements.push({
      title: 'Champion',
      icon: 'crown',
      playerName: room.players[topScorer].username,
      avatar: room.players[topScorer].avatar,
      socketId: topScorer
    });
  }

  // Fan Favorite — most total votes received
  let topVoted = null;
  let topVotes = 0;
  for (const id of playerIds) {
    const votes = room.playerStats[id]?.totalVotesReceived || 0;
    if (votes > topVotes) {
      topVotes = votes;
      topVoted = id;
    }
  }
  if (topVoted && topVotes > 0) {
    achievements.push({
      title: 'Fan Favorite',
      icon: 'heart',
      playerName: room.players[topVoted].username,
      avatar: room.players[topVoted].avatar,
      socketId: topVoted
    });
  }

  // Picasso — highest average drawing rating
  let topRated = null;
  let topAvg = 0;
  for (const id of playerIds) {
    const stats = room.playerStats[id];
    if (stats && stats.roundsPlayed > 0) {
      const avg = stats.ratingSum / stats.roundsPlayed;
      if (avg > topAvg) {
        topAvg = avg;
        topRated = id;
      }
    }
  }
  if (topRated && topAvg > 0) {
    achievements.push({
      title: 'Picasso',
      icon: 'palette',
      playerName: room.players[topRated].username,
      avatar: room.players[topRated].avatar,
      socketId: topRated
    });
  }

  // Consistent — played every round
  for (const id of playerIds) {
    const stats = room.playerStats[id];
    if (stats && stats.roundsPlayed >= room.round && room.round >= 2) {
      achievements.push({
        title: 'Consistent',
        icon: 'target',
        playerName: room.players[id].username,
        avatar: room.players[id].avatar,
        socketId: id
      });
    }
  }

  return achievements;
}

function getGameSummary(roomId) {
  const room = rooms[roomId];
  if (!room) return null;

  const finalScores = Object.fromEntries(
    Object.entries(room.players).map(([id, p]) => [
      id,
      { username: p.username, score: p.score, avatar: p.avatar }
    ])
  );

  return {
    roundHistory: room.roundHistory,
    finalScores,
    achievements: calculateAchievements(roomId)
  };
}

function resetGame(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.round = 0;
  room.roundHistory = [];
  room.drawings = {};
  room.votes = {};
  room.currentPrompt = null;
  room.gameState = 'WAITING';

  // Reset scores and stats
  for (const id of Object.keys(room.players)) {
    room.players[id].score = 0;
    room.playerStats[id] = {
      totalVotesReceived: 0,
      ratingSum: 0,
      roundsPlayed: 0
    };
  }
}

module.exports = {
  getRoom,
  joinRoom,
  leaveRoom,
  getRoomState,
  storeStroke,
  clearPlayerDrawing,
  castVote,
  tallyVotes,
  resetRound,
  getAllDrawings,
  clearRoomTimer,
  saveRoundWinner,
  getRoundHistory,
  updateRatingStats,
  calculateAchievements,
  getGameSummary,
  resetGame
};
