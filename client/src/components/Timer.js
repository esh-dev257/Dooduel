import React from 'react';

function Timer({ remaining, total }) {
  const pct = total > 0 ? (remaining / total) * 100 : 0;
  const urgent = remaining <= 10;

  return (
    <div className={`timer ${urgent ? 'timer-urgent' : ''}`}>
      <div className="timer-bar">
        <div className="timer-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="timer-text">{remaining}s</span>
    </div>
  );
}

export default Timer;
