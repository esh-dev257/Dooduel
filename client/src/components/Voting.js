import React, { useRef, useEffect, useState, useCallback } from 'react';
import socket from '../socket';
import Canvas from './Canvas';
import './Voting.css';

const ORIGINAL_W = Canvas.CANVAS_WIDTH || 800;
const ORIGINAL_H = Canvas.CANVAS_HEIGHT || 560;
const MINI_W = 360;
const MINI_H = 252;

// Replays stroke data onto a mini canvas (with smooth bezier + erase + fill support)
function replayStrokes(canvas, strokes) {
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const scaleX = MINI_W / ORIGINAL_W;
  const scaleY = MINI_H / ORIGINAL_H;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, MINI_W, MINI_H);

  for (const stroke of strokes) {
    if (stroke.type === 'fill') {
      Canvas.replayFill(ctx, stroke, scaleX, scaleY, MINI_W, MINI_H);
    } else {
      Canvas.drawSmoothStroke(ctx, stroke, scaleX, scaleY);
    }
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

function Voting({ drawings, socketId, yourAnonId }) {
  const [votedFor, setVotedFor] = useState(null);
  const [voteError, setVoteError] = useState('');

  const handleVote = useCallback((anonId) => {
    if (votedFor) return;
    if (anonId === yourAnonId) return;

    socket.emit('vote', { anonId }, (response) => {
      if (response.success) {
        setVotedFor(anonId);
        setVoteError('');
      } else {
        setVoteError(response.error);
      }
    });
  }, [votedFor, yourAnonId]);

  const entries = Object.entries(drawings);

  return (
    <div className="voting">
      <h2>Vote for the best drawing!</h2>
      <p className="voting-hint">Drawings are anonymous — vote for your favorite!</p>
      {voteError && <p className="vote-error">{voteError}</p>}
      {votedFor && <p className="voted-msg">Vote cast!</p>}

      <div className="drawings-grid">
        {entries.map(([anonId, { label, strokes }]) => {
          const isSelf = anonId === yourAnonId;
          const isVoted = votedFor === anonId;

          return (
            <div
              key={anonId}
              className={`drawing-card ${isVoted ? 'voted' : ''} ${isSelf ? 'self' : ''}`}
            >
              <MiniCanvas strokes={strokes} />
              <div className="drawing-info">
                <span className="drawing-label">{label}</span>
                {isSelf && <span className="self-badge">(Yours)</span>}
                {!isSelf && !votedFor && (
                  <button
                    className="vote-btn"
                    onClick={() => handleVote(anonId)}
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
