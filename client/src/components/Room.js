import React, { useState, useEffect, useCallback, useRef } from 'react';
import socket from '../socket';
import PlayerList from './PlayerList';
import Timer from './Timer';
import Canvas from './Canvas';
import Voting from './Voting';
import Results from './Results';
import GameSummary from './GameSummary';
import Chat from './Chat';
import './Room.css';

const REACTION_EMOJIS = ['😂', '🔥', '💀', '🤯', '👀', '😍', '🤌', '💯'];



function Room({ initialState, socketId, onLeave }) {
  const [players, setPlayers] = useState(initialState.players || {});
  const [host, setHost] = useState(initialState.host);
  const [gameState, setGameState] = useState(initialState.gameState || 'WAITING');
  const [prompt, setPrompt] = useState(null);
  const [difficulty, setDifficulty] = useState('');
  const [round, setRound] = useState(initialState.round || 0);
  const [totalRounds, setTotalRounds] = useState(3);
  const [remaining, setRemaining] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [drawings, setDrawings] = useState({});
  const [yourAnonId, setYourAnonId] = useState(null);
  const [results, setResults] = useState(null);
  const [ratings, setRatings] = useState({});
  const [isFinalRound, setIsFinalRound] = useState(false);
  const [voteInfo, setVoteInfo] = useState({ totalVotes: 0, totalPlayers: 0 });
  const [error, setError] = useState('');
  const [gameSummary, setGameSummary] = useState(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [phaseKey, setPhaseKey] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [disconnected, setDisconnected] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);

  const prevGameState = useRef(gameState);

  const isHost = host === socketId;
  const roomId = initialState.roomId || new URLSearchParams(window.location.search).get('room') || '';

  // Reconnect detection
  useEffect(() => {
    const onDisconnect = () => setDisconnected(true);
    const onConnect = () => setDisconnected(false);
    socket.on('disconnect', onDisconnect);
    socket.on('connect', onConnect);
    return () => {
      socket.off('disconnect', onDisconnect);
      socket.off('connect', onConnect);
    };
  }, []);

  // Socket event listeners
  useEffect(() => {
    const onRoomUpdate = (state) => {
      setPlayers(state.players);
      setHost(state.host);
      if (state.gameState) setGameState(state.gameState);
      if (state.round !== undefined) setRound(state.round);
    };

    const onGameStateChange = (data) => {
      // Trigger transition animation on state change
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
          if (data.duration) {
            setRemaining(data.duration);
            setTotalDuration(data.duration);
          } else {
            setRemaining(0);
            setTotalDuration(0);
          }
          setYourAnonId(null);
          // Sync sidebar scores from results
          if (data.results?.scores) {
            setPlayers(prev => {
              const updated = { ...prev };
              for (const [id, info] of Object.entries(data.results.scores)) {
                if (updated[id]) {
                  updated[id] = { ...updated[id], score: info.score };
                }
              }
              return updated;
            });
          }
          break;

        case 'WAITING':
          setPrompt(null);
          setDifficulty('');
          setRemaining(0);
          setTotalDuration(0);
          setDrawings({});
          setResults(null);
          setRatings({});
          setIsFinalRound(false);
          setYourAnonId(null);
          if (data.players) setPlayers(data.players);
          if (data.host) setHost(data.host);
          break;

        default:
          break;
      }
    };

    const onTimerTick = ({ remaining: r }) => {
      setRemaining(r);
    };

    const onVoteUpdate = (info) => {
      setVoteInfo(info);
    };

    const onGameError = ({ message }) => {
      setError(message);
      setTimeout(() => setError(''), 4000);
    };

    const onGameOver = (summary) => {
      setGameSummary(summary);
      setGameState('GAME_OVER');
      setPhaseKey(k => k + 1);
    };

    const onPlayerJoined = ({ username, avatar }) => {
      setToasts(prev => [...prev, {
        id: Date.now(),
        type: 'join',
        message: `${username} joined`,
        avatar
      }]);
    };

    const onPlayerLeft = ({ username, avatar }) => {
      setToasts(prev => [...prev, {
        id: Date.now(),
        type: 'leave',
        message: `${username} left`,
        avatar
      }]);
    };

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

  // Auto-dismiss toasts after 3 seconds
  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts(prev => prev.slice(1));
    }, 3000);
    return () => clearTimeout(timer);
  }, [toasts]);

  const handleStart = useCallback(() => {
    socket.emit('startGame');
  }, []);

  const handleBackToLobby = useCallback(() => {
    setGameSummary(null);
    setGameState('WAITING');
    setRound(0);
    setDifficulty('');
  }, []);

  const addReaction = useCallback((emoji) => {
    const id = Date.now() + Math.random();
    const x = 10 + Math.random() * 80;
    setFloatingReactions(prev => [...prev, { id, emoji, x }]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 2000);
  }, []);

  const handleInvite = useCallback(() => {
    const url = `${window.location.origin}?room=${encodeURIComponent(roomId)}`;
    const shareData = {
      title: 'Dooduel - Drawing Game',
      text: `Join my Dooduel room! Room code: ${roomId}`,
      url
    };

    const copyToClipboard = (text) => {
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          setInviteCopied(true);
          setTimeout(() => setInviteCopied(false), 2000);
        }).catch(() => fallbackCopy(text));
      } else {
        fallbackCopy(text);
      }
    };

    const fallbackCopy = (text) => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 2000);
      } catch (e) { /* no-op */ }
      document.body.removeChild(textarea);
    };

    if (navigator.share && navigator.canShare) {
      navigator.share(shareData).catch(() => {});
    } else {
      copyToClipboard(url);
    }
  }, [roomId]);

  const playerCount = Object.keys(players).length;
  const difficultyClass = difficulty ? `diff-${difficulty.toLowerCase()}` : '';

  // Phase badge color class
  const phaseBadgeClass = {
    WAITING: 'phase-waiting',
    DRAWING: 'phase-drawing',
    VOTING: 'phase-voting',
    RESULT: 'phase-result',
    GAME_OVER: 'phase-result'
  }[gameState] || '';

  // Game Summary screen
  if (gameState === 'GAME_OVER' && gameSummary) {
    return (
      <div className="room">
        <section className="room-main">
          <GameSummary
            summary={gameSummary}
            roomId={roomId}
            socketId={socketId}
            onBackToLobby={handleBackToLobby}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="room">
      {/* Sidebar */}
      <aside className="room-sidebar">
        <PlayerList players={players} host={host} socketId={socketId} />
        <button className="invite-btn" onClick={handleInvite}>
          {inviteCopied ? 'Link Copied!' : 'Invite Players'}
        </button>
        <button className="leave-btn" onClick={onLeave}>Leave Room</button>
      </aside>

      {/* Main area */}
      <section className="room-main">
        {/* Status bar */}
        <div className="room-status">
          <span className="room-round">
            {round > 0 ? `Round ${round}/${totalRounds}` : 'Lobby'}
          </span>
          {difficulty && (
            <span className={`room-difficulty-badge ${difficultyClass}`}>
              {difficulty}
            </span>
          )}
          <span className={`room-state-badge ${phaseBadgeClass}`}>{gameState}</span>
          {(gameState === 'DRAWING' || gameState === 'VOTING' || gameState === 'RESULT') && totalDuration > 0 && (
            <Timer remaining={remaining} total={totalDuration} />
          )}
        </div>

        {error && <div className="room-error">{error}</div>}

        {/* Phase content with enter animation */}
        <div className="game-phase-enter" key={phaseKey}>
          {/* WAITING state */}
          {gameState === 'WAITING' && (
            <div className="waiting-screen">
              <h2>Waiting for players...</h2>
              <p className="player-count">{playerCount} player{playerCount !== 1 ? 's' : ''} in room</p>

              {/* Game mode (host only) */}
              {isHost && (
                <>
                  <div className="lobby-section-label">GAME MODE</div>
                  <div className="mode-selector">
                    <div className="mode-btn active">
                      <span className="mode-name">CLASSIC</span>
                      <span className="mode-desc">3 rounds, timed</span>
                    </div>
                  </div>
                </>
              )}

              <div className="round-info">
                <span className="round-info-label">3 Rounds</span>
                <span className="round-info-detail">Easy (1:30) &rarr; Medium (1:00) &rarr; Hard (0:45)</span>
              </div>
              {isHost ? (
                <div className="host-controls">
                  {playerCount < 2 ? (
                    <p className="hint">Need at least 2 players to start</p>
                  ) : (
                    <button className="start-btn" onClick={handleStart}>
                      Start Game
                    </button>
                  )}
                </div>
              ) : (
                <p className="hint">Waiting for the host to start the game...</p>
              )}
              <button className="invite-btn-large" onClick={handleInvite}>
                {inviteCopied ? 'Link Copied!' : 'Invite Friends'}
              </button>
            </div>
          )}

          {/* DRAWING state */}
          {gameState === 'DRAWING' && (
            <div className="drawing-screen">
              <div className="prompt-display">
                <span className={`difficulty-tag ${difficultyClass}`}>{difficulty}</span>
                {' '}Draw: <strong>{prompt}</strong>
              </div>
              <Canvas disabled={false} />
            </div>
          )}

          {/* VOTING state */}
          {gameState === 'VOTING' && (
            <div className="voting-screen">
              <div className="vote-progress">
                Votes: {voteInfo.totalVotes}/{voteInfo.totalPlayers}
              </div>
              <Voting drawings={drawings} socketId={socketId} yourAnonId={yourAnonId} />
            </div>
          )}

          {/* RESULT state */}
          {gameState === 'RESULT' && (
            <div className="result-screen">
              <Results results={results} ratings={ratings} />
              <p className="next-round-hint">
                {isFinalRound ? 'Final results loading...' : 'Next round starting soon...'}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Chat panel */}
      <Chat roomId={roomId} socketId={socketId} players={players} />

      {/* Toast notifications */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            {toast.avatar && (
              <span className="toast-avatar" style={{ backgroundColor: toast.avatar.color }}>
                {toast.avatar.emoji}
              </span>
            )}
            <span className="toast-message">{toast.message}</span>
          </div>
        ))}
      </div>

      {/* Disconnected banner — Fix: No graceful WebSocket reconnect UI */}
      {disconnected && (
        <div className="reconnect-banner">
          <span className="reconnect-dot" />
          RECONNECTING... DO NOT CLOSE THIS TAB
        </div>
      )}

      {/* Floating emoji reactions */}
      <div className="floating-reactions-layer" aria-hidden="true">
        {floatingReactions.map(r => (
          <span
            key={r.id}
            className="floating-reaction"
            style={{ left: `${r.x}%` }}
          >
            {r.emoji}
          </span>
        ))}
      </div>
    </div>
  );
}

export default Room;
