# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
# Install all dependencies (server + client)
npm run setup

# Run backend dev server (nodemon, port 3001)
npm run dev

# Run React frontend dev server (port 3000, proxies to 3001)
cd client && npm start

# Build React for production
npm run build-client

# Run production server (serves built React from client/build/)
npm start
```

### Health check
```bash
curl http://localhost:3001/health
```

There are no tests or linting configured in this project.

---

## Architecture

### Two-process dev setup
In development, two servers run simultaneously: the Express/Socket.IO backend on port 3001 and the React dev server on port 3000. The React app proxies API/socket traffic to 3001 via `client/package.json`'s `"proxy"` field. In production, Express serves the React build directly from `client/build/`.

### Real-time state model
There is no database. All game state lives in a single in-memory `rooms` object inside `roomManager.js`. Socket.IO is the exclusive mechanism for syncing state from server to clients — the server emits `roomUpdate` and `gameStateChange` events that drive all UI transitions in `Room.js`. Client components are purely reactive; they never mutate shared state directly.

### Game phase lifecycle
`gameLoop.js` drives phase transitions via `setTimeout`. The sequence per round is:
```
WAITING → DRAWING (90/60/45s) → VOTING (20s) → RESULT (8s) → [next round or GAME_OVER]
```
Transitions fire automatically or early if all players vote. Three rounds total, each with increasing difficulty (Easy → Medium → Hard) and shorter draw time. After 3 rounds, a `gameOver` event is emitted with full stats and achievements.

### Anonymization for voting
When the DRAWING phase ends, `roomManager.getAnonymousDrawings()` shuffles drawings and assigns each a letter label (A, B, C…), storing a bidirectional mapping between `anonId` ↔ `socketId`. The `vote` event takes an `anonId`, which the server resolves internally. Clients never see real socket IDs during voting.

### Drawing data flow
Strokes are sent from `Canvas.js` via `drawStroke` events as `{ points, color, lineWidth, type }` arrays. The server accumulates them in `room.drawings[socketId]`. During voting, the full stroke arrays are sent to all clients via `gameStateChange`, and each `Voting.js` card re-renders strokes onto a `<canvas>` element client-side.

### Reconnection window
On disconnect, `roomManager.disconnectPlayer()` soft-deletes the player and starts a 30-second `setTimeout`. If the player reconnects within that window (matched by username + roomId), their session is restored. After 30 seconds, `finalizeLeave()` permanently removes them.

### Scoring
- 100 points per vote received during voting phase
- 50 bonus points for the drawing with the most votes
- Bonus from `rateDrawing.js`: score (0–10) × 10 points, based on stroke count (effort 40%), bounding box coverage (25%), color variety (20%), and points-per-stroke detail (20%)

### Key backend files
| File | Responsibility |
|---|---|
| `server.js` | Express + Socket.IO setup, static serving, graceful shutdown |
| `socketHandlers.js` | All socket event registration, rate limiting (60 draw/s, 1 chat/s) |
| `roomManager.js` | In-memory room/player state, vote tallying, achievement calculation |
| `gameLoop.js` | Phase timers and transition logic |
| `rateDrawing.js` | Drawing quality scoring algorithm |
| `prompts.js` | Tiered prompt library, repeat-prevention (last 3) |

---

## UI Design System

### Styling approach
**Tailwind CSS v3** is the sole styling mechanism. There are **no per-component CSS files**. All styles use Tailwind utility classes directly in JSX. Global styles and reusable component classes live in `client/src/tailwind.css`. Dynamic values (colors from JS variables, inline positioning) use `style={{}}`.

### Theme
- **Font**: Press Start 2P (Google Fonts) — pixel-art monospace, applied globally via `@layer base`
- **Background**: `#3B3FA5` / `#4A4EB5` checkerboard via `repeating-conic-gradient`, `background-size: 20px 20px`
- **Global font-size**: `125%` on `body` (makes everything 25% larger than browser default)
- **Accents**: Gold (`#FFD700`), Pink (`#FF66CC`), Green (`#00C060`), Cyan (`#44AAFF`), Red (`#E83030`)
- **Borders**: Always 4px solid black (`border-pixel-border` = `#000000`), colored variants use `border-pixel-*`
- **Shadows**: Hard offset pixel shadows — `4px 4px 0 #000`. Never use `blur`, `gradients`, or `border-radius`
- **Aesthetic**: Retro arcade / pixel art — `border-radius: 0 !important` enforced globally on `*`

### Tailwind config (`client/tailwind.config.js`)
Custom color palette under `pixel.*`:
| Token | Hex | Usage |
|---|---|---|
| `pixel-bg` | `#3B3FA5` | Background base |
| `pixel-bgdark` | `#2A2D7A` | Darker panels, header, input bg |
| `pixel-panel` | `#1A1A4E` | Card/panel backgrounds |
| `pixel-card` | `#A8C8F0` | Light card fill |
| `pixel-panelBorder` | `#5558CC` | Subtle inner borders |
| `pixel-gold` | `#FFD700` | Primary accent, buttons, headings |
| `pixel-pink` | `#FF66CC` | Hover states, accent |
| `pixel-green` | `#00C060` | Success, system messages |
| `pixel-cyan` | `#44AAFF` | Self-player highlight |
| `pixel-red` | `#E83030` | Errors, danger |
| `pixel-orange` | `#FF8C00` | Medium difficulty |
| `pixel-dim` | `#8888BB` | Placeholder, label text |
| `pixel-border` | `#000000` | Hard border color |
| `pixel-borderAlt` | `#5558CC` | Soft border variant |

Custom animations defined in config:
- `animate-cloud-1/2/3/4` — drifting pixel clouds (20–32s, staggered delays)
- `animate-twinkle-1/2/3/4/5` — star opacity pulses (3s, staggered 0.5s)
- `animate-float-up` — victory emoji float (2s, forwards)
- `animate-winner-pop` — scale-in pop (0.4s)
- `animate-blink` / `animate-blink-step` / `animate-blink-fast` / `animate-blink-live` — blinking text
- `animate-phase-slide` — game phase transition slide-in (0.3s)
- `animate-timer-pulse` — timer bar subtle pulse (0.5s)
- `animate-shake` — horizontal shake on error (0.3s)
- `animate-load-bar` — loading bar fill (2.5s cubic-bezier)
- `animate-logo-pulse` — gold glow on logo (2s)

Custom box-shadow tokens: `shadow-pixel`, `shadow-pixel-sm`, `shadow-pixel-lg`, `shadow-pixel-gold`, `shadow-pixel-red`, `shadow-pixel-cyan`, `shadow-pixel-none`

### Global component classes (`client/src/tailwind.css`)
Defined in `@layer components` — always prefer these over recreating the pattern inline:
- `.pixel-card` — dark panel card (`bg-pixel-panel border-4 border-pixel-border`, `4px 4px 0 #000` shadow)
- `.pixel-card-light` — light variant (`bg-pixel-card`)
- `.pixel-btn` — gold primary button (hover: `-translate-y-0.5`, active: `translate-x-1 translate-y-1 shadow-none`, disabled: `opacity-50`)
- `.pixel-btn-secondary` — dark bg, white text, soft border
- `.pixel-btn-danger` — red bg, `shadow-pixel-red`
- `.pixel-input` — black bg, purple border, green text, gold border on focus
- `.pixel-scroll` / `.chat-msg-area` — custom pixel scrollbar (8px, `#5558CC` thumb)

Utility classes in `@layer utilities`: `.pixel-shadow`, `.pixel-shadow-sm`, `.pixel-shadow-lg`, `.pixel-shadow-gold`, `.pixel-shadow-red`, `.pixel-shadow-cyan`, `.pixel-shadow-none`, `.pressed`, `.size-dot`

### Layout (gameplay)
- Three-column layout during gameplay: sidebar (190px fixed) | main (flex-grow) | chat panel (290px fixed bottom-right)
- Sidebar and chat collapse to top/bottom rows on mobile (`sm:` breakpoint)
- Phase transitions: `animate-phase-slide` on a keyed wrapper div (key = `phaseKey` counter incremented in `Room.js`)

---

## Component Reference

### `App.js`
Entry point and router. Imports `./tailwind.css`. Manages `roomState`, `socketId`, `roomId`. Renders: loading screen → `JoinRoom` → `Room`.

**`SpaceLayer` component** (inline in App.js): 4 pixel SVG clouds with staggered `animate-cloud-*` + 15 twinkling `animate-twinkle-*` star divs. Fixed, `pointer-events-none`, `z-index: 0`.

**Loading screen**: Animated gold bar (`animate-load-bar`), cycles 5 messages every 560ms (`animate-blink-step`), pixel tip box.

**Header**: `h-11 bg-pixel-bgdark border-b-4 border-pixel-border` — DOO in `text-pixel-gold`, DUEL in `text-pixel-pink`.

---

### `JoinRoom.js`
Login screen. No separate CSS file — pure Tailwind. State: `username`, `roomId`, `error`, `joining`, `avatarIdx`, `shake`.

**Avatar picker**: 6 avatars (`AVATARS` array with `emoji` + `color`). Grid of `aspect-square border-4` buttons. Active: `border-pixel-gold scale-110`. Selected avatar previewed in `w-20 h-20` box with `backgroundColor: selectedAvatar.color`.

**Live name hero**: `{username.trim() ? username.trim().toUpperCase() : 'PLAYER 1'}?` — updates in real time as user types.

**Name limit**: 10 characters max — `onChange={(e) => setUsername(e.target.value.slice(0, 10))}` + `maxLength={10}`.

**Persistence**: Saves `username` + `avatarIdx` to `localStorage` key `dooduel_stats`.

**URL param**: Auto-fills room code from `?room=` query string on mount.

**Error state**: `animate-shake` class toggled via `shake` state (resets after 400ms) on the card wrapper.

**Buttons**: `.pixel-btn` (JOIN GAME), `.pixel-btn-secondary` (CREATE PRIVATE ROOM — generates 4-char alphanumeric code).

---

### `Room.js`
Main game container. Pure Tailwind. The most complex component.

**State** (13+ variables):
| Variable | Type | Purpose |
|---|---|---|
| `players` | object | `{socketId: {username, avatar, score}}` |
| `host` | string | socketId of room host |
| `gameState` | string | `WAITING \| DRAWING \| VOTING \| RESULT \| GAME_OVER` |
| `prompt` | string | Current drawing prompt |
| `difficulty` | string | `Easy \| Medium \| Hard` |
| `round` | number | Current round (1–3) |
| `remaining` / `totalDuration` | number | Timer values in seconds |
| `drawings` | object | `{anonId: {label, strokes}}` |
| `yourAnonId` | string | Player's anonymous ID during voting |
| `results` | object | `{winners, scores}` |
| `ratings` | object | Drawing quality data per player |
| `voteInfo` | object | `{totalVotes, totalPlayers}` |
| `gameSummary` | object | Final summary for GameSummary component |
| `phaseKey` | number | Incremented to trigger `animate-phase-slide` |
| `toasts` | array | `{id, text, type}` — auto-dismiss after 3s |
| `disconnected` | bool | Socket connection state |
| `floatingReactions` | array | `{id, emoji, x}` — float upward 2s |

**Socket events listened**: `roomUpdate`, `gameStateChange`, `timerTick`, `voteUpdate`, `gameError`, `gameOver`, `playerJoined`, `playerLeft`, `disconnect`, `connect`

**Phase-specific JSX** (all keyed to `phaseKey`, wrapped with `animate-phase-slide`):
- `WAITING`: Round info cards (Easy/Medium/Hard), Start Game button (host only, ≥2 players), invite link
- `DRAWING`: Prompt banner with left gold border + difficulty badge, then `<Canvas>`
- `VOTING`: Vote progress counter, `<Voting>` component
- `RESULT`: `<Results>` component + next-round hint
- `GAME_OVER`: `<GameSummary>` component

**Overlays**:
- Toast notifications: fixed top-center — green for join, red for leave, `animate-phase-slide`
- Reconnect banner: fixed top, red bg, blinking dot (`animate-blink`)
- Floating reactions: fixed bottom, `animate-float-up` per emoji

**Difficulty badge colors**: Easy = `bg-pixel-green`, Medium = `bg-pixel-orange`, Hard = `bg-pixel-red`

---

### `Canvas.js`
HTML5 drawing tool. Pure Tailwind. Canvas resolution always **800×560**; scales to viewport via CSS `aspect-ratio`.

**State**: `selectedColor` (hex), `selectedSize` (2/4/8/14/24), `activeTool` (`pen|eraser|fill`)

**Refs** (mutated during draw events, not state):
- `canvasRef`, `isDrawing`, `currentStroke`, `colorRef`, `sizeRef`, `strokeHistory`

**Drawing pipeline**:
1. `mousedown`/`touchstart` → begin stroke
2. `mousemove`/`touchmove` → append point, render quadratic bezier via midpoint interpolation
3. `mouseup`/`touchend` → finalize, emit `drawStroke` to server, push to `strokeHistory`

**Tools**:
- **Pen**: `globalCompositeOperation: 'source-over'`, bezier curves
- **Eraser**: `globalCompositeOperation: 'destination-out'`
- **Fill**: BFS flood fill with 30px color tolerance; emits `fillAction`

**Undo**: Replays entire `strokeHistory` from scratch — no snapshot stack.

**Exported statics** (used by `Voting.js` and `GameSummary.js`):
- `Canvas.drawSmoothStroke(ctx, stroke, scaleX, scaleY)`
- `Canvas.replayFill(ctx, fillAction, scaleX, scaleY)`
- `Canvas.CANVAS_WIDTH` = 800, `Canvas.CANVAS_HEIGHT` = 560

**Toolbar**: `bg-pixel-panel` 120px right column. Tool buttons — active = `border-pixel-gold bg-pixel-gold text-pixel-black`. Color swatches — active = `border-pixel-gold scale-110`. Size picker — 5 buttons with `.size-dot` inside. On mobile, toolbar moves below canvas.

**Color palette**: 12 preset hex colors + custom `<input type="color">`.

---

### `Voting.js`
Displays anonymous drawings for voting. Pure Tailwind. State: `votedFor` (anonId), `voteError`.

**Props**: `drawings` (`{anonId: {label, strokes}}`), `socketId`, `yourAnonId`

**`MiniCanvas`** (internal component): Replays strokes at **360×252** (45% scale). `scaleX = 360/800`, `scaleY = 252/560`. Uses `Canvas.drawSmoothStroke()` and `Canvas.replayFill()`.

**Drawing card states**:
- Default: dark border (`border-pixel-border`)
- Hover: `-translate-y-1 border-pixel-pink`
- Voted: `border-pixel-green`
- Self: `opacity-55`, "(Yours)" label, no vote button

---

### `Results.js`
Display-only. Pure Tailwind. Props: `results` (`{winners, scores}`), `ratings` (`{socketId: {username, score, label, breakdown}}`).

**Sections**:
1. **Winner cards**: `animate-winner-pop`, `border-pixel-gold`, `shadow-pixel-gold`
2. **Rating cards**: Color-coded score badge + label + 4 breakdown bars
   - Score colors: ≥8 `bg-pixel-green`, ≥5 `bg-pixel-gold`, ≥3 `bg-pixel-orange`, <3 `bg-pixel-red`
   - Bars: `transition-[width] duration-700` from 0 to `score%`
3. **Scoreboard table**: First-place row `bg-pixel-gold text-pixel-black`

---

### `GameSummary.js`
End-of-game screen. Pure Tailwind. Props: `summary` (`{roundHistory, finalScores, achievements}`), `roomId`, `socketId`, `onBackToLobby`.

**Sections**:
1. **Podium**: 2nd | 1st | 3rd display order (center tallest), staggered `animate-winner-pop`, medal border colors
2. **Achievements grid**: 2-column, `.pixel-card-light`, Champion / Fan Favorite / Picasso / Consistent badges
3. **Best Drawings collage**: `CollageCanvas` component using `Canvas.drawSmoothStroke()` / `Canvas.replayFill()`, labeled with round/prompt/winner

**Share / download** (two actions):
- **Personal card** (600×800px offscreen canvas): avatar, rank, score, achievements, best drawing, room code footer
- **Full collage** (dynamic height): all winning drawings in 3-column grid
- Both use `navigator.share()` with blob fallback to direct download

---

### `Timer.js`
Stateless. Pure Tailwind. Props: `remaining` (seconds), `total` (seconds).

**Color bands** (hard-coded, no interpolation):
- >50% remaining: `text-pixel-green` / `bg-pixel-green`
- >25% remaining: `text-pixel-gold` / `bg-pixel-gold`
- ≤25% remaining: `text-pixel-red` / `bg-pixel-red`
- ≤10s: `animate-blink-fast` on text, `animate-timer-pulse` on bar

---

### `PlayerList.js`
Stateless. Pure Tailwind. Props: `players`, `host`, `socketId`.

Sorted by score descending. Self row: `border-pixel-cyan`. HOST badge: `bg-pixel-gold text-pixel-black`. YOU badge: `bg-pixel-cyan text-pixel-black`. Empty state: ghost emoji + "NO PLAYERS YET".

---

### `Chat.js`
Fixed panel, bottom-right on desktop / full-width on mobile. Pure Tailwind. State: `messages` (max 100), `inputText`, `showEmojis`, `activeCategory`, `isMinimized`, `unreadCount`, `sendDisabled`, `cooldown`, `chatError`, `errorBorder`.

**Socket events**: listens `chatMessage`, `playerJoined`, `playerLeft`; emits `chatMessage`

**Minimize behavior**: Outer container is always full-size. All body content (messages, emoji picker, input) is wrapped in `{!isMinimized && (<>...</>)}` — React conditional rendering, not CSS height. Header (`h-10`) is always rendered.

**Behaviors**:
- Auto-scrolls to bottom on new message (`messagesEndRef`)
- 1-second client-side cooldown between sends — button shows `${cooldown}s` countdown
- Unread badge (red, border-2): increments when minimized, resets on expand
- System messages (join/leave): centered, `text-pixel-green`
- Self messages: `border-pixel-cyan self-end`; others: `border-pixel-borderAlt self-start`

**Emoji picker**: 3 category tabs (`😀` / `🎮` / `✨`), each with 20 emojis in an 8-column grid. Max-height 120px.

**Panel dimensions**: `w-full sm:w-[290px]`, max-height 420px when expanded. Header always 40px (`h-10`).
