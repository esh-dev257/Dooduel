import React, { useState, useCallback, useEffect } from 'react';
import JoinRoom from './components/JoinRoom';
import Room from './components/Room';
import socket from './socket';
import './tailwind.css';

const LOAD_MSGS = [
  'SETTING UP PIXEL CANVAS...',
  'READY!',
];

/* Floating star positions (fixed random-looking positions) */
const STARS = [
  { top: '8%',  left: '5%' },  { top: '15%', left: '22%' },
  { top: '5%',  left: '40%' }, { top: '20%', left: '60%' },
  { top: '10%', left: '78%' }, { top: '30%', left: '90%' },
  { top: '45%', left: '3%' },  { top: '55%', left: '35%' },
  { top: '65%', left: '55%' }, { top: '70%', left: '80%' },
  { top: '80%', left: '15%' }, { top: '88%', left: '48%' },
  { top: '92%', left: '70%' }, { top: '50%', left: '98%' },
  { top: '38%', left: '65%' },
];

const TWINKLE_ANIMS = [
  'animate-twinkle-1','animate-twinkle-2','animate-twinkle-3',
  'animate-twinkle-4','animate-twinkle-5',
];

function SpaceLayer() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {/* Clouds */}
      <div className="absolute animate-cloud-1" style={{ top: '12%' }}>
        <svg width="80" height="40" viewBox="0 0 80 40" fill="none">
          <rect x="20" y="24" width="40" height="8" fill="white"/>
          <rect x="12" y="16" width="56" height="8" fill="white"/>
          <rect x="8"  y="8"  width="64" height="8" fill="white"/>
          <rect x="20" y="0"  width="16" height="8" fill="white"/>
          <rect x="44" y="0"  width="12" height="8" fill="white"/>
        </svg>
      </div>
      <div className="absolute animate-cloud-2" style={{ top: '55%' }}>
        <svg width="64" height="32" viewBox="0 0 64 32" fill="none">
          <rect x="16" y="20" width="32" height="8" fill="white"/>
          <rect x="8"  y="12" width="48" height="8" fill="white"/>
          <rect x="16" y="4"  width="32" height="8" fill="white"/>
          <rect x="24" y="0"  width="16" height="4" fill="white"/>
        </svg>
      </div>
      <div className="absolute animate-cloud-3" style={{ top: '30%' }}>
        <svg width="96" height="48" viewBox="0 0 96 48" fill="none">
          <rect x="24" y="32" width="48" height="8" fill="white"/>
          <rect x="16" y="24" width="64" height="8" fill="white"/>
          <rect x="8"  y="16" width="80" height="8" fill="white"/>
          <rect x="24" y="8"  width="48" height="8" fill="white"/>
          <rect x="32" y="0"  width="32" height="8" fill="white"/>
        </svg>
      </div>
      <div className="absolute animate-cloud-4" style={{ top: '75%' }}>
        <svg width="56" height="28" viewBox="0 0 56 28" fill="none">
          <rect x="12" y="16" width="32" height="8" fill="white"/>
          <rect x="4"  y="8"  width="48" height="8" fill="white"/>
          <rect x="12" y="0"  width="32" height="8" fill="white"/>
        </svg>
      </div>

      {/* Stars */}
      {STARS.map((s, i) => (
        <div
          key={i}
          className={`absolute w-1 h-1 bg-white ${TWINKLE_ANIMS[i % TWINKLE_ANIMS.length]}`}
          style={{ top: s.top, left: s.left }}
        />
      ))}
    </div>
  );
}

function App() {
  const [roomState, setRoomState] = useState(null);
  const [socketId,  setSocketId]  = useState(null);
  const [roomId,    setRoomId]    = useState(null);
  const [loadMsg,   setLoadMsg]   = useState(LOAD_MSGS[0]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      i++;
      if (i < LOAD_MSGS.length) setLoadMsg(LOAD_MSGS[i]);
      else { clearInterval(iv); setTimeout(() => setLoading(false), 400); }
    }, 560);
    return () => clearInterval(iv);
  }, []);

  const handleJoin = useCallback((state, id, room) => {
    setRoomState(state);
    setSocketId(id);
    setRoomId(room);
  }, []);

  const handleLeave = useCallback(() => {
    socket.disconnect();
    setRoomState(null);
    setSocketId(null);
    setRoomId(null);
  }, []);

  return (
    <div className="flex flex-col h-screen  overflow-hidden" style={{ zIndex: 1 }}>
      <SpaceLayer />

      {/* Header */}
      {/* <header className="relative h-11 bg-pixel-bgdark border-b-4 border-pixel-border flex items-center justify-between px-4" style={{ boxShadow: '0 4px 0 #000', zIndex: 10 }}>
        <div className="flex items-center gap-2">
          <span className="font-pixel text-sm text-pixel-gold" style={{ textShadow: '2px 2px 0 #000' }}>
            DOO<span className="text-pixel-pink">DUEL</span>
          </span>
        </div>
      </header> */}

      {/* Main content */}
      <main className="flex-1 flex flex-col relative min-h-0 overflow-hidden" style={{ zIndex: 1 }}>
        {loading ? (
          /* Loading Screen */
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
            <div className="font-pixel text-2xl text-pixel-gold animate-logo-pulse text-center"
              style={{ textShadow: '4px 4px 0 #000' }}>
              DOO<span className="text-pixel-pink">DUEL</span>
            </div>

            {/* Loading bar */}
            <div className="w-full max-w-xs border-4 border-pixel-border bg-pixel-bgdark" style={{ boxShadow: '4px 4px 0 #000' }}>
              <div className="h-4 bg-pixel-gold animate-load-bar" />
            </div>

            <div className="font-pixel text-[10px] text-pixel-white animate-blink-step text-center">
              {loadMsg}
            </div>

          </div>
        ) : !roomState ? (
          <JoinRoom onJoin={handleJoin} />
        ) : (
          <Room
            initialState={{ ...roomState, roomId }}
            socketId={socketId}
            onLeave={handleLeave}
          />
        )}
      </main>
    </div>
  );
}

export default App;
