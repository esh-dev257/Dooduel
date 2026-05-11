/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        pixel: {
          bg:          '#3B3FA5',
          bgtile:      '#4A4EB5',
          bgdark:      '#2A2D7A',
          card:        '#A8C8F0',
          cardHover:   '#C0D8FF',
          panel:       '#1A1A4E',
          panelBorder: '#5558CC',
          gold:        '#FFD700',
          pink:        '#FF66CC',
          green:       '#00C060',
          cyan:        '#44AAFF',
          red:         '#E83030',
          orange:      '#FF8C00',
          white:       '#FFFFFF',
          black:       '#000000',
          dim:         '#8888BB',
          border:      '#000000',
          borderAlt:   '#5558CC',
        },
      },
      fontFamily: {
        pixel: ['"Press Start 2P"', 'cursive'],
      },
      keyframes: {
        cloudDrift: {
          '0%':   { transform: 'translateX(-120px)' },
          '100%': { transform: 'translateX(calc(100vw + 120px))' },
        },
        twinkle: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.2' },
        },
        floatUp: {
          '0%':   { transform: 'translateY(0)', opacity: '1' },
          '100%': { transform: 'translateY(-120px)', opacity: '0' },
        },
        winnerPop: {
          '0%':   { transform: 'scale(0.5)', opacity: '0' },
          '60%':  { transform: 'scale(1.1)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0' },
        },
        blinkStep: {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0' },
        },
        phaseSlide: {
          '0%':   { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',    opacity: '1' },
        },
        timerPulse: {
          '0%, 100%': { transform: 'scaleX(1)' },
          '50%':      { transform: 'scaleX(0.97)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%':      { transform: 'translateX(-6px)' },
          '75%':      { transform: 'translateX(6px)' },
        },
        loadBar: {
          '0%':   { width: '0%' },
          '100%': { width: '100%' },
        },
        logoPulse: {
          '0%, 100%': { textShadow: '4px 4px 0 #000' },
          '50%':      { textShadow: '4px 4px 0 #000, 0 0 20px #FFD700' },
        },
      },
      animation: {
        'cloud-1':    'cloudDrift 20s linear infinite',
        'cloud-2':    'cloudDrift 28s linear 4s infinite',
        'cloud-3':    'cloudDrift 24s linear 10s infinite',
        'cloud-4':    'cloudDrift 32s linear 16s infinite',
        'twinkle-1':  'twinkle 3s ease-in-out infinite',
        'twinkle-2':  'twinkle 3s ease-in-out 0.5s infinite',
        'twinkle-3':  'twinkle 3s ease-in-out 1s infinite',
        'twinkle-4':  'twinkle 3s ease-in-out 1.5s infinite',
        'twinkle-5':  'twinkle 3s ease-in-out 2s infinite',
        'float-up':   'floatUp 2s ease-out forwards',
        'winner-pop': 'winnerPop 0.4s ease-out forwards',
        'blink':      'blink 1s ease-in-out infinite',
        'blink-step': 'blinkStep 1s step-start infinite',
        'blink-fast': 'blinkStep 0.5s step-start infinite',
        'blink-live': 'blinkStep 2s step-start infinite',
        'phase-slide':'phaseSlide 0.3s ease-out',
        'timer-pulse':'timerPulse 0.5s ease-in-out infinite',
        'shake':      'shake 0.3s ease-out',
        'load-bar':   'loadBar 2.5s cubic-bezier(0.4,0,0.2,1) forwards',
        'logo-pulse': 'logoPulse 2s ease-in-out infinite',
      },
      boxShadow: {
        'pixel':      '4px 4px 0px #000000',
        'pixel-sm':   '2px 2px 0px #000000',
        'pixel-lg':   '6px 6px 0px #000000',
        'pixel-gold': '4px 4px 0px #B8860B',
        'pixel-red':  '4px 4px 0px #8B0000',
        'pixel-cyan': '4px 4px 0px #1A5580',
        'pixel-none': 'none',
      },
    },
  },
  plugins: [],
};
