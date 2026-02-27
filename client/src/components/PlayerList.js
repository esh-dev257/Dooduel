import React from 'react';

function PlayerList({ players, host, socketId }) {
  const sorted = Object.entries(players).sort(
    ([, a], [, b]) => b.score - a.score
  );

  return (
    <div className="player-list">
      <h3>Players</h3>
      <ul>
        {sorted.map(([id, player], index) => (
          <li key={id} className={`player-item ${id === socketId ? 'you' : ''}`}>
            <div
              className="player-avatar"
              style={{ backgroundColor: player.avatar?.color || '#444' }}
            >
              <span className="player-avatar-emoji">
                {player.avatar?.emoji || '\u{1F464}'}
              </span>
            </div>
            <div className="player-info">
              <span className="player-name">
                {player.username}
                {id === host && <span className="host-badge">HOST</span>}
                {id === socketId && <span className="you-badge">YOU</span>}
              </span>
              <span className="player-score-live">{player.score} pts</span>
            </div>
            <span className="player-rank">#{index + 1}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PlayerList;
