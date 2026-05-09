import React, { useRef, useEffect, useCallback, useState } from 'react';
import Canvas from './Canvas';

const MINI_W     = 280;
const MINI_H     = 196;
const ORIGINAL_W = 800;
const ORIGINAL_H = 560;
const CARD_W     = 600;
const CARD_H     = 800;

const ACHIEVEMENT_ICONS = { crown: '👑', heart: '❤️', palette: '🎨', target: '🎯' };

function replayStrokes(canvas, strokes, w, h) {
  if (!canvas || !strokes) return;
  const ctx    = canvas.getContext('2d');
  const scaleX = w / ORIGINAL_W;
  const scaleY = h / ORIGINAL_H;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  for (const stroke of strokes) {
    if (stroke.type === 'fill') Canvas.replayFill(ctx, stroke, scaleX, scaleY, w, h);
    else Canvas.drawSmoothStroke(ctx, stroke, scaleX, scaleY);
  }
}

function CollageCanvas({ strokes }) {
  const canvasRef = useRef(null);
  useEffect(() => { replayStrokes(canvasRef.current, strokes, MINI_W, MINI_H); }, [strokes]);
  return (
    <canvas
      ref={canvasRef}
      width={MINI_W}
      height={MINI_H}
      className="block border-4 border-pixel-border"
      style={{ boxShadow: '4px 4px 0 #000' }}
    />
  );
}

function GameSummary({ summary, roomId, socketId, onBackToLobby }) {
  const [shareStatus, setShareStatus] = useState('');
  const [cardStatus,  setCardStatus]  = useState('');
  const collageRef = useRef(null);

  const { roundHistory, finalScores, achievements } = summary;
  const leaderboard = Object.entries(finalScores || {}).sort(([, a], [, b]) => b.score - a.score);
  const getPlayerAchievements = useCallback((name) => (achievements || []).filter(a => a.playerName === name), [achievements]);

  const handleShare = useCallback(async () => {
    const container = collageRef.current;
    if (!container) return;
    const canvases = container.querySelectorAll('canvas');
    if (canvases.length === 0) { setShareStatus('No drawings to share'); setTimeout(() => setShareStatus(''), 2000); return; }

    const cols = Math.min(canvases.length, 3), rows = Math.ceil(canvases.length / cols);
    const padding = 10, headerH = 60, labelH = 30;
    const totalW = cols * MINI_W + (cols + 1) * padding;
    const totalH = headerH + rows * (MINI_H + labelH) + (rows + 1) * padding;
    const composite = document.createElement('canvas');
    composite.width = totalW; composite.height = totalH;
    const ctx = composite.getContext('2d');
    ctx.fillStyle = '#2A2D7A'; ctx.fillRect(0, 0, totalW, totalH);
    ctx.fillStyle = '#FFD700'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Dooduel - Best Drawings', totalW / 2, 40);
    canvases.forEach((c, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = padding + col * (MINI_W + padding);
      const y = headerH + padding + row * (MINI_H + labelH + padding);
      ctx.fillStyle = '#1A1A4E'; ctx.fillRect(x - 2, y - 2, MINI_W + 4, MINI_H + 4);
      ctx.drawImage(c, x, y, MINI_W, MINI_H);
      const item = roundHistory[i];
      if (item) {
        ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(`R${item.round}: "${item.prompt}" - ${item.winnerUsername}`, x + MINI_W / 2, y + MINI_H + 18);
      }
    });
    try {
      const blob = await new Promise(r => composite.toBlob(r, 'image/png'));
      const file = new File([blob], 'dooduel-collage.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'Dooduel Results', text: 'Our Dooduel drawings!', files: [file] });
        setShareStatus('Shared!');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'dooduel-collage.png'; a.click();
        URL.revokeObjectURL(url); setShareStatus('Downloaded!');
      }
    } catch (err) { if (err.name !== 'AbortError') setShareStatus('Download failed'); }
    setTimeout(() => setShareStatus(''), 3000);
  }, [roundHistory]);

  const generatePersonalCard = useCallback(() => {
    const myEntry = leaderboard.find(([id]) => id === socketId);
    if (!myEntry) return null;
    const [, myData] = myEntry;
    const myRank = leaderboard.findIndex(([id]) => id === socketId) + 1;
    const myAchievements = getPlayerAchievements(myData.username);
    const myWins = (roundHistory || []).filter(r => r.winnerSocketId === socketId);
    const canvas = document.createElement('canvas');
    canvas.width = CARD_W; canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#1A1A4E'; ctx.fillRect(0, 0, CARD_W, CARD_H);
    ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, CARD_W - 8, CARD_H - 8);
    ctx.fillStyle = '#FFD700'; ctx.font = 'bold 36px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('DOODUEL', CARD_W / 2, 55);
    const avatarCX = CARD_W / 2, avatarCY = 115, avatarR = 40;
    ctx.beginPath(); ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
    ctx.fillStyle = myData.avatar?.color || '#444'; ctx.fill();
    ctx.font = '36px sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillText(myData.avatar?.emoji || '👤', avatarCX, avatarCY);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#e8e8e8'; ctx.font = 'bold 24px sans-serif';
    ctx.fillText(myData.username, CARD_W / 2, 185);
    const rankMedals = ['🥇', '🥈', '🥉'];
    const rankPrefix = myRank <= 3 ? rankMedals[myRank - 1] + ' ' : '';
    const rankText = myRank <= 3 ? ['1st','2nd','3rd'][myRank-1] + ' Place' : `#${myRank}`;
    ctx.fillStyle = '#FFD700'; ctx.font = 'bold 20px sans-serif';
    ctx.fillText(rankPrefix + rankText, CARD_W / 2, 220);
    ctx.fillStyle = '#e8e8e8'; ctx.font = '16px sans-serif';
    ctx.fillText(`${myData.score} points`, CARD_W / 2, 248);
    let yOffset = 278;
    if (myAchievements.length > 0) {
      ctx.fillStyle = '#8888BB'; ctx.font = 'bold 11px sans-serif';
      ctx.fillText('ACHIEVEMENTS', CARD_W / 2, yOffset); yOffset += 28;
      for (const a of myAchievements) {
        ctx.fillStyle = '#e8e8e8'; ctx.font = '15px sans-serif';
        ctx.fillText(`${ACHIEVEMENT_ICONS[a.icon] || ''} ${a.title}`, CARD_W / 2, yOffset); yOffset += 28;
      }
    }
    yOffset += 16;
    if (myWins.length > 0) {
      ctx.fillStyle = '#8888BB'; ctx.font = 'bold 11px sans-serif';
      ctx.fillText('BEST DRAWING', CARD_W / 2, yOffset); yOffset += 16;
      const drawX = (CARD_W - MINI_W) / 2, drawY = yOffset;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = MINI_W; tempCanvas.height = MINI_H;
      replayStrokes(tempCanvas, myWins[0].strokes, MINI_W, MINI_H);
      ctx.fillStyle = '#000'; ctx.fillRect(drawX - 4, drawY - 4, MINI_W + 8, MINI_H + 8);
      ctx.drawImage(tempCanvas, drawX, drawY, MINI_W, MINI_H);
      yOffset += MINI_H + 20;
      ctx.fillStyle = '#FFD700'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`"${myWins[0].prompt}"`, CARD_W / 2, yOffset);
    }
    ctx.fillStyle = '#444'; ctx.font = '12px sans-serif';
    ctx.fillText(`Room: ${roomId}`, CARD_W / 2, CARD_H - 24);
    return canvas;
  }, [leaderboard, socketId, getPlayerAchievements, roundHistory, roomId]);

  const handleShareCard = useCallback(async () => {
    const canvas = generatePersonalCard();
    if (!canvas) { setCardStatus('Could not generate card'); setTimeout(() => setCardStatus(''), 2000); return; }
    try {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const file = new File([blob], 'dooduel-achievement.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: 'My Dooduel Achievement', text: 'I played Dooduel!', files: [file] });
        setCardStatus('Shared!');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'dooduel-achievement.png'; a.click();
        URL.revokeObjectURL(url); setCardStatus('Downloaded!');
      }
    } catch (err) { if (err.name !== 'AbortError') setCardStatus('Download failed'); }
    setTimeout(() => setCardStatus(''), 3000);
  }, [generatePersonalCard]);

  const podiumOrder = leaderboard.slice(0, 3);
  const podiumStyles = [
    { border: 'border-pixel-gold', bg: 'bg-pixel-bgdark', shadow: '4px 4px 0 #B8860B', medal: '🥇', height: 'h-40' },
    { border: 'border-pixel-dim',  bg: 'bg-pixel-bgdark', shadow: '4px 4px 0 #555',    medal: '🥈', height: 'h-32' },
    { border: 'border-pixel-orange', bg: 'bg-pixel-bgdark', shadow: '4px 4px 0 #7A4500', medal: '🥉', height: 'h-28' },
  ];

  return (
    <div className="flex flex-col items-center gap-8 p-4 max-w-3xl mx-auto">
      <h1 className="font-pixel text-xl text-pixel-gold text-center" style={{ textShadow: '4px 4px 0 #000' }}>
        GAME OVER!
      </h1>

      {/* Podium */}
      <div className="w-full flex flex-col gap-4">
        <h2 className="font-pixel text-[10px] text-pixel-gold">FINAL STANDINGS</h2>
        <div className="flex items-end justify-center gap-3">
          {/* Reorder: 2nd, 1st, 3rd */}
          {[podiumOrder[1], podiumOrder[0], podiumOrder[2]].map((entry, displayIdx) => {
            if (!entry) return null;
            const [, player] = entry;
            const rankIdx = displayIdx === 1 ? 0 : displayIdx === 0 ? 1 : 2;
            const s = podiumStyles[rankIdx];
            const playerAchievements = getPlayerAchievements(player.username);
            return (
              <div
                key={player.username}
                className={`border-4 ${s.border} ${s.bg} flex flex-col items-center gap-1 p-3 animate-winner-pop ${s.height}`}
                style={{ boxShadow: s.shadow, minWidth: '110px', animationDelay: `${rankIdx * 0.1}s` }}
              >
                <span className="text-xl">{s.medal}</span>
                <div
                  className="w-10 h-10 border-4 border-pixel-border flex items-center justify-center text-lg"
                  style={{ backgroundColor: player.avatar?.color || '#444' }}
                >
                  {player.avatar?.emoji || '👤'}
                </div>
                <span className="font-pixel text-[8px] text-pixel-white text-center truncate w-full">{player.username}</span>
                <span className="font-pixel text-[8px] text-pixel-gold">{player.score} PTS</span>
                {playerAchievements.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 justify-center">
                    {playerAchievements.map((a, j) => (
                      <span key={j} className="text-xs" title={a.title}>{ACHIEVEMENT_ICONS[a.icon] || ''}</span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Rest of standings */}
        {leaderboard.length > 3 && (
          <div className="border-4 border-pixel-border" style={{ boxShadow: '4px 4px 0 #000' }}>
            <table className="w-full border-collapse">
              <tbody>
                {leaderboard.slice(3).map(([, player], i) => (
                  <tr key={player.username} className="border-t-2 border-pixel-borderAlt bg-pixel-panel hover:bg-pixel-bgdark">
                    <td className="font-pixel text-[10px] text-pixel-dim px-2 py-1">{i + 4}</td>
                    <td className="font-pixel text-[10px] text-pixel-white px-2 py-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 border-2 border-pixel-border flex items-center justify-center text-sm"
                          style={{ backgroundColor: player.avatar?.color || '#444' }}>
                          {player.avatar?.emoji || ''}
                        </span>
                        {player.username}
                      </div>
                    </td>
                    <td className="font-pixel text-[10px] text-pixel-gold px-2 py-1 text-right">{player.score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Achievements */}
      {achievements && achievements.length > 0 && (
        <div className="w-full flex flex-col gap-3">
          <h2 className="font-pixel text-[10px] text-pixel-gold">ACHIEVEMENTS</h2>
          <div className="grid grid-cols-2 gap-3">
            {achievements.map((a, i) => (
              <div key={i} className="pixel-card-light p-3 flex items-center gap-3">
                <div
                  className="w-10 h-10 border-4 border-pixel-border flex items-center justify-center text-lg flex-shrink-0"
                  style={{ backgroundColor: a.avatar?.color || '#444' }}
                >
                  {a.avatar?.emoji || ''}
                </div>
                <span className="text-xl">{ACHIEVEMENT_ICONS[a.icon] || ''}</span>
                <div className="flex flex-col gap-0.5">
                  <span className="font-pixel text-[8px] text-pixel-gold">{a.title}</span>
                  <span className="font-pixel text-[8px] text-pixel-dim">{a.playerName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best Drawings */}
      {roundHistory && roundHistory.length > 0 && (
        <div className="w-full flex flex-col gap-3">
          <h2 className="font-pixel text-[10px] text-pixel-gold">BEST DRAWINGS</h2>
          <div className="flex flex-wrap gap-4" ref={collageRef}>
            {roundHistory.map((entry, i) => (
              <div key={i} className="flex flex-col gap-2">
                <CollageCanvas strokes={entry.strokes} />
                <div className="flex flex-col gap-0.5">
                  <span className="font-pixel text-[8px] text-pixel-dim">ROUND {entry.round}</span>
                  <span className="font-pixel text-[8px] text-pixel-white">"{entry.prompt}"</span>
                  <span className="font-pixel text-[8px] text-pixel-gold">
                    {entry.winnerAvatar?.emoji || ''} {entry.winnerUsername}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 justify-center">
        <button className="pixel-btn text-[10px] px-4 py-2" onClick={handleShareCard}>
          {cardStatus || '📋 SHARE MY CARD'}
        </button>
        <button className="pixel-btn-secondary text-[10px] px-4 py-2" style={{ boxShadow: '4px 4px 0 #1A5580', borderColor: '#44AAFF' }} onClick={handleShare}>
          {shareStatus || '🖼 SHARE COLLAGE'}
        </button>
        <button className="pixel-btn-secondary text-[10px] px-4 py-2" onClick={onBackToLobby}>
          ↩ BACK TO LOBBY
        </button>
      </div>
    </div>
  );
}

export default GameSummary;
