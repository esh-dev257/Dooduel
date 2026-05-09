import React from 'react';

function PlayerList({ players, host, socketId }) {
  const sorted = Object.entries(players).sort(([, a], [, b]) => b.score - a.score);

  return (
    <div className="flex flex-col p-2 gap-1">
      <h3 className="font-pixel text-[8px] text-pixel-gold px-1 py-1 border-b-2 border-pixel-panelBorder mb-1">
        PLAYERS
      </h3>

      {sorted.length === 0 && (
        <div className="font-pixel text-[8px] text-pixel-dim text-center py-4">
          👻<br />NO PLAYERS YET
        </div>
      )}

      <ul className="flex flex-col gap-1">
        {sorted.map(([id, player], index) => (
          <li
            key={id}
            className={`flex items-center gap-1.5 border-4 bg-pixel-bgdark px-1.5 py-1 transition-colors duration-75
              ${id === socketId ? 'border-pixel-cyan' : 'border-pixel-border hover:bg-pixel-bg'}`}
            style={{ boxShadow: '2px 2px 0 #000' }}
          >
            {/* Avatar */}
            <div
              className="w-7 h-7 border-2 border-pixel-border flex items-center justify-center text-sm flex-shrink-0"
              style={{ backgroundColor: player.avatar?.color || '#444' }}
            >
              {player.avatar?.emoji || '👤'}
            </div>

            {/* Info */}
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="font-pixel text-[8px] text-pixel-white truncate">{player.username}</span>
              </div>
              <div className="flex items-center gap-1">
                {id === host && (
                  <span className="font-pixel text-[6px] text-pixel-black bg-pixel-gold border border-pixel-border px-0.5">HOST</span>
                )}
                {id === socketId && (
                  <span className="font-pixel text-[6px] text-pixel-black bg-pixel-cyan border border-pixel-border px-0.5">YOU</span>
                )}
              </div>
            </div>

            {/* Score + rank */}
            <div className="flex flex-col items-end flex-shrink-0">
              <span className="font-pixel text-[8px] text-pixel-gold tabular-nums">{player.score}</span>
              <span className="font-pixel text-[6px] text-pixel-dim">#{index + 1}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PlayerList;
