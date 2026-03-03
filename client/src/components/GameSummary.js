import React, { useRef, useEffect, useCallback, useState } from 'react';
import Canvas from './Canvas';
import './GameSummary.css';

const MINI_W = 280;
const MINI_H = 196;
const ORIGINAL_W = 800;
const ORIGINAL_H = 560;
const CARD_W = 600;
const CARD_H = 800;

const ACHIEVEMENT_ICONS = {
  crown: '\u{1F451}',
  heart: '\u{2764}\u{FE0F}',
  palette: '\u{1F3A8}',
  target: '\u{1F3AF}'
};

// Replay strokes using shared Canvas utilities (supports fill, erase, bezier)
function replayStrokes(canvas, strokes, w, h) {
  if (!canvas || !strokes) return;

  const ctx = canvas.getContext('2d');
  const scaleX = w / ORIGINAL_W;
  const scaleY = h / ORIGINAL_H;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  for (const stroke of strokes) {
    if (stroke.type === 'fill') {
      Canvas.replayFill(ctx, stroke, scaleX, scaleY, w, h);
    } else {
      Canvas.drawSmoothStroke(ctx, stroke, scaleX, scaleY);
    }
  }
}

function CollageCanvas({ strokes }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    replayStrokes(canvasRef.current, strokes, MINI_W, MINI_H);
  }, [strokes]);

  return (
    <canvas
      ref={canvasRef}
      width={MINI_W}
      height={MINI_H}
      className="collage-canvas"
    />
  );
}

function GameSummary({ summary, roomId, socketId, onBackToLobby }) {
  const [shareStatus, setShareStatus] = useState('');
  const [cardStatus, setCardStatus] = useState('');
  const collageRef = useRef(null);

  const { roundHistory, finalScores, achievements } = summary;

  // Sort leaderboard
  const leaderboard = Object.entries(finalScores || {})
    .sort(([, a], [, b]) => b.score - a.score);

  // Get achievements for a player
  const getPlayerAchievements = useCallback((playerName) => {
    return (achievements || []).filter(a => a.playerName === playerName);
  }, [achievements]);

  // --- Share Collage (existing) ---
  const handleShare = useCallback(async () => {
    const container = collageRef.current;
    if (!container) return;

    const canvases = container.querySelectorAll('canvas');
    if (canvases.length === 0) {
      setShareStatus('No drawings to share');
      setTimeout(() => setShareStatus(''), 2000);
      return;
    }

    const cols = Math.min(canvases.length, 3);
    const rows = Math.ceil(canvases.length / cols);
    const padding = 10;
    const headerH = 60;
    const labelH = 30;
    const totalW = cols * MINI_W + (cols + 1) * padding;
    const totalH = headerH + rows * (MINI_H + labelH) + (rows + 1) * padding;

    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = totalW;
    compositeCanvas.height = totalH;
    const ctx = compositeCanvas.getContext('2d');

    ctx.fillStyle = '#0f0e17';
    ctx.fillRect(0, 0, totalW, totalH);

    ctx.fillStyle = '#e94560';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Dooduel - Best Drawings', totalW / 2, 40);

    canvases.forEach((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = padding + col * (MINI_W + padding);
      const y = headerH + padding + row * (MINI_H + labelH + padding);

      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(x - 2, y - 2, MINI_W + 4, MINI_H + 4);
      ctx.drawImage(c, x, y, MINI_W, MINI_H);

      const historyItem = roundHistory[i];
      if (historyItem) {
        ctx.fillStyle = '#e8e8e8';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(
          `R${historyItem.round}: "${historyItem.prompt}" - ${historyItem.winnerUsername}`,
          x + MINI_W / 2,
          y + MINI_H + 18
        );
      }
    });

    try {
      const blob = await new Promise(resolve => compositeCanvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'dooduel-collage.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Dooduel Game Results',
          text: 'Check out our Dooduel drawings!',
          files: [file]
        });
        setShareStatus('Shared!');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dooduel-collage.png';
        a.click();
        URL.revokeObjectURL(url);
        setShareStatus('Downloaded!');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setShareStatus('Download failed');
      }
    }
    setTimeout(() => setShareStatus(''), 3000);
  }, [roundHistory]);

  // --- Personal Achievement Card ---
  const generatePersonalCard = useCallback(() => {
    const myEntry = leaderboard.find(([id]) => id === socketId);
    if (!myEntry) return null;

    const [, myData] = myEntry;
    const myRank = leaderboard.findIndex(([id]) => id === socketId) + 1;
    const myAchievements = getPlayerAchievements(myData.username);
    const myWins = (roundHistory || []).filter(r => r.winnerSocketId === socketId);

    const canvas = document.createElement('canvas');
    canvas.width = CARD_W;
    canvas.height = CARD_H;
    const ctx = canvas.getContext('2d');

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 0, CARD_H);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(1, '#0f0e17');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CARD_W, CARD_H);

    // Border
    ctx.strokeStyle = '#e94560';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(28, 8);
    ctx.lineTo(CARD_W - 28, 8);
    ctx.arcTo(CARD_W - 8, 8, CARD_W - 8, 28, 20);
    ctx.lineTo(CARD_W - 8, CARD_H - 28);
    ctx.arcTo(CARD_W - 8, CARD_H - 8, CARD_W - 28, CARD_H - 8, 20);
    ctx.lineTo(28, CARD_H - 8);
    ctx.arcTo(8, CARD_H - 8, 8, CARD_H - 28, 20);
    ctx.lineTo(8, 28);
    ctx.arcTo(8, 8, 28, 8, 20);
    ctx.closePath();
    ctx.stroke();

    // Header
    ctx.fillStyle = '#e94560';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Dooduel', CARD_W / 2, 55);

    // Avatar circle
    const avatarCX = CARD_W / 2;
    const avatarCY = 115;
    const avatarR = 40;
    ctx.beginPath();
    ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
    ctx.fillStyle = myData.avatar?.color || '#444';
    ctx.fill();
    ctx.font = '36px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(myData.avatar?.emoji || '\u{1F464}', avatarCX, avatarCY);
    ctx.textBaseline = 'alphabetic';

    // Username
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(myData.username, CARD_W / 2, 185);

    // Rank
    const rankLabels = ['1st', '2nd', '3rd'];
    const rankText = myRank <= 3 ? rankLabels[myRank - 1] + ' Place' : `#${myRank}`;
    const rankMedals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
    const rankPrefix = myRank <= 3 ? rankMedals[myRank - 1] + ' ' : '';
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(rankPrefix + rankText, CARD_W / 2, 220);

    // Score
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '18px sans-serif';
    ctx.fillText(`${myData.score} points`, CARD_W / 2, 250);

    // Divider
    let yOffset = 280;
    ctx.strokeStyle = '#16213e';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, yOffset - 10);
    ctx.lineTo(CARD_W - 80, yOffset - 10);
    ctx.stroke();

    // Achievements
    if (myAchievements.length > 0) {
      ctx.fillStyle = '#888';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('ACHIEVEMENTS', CARD_W / 2, yOffset);
      yOffset += 28;

      for (const a of myAchievements) {
        const icon = ACHIEVEMENT_ICONS[a.icon] || '';
        ctx.fillStyle = '#e8e8e8';
        ctx.font = '16px sans-serif';
        ctx.fillText(`${icon} ${a.title}`, CARD_W / 2, yOffset);
        yOffset += 28;
      }
    }

    // Best drawing
    yOffset += 16;
    if (myWins.length > 0) {
      ctx.fillStyle = '#888';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('BEST DRAWING', CARD_W / 2, yOffset);
      yOffset += 16;

      const drawX = (CARD_W - MINI_W) / 2;
      const drawY = yOffset;

      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = MINI_W;
      tempCanvas.height = MINI_H;
      replayStrokes(tempCanvas, myWins[0].strokes, MINI_W, MINI_H);

      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(drawX - 2, drawY - 2, MINI_W + 4, MINI_H + 4);
      ctx.drawImage(tempCanvas, drawX, drawY, MINI_W, MINI_H);

      yOffset += MINI_H + 20;
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(`"${myWins[0].prompt}"`, CARD_W / 2, yOffset);
    }

    // Footer
    ctx.fillStyle = '#444';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Room: ${roomId}`, CARD_W / 2, CARD_H - 24);

    return canvas;
  }, [leaderboard, socketId, getPlayerAchievements, roundHistory, roomId]);

  const handleShareCard = useCallback(async () => {
    const canvas = generatePersonalCard();
    if (!canvas) {
      setCardStatus('Could not generate card');
      setTimeout(() => setCardStatus(''), 2000);
      return;
    }

    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], 'dooduel-achievement.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'My Dooduel Achievement',
          text: 'I played Dooduel! Check out my results!',
          files: [file]
        });
        setCardStatus('Shared!');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'dooduel-achievement.png';
        a.click();
        URL.revokeObjectURL(url);
        setCardStatus('Downloaded!');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setCardStatus('Download failed');
      }
    }
    setTimeout(() => setCardStatus(''), 3000);
  }, [generatePersonalCard]);

  return (
    <div className="game-summary">
      <h1 className="summary-title">Game Over!</h1>

      {/* Final Leaderboard */}
      <div className="final-leaderboard">
        <h2>Final Standings</h2>
        <div className="podium">
          {leaderboard.slice(0, 3).map(([, player], i) => {
            const medals = ['\u{1F947}', '\u{1F948}', '\u{1F949}'];
            const playerAchievements = getPlayerAchievements(player.username);
            return (
              <div key={player.username} className={`podium-place place-${i + 1}`}>
                <div
                  className="podium-avatar"
                  style={{ backgroundColor: player.avatar?.color || '#444' }}
                >
                  <span className="podium-avatar-emoji">
                    {player.avatar?.emoji || '\u{1F464}'}
                  </span>
                </div>
                <span className="podium-medal">{medals[i]}</span>
                <span className="podium-name">{player.username}</span>
                <span className="podium-score">{player.score} pts</span>
                {playerAchievements.length > 0 && (
                  <div className="podium-achievements">
                    {playerAchievements.map((a, j) => (
                      <span key={j} className="achievement-badge" title={a.title}>
                        {ACHIEVEMENT_ICONS[a.icon] || ''} {a.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {leaderboard.length > 3 && (
          <table className="rest-standings">
            <tbody>
              {leaderboard.slice(3).map(([, player], i) => (
                <tr key={player.username}>
                  <td>{i + 4}</td>
                  <td>
                    <span
                      className="rest-avatar"
                      style={{ backgroundColor: player.avatar?.color || '#444' }}
                    >
                      {player.avatar?.emoji || ''}
                    </span>
                    {player.username}
                  </td>
                  <td>{player.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Achievements */}
      {achievements && achievements.length > 0 && (
        <div className="achievements-section">
          <h2>Achievements</h2>
          <div className="achievements-grid">
            {achievements.map((a, i) => (
              <div key={i} className="achievement-card">
                <div
                  className="achievement-avatar"
                  style={{ backgroundColor: a.avatar?.color || '#444' }}
                >
                  {a.avatar?.emoji || ''}
                </div>
                <span className="achievement-icon">{ACHIEVEMENT_ICONS[a.icon] || ''}</span>
                <div className="achievement-info">
                  <span className="achievement-title">{a.title}</span>
                  <span className="achievement-player">{a.playerName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drawing Collage */}
      {roundHistory && roundHistory.length > 0 && (
        <div className="collage-section">
          <h2>Best Drawings</h2>
          <div className="collage-grid" ref={collageRef}>
            {roundHistory.map((entry, i) => (
              <div key={i} className="collage-item">
                <CollageCanvas strokes={entry.strokes} />
                <div className="collage-label">
                  <span className="collage-round">Round {entry.round}</span>
                  <span className="collage-prompt">"{entry.prompt}"</span>
                  <span className="collage-winner">
                    {entry.winnerAvatar?.emoji || ''} by {entry.winnerUsername}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="summary-actions">
        <button className="share-card-btn" onClick={handleShareCard}>
          {cardStatus || 'Share My Card'}
        </button>
        <button className="share-collage-btn" onClick={handleShare}>
          {shareStatus || 'Share Collage'}
        </button>
        <button className="back-lobby-btn" onClick={onBackToLobby}>
          Back to Lobby
        </button>
      </div>
    </div>
  );
}

export default GameSummary;
