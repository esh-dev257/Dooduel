const {
  joinRoom,
  leaveRoom,
  disconnectPlayer,
  getRoomState,
  getRoom,
  storeStroke,
  storeFillAction,
  clearPlayerDrawing,
  castAnonVote,
  clearRoomTimer,
  getGameSummary,
  resetGame,
  addChatMessage
} = require('./roomManager');
const { startGame, advanceToResults } = require('./gameLoop');

// Per-socket rate limiting
const rateLimits = new Map();

function getRateLimit(socketId) {
  if (!rateLimits.has(socketId)) {
    rateLimits.set(socketId, { drawCount: 0, chatCount: 0, lastReset: Date.now() });
  }
  const rl = rateLimits.get(socketId);
  const now = Date.now();
  // Reset counters every second
  if (now - rl.lastReset >= 1000) {
    rl.drawCount = 0;
    rl.chatCount = 0;
    rl.lastReset = now;
  }
  return rl;
}

function checkDrawRate(socketId) {
  const rl = getRateLimit(socketId);
  if (rl.drawCount >= 60) return false; // Max 60 draw events/sec
  rl.drawCount++;
  return true;
}

function checkChatRate(socketId) {
  const rl = getRateLimit(socketId);
  if (rl.chatCount >= 1) return false; // Max 1 chat message/sec
  rl.chatCount++;
  return true;
}

function registerHandlers(io, socket) {

  // --- Join Room ---
  socket.on('joinRoom', ({ username, roomId, avatar }, callback) => {
    if (!username?.trim() || !roomId?.trim()) {
      return callback?.({ error: 'Username and room ID are required' });
    }

    username = username.trim().slice(0, 20);
    roomId = roomId.trim().toLowerCase().slice(0, 20);

    // Sanitise avatar from client
    let clientAvatar = null;
    if (avatar && (avatar.url || avatar.emoji || avatar.color)) {
      clientAvatar = {
        emoji: String(avatar.emoji || '').slice(0, 8),
        color: String(avatar.color || '#444').slice(0, 20),
        url:   avatar.url ? String(avatar.url).slice(0, 100) : null,
      };
    }

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

    const { room, error } = joinRoom(roomId, socket.id, username, clientAvatar);
    if (error) {
      socket.leave(roomId);
      socket.data.roomId = null;
      return callback?.({ error });
    }

    const state = getRoomState(roomId);

    // Notify all players in the room
    io.to(roomId).emit('roomUpdate', state);

    // Emit join notification
    const joinedPlayer = room.players[socket.id];
    io.to(roomId).emit('playerJoined', {
      username: username,
      avatar: joinedPlayer?.avatar || null,
      socketId: socket.id
    });

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

  // --- Drawing stroke (final, stores on server) ---
  socket.on('drawStroke', (stroke) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    if (!checkDrawRate(socket.id)) return;

    const room = getRoom(roomId);
    if (!room || room.gameState !== 'DRAWING') return;

    // Validate stroke shape
    if (!stroke?.points?.length || !stroke.color || !stroke.lineWidth) return;

    storeStroke(roomId, socket.id, stroke);
  });


  // --- Flood fill action ---
  socket.on('fillAction', (action) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = getRoom(roomId);
    if (!room || room.gameState !== 'DRAWING') return;

    if (typeof action?.x !== 'number' || typeof action?.y !== 'number' || !action?.color) return;

    storeFillAction(roomId, socket.id, action);
  });

  // --- Clear canvas ---
  socket.on('clearCanvas', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = getRoom(roomId);
    if (!room || room.gameState !== 'DRAWING') return;

    clearPlayerDrawing(roomId, socket.id);
  });

  // --- Vote (anonymous) ---
  socket.on('vote', ({ anonId }, callback) => {
    const roomId = socket.data.roomId;
    if (!roomId) return callback?.({ success: false, error: 'Not in a room' });

    const result = castAnonVote(roomId, socket.id, anonId);
    callback?.(result);

    if (result.success) {
      const room = getRoom(roomId);
      if (room) {
        const totalPlayers = Object.keys(room.players).length;
        const totalVotes = Object.keys(room.votes).length;
        io.to(roomId).emit('voteUpdate', { totalVotes, totalPlayers });

        // All players voted — advance early
        if (totalVotes >= totalPlayers) {
          advanceToResults(io, roomId);
        }
      }
    }
  });

  // --- Chat message ---
  socket.on('chatMessage', ({ text }, callback) => {
    const roomId = socket.data.roomId;
    if (!roomId) return callback?.({ error: 'Not in a room' });

    if (!text?.trim()) return callback?.({ error: 'Empty message' });

    if (!checkChatRate(socket.id)) {
      return callback?.({ error: 'Slow down! 1 message per second.' });
    }

    const message = addChatMessage(roomId, socket.id, text);
    if (!message) return callback?.({ error: 'Failed to send' });

    io.to(roomId).emit('chatMessage', message);
    callback?.({ success: true });
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

  // --- Disconnect (move to reconnection pool) ---
  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    // Clean up rate limits
    rateLimits.delete(socket.id);

    // Capture player info before disconnect removes them
    const roomBefore = getRoom(roomId);
    const leavingPlayer = roomBefore?.players[socket.id];
    const leavingUsername = leavingPlayer?.username || socket.data.username || 'A player';
    const leavingAvatar = leavingPlayer?.avatar || null;

    const room = disconnectPlayer(roomId, socket.id);
    if (!room) return; // room was deleted (empty)

    io.to(roomId).emit('roomUpdate', getRoomState(roomId));

    // Emit leave notification
    io.to(roomId).emit('playerLeft', {
      username: leavingUsername,
      avatar: leavingAvatar,
      socketId: socket.id
    });

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

    // Broadcast updated vote count if in voting phase
    if (room.gameState === 'VOTING') {
      const totalPlayers = Object.keys(room.players).length;
      const totalVotes = Object.keys(room.votes).length;
      io.to(roomId).emit('voteUpdate', { totalVotes, totalPlayers });
    }
  });
}

module.exports = { registerHandlers };
