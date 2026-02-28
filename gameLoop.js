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
  const results = tallyVotes(roomId);

  console.log(`[${roomId}] RESULT phase — Round ${room.round}`);

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
    if (resultRemaining <= 0) {
      clearInterval(resultTick);
    }
  }, 1000);

  // After result display
  room.timer = setTimeout(() => {
    clearInterval(resultTick);
    room.timer = null;
    room.timerType = null;
    resetRound(roomId);

    if (isFinalRound) {
      // Game over — send summary then reset server state
      const summary = getGameSummary(roomId);
      io.to(roomId).emit('gameOver', summary);
      resetGame(roomId);
    } else {
      // Verify enough players before next round
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
      // Auto-start next round
      currentRoom.round += 1;
      startDrawingPhase(io, roomId);
    }
  }, resultDuration * 1000);
  room.timerType = 'timeout';
}

module.exports = { startGame, advanceToResults };
