const {
  getRoom,
  getAllDrawings,
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
  startDrawingPhase(io, roomId);
}

function startDrawingPhase(io, roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  clearRoomTimer(roomId);

  const { prompt, difficulty, duration } = getPromptForRound(room.round);

  room.gameState = 'DRAWING';
  room.currentPrompt = prompt;
  room.drawings = {};
  room.votes = {};

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
      startVotingPhase(io, roomId);
    }
  }, 1000);
}

function startVotingPhase(io, roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  clearRoomTimer(roomId);

  room.gameState = 'VOTING';
  const drawings = getAllDrawings(roomId);

  // Skip voting if nobody drew anything
  if (Object.keys(drawings).length === 0) {
    startResultPhase(io, roomId);
    return;
  }

  io.to(roomId).emit('gameStateChange', {
    gameState: 'VOTING',
    drawings,
    duration: VOTING_DURATION
  });

  let remaining = VOTING_DURATION;

  room.timer = setInterval(() => {
    remaining -= 1;
    io.to(roomId).emit('timerTick', { remaining });

    if (remaining <= 0) {
      clearInterval(room.timer);
      room.timer = null;
      startResultPhase(io, roomId);
    }
  }, 1000);
}

function startResultPhase(io, roomId) {
  const room = getRoom(roomId);
  if (!room) return;

  clearRoomTimer(roomId);

  room.gameState = 'RESULT';
  const results = tallyVotes(roomId);

  // Rate each player's drawing and award bonus points
  const ratings = {};
  for (const [socketId, strokes] of Object.entries(room.drawings)) {
    if (room.players[socketId]) {
      const rating = rateDrawing(strokes);
      ratings[socketId] = {
        username: room.players[socketId].username,
        ...rating
      };
      const bonus = Math.round(rating.score * 10);
      room.players[socketId].score += bonus;
      if (results?.scores?.[socketId]) {
        results.scores[socketId].score = room.players[socketId].score;
      }
      updateRatingStats(roomId, socketId, rating.score);
    }
  }

  // Save round winner to history for game summary collage
  if (results?.winners?.length > 0) {
    const winner = results.winners[0];
    const winnerStrokes = room.drawings[winner.socketId] || [];
    saveRoundWinner(roomId, {
      round: room.round,
      prompt: room.currentPrompt,
      winnerSocketId: winner.socketId,
      winnerUsername: winner.username,
      winnerAvatar: room.players[winner.socketId]?.avatar || null,
      strokes: winnerStrokes
    });
  }

  // Broadcast updated scores to sidebar immediately
  io.to(roomId).emit('roomUpdate', getRoomState(roomId));

  const isFinalRound = room.round >= MAX_ROUNDS;

  io.to(roomId).emit('gameStateChange', {
    gameState: 'RESULT',
    results,
    ratings,
    duration: RESULT_DURATION,
    round: room.round,
    totalRounds: MAX_ROUNDS,
    isFinalRound
  });

  // After result display
  room.timer = setTimeout(() => {
    room.timer = null;
    resetRound(roomId);

    if (isFinalRound) {
      // Game over — send summary then reset server state
      // Don't emit roomUpdate here; it would override GAME_OVER with WAITING
      const summary = getGameSummary(roomId);
      io.to(roomId).emit('gameOver', summary);
      resetGame(roomId);
    } else {
      // Auto-start next round
      room.round += 1;
      startDrawingPhase(io, roomId);
    }
  }, RESULT_DURATION * 1000);
}

module.exports = { startGame };
