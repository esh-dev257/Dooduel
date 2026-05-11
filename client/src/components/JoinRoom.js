import React, { useState, useEffect } from 'react';
import socket from '../socket';

const AVATARS = Array.from({ length: 18 }, (_, i) => `/avatar/Avatar (${i + 1}).png`);

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
    if (room) setRoomId(room.trim().toUpperCase().slice(0, 4));
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

  const doJoin = (roomCode) => {
    if (!username.trim()) {
      setError('PLAYER NAME IS REQUIRED');
      triggerShake();
      return;
    }

    setJoining(true);
    setError('');

    if (!socket.connected) socket.connect();

    const avatarUrl = AVATARS[avatarIdx];

    const emitJoin = () => {
      socket.emit('joinRoom', {
        username: username.trim(),
        roomId:   roomCode.trim(),
        avatar:   { emoji: '', color: '#2A2D7A', url: avatarUrl },
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
        onJoin(response.roomState, response.socketId, roomCode.trim().toLowerCase());
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

  const handleJoin = () => {
    if (!roomId.trim()) {
      setError('ROOM CODE IS REQUIRED');
      triggerShake();
      return;
    }
    doJoin(roomId);
  };

  const handleCreate = () => {
    const code = Math.random().toString(36).slice(2, 6).toUpperCase();
    setRoomId(code);
    doJoin(code);
  };

  const prevAvatar = () => setAvatarIdx(i => (i - 1 + AVATARS.length) % AVATARS.length);
  const nextAvatar = () => setAvatarIdx(i => (i + 1) % AVATARS.length);
  const randomAvatar = () => setAvatarIdx(Math.floor(Math.random() * AVATARS.length));

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-10 px-4 gap-6 overflow-y-auto">

      {/* Title — outside card */}
      <div className="flex flex-row items-baseline">
        <span className="font-pixel text-3xl sm:text-3xl text-pixel-gold leading-tight"
          style={{ textShadow: '4px 4px 0 #B8860B' }}>
          DOO
        </span>
        <span className="font-pixel text-3xl sm:text-3xl text-pixel-pink leading-tight"
          style={{ textShadow: '4px 4px 0 #000' }}>
          DUEL
        </span>
      </div>

      {/* Card */}
      <div
        className={`pixel-card p-6 sm:p-8 max-w-[480px] w-full flex flex-col gap-6 ${shake ? 'animate-shake' : ''}`}
        style={{ position: 'relative', zIndex: 2 }}
      >
        {/* Hero Row */}
        <div className="flex flex-col sm:flex-row gap-6 items-start">

          {/* Left — hero copy */}
          <div className="flex-1 flex flex-col gap-3">
            <p className="font-pixel text-[18px] text-white leading-relaxed">
              READY,<br />
              {username.trim() ? username.trim().toUpperCase() : 'PLAYER 1'}?
            </p>
            <p className="font-pixel text-[12px] text-pixel-dim leading-loose tracking-wide">
              DRAW · VOTE · WIN
            </p>
            <div className="flex flex-col gap-1 mt-1">

            </div>
          </div>

          {/* Right — avatar section */}
          <div className="flex flex-row items-start gap-2 self-center sm:self-start">

            {/* Dice — top-aligned with avatar box */}
            <img
              src="/assets/dice.png"
              alt="Randomize avatar"
              className={`w-8 h-8 cursor-pointer hover:opacity-80 active:opacity-60 transition-opacity duration-75 mt-1
                ${joining ? 'pointer-events-none opacity-40' : ''}`}
              style={{ imageRendering: 'pixelated' }}
              onClick={randomAvatar}
              title="Random avatar"
            />

            {/* Avatar box + counter + arrows — all centered together */}
            <div className="flex flex-col items-center gap-2">

              {/* Avatar preview box */}
              <div className="w-32 h-32 border-4 border-pixel-border bg-pixel-bgdark overflow-hidden"
                style={{ boxShadow: '4px 4px 0 #000' }}>
                <img
                  src={AVATARS[avatarIdx]}
                  alt="Selected avatar"
                  className="w-full h-full object-cover"
                  style={{ imageRendering: 'pixelated' }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              </div>

              {/* Counter */}
              <span className="font-pixel text-[8px] text-pixel-dim">
                {avatarIdx + 1} / {AVATARS.length}
              </span>

              {/* Arrow buttons */}
              <div className="flex flex-row gap-2">
                <button
                  type="button"
                  className="pixel-btn-secondary px-2 py-0.5 text-sm"
                  onClick={prevAvatar}
                  disabled={joining}
                  aria-label="Previous avatar"
                >
                  ←
                </button>
                <button
                  type="button"
                  className="pixel-btn-secondary px-2 py-0.5 text-sm"
                  onClick={nextAvatar}
                  disabled={joining}
                  aria-label="Next avatar"
                >
                  →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t-4 border-pixel-border" />

        {/* Form */}
        <div className="flex flex-col gap-4">

          {/* Username */}
          <div className="flex flex-col gap-1">
            <label className="font-pixel text-[8px] text-pixel-dim">PLAYER NAME</label>
            <div className="relative">
              <input
                className="pixel-input"
                type="text"
                placeholder="ENTER NAME..."
                value={username}
                onChange={e => setUsername(e.target.value.slice(0, 16))}
                maxLength={16}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                disabled={joining}
              />
              {username.length > 0 && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 font-pixel text-[8px] text-pixel-dim pointer-events-none">
                  {username.length}/16
                </span>
              )}
            </div>
          </div>

          {/* Room code */}
          <div className="flex flex-col gap-1">
            <label className="font-pixel text-[8px] text-pixel-dim">
              ROOM CODE <span className="text-pixel-dim">(OPTIONAL)</span>
            </label>
            <input
              className="pixel-input uppercase"
              type="text"
              placeholder="XXXX"
              value={roomId}
              onChange={e => setRoomId(e.target.value.toUpperCase().slice(0, 4))}
              maxLength={4}
              autoComplete="off"
              spellCheck={false}
              disabled={joining}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              className="border-4 border-pixel-red bg-pixel-panel p-3 animate-shake"
              style={{ boxShadow: '4px 4px 0 #8B0000' }}
            >
              <p className="font-pixel text-[9px] text-pixel-red leading-relaxed m-0">
                ✕ {error}
              </p>
            </div>
          )}

          {/* JOIN button */}
          <button
            type="button"
            className="pixel-btn w-full mt-1"
            onClick={handleJoin}
            disabled={joining}
          >
            {joining ? '•••' : '▶ JOIN GAME'}
          </button>

          {/* CREATE button */}
          <button
            type="button"
            className="pixel-btn-secondary w-full"
            onClick={handleCreate}
            disabled={joining}
          >
            {joining ? '•••' : '+ CREATE ROOM'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default JoinRoom;
