import React, { useState, useCallback } from 'react';
import JoinRoom from './components/JoinRoom';
import Room from './components/Room';
import socket from './socket';
import './App.css';

function App() {
  const [roomState, setRoomState] = useState(null);
  const [socketId, setSocketId] = useState(null);

  const [roomId, setRoomId] = useState(null);

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
        <h1 className="app-logo">Scribll</h1>
      </header>
      <main className="app-main">
        {!roomState ? (
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
