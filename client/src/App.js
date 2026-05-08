import React, { useState, useCallback, useEffect } from 'react';
import JoinRoom from './components/JoinRoom';
import Room from './components/Room';
import socket from './socket';
import './App.css';

const LOAD_MSGS = [
  'CONNECTING TO SERVER...',
  'WAKING SERVER FROM SLEEP...',
  'LOADING WORD LIBRARY...',
  'SETTING UP PIXEL CANVAS...',
  'READY!',
];

function App() {
  const [roomState, setRoomState]   = useState(null);
  const [socketId,  setSocketId]    = useState(null);
  const [roomId,    setRoomId]      = useState(null);
  const [loadMsg,   setLoadMsg]     = useState(LOAD_MSGS[0]);
  const [loading,   setLoading]     = useState(true);

  /* Cycle loading messages, then hide loader after 2.8 s */
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
    <div className="app">
      <header className="app-header">
        <h1 className="app-logo">DOO<span style={{ color: '#FF66CC' }}>DUEL</span></h1>
      </header>
      <main className="app-main">
        {loading ? (
          <div className="loading-screen">
            <div className="loading-logo">DOO<span>DUEL</span></div>
            <div className="loading-bar-track">
              <div className="loading-bar-fill" />
            </div>
            <div className="loading-status">{loadMsg}</div>
            <div className="loading-tip">
              <strong>⚡ HEADS UP</strong><br />
              First load may take 30–60 s while the server wakes.<br />
              After that it's instant!
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
