import React from 'react';

function Timer({ remaining, total }) {
  const pct    = total > 0 ? (remaining / total) * 100 : 0;
  const urgent = remaining <= 10;

  const numColor  = pct > 50 ? 'text-pixel-green' : pct > 25 ? 'text-pixel-gold' : 'text-pixel-red';
  const barColor  = pct > 50 ? 'bg-pixel-green'   : pct > 25 ? 'bg-pixel-gold'   : 'bg-pixel-red';

  return (
    <div className="flex items-center gap-2">
      <span className={`font-pixel text-sm w-10 text-right tabular-nums ${numColor} ${urgent ? 'animate-blink-fast' : ''}`}>
        {remaining}s
      </span>
      <div className="w-32 h-4 bg-pixel-bgdark border-4 border-pixel-border flex-shrink-0">
        <div
          className={`h-full ${barColor} transition-[width] duration-1000 linear ${urgent ? 'animate-timer-pulse' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default Timer;
