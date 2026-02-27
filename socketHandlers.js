const {
  joinRoom,
  leaveRoom,
  getRoomState,
  getRoom,
  storeStroke,
  clearPlayerDrawing,
  castVote,
  clearRoomTimer,
  getGameSummary,
  resetGame
} = require('./roomManager');
const { startGame } = require('./gameLoop');

function registerHandlers(io, socket) {

  // --- Join Room ---
  socket.on('joinRoom', ({ username, roomId }, callback) => {
    if (!username?.trim() || !roomId?.trim()) {
      return callback?.({ error: 'Username and room ID are required' });
    }

    username = username.trim().slice(0, 20);
    roomId = roomId.trim().toLowerCase().slice(0, 20);

    // Leave any previous rooms
    const prevRooms = [...socket.rooms].filter(r => r !== socket.id);
    for (const prev of prevRooms) {
      socket.leave(prev);
      const updated = leaveRoom(prev, socket.id);
      if (updated) {
        io.to(prev).emit('roomUpdate', getRoomState(prev));
      }
    }

    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.username = username;

    joinRoom(roomId, socket.id, username);
    const state = getRoomState(roomId);

    // Notify all players in the room
    io.to(roomId).emit('roomUpdate', state);
    callback?.({ success: true, roomState: state, socketId: socket.id });
  });

  // --- Start Game (host only) ---
  socket.on('startGame', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = getRoom(roomId);
    if (!room) return;
    if (room.host !== socket.id) return;
    if (room.gameState !== 'WAITING') return;

    if (Object.keys(room.players).length < 2) {
      socket.emit('gameError', { message: 'Need at least 2 players' });
      return;
    }

    startGame(io, roomId);
  });

  // --- Drawing stroke ---
  socket.on('drawStroke', (stroke) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = getRoom(roomId);
    if (!room || room.gameState !== 'DRAWING') return;

    // Validate stroke shape
    if (!stroke?.points?.length || !stroke.color || !stroke.lineWidth) return;

    storeStroke(roomId, socket.id, stroke);
  });

  // --- Clear canvas ---
  socket.on('clearCanvas', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = getRoom(roomId);
    if (!room || room.gameState !== 'DRAWING') return;

    clearPlayerDrawing(roomId, socket.id);
  });

  // --- Vote ---
  socket.on('vote', ({ targetSocketId }, callback) => {
    const roomId = socket.data.roomId;
    if (!roomId) return callback?.({ success: false, error: 'Not in a room' });

    const result = castVote(roomId, socket.id, targetSocketId);
    callback?.(result);

    if (result.success) {
      const room = getRoom(roomId);
      if (room) {
        const totalPlayers = Object.keys(room.players).length;
        const totalVotes = Object.keys(room.votes).length;
        io.to(roomId).emit('voteUpdate', { totalVotes, totalPlayers });
      }
    }
  });

  // --- End Game (host only) ---
  socket.on('endGame', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = getRoom(roomId);
    if (!room) return;
    if (room.host !== socket.id) return;
    if (room.gameState !== 'WAITING') return;
    if (room.round < 1) return;

    clearRoomTimer(roomId);
    const summary = getGameSummary(roomId);

    io.to(roomId).emit('gameOver', summary);

    // Reset room for a fresh game
    resetGame(roomId);
    io.to(roomId).emit('roomUpdate', getRoomState(roomId));
  });

  // --- Disconnect ---
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = leaveRoom(roomId, socket.id);
    if (!room) return; // room was deleted (empty)

    io.to(roomId).emit('roomUpdate', getRoomState(roomId));

    // If game is active but fewer than 2 players remain, reset to WAITING
    const playerCount = Object.keys(room.players).length;
    if (playerCount < 2 && room.gameState !== 'WAITING') {
      clearRoomTimer(roomId);
      room.gameState = 'WAITING';
      room.drawings = {};
      room.votes = {};
      room.currentPrompt = null;

      io.to(roomId).emit('gameStateChange', {
        gameState: 'WAITING',
        players: room.players,
        host: room.host
      });
    }
  });
}

module.exports = { registerHandlers };
