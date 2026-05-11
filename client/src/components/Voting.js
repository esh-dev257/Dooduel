import React, { useRef, useEffect, useState, useCallback } from 'react';
import socket from '../socket';
import Canvas from './Canvas';

const ORIGINAL_W = Canvas.CANVAS_WIDTH  || 800;
const ORIGINAL_H = Canvas.CANVAS_HEIGHT || 560;
const MINI_W = 360;
const MINI_H = 252;

function replayStrokes(canvas, strokes) {
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  const scaleX = MINI_W / ORIGINAL_W;
  const scaleY = MINI_H / ORIGINAL_H;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, MINI_W, MINI_H);
  for (const stroke of strokes) {
    if (stroke.type === 'fill') Canvas.replayFill(ctx, stroke, scaleX, scaleY, MINI_W, MINI_H);
    else Canvas.drawSmoothStroke(ctx, stroke, scaleX, scaleY);
  }
}

function MiniCanvas({ strokes }) {
  const canvasRef = useRef(null);
  useEffect(() => { replayStrokes(canvasRef.current, strokes); }, [strokes]);
  return (
    <canvas
      ref={canvasRef}
      width={MINI_W}
      height={MINI_H}
      className="block w-full border-2 border-pixel-border"
      style={{ boxShadow: '2px 2px 0 #000' }}
    />
  );
}

function Voting({ drawings, socketId, yourAnonId, voteInfo = { totalVotes: 0, totalPlayers: 0 } }) {
  const [action,    setAction]    = useState(null);  // null | { type: 'vote'|'skip', anonId: string|null }
  const [locked,    setLocked]    = useState(false);
  const [voteError, setVoteError] = useState('');

  const handleVote = useCallback((anonId) => {
    if (locked || anonId === yourAnonId) return;
    socket.emit('vote', { anonId }, (response) => {
      if (response?.success) {
        setAction({ type: 'vote', anonId });
        setLocked(true);
        setVoteError('');
      } else {
        setVoteError(response?.error || 'Vote failed');
      }
    });
  }, [locked, yourAnonId]);

  const handleSkip = useCallback(() => {
    if (locked) return;
    socket.emit('skipVote');
    setAction({ type: 'skip', anonId: null });
    setLocked(true);
  }, [locked]);

  return (
    <div className="flex flex-col gap-4">

      {/* Header */}
      <div className="flex flex-col items-center gap-1">
        <p className="font-pixel text-pixel-gold text-sm" style={{ textShadow: '2px 2px 0 #000' }}>
          VOTE FOR THE BEST DRAWING!
        </p>

        <p className="font-pixel text-[8px] text-pixel mt-1 mb-5">
          VOTES: {voteInfo.totalVotes} / {voteInfo.totalPlayers} PLAYERS
        </p>
      </div>

      {/* Error */}
      {voteError && (
        <div className="bg-pixel-red border-4 border-pixel-border font-pixel text-[10px] text-white p-2"
          style={{ boxShadow: '4px 4px 0 #8B0000' }}>
          {voteError}
        </div>
      )}

      {/* Status after action */}
      {action && (
        <div className={`text-center border-4 px-4 py-2 font-pixel text-[9px]
          ${action.type === 'vote'
            ? 'border-pixel-green bg-pixel-panel text-pixel-green'
            : 'border-pixel-dim bg-pixel-panel text-pixel-dim'}`}
          style={{ boxShadow: '4px 4px 0 #000' }}
        >
          {action.type === 'vote'
            ? `YOU VOTED FOR DRAWING : ${drawings[action.anonId]?.label || action.anonId}`
            : 'YOU SKIPPED THIS ROUND'}
        </div>
      )}

      {/* Drawing grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {Object.entries(drawings).map(([anonId, drawing]) => {
          const isOwn    = anonId === yourAnonId;
          const isVoted  = action?.type === 'vote' && action.anonId === anonId;

          return (
            <div
              key={anonId}
              className={`flex border-1 transition-transform duration-75
                ${isOwn
                  ? 'opacity-60 border-pixel-borderAlt cursor-default'
                  : isVoted
                    ? 'border-pixel-green'
                    : locked
                      ? 'border-pixel-border opacity-70 cursor-default'
                      : 'border-pixel-border hover:-translate-y-1 hover:border-pixel-pink cursor-pointer'}`}
              style={{ boxShadow: isVoted ? '4px 4px 0 #006030' : '4px 4px 0 #000' }}
            >
              {/* Letter label strip */}


              {/* Card body */}
              <div className="flex flex-col flex-1 bg-pixel-panel p-2 gap-2">
                <div className="border-2 border-pixel-border">
                  <MiniCanvas strokes={drawing.strokes} />
                </div>

                {/* Vote button — only if not own, not locked */}
                {!isOwn && !locked && (
                  <button
                    className="pixel-btn w-full text-[9px] py-2"
                    onClick={() => handleVote(anonId)}
                  >
                    VOTE
                  </button>
                )}

                {/* Voted indicator */}
                {isVoted && (
                  <div className="border-4 border-pixel-green bg-pixel-panel text-center py-2">
                    <span className="font-pixel text-[9px] text-pixel-green">✓ VOTED</span>
                  </div>
                )}

                {/* Locked but not voted on this card */}
                {locked && !isVoted && !isOwn && (
                  <div className="border-4 border-pixel-borderAlt bg-pixel-panel text-center py-2">
                    <span className="font-pixel text-[8px] text-pixel-dim">—</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Skip button — only before acting */}
      {!locked && (
        <div className="flex justify-center mt-2">
          <button
            className="pixel-btn-secondary px-8 py-2 text-[9px]"
            onClick={handleSkip}
          >
            — SKIP VOTING
          </button>
        </div>
      )}
    </div>
  );
}

export default Voting;
