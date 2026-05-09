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

function Voting({ drawings, socketId, yourAnonId }) {
  const [votedFor,   setVotedFor]   = useState(null);
  const [voteError,  setVoteError]  = useState('');

  const handleVote = useCallback((anonId) => {
    if (votedFor || anonId === yourAnonId) return;
    socket.emit('vote', { anonId }, (response) => {
      if (response.success) { setVotedFor(anonId); setVoteError(''); }
      else setVoteError(response.error);
    });
  }, [votedFor, yourAnonId]);

  const entries = Object.entries(drawings);

  return (
    <div className="w-full">
      <h2 className="font-pixel text-xs text-pixel-gold text-center mb-1" style={{ textShadow: '2px 2px 0 #000' }}>
        VOTE FOR THE BEST DRAWING!
      </h2>
      <p className="font-pixel text-[8px] text-pixel-dim text-center mb-4">
        DRAWINGS ARE ANONYMOUS — VOTE FOR YOUR FAVORITE!
      </p>

      {voteError && (
        <div className="bg-pixel-red border-4 border-pixel-border font-pixel text-[10px] text-pixel-white p-2 mb-3"
          style={{ boxShadow: '4px 4px 0 #8B0000' }}>
          {voteError}
        </div>
      )}
      {votedFor && (
        <div className="bg-pixel-green border-4 border-pixel-border font-pixel text-[10px] text-pixel-black p-2 mb-3 text-center"
          style={{ boxShadow: '4px 4px 0 #000' }}>
          ✓ VOTE CAST!
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {entries.map(([anonId, { label, strokes }]) => {
          const isSelf  = anonId === yourAnonId;
          const isVoted = votedFor === anonId;

          return (
            <div
              key={anonId}
              className={`flex border-4 transition-transform duration-75
                ${isVoted ? 'border-pixel-green' : isSelf ? 'border-pixel-dim opacity-55' : 'border-pixel-border hover:-translate-y-1 hover:border-pixel-pink cursor-pointer'}`}
              style={{ boxShadow: isVoted ? '4px 4px 0 #006030' : '4px 4px 0 #000' }}
            >
              {/* Label tab */}
              <div className="w-10 flex-shrink-0 bg-pixel-white border-r-4 border-pixel-border flex items-center justify-center">
                <span className="font-pixel text-xs text-pixel-black">{label}</span>
              </div>

              {/* Card body */}
              <div className="flex-1 p-2 flex flex-col gap-2 bg-pixel-card">
                <MiniCanvas strokes={strokes} />

                <div className="flex items-center justify-between gap-2">
                  {isSelf && (
                    <span className="font-pixel text-[8px] text-pixel-dim border-2 border-pixel-dim px-1">(YOURS)</span>
                  )}
                  {isVoted && (
                    <span className="font-pixel text-[8px] text-pixel-green border-2 border-pixel-green px-1 ml-auto">✓ VOTED</span>
                  )}
                  {!isSelf && !votedFor && (
                    <button
                      className="pixel-btn w-full text-[8px] py-1 mt-1"
                      onClick={() => handleVote(anonId)}
                    >
                      VOTE ▶
                    </button>
                  )}
                  {!isSelf && votedFor && !isVoted && (
                    <button className="pixel-btn-secondary w-full text-[8px] py-1 mt-1 opacity-50 cursor-not-allowed" disabled>
                      VOTED
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Voting;
