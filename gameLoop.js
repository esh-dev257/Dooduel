const {
  getRoom,
  getAnonymousDrawings,
  tallyVotes,
  resetRound,
  getRoomState,
  clearRoomTimer,
  saveRoundWinner,
  updateRatingStats,
  getGameSummary,
  resetGame
} = require('./roomManager');
const { getPromptForRound } = require('./prompts');
const { rateDrawing } = require('./rateDrawing');

const MAX_ROUNDS = 3;
const VOTING_DURATION = 20;
const RESULT_DURATION = 8;
const GAME_OVER_DELAY = 20; // Extra time for final round results

function startGame(io, roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  if (Object.keys(room.players).length < 2) return;

  // Reset for a fresh 3-round game
  if (room.round === 0) {
    room.roundHistory = [];
    for (const id of Object.keys(room.players)) {
      room.players[id].score = 0;
      if (room.playerStats[id]) {
        room.playerStats[id].totalVotesReceived = 0;
        room.playerStats[id].ratingSum = 0;
        room.playerStats[id].roundsPlayed = 0;
      }
    }
  }

  room.round += 1;
  console.log(`[${roomId}] Game started — Round ${room.round}/${MAX_ROUNDS}`);
  startDrawingPhase(io, roomId);
}

function startDrawingPhase(io, roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  clearRoomTimer(roomId);

  // Verify enough players
  if (Object.keys(room.players).length < 2) {
    room.gameState = 'WAITING';
    io.to(roomId).emit('gameStateChange', {
      gameState: 'WAITING',
      players: room.players,
      host: room.host
    });
    return;
  }

  const { prompt, difficulty, duration } = getPromptForRound(room.round);

  room.gameState = 'DRAWING';
  room.currentPrompt = prompt;
  room.drawings = {};
  room.votes = {};

  console.log(`[${roomId}] DRAWING phase — "${prompt}" (${difficulty}, ${duration}s)`);

  io.to(roomId).emit('gameStateChange', {
    gameState: 'DRAWING',
    prompt,
    difficulty,
    duration,
    round: room.round,
    totalRounds: MAX_ROUNDS
  });

  let remaining = duration;

  room.timer = setInterval(() => {
    remaining -= 1;
    io.to(roomId).emit('timerTick', { remaining });

    if (remaining <= 0) {
      clearInterval(room.timer);
      room.timer = null;
      room.timerType = null;
      startVotingPhase(io, roomId);
    }
  }, 1000);
  room.timerType = 'interval';
}

function startVotingPhase(io, roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  clearRoomTimer(roomId);

  room.gameState = 'VOTING';

  // Get anonymous drawings (shuffled, no usernames/avatars)
  const anonDrawings = getAnonymousDrawings(roomId);

  // Skip voting if nobody drew anything
  if (Object.keys(anonDrawings).length === 0) {
    startResultPhase(io, roomId);
    return;
  }

  console.log(`[${roomId}] VOTING phase — ${Object.keys(anonDrawings).length} drawings`);

  // Send per-player to include their own anonId
  for (const socketId of Object.keys(room.players)) {
    const yourAnonId = room.anonReverseMap?.[socketId] || null;
    io.to(socketId).emit('gameStateChange', {
      gameState: 'VOTING',
      drawings: anonDrawings,
      yourAnonId,
      duration: VOTING_DURATION
    });
  }

  let remaining = VOTING_DURATION;

  room.timer = setInterval(() => {
    remaining -= 1;
    io.to(roomId).emit('timerTick', { remaining });

    if (remaining <= 0) {
      clearInterval(room.timer);
      room.timer = null;
      room.timerType = null;
      startResultPhase(io, roomId);
    }
  }, 1000);
  room.timerType = 'interval';
}

// Called when all players vote early
function advanceToResults(io, roomId) {
  const room = getRoom(roomId);
  if (!room || room.gameState !== 'VOTING') return;

  console.log(`[${roomId}] All players voted — advancing early`);
  clearRoomTimer(roomId);
  startResultPhase(io, roomId);
}

function startResultPhase(io, roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  clearRoomTimer(roomId);
  room.gameState = 'RESULT';

  console.log(`[${roomId}] RESULT phase — Round ${room.round}`);

  // STEP 1: Tally votes → 100 pts per vote received, get tied top candidates
  const { voteCounts, topCandidates, maxVotes } = tallyVotes(roomId);

  // STEP 2: Rate every drawing → quality bonus (score × 10, max 100 pts each)
  const ratings = {};
  for (const [socketId, strokes] of Object.entries(room.drawings)) {
    if (room.players[socketId]) {
      const rating = rateDrawing(strokes);
      ratings[socketId] = { username: room.players[socketId].username, ...rating };
      room.players[socketId].score += Math.round(rating.score * 10);
      updateRatingStats(roomId, socketId, rating.score);
    }
  }

  // STEP 3: Resolve the round winner
  //   Primary   — most votes
  //   Tiebreaker — highest quality rating among tied vote leaders
  //   All-skip  — highest quality rating across all players
  //   True tie  — both conditions equal → co-winners, both get bonus
  let resolvedWinners = [];

  if (maxVotes > 0) {
    if (topCandidates.length === 1) {
      resolvedWinners = topCandidates;
    } else {
      // Break vote tie with quality rating
      let maxQuality = -1;
      for (const c of topCandidates) {
        const q = ratings[c.socketId]?.score ?? 0;
        if (q > maxQuality) maxQuality = q;
      }
      resolvedWinners = topCandidates.filter(
        c => (ratings[c.socketId]?.score ?? 0) === maxQuality
      );
    }
  } else {
    // All-skip: quality rating decides
    let maxQuality = -1;
    for (const [sid, r] of Object.entries(ratings)) {
      if (room.players[sid] && r.score > maxQuality) maxQuality = r.score;
    }
    if (maxQuality > 0) {
      resolvedWinners = Object.entries(ratings)
        .filter(([sid, r]) => room.players[sid] && r.score === maxQuality)
        .map(([sid]) => ({
          socketId: sid,
          username: room.players[sid].username,
          avatar:   room.players[sid].avatar || null,
          votes:    0
        }));
    }
  }

  // STEP 4: Award winner bonus (200 pts — makes votes clearly the dominant factor)
  for (const w of resolvedWinners) {
    if (room.players[w.socketId]) {
      room.players[w.socketId].score += 200;
    }
  }

  // STEP 5: Build results snapshot AFTER all bonuses are applied
  const results = {
    winners:    resolvedWinners,
    voteCounts,
    scores: Object.fromEntries(
      Object.entries(room.players).map(([id, p]) => [
        id, { username: p.username, score: p.score, avatar: p.avatar }
      ])
    )
  };

  // STEP 6: Save round winner for game summary collage
  if (resolvedWinners.length > 0) {
    const w = resolvedWinners[0];
    saveRoundWinner(roomId, {
      round:           room.round,
      prompt:          room.currentPrompt,
      winnerSocketId:  w.socketId,
      winnerUsername:  w.username,
      winnerAvatar:    room.players[w.socketId]?.avatar || null,
      strokes:         room.drawings[w.socketId] || []
    });
  }

  // Broadcast updated scores to sidebar immediately
  io.to(roomId).emit('roomUpdate', getRoomState(roomId));

  const isFinalRound = room.round >= MAX_ROUNDS;
  const resultDuration = isFinalRound ? GAME_OVER_DELAY : RESULT_DURATION;

  io.to(roomId).emit('gameStateChange', {
    gameState: 'RESULT',
    results,
    ratings,
    duration: resultDuration,
    round: room.round,
    totalRounds: MAX_ROUNDS,
    isFinalRound
  });

  // Timer ticks for result phase countdown
  let resultRemaining = resultDuration;
  const resultTick = setInterval(() => {
    resultRemaining -= 1;
    io.to(roomId).emit('timerTick', { remaining: resultRemaining });
    if (resultRemaining <= 0) clearInterval(resultTick);
  }, 1000);

  room.timer = setTimeout(() => {
    clearInterval(resultTick);
    room.timer = null;
    room.timerType = null;
    resetRound(roomId);

    if (isFinalRound) {
      const summary = getGameSummary(roomId);
      io.to(roomId).emit('gameOver', summary);
      resetGame(roomId);
    } else {
      const currentRoom = getRoom(roomId);
      if (!currentRoom || Object.keys(currentRoom.players).length < 2) {
        if (currentRoom) {
          currentRoom.gameState = 'WAITING';
          io.to(roomId).emit('gameStateChange', {
            gameState: 'WAITING',
            players: currentRoom.players,
            host: currentRoom.host
          });
        }
        return;
      }
      currentRoom.round += 1;
      startDrawingPhase(io, roomId);
    }
  }, resultDuration * 1000);
  room.timerType = 'timeout';
}

module.exports = { startGame, advanceToResults };
