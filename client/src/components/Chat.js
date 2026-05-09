import React, { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../socket';

const EMOJI_CATEGORIES = {
  '😀': ['😂','😍','🥺','😭','🤯','😱','😎','🥳','🤔','😏','😡','🤡','😤','🥶','🫡','😊','😆','🤣','😇','🙃'],
  '🎮': ['🎮','🕹️','🏆','🎯','🎲','🎰','🃏','🧩','🎭','🏅','🥇','🎪','🎠','🎡','🎢','🎨','🖌️','✏️','📝','🖍️'],
  '✨': ['✨','❤️','🔥','💀','👀','💯','👏','🙌','💪','👍','👎','🎉','⭐','🌟','💎','👑','🤝','💫','🚀','⚡'],
};

const CATEGORY_KEYS = Object.keys(EMOJI_CATEGORIES);

function Chat({ roomId, socketId, players }) {
  const [messages,    setMessages]    = useState([]);
  const [inputText,   setInputText]   = useState('');
  const [showEmojis,  setShowEmojis]  = useState(false);
  const [activeCategory, setActiveCategory] = useState(CATEGORY_KEYS[0]);
  const [isMinimized, setIsMinimized] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [cooldown,    setCooldown]    = useState(0);
  const [sendDisabled,setSendDisabled]= useState(false);
  const [chatError,   setChatError]   = useState('');
  const [errorBorder, setErrorBorder] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);
  const cooldownRef    = useRef(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    const onChatMessage = (message) => {
      setMessages(prev => [...prev.slice(-99), message]);
      if (isMinimized) setUnreadCount(c => c + 1);
    };
    const onPlayerJoined = ({ username }) =>
      setMessages(prev => [...prev.slice(-99), { system: true, text: `${username} joined`, timestamp: Date.now() }]);
    const onPlayerLeft = ({ username }) =>
      setMessages(prev => [...prev.slice(-99), { system: true, text: `${username} left`, timestamp: Date.now() }]);

    socket.on('chatMessage', onChatMessage);
    socket.on('playerJoined', onPlayerJoined);
    socket.on('playerLeft', onPlayerLeft);
    return () => {
      socket.off('chatMessage', onChatMessage);
      socket.off('playerJoined', onPlayerJoined);
      socket.off('playerLeft', onPlayerLeft);
    };
  }, [isMinimized]);

  const startCooldown = useCallback(() => {
    setSendDisabled(true);
    setCooldown(1);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) {
          clearInterval(cooldownRef.current);
          setSendDisabled(false);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, []);

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || sendDisabled) return;

    socket.emit('chatMessage', { text }, (response) => {
      if (response?.error) {
        setChatError(response.error);
        setErrorBorder(true);
        setTimeout(() => { setChatError(''); setErrorBorder(false); }, 3000);
      }
    });

    setInputText('');
    setShowEmojis(false);
    startCooldown();
  }, [inputText, sendDisabled, startCooldown]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  const handleEmojiClick = useCallback((emoji) => {
    setInputText(prev => prev + emoji);
    inputRef.current?.focus();
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized(prev => { if (prev) setUnreadCount(0); return !prev; });
  }, []);

  const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className="fixed bottom-0 right-0 z-40 w-full sm:w-[290px] bg-pixel-panel border-4 border-b-0 border-pixel-border flex flex-col"
      style={{ maxHeight: isMinimized ? 'none' : '420px', boxShadow: '-4px -4px 0 #000' }}
    >
      {/* Header — always fully visible and clickable */}
      <button
        className="h-10 bg-pixel-bgdark border-b-4 border-pixel-border flex items-center justify-between px-3 cursor-pointer flex-shrink-0 w-full"
        onClick={toggleMinimize}
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[10px] text-pixel-gold">CHAT</span>
          {isMinimized && unreadCount > 0 && (
            <span className="font-pixel text-[8px] text-pixel-white bg-pixel-red border-2 border-pixel-border w-5 h-5 flex items-center justify-center"
              style={{ boxShadow: '2px 2px 0 #000' }}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <span className="font-pixel text-[8px] text-pixel-dim">{isMinimized ? '▲' : '▼'}</span>
      </button>

      {/* Body — only rendered when expanded */}
      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="overflow-y-auto p-2 flex flex-col gap-1 chat-msg-area" style={{ maxHeight: '280px' }}>
            {messages.length === 0 && (
              <div className="font-pixel text-[8px] text-pixel-dim text-center py-8">
                NO MESSAGES YET
              </div>
            )}
            {messages.map((msg, i) => {
              if (msg.system) {
                return (
                  <div key={i} className="font-pixel text-[8px] text-pixel-green text-center py-0.5">
                    {msg.text}
                  </div>
                );
              }
              const isSelf = msg.socketId === socketId;
              return (
                <div
                  key={i}
                  className={`flex flex-col border-2 px-2 py-1 max-w-[220px]
                    ${isSelf
                      ? 'border-pixel-cyan self-end bg-pixel-bgdark'
                      : 'border-pixel-borderAlt self-start bg-pixel-bgdark'}`}
                  style={{ boxShadow: '2px 2px 0 #000' }}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {msg.avatar?.url
                      ? <div className="w-4 h-4 border border-pixel-border overflow-hidden bg-pixel-bgdark flex-shrink-0">
                          <img src={msg.avatar.url} alt="avatar" className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                        </div>
                      : <span className="w-4 h-4 border border-pixel-border flex items-center justify-center text-xs flex-shrink-0"
                          style={{ backgroundColor: msg.avatar?.color || '#444' }}>
                          {msg.avatar?.emoji || ''}
                        </span>
                    }
                    <span className="font-pixel text-[8px] text-pixel-gold truncate flex-1">
                      {isSelf ? 'YOU' : msg.username}
                    </span>
                  </div>
                  <p className="font-pixel text-[10px] text-pixel-white break-words m-0 leading-4">
                    {msg.text}
                  </p>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {chatError && (
            <div className="font-pixel text-[8px] text-pixel-white bg-pixel-red border-t-2 border-pixel-border px-2 py-1">
              {chatError}
            </div>
          )}

          {/* Emoji picker */}
          {showEmojis && (
            <div className="relative border-t-4 border-pixel-border bg-pixel-panel">
              <div className="flex border-b-4 border-pixel-border">
                {CATEGORY_KEYS.map(cat => (
                  <button
                    key={cat}
                    className={`flex-1 py-1 text-base border-r-2 border-pixel-border last:border-r-0 cursor-pointer
                      ${activeCategory === cat
                        ? 'bg-pixel-bgdark border-b-4 border-b-pixel-gold'
                        : 'bg-pixel-panel hover:bg-pixel-bgdark'}`}
                    onClick={() => setActiveCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-8 overflow-y-auto chat-msg-area" style={{ maxHeight: '120px' }}>
                {EMOJI_CATEGORIES[activeCategory].map(emoji => (
                  <button
                    key={emoji}
                    className="w-8 h-8 flex items-center justify-center text-base border-2 border-transparent hover:border-pixel-gold hover:bg-pixel-bgdark cursor-pointer"
                    onClick={() => handleEmojiClick(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input row */}
          <div className="flex gap-1.5 p-2 border-t-4 border-pixel-border bg-pixel-bgdark flex-shrink-0">
            <button
              className={`pixel-btn-secondary px-2 py-1 text-base flex-shrink-0 ${showEmojis ? 'border-pixel-gold' : ''}`}
              onClick={() => setShowEmojis(prev => !prev)}
              title="Emojis"
            >
              😊
            </button>
            <input
              ref={inputRef}
              type="text"
              className={`pixel-input flex-1 text-[10px] py-1 ${errorBorder ? 'border-pixel-red' : ''}`}
              placeholder="SAY SOMETHING..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value.slice(0, 200))}
              onKeyDown={handleKeyDown}
              maxLength={200}
            />
            <button
              className="pixel-btn px-2 py-1 text-[8px] flex-shrink-0 min-w-[48px]"
              onClick={handleSend}
              disabled={sendDisabled || !inputText.trim()}
            >
              {sendDisabled ? `${cooldown}s` : 'SEND'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default Chat;
