import React, { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../socket';
import './Chat.css';

const COMMON_EMOJIS = [
  '😂', '😍', '🔥', '👏', '💀', '😭', '🎨', '✨',
  '👀', '💯', '🤣', '😎', '🥳', '🤔', '😱', '🙌',
  '❤️', '👍', '👎', '🎉', '😡', '🤡', '💪', '🏆',
  '⭐', '🌟', '😏', '🫡', '🤝', '😤', '🥶', '🤯',
  '👑', '💎', '🎯', '🖌️', '✏️', '🖍️', '📝', '🎭'
];

function Chat({ roomId, socketId, players }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sendDisabled, setSendDisabled] = useState(false);
  const [chatError, setChatError] = useState('');

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to latest message
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Listen for chat messages
  useEffect(() => {
    const onChatMessage = (message) => {
      setMessages(prev => [...prev.slice(-99), message]);
      if (isMinimized) {
        setUnreadCount(c => c + 1);
      }
    };

    const onPlayerJoined = ({ username }) => {
      setMessages(prev => [...prev.slice(-99), {
        system: true,
        text: `${username} joined the room`,
        timestamp: Date.now()
      }]);
    };

    const onPlayerLeft = ({ username }) => {
      setMessages(prev => [...prev.slice(-99), {
        system: true,
        text: `${username} left the room`,
        timestamp: Date.now()
      }]);
    };

    socket.on('chatMessage', onChatMessage);
    socket.on('playerJoined', onPlayerJoined);
    socket.on('playerLeft', onPlayerLeft);
    return () => {
      socket.off('chatMessage', onChatMessage);
      socket.off('playerJoined', onPlayerJoined);
      socket.off('playerLeft', onPlayerLeft);
    };
  }, [isMinimized]);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || sendDisabled) return;

    socket.emit('chatMessage', { text }, (response) => {
      if (response?.error) {
        setChatError(response.error);
        setTimeout(() => setChatError(''), 3000);
      }
    });

    setInputText('');
    setShowEmojis(false);

    // Client-side rate limit: disable for 1s
    setSendDisabled(true);
    setTimeout(() => setSendDisabled(false), 1000);
  }, [inputText, sendDisabled]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleEmojiClick = useCallback((emoji) => {
    setInputText(prev => prev + emoji);
    inputRef.current?.focus();
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized(prev => {
      if (prev) setUnreadCount(0);
      return !prev;
    });
  }, []);

  const formatTime = (timestamp) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`chat-panel ${isMinimized ? 'minimized' : ''}`}>
      {/* Header / Toggle */}
      <button className="chat-header" onClick={toggleMinimize}>
        <span className="chat-title">Chat</span>
        {isMinimized && unreadCount > 0 && (
          <span className="chat-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
        <span className="chat-toggle">{isMinimized ? '▲' : '▼'}</span>
      </button>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="chat-messages">
            {messages.length === 0 && (
              <p className="chat-empty">No messages yet. Say hi!</p>
            )}
            {messages.map((msg, i) => {
              if (msg.system) {
                return (
                  <div key={i} className="chat-message system">
                    <p className="chat-text">{msg.text}</p>
                  </div>
                );
              }
              const isSelf = msg.socketId === socketId;
              return (
                <div key={i} className={`chat-message ${isSelf ? 'self' : ''}`}>
                  <div className="chat-message-header">
                    <span
                      className="chat-avatar"
                      style={{ backgroundColor: msg.avatar?.color || '#444' }}
                    >
                      {msg.avatar?.emoji || ''}
                    </span>
                    <span className="chat-username">{isSelf ? 'You' : msg.username}</span>
                    <span className="chat-time">{formatTime(msg.timestamp)}</span>
                  </div>
                  <p className="chat-text">{msg.text}</p>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {chatError && <div className="chat-error">{chatError}</div>}

          {/* Emoji picker */}
          {showEmojis && (
            <div className="emoji-picker">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  className="emoji-btn"
                  onClick={() => handleEmojiClick(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="chat-input-row">
            <button
              className={`emoji-toggle ${showEmojis ? 'active' : ''}`}
              onClick={() => setShowEmojis(prev => !prev)}
              title="Emojis"
            >
              😊
            </button>
            <input
              ref={inputRef}
              type="text"
              className="chat-input"
              placeholder="Type a message..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value.slice(0, 200))}
              onKeyDown={handleKeyDown}
              maxLength={200}
            />
            <button
              className="chat-send"
              onClick={handleSend}
              disabled={sendDisabled || !inputText.trim()}
            >
              Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default Chat;
