import React, { useState, useEffect } from 'react';
import socket from '../socket';
import './JoinRoom.css';

const AVATARS = [
  { id: 0, emoji: '👾', color: '#6600cc' },
  { id: 1, emoji: '🤖', color: '#E53935' },
  { id: 2, emoji: '👻', color: '#00897B' },
  { id: 3, emoji: '🦊', color: '#FF8800' },
  { id: 4, emoji: '🐱', color: '#AA00AA' },
  { id: 5, emoji: '🌟', color: '#1565C0' },
];

function JoinRoom({ onJoin }) {
  const [username,  setUsername]  = useState('');
  const [roomId,    setRoomId]    = useState('');
  const [error,     setError]     = useState('');
  const [joining,   setJoining]   = useState(false);
  const [avatarIdx, setAvatarIdx] = useState(0);

  /* Auto-fill room from URL ?room= */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) setRoomId(room.trim().toLowerCase().slice(0, 20));
  }, []);

  /* Restore last-used avatar + username */
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('dooduel_stats') || '{}');
      if (saved.avatarIdx !== undefined) setAvatarIdx(saved.avatarIdx);
      if (saved.username) setUsername(saved.username);
    } catch {}
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim() || !roomId.trim()) {
      setError('Both fields are required');
      return;
    }

    setJoining(true);
    setError('');

    if (!socket.connected) socket.connect();

    const selectedAvatar = AVATARS[avatarIdx];

    const emitJoin = () => {
      socket.emit('joinRoom', {
        username: username.trim(),
        roomId:   roomId.trim(),
        avatar:   { emoji: selectedAvatar.emoji, color: selectedAvatar.color },
      }, (response) => {
        setJoining(false);
        if (response.error) { setError(response.error); return; }

        try {
          const prev = JSON.parse(localStorage.getItem('dooduel_stats') || '{}');
          localStorage.setItem('dooduel_stats', JSON.stringify({
            ...prev,
            username: username.trim(),
            avatarIdx,
          }));
        } catch {}

        onJoin(response.roomState, response.socketId, roomId.trim().toLowerCase());
      });
    };

    if (socket.connected) {
      emitJoin();
    } else {
      socket.once('connect', emitJoin);
      setTimeout(() => {
        if (!socket.connected) {
          setJoining(false);
          setError('Could not connect to server');
          socket.off('connect', emitJoin);
        }
      }, 5000);
    }
  };

  const selectedAvatar = AVATARS[avatarIdx];

  return (
    <div className="join-room">
      <div className="join-card">
        <div className="join-topbar">
          <span className="join-title-text">DOO<span>DUEL</span></span>
          <span className="join-chip-g">LIVE</span>
          <span className="join-chip-y">FREE</span>
        </div>

        <div className="join-body">
          {/* Hero: heading + selected avatar preview */}
          <div className="join-hero">
            <div className="join-hero-text">
              <div className="join-heading">READY,<br />PLAYER 1?</div>
              <div className="join-sub">draw it · guess it · win it</div>
            </div>
            <div className="join-char-preview" style={{ backgroundColor: selectedAvatar.color }}>
              <span className="join-char-emoji">{selectedAvatar.emoji}</span>
            </div>
          </div>

          {/* Avatar picker */}
          <div className="avatar-section-label">CHOOSE YOUR FIGHTER</div>
          <div className="avatar-grid">
            {AVATARS.map((av, i) => (
              <button
                key={av.id}
                type="button"
                className={`avatar-opt${i === avatarIdx ? ' sel' : ''}`}
                style={{ backgroundColor: av.color }}
                onClick={() => setAvatarIdx(i)}
              >
                <span className="avatar-emoji">{av.emoji}</span>
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="join-form">
            <input
              className="px-field"
              type="text"
              placeholder="YOUR NAME"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              autoFocus
              disabled={joining}
            />
            <input
              className="px-field"
              type="text"
              placeholder="ROOM CODE"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              maxLength={20}
              disabled={joining}
            />
            {error && <div className="join-error">{error}</div>}
            <button type="submit" disabled={joining} className="join-btn-play">
              {joining ? 'CONNECTING...' : '▶ JOIN GAME'}
            </button>
          </form>

          <div className="join-or-row">
            <div className="join-or-line" /><span className="join-or-txt">- OR -</span><div className="join-or-line" />
          </div>
          <button
            type="button"
            className="join-btn-create"
            disabled={joining}
            onClick={() => {
              const code = Math.random().toString(36).slice(2, 6).toUpperCase();
              setRoomId(code);
            }}
          >
            + CREATE PRIVATE ROOM
          </button>
        </div>
      </div>
    </div>
  );
}

export default JoinRoom;
