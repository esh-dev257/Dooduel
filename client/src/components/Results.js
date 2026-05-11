import React from 'react';

function AvatarImg({ avatar, size = 'w-12 h-12', textSize = 'text-2xl', borderClass = 'border-4' }) {
  if (avatar?.url) {
    return (
      <div className={`${size} ${borderClass} border-pixel-border overflow-hidden bg-pixel-bgdark`}>
        <img src={avatar.url} alt="avatar" className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
      </div>
    );
  }
  return (
    <div
      className={`${size} ${borderClass} border-pixel-border flex items-center justify-center ${textSize}`}
      style={{ backgroundColor: avatar?.color || '#444' }}
    >
      {avatar?.emoji || '👤'}
    </div>
  );
}

function scoreColor(score) {
  if (score >= 8) return 'text-pixel-green';
  if (score >= 5) return 'text-pixel-gold';
  if (score >= 3) return 'text-pixel-orange';
  return 'text-pixel-red';
}

function scoreBarColor(score) {
  if (score >= 8) return 'bg-pixel-green';
  if (score >= 5) return 'bg-pixel-gold';
  if (score >= 3) return 'bg-pixel-orange';
  return 'bg-pixel-red';
}

function Results({ results, ratings, socketId }) {
  if (!results) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <h2 className="font-pixel text-sm text-pixel-gold" style={{ textShadow: '2px 2px 0 #000' }}>ROUND OVER</h2>
        <p className="font-pixel text-[10px] text-pixel-dim">NO VOTES WERE CAST THIS ROUND.</p>
      </div>
    );
  }

  const { winners, scores } = results;
  const scoreboard    = Object.entries(scores).sort(([, a], [, b]) => b.score - a.score);
  const ratingEntries = Object.entries(ratings || {}).sort(([, a], [, b]) => b.score - a.score);

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <h2 className="font-pixel text-sm text-pixel-gold text-center" style={{ textShadow: '2px 2px 0 #000' }}>
        ROUND RESULTS
      </h2>

      {/* Winners */}
      {winners && winners.length > 0 && (
        <div className="flex flex-col items-center gap-3">
          <div className="text-4xl">🏆</div>
          <h3 className="font-pixel text-[10px] text-pixel-gold">
            {winners.length === 1 ? 'ROUND WINNER!' : "IT'S A TIE!"}
          </h3>
          <div className="flex flex-wrap gap-3 justify-center">
            {winners.map((w) => (
              <div
                key={w.socketId}
                className="pixel-card border-pixel-gold flex flex-col items-center gap-2 p-4 animate-winner-pop"
                style={{ boxShadow: '4px 4px 0 #B8860B' }}
              >
                <AvatarImg avatar={w.avatar} size="w-12 h-12" textSize="text-2xl" borderClass="border-4" />
                <span className="font-pixel text-[10px] text-white">{w.username}</span>
                <span className="font-pixel text-[8px] text-pixel-gold">
                  {w.votes} VOTE{w.votes !== 1 ? 'S' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drawing ratings */}
      {ratingEntries.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-pixel text-[10px] text-pixel-gold">DRAWING RATINGS</h3>
          <div className="flex flex-wrap gap-3">
            {ratingEntries.map(([sid, rating]) => {
              const isOwn = sid === socketId;
              return (
                <div
                  key={sid}
                  className={`flex flex-col gap-2 p-3 border-4
                    ${isOwn
                      ? 'pixel-card-light border-pixel-gold'
                      : 'pixel-card border-pixel-borderAlt'}`}
                  style={{
                    minWidth: isOwn ? '200px' : '150px',
                    maxWidth: isOwn ? '240px' : '180px',
                    boxShadow: isOwn ? '4px 4px 0 #B8860B' : '4px 4px 0 #000'
                  }}
                >
                  {/* Name + score — always visible */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-pixel text-[8px] text-white truncate">{rating.username}</span>
                    <span className={`font-pixel text-xs ${scoreColor(rating.score)}`}>{rating.score}/10</span>
                  </div>

                  {/* Label — always visible */}
                  <span className={`font-pixel text-[8px] ${scoreColor(rating.score)}`}>{rating.label}</span>

                  {/* Own drawing: full breakdown */}
                  {isOwn && (
                    <>
                      {[
                        { key: 'effort',       label: 'EFFORT'   },
                        { key: 'coverage',     label: 'COVERAGE' },
                        { key: 'colorVariety', label: 'COLORS'   },
                        { key: 'detail',       label: 'DETAIL'   },
                      ].map(({ key, label }) => {
                        const val = rating.breakdown?.[key] ?? 0;
                        return (
                          <div key={key} className="flex flex-col gap-0.5">
                            <span className="font-pixel text-[6px] text-pixel-dim">{label}</span>
                            <div className="w-full h-2 bg-pixel-bgdark border-2 border-pixel-border">
                              <div
                                className={`h-full ${scoreBarColor(val)} transition-[width] duration-700`}
                                style={{ width: `${(val / 10) * 100}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      <div className="border-t-2 border-pixel-borderAlt pt-2 text-right">
                        <span className="font-pixel text-[10px] text-pixel-gold">
                          +{Math.round(rating.score * 10)} PTS
                        </span>
                      </div>
                    </>
                  )}

                  {/* Others: private notice */}
                  {!isOwn && (
                    <span className="font-pixel text-[7px] text-pixel-dim">— details private</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Scoreboard */}
      <div className="flex flex-col gap-2">
        <h3 className="font-pixel text-[10px] text-pixel-gold">SCOREBOARD</h3>
        <div className="border-4 border-pixel-border" style={{ boxShadow: '4px 4px 0 #000' }}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-pixel-bgdark">
                <th className="font-pixel text-[8px] text-pixel-gold px-2 py-2 text-left border-b-2 border-pixel-border">#</th>
                <th className="font-pixel text-[8px] text-pixel-gold px-2 py-2 text-left border-b-2 border-pixel-border">PLAYER</th>
                <th className="font-pixel text-[8px] text-pixel-gold px-2 py-2 text-right border-b-2 border-pixel-border">SCORE</th>
              </tr>
            </thead>
            <tbody>
              {scoreboard.map(([, player], i) => (
                <tr
                  key={player.username + i}
                  className={`border-t-2 border-pixel-borderAlt
                    ${i === 0 ? 'bg-pixel-gold' : 'bg-pixel-panel hover:bg-pixel-bgdark'}`}
                >
                  <td className={`font-pixel text-[10px] px-2 py-2 ${i === 0 ? 'text-pixel-black' : 'text-pixel-dim'}`}>
                    {i + 1}
                  </td>
                  <td className={`font-pixel text-[10px] px-2 py-2 ${i === 0 ? 'text-pixel-black' : 'text-white'}`}>
                    <div className="flex items-center gap-2">
                      <AvatarImg avatar={player.avatar} size="w-5 h-5" textSize="text-xs" borderClass="border-2" />
                      {player.username}
                    </div>
                  </td>
                  <td className={`font-pixel text-[10px] px-2 py-2 text-right ${i === 0 ? 'text-pixel-black' : 'text-pixel-gold'}`}>
                    {player.score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Results;
