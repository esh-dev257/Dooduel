import React, { useRef, useEffect, useCallback, useState } from 'react';
import Canvas from './Canvas';

const ORIGINAL_W = Canvas.CANVAS_WIDTH  || 800;
const ORIGINAL_H = Canvas.CANVAS_HEIGHT || 560;

// ─── Achievement definitions (matched by title from server data) ─────────────
const ACHIEVEMENT_DEFS = [
  { title: 'Champion',    label: 'CHAMPION',     desc: 'HIGHEST TOTAL SCORE',           badge: 'CHAMP', badgeBg: 'bg-pixel-gold',  badgeTx: 'text-pixel-black' },
  { title: 'Fan Favorite',label: 'FAN FAVORITE', desc: 'MOST VOTES RECEIVED',           badge: 'FAV',   badgeBg: 'bg-pixel-pink',  badgeTx: 'text-pixel-black' },
  { title: 'Picasso',     label: 'PICASSO',      desc: 'HIGHEST DRAWING QUALITY SCORE', badge: 'ART',   badgeBg: 'bg-pixel-cyan',  badgeTx: 'text-pixel-black' },
  { title: 'Consistent',  label: 'CONSISTENT',   desc: 'MOST EVEN SCORES ACROSS ROUNDS',badge: 'PRO',   badgeBg: 'bg-pixel-green', badgeTx: 'text-pixel-black' },
];

const PLACE_STYLES = {
  1: { border: 'border-pixel-gold',    label: '1ST', labelBg: 'bg-pixel-gold',    labelTx: 'text-pixel-black', scoreTx: 'text-pixel-gold' },
  2: { border: 'border-[#C0C0C0]',     label: '2ND', labelBg: 'bg-[#C0C0C0]',    labelTx: 'text-pixel-black', scoreTx: 'text-[#C0C0C0]'  },
  3: { border: 'border-pixel-orange',  label: '3RD', labelBg: 'bg-pixel-orange',  labelTx: 'text-pixel-black', scoreTx: 'text-pixel-orange'},
};

// ─── Avatar rendering ─────────────────────────────────────────────────────────
function AvatarBlock({ avatar, size, username }) {
  if (avatar?.url) {
    return (
      <div className={`${size} border-4 border-pixel-border overflow-hidden bg-pixel-bgdark flex-shrink-0`}>
        <img src={avatar.url} alt={username} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
      </div>
    );
  }
  return (
    <div
      className={`${size} border-4 border-pixel-border flex items-center justify-center flex-shrink-0`}
      style={{ backgroundColor: avatar?.color || '#2A2D7A' }}
    >
      <span className="font-pixel text-[8px] text-white">{username?.[0]?.toUpperCase() || '?'}</span>
    </div>
  );
}

// ─── Podium card ──────────────────────────────────────────────────────────────
function PodiumCard({ player, place, height }) {
  if (!player) return null;
  const s = PLACE_STYLES[place];
  return (
    <div
      className={`flex flex-col items-center bg-pixel-panel border-4 ${s.border} w-24 lg:w-44 ${height} p-1.5 lg:p-3 animate-winner-pop`}
      style={{
        boxShadow: place === 1 ? '4px 4px 0 #B8860B' : place === 2 ? '4px 4px 0 #888' : '4px 4px 0 #B85C00',
        animationDelay: `${(place - 1) * 0.15}s`
      }}
    >
      <div className={`${s.labelBg} ${s.labelTx} font-pixel text-[8px] lg:text-[10px] leading-none border-2 border-pixel-border px-1 lg:px-3 py-1 lg:py-1.5 w-full text-center mb-1.5 lg:mb-3`}
        style={{ boxShadow: '2px 2px 0 #000' }}>
        {s.label}
      </div>
      <div className="w-10 h-10 lg:w-16 lg:h-16 border-2 lg:border-4 border-pixel-border overflow-hidden bg-pixel-bgdark mb-1 lg:mb-2 flex-shrink-0">
        {player.avatar?.url
          ? <img src={player.avatar.url} alt={player.username} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
          : <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: player.avatar?.color || '#2A2D7A' }}>
              <span className="font-pixel text-[6px] lg:text-[8px] leading-none text-white">{player.username?.[0]?.toUpperCase()}</span>
            </div>
        }
      </div>
      <span className="font-pixel text-[7px] lg:text-[9px] leading-none text-white truncate max-w-full text-center mb-0.5 lg:mb-1">{player.username}</span>
      <span className={`font-pixel text-[9px] lg:text-sm leading-none ${s.scoreTx} tabular-nums`}>{player.score} PTS</span>
    </div>
  );
}

// ─── Mini collage canvas ──────────────────────────────────────────────────────
const COLLAGE_W = 400;
const COLLAGE_H = 280;

function CollageCanvas({ strokes }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !strokes) return;
    const ctx    = canvas.getContext('2d');
    const scaleX = COLLAGE_W / ORIGINAL_W;
    const scaleY = COLLAGE_H / ORIGINAL_H;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, COLLAGE_W, COLLAGE_H);
    for (const stroke of strokes) {
      if (stroke.type === 'fill') Canvas.replayFill(ctx, stroke, scaleX, scaleY, COLLAGE_W, COLLAGE_H);
      else Canvas.drawSmoothStroke(ctx, stroke, scaleX, scaleY);
    }
  }, [strokes]);
  return (
    <canvas
      ref={canvasRef}
      width={COLLAGE_W}
      height={COLLAGE_H}
      className="block w-full border-4 border-pixel-border"
      style={{ boxShadow: '4px 4px 0 #000' }}
    />
  );
}

// ─── Share helpers ─────────────────────────────────────────────────────────────
async function shareOrDownload(canvas, filename) {
  return new Promise(resolve => {
    canvas.toBlob(async (blob) => {
      const file = new File([blob], filename, { type: 'image/png' });
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Doo-Duel Results' });
        } else {
          const url = URL.createObjectURL(blob);
          const a   = document.createElement('a');
          a.href     = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          const url = URL.createObjectURL(blob);
          const a   = document.createElement('a');
          a.href     = url;
          a.download = filename;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
      resolve();
    }, 'image/png');
  });
}

function drawCheckerboard(ctx, w, h) {
  ctx.fillStyle = '#3B3FA5';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#4A4EB5';
  for (let y = 0; y < h; y += 20) {
    for (let x = 0; x < w; x += 20) {
      if (((x / 20) + (y / 20)) % 2 === 0) ctx.fillRect(x, y, 20, 20);
    }
  }
}

async function generatePersonalCard(player, socketId, summary, roomId) {
  const W = 600, H = 800;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  // 1. Background
  drawCheckerboard(ctx, W, H);

  // 2. Outer borders
  ctx.strokeStyle = '#000000'; ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, W - 8, H - 8);
  ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, W - 28, H - 28);

  // 3. Header block
  ctx.fillStyle = '#1A1A4E';
  ctx.fillRect(14, 14, W - 28, 80);
  ctx.strokeStyle = '#000000'; ctx.lineWidth = 4;
  ctx.strokeRect(14, 14, W - 28, 80);
  ctx.font = 'bold 28px "Press Start 2P", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD700'; ctx.fillText('DOO', 210, 62);
  ctx.fillStyle = '#FF66CC'; ctx.fillText('DUEL', 360, 62);

  // 4. Avatar
  const avatarSize = 120, avatarX = (W - avatarSize) / 2, avatarY = 110;
  ctx.fillStyle = '#000000';
  ctx.fillRect(avatarX - 4, avatarY - 4, avatarSize + 8, avatarSize + 8);
  ctx.fillStyle = '#2A2D7A';
  ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
  if (player.avatar?.url) {
    await new Promise((resolve) => {
      const img = new Image();
      img.onload  = () => { ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize); resolve(); };
      img.onerror = resolve;
      img.src     = player.avatar.url;
    });
  }

  // 5. Username
  ctx.font = '18px "Press Start 2P", monospace';
  ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'center';
  ctx.fillText((player.username || 'PLAYER').toUpperCase(), W / 2, 265);

  // 6. Place + score
  const leaderboard = Object.entries(summary.finalScores || {}).sort(([, a], [, b]) => b.score - a.score);
  const rank = leaderboard.findIndex(([id]) => id === socketId) + 1;
  const placeColors = { 1: '#FFD700', 2: '#C0C0C0', 3: '#FF8C00' };
  const placeLabels = { 1: '1ST PLACE', 2: '2ND PLACE', 3: '3RD PLACE' };
  const placeColor  = placeColors[rank] || '#8888BB';
  const placeLabel  = placeLabels[rank] || `#${rank} PLACE`;

  ctx.fillStyle = '#1A1A4E';
  ctx.fillRect(50, 285, 500, 56);
  ctx.strokeStyle = placeColor; ctx.lineWidth = 4;
  ctx.strokeRect(50, 285, 500, 56);
  ctx.font = '20px "Press Start 2P", monospace';
  ctx.fillStyle = placeColor; ctx.textAlign = 'center';
  ctx.fillText(placeLabel, W / 2, 322);
  ctx.font = '14px "Press Start 2P", monospace';
  ctx.fillStyle = '#FFD700';
  ctx.fillText(`${player.score || 0} PTS`, W / 2, 374);

  // 7. Achievements
  const playerAchievements = (summary.achievements || [])
    .filter(a => a.socketId === socketId)
    .map(a => a.title.toUpperCase().replace(' ', ''));

  let yOffset = 405;
  if (playerAchievements.length > 0) {
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#8888BB'; ctx.textAlign = 'center';
    ctx.fillText('ACHIEVEMENTS', W / 2, yOffset);
    yOffset += 24;

    const pillColors = { CHAMPION: '#FFD700', FANFAVORITE: '#FF66CC', PICASSO: '#44AAFF', CONSISTENT: '#00C060' };
    const pillW = 140, pillH = 32, pillGap = 10;
    const totalPillW = playerAchievements.length * pillW + (playerAchievements.length - 1) * pillGap;
    let px = (W - totalPillW) / 2;
    for (const ach of playerAchievements) {
      const pc = pillColors[ach] || '#8888BB';
      ctx.fillStyle = pc;
      ctx.fillRect(px, yOffset, pillW, pillH);
      ctx.strokeStyle = '#000000'; ctx.lineWidth = 3;
      ctx.strokeRect(px, yOffset, pillW, pillH);
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillStyle = '#000000'; ctx.textAlign = 'center';
      ctx.fillText(ach.slice(0, 10), px + pillW / 2, yOffset + pillH / 2 + 3);
      px += pillW + pillGap;
    }
    yOffset += pillH + 16;
  }

  // 8. Best drawing
  const bestRound = (summary.roundHistory || []).find(r => r.winnerSocketId === socketId);
  if (bestRound) {
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#8888BB'; ctx.textAlign = 'center';
    ctx.fillText('BEST DRAWING', W / 2, yOffset);
    yOffset += 16;

    const drawX = 100, drawY = yOffset, drawW = 400, drawH = 180;
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(drawX, drawY, drawW, drawH);
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 4;
    ctx.strokeRect(drawX - 4, drawY - 4, drawW + 8, drawH + 8);
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2;
    ctx.strokeRect(drawX, drawY, drawW, drawH);

    const miniCanvas  = document.createElement('canvas');
    miniCanvas.width  = ORIGINAL_W;
    miniCanvas.height = ORIGINAL_H;
    const miniCtx     = miniCanvas.getContext('2d');
    miniCtx.fillStyle = '#FFFFFF';
    miniCtx.fillRect(0, 0, ORIGINAL_W, ORIGINAL_H);
    (bestRound.strokes || []).forEach(stroke => {
      if (stroke.type === 'fill') Canvas.replayFill(miniCtx, stroke, 1, 1, ORIGINAL_W, ORIGINAL_H);
      else Canvas.drawSmoothStroke(miniCtx, stroke, 1, 1);
    });
    ctx.drawImage(miniCanvas, drawX, drawY, drawW, drawH);

    yOffset += drawH + 14;
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.fillStyle = '#8888BB'; ctx.textAlign = 'center';
    ctx.fillText(`"${bestRound.prompt}"`.toUpperCase().slice(0, 42), W / 2, yOffset);
  }

  // 9. Footer
  ctx.fillStyle = '#1A1A4E';
  ctx.fillRect(14, H - 46, W - 28, 32);
  ctx.strokeStyle = '#000000'; ctx.lineWidth = 3;
  ctx.strokeRect(14, H - 46, W - 28, 32);
  ctx.font = '9px "Press Start 2P", monospace';
  ctx.fillStyle = '#8888BB'; ctx.textAlign = 'center';
  ctx.fillText(`ROOM: ${roomId}  |  DOO-DUEL`, W / 2, H - 24);

  return canvas;
}

async function generateCollage(summary, roomId) {
  const cols   = 2;
  const cellW  = 400, cellH = 280, cellPad = 20, labelH = 60;
  const rounds = (summary.roundHistory || []).filter(r => r.strokes);
  const rows   = Math.ceil(rounds.length / cols);
  const totalW = cols * (cellW + cellPad) + cellPad;
  const headerH = 80;
  const totalH  = headerH + rows * (cellH + labelH + cellPad) + cellPad;

  const canvas = document.createElement('canvas');
  canvas.width = totalW; canvas.height = totalH;
  const ctx = canvas.getContext('2d');

  drawCheckerboard(ctx, totalW, totalH);

  ctx.strokeStyle = '#000000'; ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, totalW - 8, totalH - 8);
  ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, totalW - 24, totalH - 24);

  ctx.fillStyle = '#1A1A4E';
  ctx.fillRect(12, 12, totalW - 24, headerH - 12);
  ctx.strokeStyle = '#000000'; ctx.lineWidth = 3;
  ctx.strokeRect(12, 12, totalW - 24, headerH - 12);
  ctx.font = '22px "Press Start 2P", monospace';
  ctx.fillStyle = '#FFD700'; ctx.textAlign = 'center';
  ctx.fillText('BEST DRAWINGS', totalW / 2, 58);

  for (let i = 0; i < rounds.length; i++) {
    const round = rounds[i];
    const col   = i % cols;
    const row   = Math.floor(i / cols);
    const x     = cellPad + col * (cellW + cellPad);
    const y     = headerH + row * (cellH + labelH + cellPad) + cellPad;

    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(x, y, cellW, cellH);
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 4;
    ctx.strokeRect(x - 4, y - 4, cellW + 8, cellH + 8);

    const mini     = document.createElement('canvas');
    mini.width     = ORIGINAL_W; mini.height = ORIGINAL_H;
    const mCtx     = mini.getContext('2d');
    mCtx.fillStyle = '#FFFFFF';
    mCtx.fillRect(0, 0, ORIGINAL_W, ORIGINAL_H);
    (round.strokes || []).forEach(s => {
      if (s.type === 'fill') Canvas.replayFill(mCtx, s, 1, 1, ORIGINAL_W, ORIGINAL_H);
      else Canvas.drawSmoothStroke(mCtx, s, 1, 1);
    });
    ctx.drawImage(mini, x, y, cellW, cellH);

    ctx.font = '9px "Press Start 2P", monospace';
    ctx.fillStyle = '#8888BB'; ctx.textAlign = 'left';
    ctx.fillText(`ROUND ${round.round}`, x, y + cellH + 18);
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`"${round.prompt}"`.toUpperCase().slice(0, 36), x, y + cellH + 36);
    ctx.font = '9px "Press Start 2P", monospace';
    ctx.fillStyle = '#FFD700';
    ctx.fillText((round.winnerUsername || '').toUpperCase(), x, y + cellH + 54);
  }

  return canvas;
}

// ─── Main component ───────────────────────────────────────────────────────────
function GameSummary({ summary, roomId, socketId, onBackToLobby }) {
  const [sharing, setSharing] = useState(false);

  const { roundHistory = [], finalScores = {}, achievements = [] } = summary;

  const leaderboard = Object.entries(finalScores).sort(([, a], [, b]) => b.score - a.score);
  // Podium: display order 2nd | 1st | 3rd
  const podiumDisplay = [leaderboard[1], leaderboard[0], leaderboard[2]];
  const podiumPlaces  = [2, 1, 3];
  const podiumHeights = ['h-36 lg:h-44', 'h-44 lg:h-56', 'h-32 lg:h-36'];

  const handleShareCard = useCallback(async () => {
    setSharing(true);
    try {
      const myEntry = leaderboard.find(([id]) => id === socketId);
      const myPlayer = myEntry ? myEntry[1] : { username: 'PLAYER', score: 0, avatar: null };
      const canvas = await generatePersonalCard(myPlayer, socketId, summary, roomId);
      await shareOrDownload(canvas, `dooduel-${(myPlayer.username || 'player').toLowerCase()}.png`);
    } finally {
      setSharing(false);
    }
  }, [leaderboard, socketId, summary, roomId]);

  const handleShareCollage = useCallback(async () => {
    setSharing(true);
    try {
      const canvas = await generateCollage(summary, roomId);
      await shareOrDownload(canvas, `dooduel-collage-${roomId}.png`);
    } finally {
      setSharing(false);
    }
  }, [summary, roomId]);

  return (
    <div className="overflow-y-auto">
      <div className="max-w-5xl mx-auto px-3 lg:px-8 py-2 lg:py-4">

        {/* Title */}
        <div className="text-center py-3 lg:py-6">
          <h1 className="font-pixel text-xl lg:text-3xl text-pixel-gold" style={{ textShadow: '4px 4px 0 #B8860B' }}>
            GAME&nbsp;&nbsp;OVER!
          </h1>
        </div>

        {/* ── Final Standings ── */}
        <h2 className="font-pixel text-sm text-pixel-gold pb-2 lg:pb-10">
          FINAL STANDINGS
        </h2>

        <div className="flex flex-row items-start lg:items-end justify-center gap-2 lg:gap-4 mb-6 lg:mb-8">
          {podiumDisplay.map((entry, i) => {
            if (!entry) return <div key={i} className="w-44" />;
            const [, player] = entry;
            return (
              <PodiumCard
                key={i}
                player={player}
                place={podiumPlaces[i]}
                height={podiumHeights[i]}
              />
            );
          })}
        </div>

        {/* Rest of standings (4th+) */}
        {leaderboard.length > 3 && (
          <div className="border-4 border-pixel-border mb-8" style={{ boxShadow: '4px 4px 0 #000' }}>
            <table className="w-full border-collapse">
              <tbody>
                {leaderboard.slice(3).map(([id, player], i) => (
                  <tr key={id} className="border-t-2 border-pixel-borderAlt bg-pixel-panel hover:bg-pixel-bgdark">
                    <td className="font-pixel text-[10px] text-pixel-dim px-3 py-2">{i + 4}</td>
                    <td className="font-pixel text-[10px] text-white px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 border-2 border-pixel-border overflow-hidden bg-pixel-bgdark flex-shrink-0">
                          {player.avatar?.url
                            ? <img src={player.avatar.url} alt={player.username} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                            : <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: player.avatar?.color || '#2A2D7A' }}>
                                <span className="font-pixel text-[6px] text-white">{player.username?.[0]?.toUpperCase()}</span>
                              </div>
                          }
                        </div>
                        {player.username}
                      </div>
                    </td>
                    <td className="font-pixel text-[10px] text-pixel-gold px-3 py-2 text-right">{player.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Achievements ── */}
        <h2 className="font-pixel text-sm text-pixel-gold pb-4 lg:pb-10">
          ACHIEVEMENTS
        </h2>

        <div className="grid grid-cols-2 gap-2 lg:gap-4 mb-6 lg:mb-8">
          {ACHIEVEMENT_DEFS.map((def) => {
            const winner = achievements.find(a => a.title === def.title);
            const isUnlocked = !!winner;

            return (
              <div
                key={def.title}
                className={`flex flex-row items-center gap-2 lg:gap-4 border-2 lg:border-4 p-2 lg:p-4
                  ${isUnlocked ? 'bg-pixel-panel border-pixel-gold' : 'bg-pixel-bgdark border-pixel-borderAlt opacity-50'}`}
                style={{ boxShadow: isUnlocked ? '4px 4px 0 #B8860B' : '4px 4px 0 #000' }}
              >
                {/* Badge */}
                <div
                  className={`font-pixel text-[7px] lg:text-[9px] border-2 lg:border-4 border-pixel-border px-1 lg:px-2 py-1 lg:py-2 text-center flex-shrink-0 w-10 lg:w-16
                    ${isUnlocked ? `${def.badgeBg} ${def.badgeTx}` : 'bg-pixel-bgdark text-pixel-dim'}`}
                  style={{ boxShadow: '2px 2px 0 #000' }}
                >
                  {def.badge}
                </div>

                {/* Text */}
                <div className="flex flex-col gap-1 lg:gap-2 min-w-0 flex-1">
                  <span className={`font-pixel text-[8px] lg:text-[11px] leading-tight ${isUnlocked ? 'text-pixel-gold' : 'text-pixel-dim'}`}>
                    {def.label}
                  </span>
                  <span className="font-pixel text-[6px] lg:text-[8px] text-pixel-dim leading-relaxed">
                    {def.desc}
                  </span>

                  {isUnlocked && (
                    <div className="flex flex-row items-center gap-2 mt-1">
                      <div className="w-8 h-8 border-2 border-pixel-border overflow-hidden bg-pixel-bgdark flex-shrink-0">
                        {winner.avatar?.url
                          ? <img src={winner.avatar.url} alt={winner.playerName} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                          : <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: winner.avatar?.color || '#2A2D7A' }}>
                              <span className="font-pixel text-[7px] text-white">{winner.playerName?.[0]?.toUpperCase()}</span>
                            </div>
                        }
                      </div>
                      <span className="font-pixel text-[10px] text-white truncate">{winner.playerName}</span>
                    </div>
                  )}

                  {!isUnlocked && (
                    <span className="font-pixel text-[8px] text-pixel-dim">NOT AWARDED</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Best Drawings ── */}
        {roundHistory.length > 0 && (
          <>
            <h2 className="font-pixel text-sm text-pixel-gold pb-4 lg:pb-10">
              BEST DRAWINGS
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
              {roundHistory.map((round, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="border-4 border-pixel-border bg-white overflow-hidden" style={{ boxShadow: '4px 4px 0 #000' }}>
                    <CollageCanvas strokes={round.strokes} />
                  </div>
                  <div className="flex flex-col gap-1 px-1">
                    <span className="font-pixel text-[8px] text-pixel-dim">ROUND {round.round}</span>
                    <span className="font-pixel text-[10px] text-white leading-snug">"{round.prompt}"</span>
                    <span className="font-pixel text-[9px] text-pixel-gold">{round.winnerUsername}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Action Buttons ── */}
        <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 items-stretch lg:items-center lg:justify-center py-4 lg:py-6">
          <button
            className="pixel-btn px-5 lg:px-8 py-2 lg:py-3 text-[9px] lg:text-[10px]"
            onClick={handleShareCard}
            disabled={sharing}
          >
            {sharing ? '...' : 'SHARE MY CARD'}
          </button>
          <button
            className="pixel-btn-secondary px-5 lg:px-8 py-2 lg:py-3 text-[9px] lg:text-[10px]"
            onClick={handleShareCollage}
            disabled={sharing}
          >
            SHARE COLLAGE
          </button>
          <button
            className="pixel-btn-secondary px-5 lg:px-8 py-2 lg:py-3 text-[9px] lg:text-[10px] border-pixel-cyan text-pixel-cyan"
            onClick={onBackToLobby}
          >
            BACK TO LOBBY
          </button>
        </div>

      </div>
    </div>
  );
}

export default GameSummary;
