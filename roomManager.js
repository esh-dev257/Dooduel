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
    skips: new Set(),
    round: 0,
    timer: null,
    timerType: null, // 'interval' | 'timeout'
    roundHistory: [],
    playerStats: {},
    chatHistory: [],
    lastActivity: Date.now(),
    anonMap: null,       // { anonId → realSocketId } set during voting
    anonReverseMap: null, // { realSocketId → anonId }
    disconnectedPlayers: {} // { socketId → { player, stats, timeout } }
  };
  return rooms[roomId];
}

function getRoom(roomId) {
  return rooms[roomId] || null;
}

function joinRoom(roomId, socketId, username, clientAvatar = null) {
  let room = rooms[roomId];
  if (!room) {
    room = createRoom(roomId);
  }

  room.lastActivity = Date.now();

  // Check for duplicate username
  const usernames = Object.values(room.players).map(p => p.username.toLowerCase());
  if (usernames.includes(username.toLowerCase())) {
    return { room: null, error: 'Username already taken in this room' };
  }

  // Check if this is a reconnecting player
  let avatar;
  let score = 0;
  let stats = null;
  const disconnectedEntry = Object.entries(room.disconnectedPlayers).find(
    ([, data]) => data.player.username.toLowerCase() === username.toLowerCase()
  );
  if (disconnectedEntry) {
    const [oldSocketId, data] = disconnectedEntry;
    // Restore avatar, score, and stats from disconnected session
    avatar = data.player.avatar;
    score = data.player.score;
    stats = data.stats;
    clearTimeout(data.timeout);
    delete room.disconnectedPlayers[oldSocketId];
  } else {
    avatar = clientAvatar || assignAvatar(room.players);
  }

  room.players[socketId] = { username, score, avatar };

  room.playerStats[socketId] = stats || room.playerStats[socketId] || {
    totalVotesReceived: 0,
    ratingSum: 0,
    roundsPlayed: 0
  };

  // First player becomes host
  if (!room.host || !room.players[room.host]) {
    room.host = socketId;
  }

  return { room, error: null };
}

// Move player to disconnected pool instead of immediate removal
function disconnectPlayer(roomId, socketId) {
  const room = rooms[roomId];
  if (!room || !room.players[socketId]) return null;

  const player = { ...room.players[socketId] };
  const stats = room.playerStats[socketId] ? { ...room.playerStats[socketId] } : null;

  // Set a 30-second timeout for permanent removal
  const timeout = setTimeout(() => {
    finalizeLeave(roomId, socketId);
  }, 30000);

  room.disconnectedPlayers[socketId] = { player, stats, timeout };

  // Remove from active players
  delete room.players[socketId];
  delete room.drawings[socketId];
  delete room.votes[socketId];

  // Remove votes cast FOR this player
  for (const [voter, votedFor] of Object.entries(room.votes)) {
    if (votedFor === socketId) {
      delete room.votes[voter];
    }
  }

  const playerCount = Object.keys(room.players).length;

  // Clean up empty rooms (no active or disconnected players)
  if (playerCount === 0 && Object.keys(room.disconnectedPlayers).length === 0) {
    clearRoomTimer(roomId);
    // Clear all disconnect timeouts
    for (const data of Object.values(room.disconnectedPlayers)) {
      clearTimeout(data.timeout);
    }
    delete rooms[roomId];
    return null;
  }

  // Reassign host if the host left
  if (room.host === socketId) {
    room.host = Object.keys(room.players)[0] || null;
  }

  return room;
}

// Permanent removal after reconnection timeout
function finalizeLeave(roomId, socketId) {
  const room = rooms[roomId];
  if (!room) return;

  if (room.disconnectedPlayers[socketId]) {
    clearTimeout(room.disconnectedPlayers[socketId].timeout);
    delete room.disconnectedPlayers[socketId];
  }
  delete room.playerStats[socketId];

  // Clean up empty rooms
  const playerCount = Object.keys(room.players).length;
  if (playerCount === 0 && Object.keys(room.disconnectedPlayers).length === 0) {
    clearRoomTimer(roomId);
    delete rooms[roomId];
  }
}

// Legacy leaveRoom for immediate removal (used by explicit leave)
function leaveRoom(roomId, socketId) {
  const room = rooms[roomId];
  if (!room) return null;

  // Clear any pending reconnection timeout
  if (room.disconnectedPlayers[socketId]) {
    clearTimeout(room.disconnectedPlayers[socketId].timeout);
    delete room.disconnectedPlayers[socketId];
  }

  delete room.players[socketId];
  delete room.drawings[socketId];
  delete room.playerStats[socketId];

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
  if (playerCount === 0 && Object.keys(room.disconnectedPlayers).length === 0) {
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

  room.lastActivity = Date.now();

  if (!room.drawings[socketId]) {
    room.drawings[socketId] = [];
  }
  room.drawings[socketId].push(stroke);
}

function storeFillAction(roomId, socketId, fillAction) {
  const room = rooms[roomId];
  if (!room || room.gameState !== 'DRAWING') return;

  room.lastActivity = Date.now();

  if (!room.drawings[socketId]) {
    room.drawings[socketId] = [];
  }
  // Store as special stroke entry
  room.drawings[socketId].push({
    type: 'fill',
    x: fillAction.x,
    y: fillAction.y,
    color: fillAction.color
  });
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

  room.lastActivity = Date.now();
  room.votes[voterSocketId] = targetSocketId;
  return { success: true };
}

// Anonymous vote: resolves anonId to real socketId, then casts vote
function castAnonVote(roomId, voterSocketId, anonId) {
  const room = rooms[roomId];
  if (!room) return { success: false, error: 'Room not found' };
  if (!room.anonMap || !room.anonMap[anonId]) {
    return { success: false, error: 'Invalid drawing' };
  }

  const targetSocketId = room.anonMap[anonId];
  return castVote(roomId, voterSocketId, targetSocketId);
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

// Fisher-Yates shuffle
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Returns anonymized drawings with labels, stores mapping on room
function getAnonymousDrawings(roomId) {
  const room = rooms[roomId];
  if (!room) return {};

  const entries = Object.entries(room.drawings).filter(
    ([socketId]) => room.players[socketId]
  );

  // Shuffle entries for random order
  shuffle(entries);

  const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const anonDrawings = {};
  const anonMap = {};       // anonId → realSocketId
  const anonReverseMap = {}; // realSocketId → anonId

  entries.forEach(([socketId, strokes], i) => {
    const anonId = `anon_${i}`;
    const label = `Drawing ${labels[i] || (i + 1)}`;
    anonDrawings[anonId] = { label, strokes };
    anonMap[anonId] = socketId;
    anonReverseMap[socketId] = anonId;
  });

  // Store mapping on room for vote resolution
  room.anonMap = anonMap;
  room.anonReverseMap = anonReverseMap;

  return anonDrawings;
}

function recordSkip(roomId, socketId) {
  const room = rooms[roomId];
  if (!room) return false;
  if (room.gameState !== 'VOTING') return false;
  if (room.skips.has(socketId)) return false;
  if (room.votes[socketId]) return false;
  room.skips.add(socketId);
  room.lastActivity = Date.now();
  return true;
}

function allPlayersActed(roomId) {
  const room = rooms[roomId];
  if (!room) return false;
  const totalActed = Object.keys(room.votes).length + room.skips.size;
  const totalPlayers = Object.keys(room.players).length;
  return totalPlayers > 0 && totalActed >= totalPlayers;
}

function getVoteInfo(roomId) {
  const room = rooms[roomId];
  if (!room) return { totalVotes: 0, totalPlayers: 0 };
  const totalActed = Object.keys(room.votes).length + room.skips.size;
  const totalPlayers = Object.keys(room.players).length;
  return { totalVotes: totalActed, totalPlayers };
}

function resetRound(roomId) {
  const room = rooms[roomId];
  if (!room) return;

  room.drawings = {};
  room.votes = {};
  room.skips = new Set();
  room.currentPrompt = null;
  room.anonMap = null;
  room.anonReverseMap = null;
}

function clearRoomTimer(roomId) {
  const room = rooms[roomId];
  if (!room || !room.timer) return;

  if (room.timerType === 'interval') {
    clearInterval(room.timer);
  } else {
    clearTimeout(room.timer);
  }
  room.timer = null;
  room.timerType = null;
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
  room.skips = new Set();
  room.currentPrompt = null;
  room.gameState = 'WAITING';
  room.anonMap = null;
  room.anonReverseMap = null;

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

// Stale room sweeper — removes rooms inactive for 30+ minutes
let cleanerInterval = null;
function startRoomCleaner(intervalMs = 60000) {
  cleanerInterval = setInterval(() => {
    const now = Date.now();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    for (const roomId of Object.keys(rooms)) {
      const room = rooms[roomId];
      if (now - room.lastActivity > staleThreshold) {
        console.log(`[RoomCleaner] Removing stale room: ${roomId}`);
        clearRoomTimer(roomId);
        // Clear disconnect timeouts
        for (const data of Object.values(room.disconnectedPlayers)) {
          clearTimeout(data.timeout);
        }
        delete rooms[roomId];
      }
    }
  }, intervalMs);
}

function stopRoomCleaner() {
  if (cleanerInterval) {
    clearInterval(cleanerInterval);
    cleanerInterval = null;
  }
}

// Add chat message to room history
function addChatMessage(roomId, socketId, text) {
  const room = rooms[roomId];
  if (!room || !room.players[socketId]) return null;

  const message = {
    socketId,
    username: room.players[socketId].username,
    avatar: room.players[socketId].avatar,
    text: text.trim().slice(0, 200),
    timestamp: Date.now()
  };

  room.chatHistory.push(message);
  // Keep last 100 messages
  if (room.chatHistory.length > 100) {
    room.chatHistory = room.chatHistory.slice(-100);
  }

  return message;
}

module.exports = {
  getRoom,
  joinRoom,
  leaveRoom,
  disconnectPlayer,
  getRoomState,
  storeStroke,
  storeFillAction,
  clearPlayerDrawing,
  castVote,
  castAnonVote,
  tallyVotes,
  recordSkip,
  allPlayersActed,
  getVoteInfo,
  resetRound,
  getAllDrawings,
  getAnonymousDrawings,
  clearRoomTimer,
  saveRoundWinner,
  getRoundHistory,
  updateRatingStats,
  calculateAchievements,
  getGameSummary,
  resetGame,
  startRoomCleaner,
  stopRoomCleaner,
  addChatMessage
};
