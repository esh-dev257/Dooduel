import React, { useState, useEffect, useCallback, useRef } from 'react';
import socket from '../socket';
import PlayerList from './PlayerList';
import Timer from './Timer';
import Canvas from './Canvas';
import Voting from './Voting';
import Results from './Results';
import GameSummary from './GameSummary';
import Chat from './Chat';

function Room({ initialState, socketId, onLeave }) {
  const [players, setPlayers]           = useState(initialState.players || {});
  const [host, setHost]                 = useState(initialState.host);
  const [gameState, setGameState]       = useState(initialState.gameState || 'WAITING');
  const [prompt, setPrompt]             = useState(null);
  const [difficulty, setDifficulty]     = useState('');
  const [round, setRound]               = useState(initialState.round || 0);
  const [totalRounds, setTotalRounds]   = useState(3);
  const [remaining, setRemaining]       = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [drawings, setDrawings]         = useState({});
  const [yourAnonId, setYourAnonId]     = useState(null);
  const [results, setResults]           = useState(null);
  const [ratings, setRatings]           = useState({});
  const [isFinalRound, setIsFinalRound] = useState(false);
  const [voteInfo, setVoteInfo]         = useState({ totalVotes: 0, totalPlayers: 0 });
  const [error, setError]               = useState('');
  const [gameSummary, setGameSummary]   = useState(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [phaseKey, setPhaseKey]         = useState(0);
  const [toasts, setToasts]             = useState([]);
  const [disconnected, setDisconnected] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);

  const prevGameState = useRef(gameState);
  const isHost = host === socketId;
  const roomId = initialState.roomId || new URLSearchParams(window.location.search).get('room') || '';
  const playerCount = Object.keys(players).length;

  useEffect(() => {
    const onDisconnect = () => setDisconnected(true);
    const onConnect    = () => setDisconnected(false);
    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);
    return () => { socket.off('disconnect', onDisconnect); socket.off('connect', onConnect); };
  }, []);

  useEffect(() => {
    const onRoomUpdate = (state) => {
      setPlayers(state.players);
      setHost(state.host);
      if (state.gameState) setGameState(state.gameState);
      if (state.round !== undefined) setRound(state.round);
    };

    const onGameStateChange = (data) => {
      if (data.gameState !== prevGameState.current) {
        setPhaseKey(k => k + 1);
        prevGameState.current = data.gameState;
      }
      setGameState(data.gameState);
      setError('');

      switch (data.gameState) {
        case 'DRAWING':
          setPrompt(data.prompt);
          setDifficulty(data.difficulty || '');
          setRound(data.round);
          if (data.totalRounds) setTotalRounds(data.totalRounds);
          setRemaining(data.duration);
          setTotalDuration(data.duration);
          setDrawings({});
          setResults(null);
          setYourAnonId(null);
          break;
        case 'VOTING':
          setDrawings(data.drawings || {});
          setYourAnonId(data.yourAnonId || null);
          setRemaining(data.duration);
          setTotalDuration(data.duration);
          setPrompt(null);
          break;
        case 'RESULT':
          setResults(data.results);
          setRatings(data.ratings || {});
          setIsFinalRound(data.isFinalRound || false);
          if (data.round) setRound(data.round);
          if (data.totalRounds) setTotalRounds(data.totalRounds);
          if (data.duration) { setRemaining(data.duration); setTotalDuration(data.duration); }
          else { setRemaining(0); setTotalDuration(0); }
          setYourAnonId(null);
          if (data.results?.scores) {
            setPlayers(prev => {
              const updated = { ...prev };
              for (const [id, info] of Object.entries(data.results.scores)) {
                if (updated[id]) updated[id] = { ...updated[id], score: info.score };
              }
              return updated;
            });
          }
          break;
        case 'WAITING':
          setPrompt(null); setDifficulty(''); setRemaining(0); setTotalDuration(0);
          setDrawings({}); setResults(null); setRatings({}); setIsFinalRound(false); setYourAnonId(null);
          if (data.players) setPlayers(data.players);
          if (data.host) setHost(data.host);
          break;
        default: break;
      }
    };

    const onTimerTick   = ({ remaining: r }) => setRemaining(r);
    const onVoteUpdate  = (info) => setVoteInfo(info);
    const onGameError   = ({ message }) => { setError(message); setTimeout(() => setError(''), 4000); };
    const onGameOver    = (summary) => { setGameSummary(summary); setGameState('GAME_OVER'); setPhaseKey(k => k + 1); };
    const onPlayerJoined = ({ username, avatar }) => setToasts(prev => [...prev, { id: Date.now(), type: 'join', message: `${username} joined`, avatar }]);
    const onPlayerLeft   = ({ username, avatar }) => setToasts(prev => [...prev, { id: Date.now(), type: 'leave', message: `${username} left`, avatar }]);

    socket.on('roomUpdate', onRoomUpdate);
    socket.on('gameStateChange', onGameStateChange);
    socket.on('timerTick', onTimerTick);
    socket.on('voteUpdate', onVoteUpdate);
    socket.on('gameError', onGameError);
    socket.on('gameOver', onGameOver);
    socket.on('playerJoined', onPlayerJoined);
    socket.on('playerLeft', onPlayerLeft);
    return () => {
      socket.off('roomUpdate', onRoomUpdate);
      socket.off('gameStateChange', onGameStateChange);
      socket.off('timerTick', onTimerTick);
      socket.off('voteUpdate', onVoteUpdate);
      socket.off('gameError', onGameError);
      socket.off('gameOver', onGameOver);
      socket.off('playerJoined', onPlayerJoined);
      socket.off('playerLeft', onPlayerLeft);
    };
  }, []);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => setToasts(prev => prev.slice(1)), 3000);
    return () => clearTimeout(timer);
  }, [toasts]);

  const handleStart = useCallback(() => socket.emit('startGame'), []);

  const handleBackToLobby = useCallback(() => {
    setGameSummary(null); setGameState('WAITING'); setRound(0); setDifficulty('');
  }, []);

  const handleInvite = useCallback(() => {
    const url = `${window.location.origin}?room=${encodeURIComponent(roomId)}`;
    if (navigator.share && navigator.canShare) {
      navigator.share({ title: 'Dooduel', text: `Join room: ${roomId}`, url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).then(() => {
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 2000);
      });
    }
  }, [roomId]);

  const diffBadgeColor = { Easy: 'bg-pixel-green', Medium: 'bg-pixel-gold', Hard: 'bg-pixel-red' }[difficulty] || 'bg-pixel-dim';
  const stateBadgeColor = { WAITING: 'bg-pixel-dim', DRAWING: 'bg-pixel-cyan', VOTING: 'bg-pixel-pink', RESULT: 'bg-pixel-gold', GAME_OVER: 'bg-pixel-gold' }[gameState] || 'bg-pixel-dim';

  if (gameState === 'GAME_OVER' && gameSummary) {
    return (
      <div className="flex flex-1 overflow-hidden">
        <section className="flex-1 overflow-y-auto p-4">
          <GameSummary summary={gameSummary} roomId={roomId} socketId={socketId} onBackToLobby={handleBackToLobby} />
        </section>
      </div>
    );
  }

  return (
    <div className="flex flex-1 overflow-hidden relative">

      {/* Reconnect banner */}
      {disconnected && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-pixel-red border-b-4 border-pixel-border text-pixel-white font-pixel text-[10px] text-center py-2 flex items-center justify-center gap-2">
          <span className="w-2 h-2 bg-pixel-white animate-blink-fast inline-block" />
          RECONNECTING... DO NOT CLOSE THIS TAB
        </div>
      )}

      {/* Toast container */}
      <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-2 border-4 border-pixel-border font-pixel text-[10px] px-3 py-2 animate-phase-slide
              ${toast.type === 'join' ? 'bg-pixel-green text-pixel-black' : 'bg-pixel-red text-pixel-white'}`}
            style={{ boxShadow: '4px 4px 0 #000' }}
          >
            {toast.avatar && (
              <span className="w-5 h-5 border-2 border-pixel-border flex items-center justify-center text-sm"
                style={{ backgroundColor: toast.avatar.color }}>
                {toast.avatar.emoji}
              </span>
            )}
            {toast.message}
          </div>
        ))}
      </div>

      {/* Floating reactions */}
      <div className="fixed bottom-16 left-1/2 pointer-events-none" style={{ zIndex: 40 }}>
        {floatingReactions.map(r => (
          <span key={r.id} className="absolute text-2xl animate-float-up" style={{ left: `${r.x}%` }}>
            {r.emoji}
          </span>
        ))}
      </div>

      {/* Sidebar */}
      <aside className="w-[190px] flex-shrink-0 flex flex-col bg-pixel-panel border-r-4 border-pixel-border overflow-y-auto">
        <PlayerList players={players} host={host} socketId={socketId} />
        <div className="p-2 flex flex-col gap-2 mt-auto border-t-4 border-pixel-border">
          <button
            className="pixel-btn-secondary w-full text-[10px] py-1.5"
            onClick={handleInvite}
          >
            {inviteCopied ? '✓ COPIED!' : '+ INVITE'}
          </button>
          <button
            className="pixel-btn-danger w-full text-[10px] py-1.5"
            onClick={onLeave}
          >
            LEAVE
          </button>
        </div>
      </aside>

      {/* Main area */}
      <section className="flex-1 flex flex-col overflow-hidden">

        {/* Status bar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-pixel-bgdark border-b-4 border-pixel-border flex-shrink-0">
          <span className="font-pixel text-[10px] text-pixel-white">
            {round > 0 ? `ROUND ${round}/${totalRounds}` : 'LOBBY'}
          </span>
          {difficulty && (
            <span className={`font-pixel text-[8px] text-pixel-black border-2 border-pixel-border px-1 ${diffBadgeColor}`}>
              {difficulty.toUpperCase()}
            </span>
          )}
          <span className={`font-pixel text-[8px] text-pixel-black border-2 border-pixel-border px-1 ${stateBadgeColor}`}>
            {gameState}
          </span>
          <div className="ml-auto">
            {(gameState === 'DRAWING' || gameState === 'VOTING' || gameState === 'RESULT') && totalDuration > 0 && (
              <Timer remaining={remaining} total={totalDuration} />
            )}
          </div>
        </div>

        {error && (
          <div className="bg-pixel-red border-4 border-pixel-border font-pixel text-[10px] text-pixel-white px-3 py-2 m-2"
            style={{ boxShadow: '4px 4px 0 #8B0000' }}>
            ⚠ {error}
          </div>
        )}

        {/* Phase content */}
        <div className="flex-1 overflow-y-auto animate-phase-slide" key={phaseKey}>

          {/* WAITING */}
          {gameState === 'WAITING' && (
            <div className="flex flex-col items-center gap-6 p-6">
              <div className="font-pixel text-sm text-pixel-gold text-center" style={{ textShadow: '2px 2px 0 #000' }}>
                WAITING FOR PLAYERS...
              </div>
              <div className="font-pixel text-[10px] text-pixel-dim">
                {playerCount} PLAYER{playerCount !== 1 ? 'S' : ''} IN ROOM
              </div>

              {/* Round info */}
              <div className="flex gap-3">
                {[
                  { label: 'EASY', time: '1:30', color: 'bg-pixel-green' },
                  { label: 'MEDIUM', time: '1:00', color: 'bg-pixel-gold' },
                  { label: 'HARD', time: '0:45', color: 'bg-pixel-red' },
                ].map((r, i) => (
                  <div key={i} className="pixel-card-light px-3 py-2 text-center">
                    <div className={`font-pixel text-[8px] text-pixel-black border-2 border-pixel-border px-1 mb-1 ${r.color}`}>
                      {r.label}
                    </div>
                    <div className="font-pixel text-[8px] text-pixel-panel">{r.time}</div>
                  </div>
                ))}
              </div>

              {isHost ? (
                <div className="flex flex-col items-center gap-3">
                  {playerCount < 2 ? (
                    <p className="font-pixel text-[8px] text-pixel-dim animate-blink text-center">
                      NEED AT LEAST 2 PLAYERS
                    </p>
                  ) : (
                    <button className="pixel-btn text-sm px-8 py-3" onClick={handleStart}>
                      ▶ START GAME
                    </button>
                  )}
                </div>
              ) : (
                <p className="font-pixel text-[8px] text-pixel-dim text-center animate-blink">
                  WAITING FOR HOST TO START...
                </p>
              )}

              <button className="pixel-btn-secondary text-[10px] px-4 py-2" onClick={handleInvite}>
                {inviteCopied ? '✓ LINK COPIED!' : '+ INVITE FRIENDS'}
              </button>
            </div>
          )}

          {/* DRAWING */}
          {gameState === 'DRAWING' && (
            <div className="flex flex-col h-full">
              {/* Prompt banner */}
              <div className="flex items-center gap-3 bg-pixel-bgdark border-b-4 border-pixel-border px-4 py-3 border-l-8 border-l-pixel-gold">
                <span className="font-pixel text-[8px] text-pixel-dim">
                  QUESTION {round}/{totalRounds}
                </span>
                <span className="font-pixel text-xs text-pixel-white flex-1 text-center">
                  DRAW: <span className="text-pixel-gold">{prompt}</span>
                </span>
                {difficulty && (
                  <span className={`font-pixel text-[8px] text-pixel-black border-2 border-pixel-border px-2 ${diffBadgeColor}`}>
                    {difficulty.toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <Canvas disabled={false} />
              </div>
            </div>
          )}

          {/* VOTING */}
          {gameState === 'VOTING' && (
            <div className="p-4">
              <div className="font-pixel text-[10px] text-pixel-dim text-center mb-3">
                VOTES: {voteInfo.totalVotes}/{voteInfo.totalPlayers} PLAYERS
              </div>
              <Voting drawings={drawings} socketId={socketId} yourAnonId={yourAnonId} />
            </div>
          )}

          {/* RESULT */}
          {gameState === 'RESULT' && (
            <div className="p-4">
              <Results results={results} ratings={ratings} />
              <p className="font-pixel text-[8px] text-pixel-dim text-center mt-4 animate-blink">
                {isFinalRound ? 'FINAL RESULTS LOADING...' : 'NEXT ROUND STARTING SOON...'}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Chat */}
      <Chat roomId={roomId} socketId={socketId} players={players} />
    </div>
  );
}

export default Room;
