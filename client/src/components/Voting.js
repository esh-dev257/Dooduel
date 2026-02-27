import React, { useRef, useEffect, useState, useCallback } from 'react';
import socket from '../socket';
import './Voting.css';

const ORIGINAL_W = 800;
const ORIGINAL_H = 560;
const MINI_W = 360;
const MINI_H = 252;

// Replays stroke data onto a canvas
function replayStrokes(canvas, strokes) {
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const scaleX = MINI_W / ORIGINAL_W;
  const scaleY = MINI_H / ORIGINAL_H;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, MINI_W, MINI_H);

  for (const stroke of strokes) {
    if (!stroke.points || stroke.points.length === 0) continue;

    if (stroke.points.length === 1) {
      ctx.fillStyle = stroke.color;
      ctx.beginPath();
      ctx.arc(
        stroke.points[0].x * scaleX,
        stroke.points[0].y * scaleY,
        (stroke.lineWidth / 2) * Math.min(scaleX, scaleY),
        0, Math.PI * 2
      );
      ctx.fill();
      continue;
    }

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x * scaleX, stroke.points[i].y * scaleY);
    }
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.lineWidth * Math.min(scaleX, scaleY);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

function MiniCanvas({ strokes }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    replayStrokes(canvasRef.current, strokes);
  }, [strokes]);

  return (
    <canvas
      ref={canvasRef}
      width={MINI_W}
      height={MINI_H}
      className="mini-canvas"
    />
  );
}

function Voting({ drawings, socketId }) {
  const [votedFor, setVotedFor] = useState(null);
  const [voteError, setVoteError] = useState('');

  const handleVote = useCallback((targetId) => {
    if (votedFor) return;
    if (targetId === socketId) return;

    socket.emit('vote', { targetSocketId: targetId }, (response) => {
      if (response.success) {
        setVotedFor(targetId);
        setVoteError('');
      } else {
        setVoteError(response.error);
      }
    });
  }, [votedFor, socketId]);

  const entries = Object.entries(drawings);

  return (
    <div className="voting">
      <h2>Vote for the best drawing!</h2>
      {voteError && <p className="vote-error">{voteError}</p>}
      {votedFor && <p className="voted-msg">Vote cast!</p>}

      <div className="drawings-grid">
        {entries.map(([id, { username, avatar, strokes }]) => {
          const isSelf = id === socketId;
          const isVoted = votedFor === id;

          return (
            <div
              key={id}
              className={`drawing-card ${isVoted ? 'voted' : ''} ${isSelf ? 'self' : ''}`}
            >
              <MiniCanvas strokes={strokes} />
              <div className="drawing-info">
                <span className="drawing-author">
                  <span
                    className="voting-avatar"
                    style={{ backgroundColor: avatar?.color || '#444' }}
                  >
                    {avatar?.emoji || ''}
                  </span>
                  {username}{isSelf ? ' (You)' : ''}
                </span>
                {!isSelf && !votedFor && (
                  <button
                    className="vote-btn"
                    onClick={() => handleVote(id)}
                  >
                    Vote
                  </button>
                )}
                {isVoted && <span className="voted-badge">Voted</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Voting;
