import React, { useState, useEffect } from 'react';
import socket from '../socket';
import './JoinRoom.css';

function JoinRoom({ onJoin }) {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  // Auto-fill room code from URL ?room= parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setRoomId(room.trim().toLowerCase().slice(0, 20));
    }
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim() || !roomId.trim()) {
      setError('Both fields are required');
      return;
    }

    setJoining(true);
    setError('');

    if (!socket.connected) {
      socket.connect();
    }

    // Wait for connection before emitting
    const emitJoin = () => {
      socket.emit('joinRoom', {
        username: username.trim(),
        roomId: roomId.trim()
      }, (response) => {
        setJoining(false);
        if (response.error) {
          setError(response.error);
          return;
        }
        onJoin(response.roomState, response.socketId, roomId.trim().toLowerCase());
      });
    };

    if (socket.connected) {
      emitJoin();
    } else {
      socket.once('connect', emitJoin);
      // Timeout if connection fails
      setTimeout(() => {
        if (!socket.connected) {
          setJoining(false);
          setError('Could not connect to server');
          socket.off('connect', emitJoin);
        }
      }, 5000);
    }
  };

  return (
    <div className="join-room">
      <div className="join-card">
        <h2>Join a Room</h2>
        <p className="join-subtitle">Enter a room code to join or create a new game</p>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="text"
              placeholder="Your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              autoFocus
              disabled={joining}
            />
          </div>
          <div className="input-group">
            <input
              type="text"
              placeholder="Room code"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              maxLength={20}
              disabled={joining}
            />
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button type="submit" disabled={joining} className="join-btn">
            {joining ? 'Connecting...' : 'Join Game'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default JoinRoom;
