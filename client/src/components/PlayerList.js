import React from 'react';

function AvatarImg({ avatar, size = 'w-8 h-8' }) {
  if (avatar?.url) {
    return (
      <div className={`${size} border-2 border-pixel-border overflow-hidden flex-shrink-0 bg-pixel-bgdark`}>
        <img src={avatar.url} alt="avatar" className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
      </div>
    );
  }
  return (
    <div
      className={`${size} border-2 border-pixel-border flex items-center justify-center text-sm flex-shrink-0`}
      style={{ backgroundColor: avatar?.color || '#444' }}
    >
      {avatar?.emoji || '👤'}
    </div>
  );
}

function PlayerList({ players, host, socketId, gameState }) {
  const entries = Object.entries(players);

  const sorted = gameState === 'WAITING'
    ? entries
    : [...entries].sort(([, a], [, b]) => b.score - a.score);

  return (
    <div className="w-[200px] flex-shrink-0 bg-pixel-panel border-r-4 border-pixel-border flex flex-col overflow-y-auto">
      {sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 p-4">
          <span className="text-3xl">👻</span>
          <span className="font-pixel text-[8px] text-pixel-dim text-center">NO PLAYERS YET</span>
        </div>
      )}

      {sorted.map(([id, player], index) => {
        const isYou  = id === socketId;
        const isHost = id === host;
        return (
          <div
            key={id}
            className={`flex flex-row items-center gap-2 px-3 py-2 border-b-2 border-pixel-borderAlt
              ${isYou  ? 'bg-pixel-bgdark border-l-4 border-l-pixel-cyan' : ''}
              ${isHost && !isYou ? 'border-l-4 border-l-pixel-gold' : ''}`}
          >
            {/* Rank */}
            <span className="font-pixel text-[8px] text-pixel-dim w-4 text-right flex-shrink-0">
              #{index + 1}
            </span>

            {/* Avatar */}
            <AvatarImg avatar={player.avatar} size="w-8 h-8" />

            {/* Name + score */}
            <div className="flex flex-col min-w-0 flex-1">
              <span className={`font-pixel text-[9px] truncate leading-tight ${isYou ? 'text-pixel-cyan' : 'text-white'}`}>
                {player.username}
              </span>
              <span className="font-pixel text-[8px] text-pixel-gold leading-tight mt-0.5">
                {player.score} pts
              </span>
            </div>

            {/* HOST / YOU plain text labels */}
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              {isHost && (
                <span className="font-pixel text-[6px] text-pixel-gold">HOST</span>
              )}
              {isYou && (
                <span className="font-pixel text-[6px] text-pixel-cyan">YOU</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default PlayerList;
