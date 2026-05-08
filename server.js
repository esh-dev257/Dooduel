const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { registerHandlers } = require('./socketHandlers');
const { startRoomCleaner, stopRoomCleaner } = require('./roomManager');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? false
      : (origin, cb) => cb(null, true), // allow any localhost port in dev
    methods: ['GET', 'POST']
  }
});

// Serve React build in production
app.use(express.static(path.join(__dirname, 'client', 'build')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// SPA fallback (Express 5 wildcard syntax)
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'build', 'index.html'));
});

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);
  registerHandlers(io, socket);
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Clean stale rooms every 60 seconds
  startRoomCleaner(60000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received — shutting down');
  stopRoomCleaner();
  io.close();
  server.close(() => process.exit(0));
});
process.on('SIGINT', () => {
  console.log('SIGINT received — shutting down');
  stopRoomCleaner();
  io.close();
  server.close(() => process.exit(0));
});
