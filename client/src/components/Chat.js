import React, { useState, useEffect, useRef, useCallback } from 'react';
import socket from '../socket';

const EMOJI_CATEGORIES = {
  '😀': ['😂','😍','🥺','😭','🤯','😱','😎','🥳','🤔','😏','😡','🤡','😤','🥶','🫡','😊','😆','🤣','😇','🙃'],
  '🎮': ['🎮','🕹️','🏆','🎯','🎲','🎰','🃏','🧩','🎭','🏅','🥇','🎪','🎠','🎡','🎢','🎨','🖌️','✏️','📝','🖍️'],
  '✨': ['✨','❤️','🔥','💀','👀','💯','👏','🙌','💪','👍','👎','🎉','⭐','🌟','💎','👑','🤝','💫','🚀','⚡'],
};

const CATEGORY_KEYS = Object.keys(EMOJI_CATEGORIES);

function Chat({ roomId, socketId, players }) {
  const [messages,       setMessages]       = useState([]);
  const [inputText,      setInputText]      = useState('');
  const [showEmojis,     setShowEmojis]     = useState(false);
  const [activeCategory, setActiveCategory] = useState(CATEGORY_KEYS[0]);
  const [isMinimized,    setIsMinimized]    = useState(false);
  const [unreadCount,    setUnreadCount]    = useState(0);
  const [cooldown,       setCooldown]       = useState(0);
  const [sendDisabled,   setSendDisabled]   = useState(false);
  const [chatError,      setChatError]      = useState('');
  const [errorBorder,    setErrorBorder]    = useState(false);

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

    socket.on('chatMessage',  onChatMessage);
    socket.on('playerJoined', onPlayerJoined);
    socket.on('playerLeft',   onPlayerLeft);
    return () => {
      socket.off('chatMessage',  onChatMessage);
      socket.off('playerJoined', onPlayerJoined);
      socket.off('playerLeft',   onPlayerLeft);
    };
  }, [isMinimized]);

  const startCooldown = useCallback(() => {
    setSendDisabled(true);
    setCooldown(1);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) { clearInterval(cooldownRef.current); setSendDisabled(false); return 0; }
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

  const expand = useCallback(() => {
    setIsMinimized(false);
    setUnreadCount(0);
  }, []);

  const collapse = useCallback(() => {
    setIsMinimized(true);
  }, []);

  return (
    <div className={`flex flex-col bg-pixel-panel border-l-4 border-pixel-border overflow-hidden flex-shrink-0 transition-[width] duration-200 ${isMinimized ? 'w-8' : 'w-[260px]'}`}>

      {/* === MINIMIZED STATE === */}
      {isMinimized && (
        <div
          className="flex flex-col items-center justify-start pt-3 gap-3 h-full cursor-pointer select-none"
          onClick={expand}
        >
          {unreadCount > 0 && (
            <div className="bg-pixel-red border-2 border-pixel-border w-5 h-5 flex items-center justify-center flex-shrink-0" style={{ boxShadow: '2px 2px 0 #000' }}>
              <span className="font-pixel text-[6px] text-white leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            </div>
          )}
          <div className="flex-1 flex items-center justify-center">
            <span
              className="font-pixel text-[8px] text-pixel-gold whitespace-nowrap"
              style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
            >
               CHAT
            </span>
          </div>
          <span className="font-pixel text-[8px] text-pixel-dim pb-2">▶</span>
        </div>
      )}

      {/* === EXPANDED STATE === */}
      {!isMinimized && (
        <>
          {/* Header */}
          <div
            className="h-10 flex flex-row items-center justify-between px-3 border-b-4 border-pixel-border bg-pixel-bgdark flex-shrink-0 cursor-pointer select-none"
            onClick={collapse}
          >
            <span className="font-pixel text-[9px] text-pixel-gold whitespace-nowrap"> CHAT</span>
            <span className="font-pixel text-[8px] text-pixel-dim">◀</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-1 p-2 chat-msg-area min-h-0">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center flex-1 gap-2 py-8">
                <span className="text-2xl"></span>
                <span className="font-pixel text-[7px] text-pixel-dim text-center">NO MESSAGES YET</span>
              </div>
            )}
            {messages.map((msg, i) => {
              if (msg.system) {
                return (
                  <div key={i} className="text-center py-0.5">
                    <span className="font-pixel text-[7px] text-pixel-green">{msg.text}</span>
                  </div>
                );
              }
              const isSelf = msg.socketId === socketId;
              return (
                <div
                  key={i}
                  className={`flex flex-col max-w-[95%] border-2 px-2 py-1
                    ${isSelf
                      ? 'self-end border-pixel-cyan bg-pixel-bgdark'
                      : 'self-start border-pixel-borderAlt bg-pixel-bgdark'}`}
                  style={{ boxShadow: '2px 2px 0 #000' }}
                >
                  <div className="flex items-center gap-1 mb-0.5">
                    {msg.avatar?.url
                      ? <img src={msg.avatar.url} alt="avatar" className="w-4 h-4 border border-pixel-border flex-shrink-0" style={{ imageRendering: 'pixelated' }} />
                      : <span className="w-4 h-4 border border-pixel-border flex items-center justify-center text-xs flex-shrink-0"
                          style={{ backgroundColor: msg.avatar?.color || '#444' }}>
                          {msg.avatar?.emoji || ''}
                        </span>
                    }
                    <span className={`font-pixel text-[7px] truncate flex-1 ${isSelf ? 'text-pixel-cyan' : 'text-pixel-gold'}`}>
                      {isSelf ? 'YOU' : msg.username}
                    </span>
                  </div>
                  <span className="font-pixel text-[8px] text-white break-words leading-relaxed">
                    {msg.text}
                  </span>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {chatError && (
            <div className="font-pixel text-[7px] text-white bg-pixel-red border-t-2 border-pixel-border px-2 py-1 flex-shrink-0">
              {chatError}
            </div>
          )}

          {/* Emoji picker */}
          {showEmojis && (
            <div className="border-t-4 border-pixel-border bg-pixel-bgdark flex-shrink-0">
              <div className="flex flex-row border-b-2 border-pixel-borderAlt">
                {CATEGORY_KEYS.map(cat => (
                  <button
                    key={cat}
                    className={`flex-1 py-1 text-base border-b-4 transition-colors duration-75
                      ${activeCategory === cat
                        ? 'border-pixel-gold bg-pixel-panel'
                        : 'border-transparent hover:border-pixel-borderAlt'}`}
                    onClick={() => setActiveCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-8 chat-msg-area overflow-y-auto" style={{ maxHeight: '96px' }}>
                {EMOJI_CATEGORIES[activeCategory].map(emoji => (
                  <button
                    key={emoji}
                    className="w-8 h-8 flex items-center justify-center text-base border-2 border-transparent hover:border-pixel-gold hover:bg-pixel-panel cursor-pointer"
                    onClick={() => handleEmojiClick(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input row */}
          <div className="flex flex-row gap-1 p-2 border-t-4 border-pixel-border bg-pixel-bgdark flex-shrink-0">
            <button
              className={`border-4 px-2 py-1 text-sm transition-colors duration-75 shadow-pixel-sm
                active:translate-x-[2px] active:translate-y-[2px] active:shadow-none
                ${showEmojis
                  ? 'bg-pixel-gold border-pixel-gold text-pixel-black'
                  : 'bg-pixel-bgdark border-pixel-border text-white hover:border-pixel-gold'}`}
              onClick={() => setShowEmojis(s => !s)}
            >
              😊
            </button>
            <input
              ref={inputRef}
              type="text"
              className={`flex-1 bg-pixel-black border-4 font-pixel text-[8px] text-pixel-green px-2 py-1 focus:outline-none placeholder:text-pixel-dim min-w-0
                ${errorBorder ? 'border-pixel-red' : 'border-pixel-borderAlt focus:border-pixel-gold'}`}
              placeholder="SAY SOMETHING..."
              value={inputText}
              onChange={e => setInputText(e.target.value.slice(0, 200))}
              onKeyDown={handleKeyDown}
              maxLength={200}
            />
            <button
              className="pixel-btn px-2 py-1 text-[8px] flex-shrink-0"
              disabled={sendDisabled || !inputText.trim()}
              onClick={handleSend}
            >
              {sendDisabled ? `${cooldown}s` : '▶'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default Chat;
