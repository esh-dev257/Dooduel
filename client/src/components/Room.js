import React, { useState, useEffect, useCallback } from 'react';
import socket from '../socket';
import PlayerList from './PlayerList';
import Timer from './Timer';
import Canvas from './Canvas';
import Voting from './Voting';
import Results from './Results';
import GameSummary from './GameSummary';
import './Room.css';

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
  const [results, setResults] = useState(null);
  const [ratings, setRatings] = useState({});
  const [isFinalRound, setIsFinalRound] = useState(false);
  const [voteInfo, setVoteInfo] = useState({ totalVotes: 0, totalPlayers: 0 });
  const [error, setError] = useState('');
  const [gameSummary, setGameSummary] = useState(null);
  const [inviteCopied, setInviteCopied] = useState(false);

  const isHost = host === socketId;
  const roomId = initialState.roomId || new URLSearchParams(window.location.search).get('room') || '';

  // Socket event listeners
  useEffect(() => {
    const onRoomUpdate = (state) => {
      setPlayers(state.players);
      setHost(state.host);
      if (state.gameState) setGameState(state.gameState);
      if (state.round !== undefined) setRound(state.round);
    };

    const onGameStateChange = (data) => {
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
          break;

        case 'VOTING':
          setDrawings(data.drawings || {});
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
          setRemaining(0);
          setTotalDuration(0);
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
    };

    socket.on('roomUpdate', onRoomUpdate);
    socket.on('gameStateChange', onGameStateChange);
    socket.on('timerTick', onTimerTick);
    socket.on('voteUpdate', onVoteUpdate);
    socket.on('gameError', onGameError);
    socket.on('gameOver', onGameOver);

    return () => {
      socket.off('roomUpdate', onRoomUpdate);
      socket.off('gameStateChange', onGameStateChange);
      socket.off('timerTick', onTimerTick);
      socket.off('voteUpdate', onVoteUpdate);
      socket.off('gameError', onGameError);
      socket.off('gameOver', onGameOver);
    };
  }, []);

  const handleStart = useCallback(() => {
    socket.emit('startGame');
  }, []);

  const handleBackToLobby = useCallback(() => {
    setGameSummary(null);
    setGameState('WAITING');
    setRound(0);
  }, []);

  const handleInvite = useCallback(() => {
    const url = `${window.location.origin}?room=${encodeURIComponent(roomId)}`;
    const shareData = {
      title: 'Scribll - Drawing Game',
      text: `Join my Scribll room! Room code: ${roomId}`,
      url
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 2000);
      });
    }
  }, [roomId]);

  const playerCount = Object.keys(players).length;

  const difficultyClass = difficulty ? `diff-${difficulty.toLowerCase()}` : '';

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
          <span className="room-state-badge">{gameState}</span>
          {(gameState === 'DRAWING' || gameState === 'VOTING') && (
            <Timer remaining={remaining} total={totalDuration} />
          )}
        </div>

        {error && <div className="room-error">{error}</div>}

        {/* WAITING state */}
        {gameState === 'WAITING' && (
          <div className="waiting-screen">
            <h2>Waiting for players...</h2>
            <p className="player-count">{playerCount} player{playerCount !== 1 ? 's' : ''} in room</p>
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
            <Voting drawings={drawings} socketId={socketId} />
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
      </section>
    </div>
  );
}

export default Room;
