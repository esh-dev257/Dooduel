import React from 'react';

function Timer({ remaining, total }) {
  const pct    = total > 0 ? (remaining / total) * 100 : 0;
  const urgent = remaining <= 10;

  const color = pct > 50 ? 'text-pixel-green' : pct > 25 ? 'text-pixel-gold' : 'text-pixel-red';

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <span className={`font-pixel text-lg tabular-nums ${color} ${urgent ? 'animate-blink-fast' : ''}`}>
      {mm}:{ss}
    </span>
  );
}

export default Timer;
