import React from 'react';

function Timer({ remaining, total }) {
  const pct = total > 0 ? (remaining / total) * 100 : 0;
  const urgent = remaining <= 10;

  // Color interpolation: green → yellow → red
  let barColor;
  if (pct > 50) {
    // Green to yellow
    const t = (pct - 50) / 50;
    const r = Math.round(255 * (1 - t) + 51 * t);
    const g = Math.round(204 * (1 - t) + 204 * t);
    barColor = `rgb(${r}, ${g}, 51)`;
  } else {
    // Yellow to red
    const t = pct / 50;
    const g = Math.round(204 * t);
    barColor = `rgb(233, ${g}, 51)`;
  }

  return (
    <div className={`timer ${urgent ? 'timer-urgent' : ''}`}>
      <div className="timer-bar">
        <div
          className={`timer-fill ${urgent ? 'timer-pulse' : ''}`}
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <span className="timer-text" style={urgent ? { color: '#e94560' } : undefined}>
        {remaining}s
      </span>
    </div>
  );
}

export default Timer;
