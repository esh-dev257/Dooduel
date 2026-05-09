import React, { useState, useEffect } from 'react';
import socket from '../socket';

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
  const [shake,     setShake]     = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) setRoomId(room.trim().toLowerCase().slice(0, 20));
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('dooduel_stats') || '{}');
      if (saved.avatarIdx !== undefined) setAvatarIdx(saved.avatarIdx);
      if (saved.username) setUsername(saved.username);
    } catch {}
  }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!username.trim() || !roomId.trim()) {
      setError('BOTH FIELDS ARE REQUIRED');
      triggerShake();
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
        if (response.error) {
          setError(response.error.toUpperCase());
          triggerShake();
          return;
        }
        try {
          const prev = JSON.parse(localStorage.getItem('dooduel_stats') || '{}');
          localStorage.setItem('dooduel_stats', JSON.stringify({ ...prev, username: username.trim(), avatarIdx }));
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
          setError('COULD NOT CONNECT TO SERVER');
          triggerShake();
          socket.off('connect', emitJoin);
        }
      }, 5000);
    }
  };

  const selectedAvatar = AVATARS[avatarIdx];

  return (
    <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
      <div
        className={`pixel-card max-w-[520px] w-full ${shake ? 'animate-shake' : ''}`}
        style={{ position: 'relative', zIndex: 2 }}
      >
        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b-4 border-pixel-border bg-pixel-bgdark">
          <span className="font-pixel text-xs text-pixel-gold">DOO<span className="text-pixel-pink">DUEL</span></span>
        </div>

        <div className="p-6 flex flex-col gap-4">
          {/* Hero */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-2">
              <div className="font-pixel text-base text-pixel-gold leading-6" style={{ textShadow: '2px 2px 0 #000' }}>
                READY,<br />{username.trim() ? username.trim().toUpperCase() : 'PLAYER 1'}?
              </div>
              <div className="font-pixel text-[8px] text-pixel-dim">draw it · guess it · win it</div>
            </div>
            {/* Avatar preview */}
            <div
              className="w-20 h-20 border-4 border-pixel-border flex items-center justify-center text-3xl flex-shrink-0"
              style={{ backgroundColor: selectedAvatar.color, boxShadow: '4px 4px 0 #000' }}
            >
              {selectedAvatar.emoji}
            </div>
          </div>

          {/* Avatar picker */}
          <div>
            <div className="font-pixel text-[8px] text-pixel-dim mb-10">CHOOSE YOUR FIGHTER</div>
            <div className="grid grid-cols-6 gap-1.5">
              {AVATARS.map((av, i) => (
                <button
                  key={av.id}
                  type="button"
                  className={`aspect-square border-4 cursor-pointer flex items-center justify-center text-xl transition-transform duration-75
                    ${i === avatarIdx
                      ? 'border-pixel-gold scale-110'
                      : 'border-pixel-border hover:border-pixel-pink hover:-translate-y-0.5'
                    }`}
                  style={{
                    backgroundColor: av.color,
                    boxShadow: i === avatarIdx ? '4px 4px 0 #B8860B' : '2px 2px 0 #000',
                  }}
                  onClick={() => setAvatarIdx(i)}
                >
                  {av.emoji}
                </button>
              ))}
            </div>
          </div>


          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <label className="font-pixel text-[8px] text-pixel-dim mb-1 block">YOUR NAME</label>
              <input
                className="pixel-input"
                type="text"
                placeholder="PLAYER ONE"
                value={username}
                onChange={(e) => setUsername(e.target.value.slice(0, 10))}
                maxLength={10}
                autoFocus
                disabled={joining}
              />
            </div>
            <div>
              <label className="font-pixel text-[8px] text-pixel-dim mb-1 block">ROOM CODE</label>
              <input
                className="pixel-input"
                type="text"
                placeholder="ENTER CODE"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                maxLength={20}
                disabled={joining}
              />
            </div>

            {error && (
              <div
                className="bg-pixel-red border-4 border-pixel-border text-pixel-white font-pixel text-[10px] p-2"
                style={{ boxShadow: '4px 4px 0 #8B0000' }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={joining}
              className="pixel-btn w-full mt-1 text-sm"
            >
              {joining ? '••• CONNECTING...' : '▶ JOIN GAME'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-2">
            <div className="flex-1 border-t-2 border-pixel-panelBorder" />
            <span className="font-pixel text-[8px] text-pixel-dim">— OR —</span>
            <div className="flex-1 border-t-2 border-pixel-panelBorder" />
          </div>

          <button
            type="button"
            className="pixel-btn-secondary w-full text-xs"
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
