# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
# Install all dependencies (root + client) in one step
npm install          # postinstall auto-runs: cd client && npm install

# Run both servers simultaneously with hot reload (recommended)
npm run dev          # Express on :3001 + React dev server on :3000 (via concurrently)

# Run servers individually if needed
npm run dev:client   # React dev server only (port 3000)

# Build React for production
npm run build        # cd client && npm run build

# Run production server (serves built React from client/build/)
npm start
```

### Health check
```bash
curl http://localhost:3001/health
```

### Dev workflow
- Run `npm run dev` from the project root
- Open **http://localhost:3000** in the browser — changes hot-reload instantly on save
- Never use `npm run build` during development — only needed for production deploys

There are no tests or linting configured in this project.

---

## Architecture

### Two-process dev setup
In development, `npm run dev` uses `concurrently` to run two servers:
- Express/Socket.IO backend on port 3001 (`nodemon server.js`)
- React dev server on port 3000 (`cd client && npm start`)

The React app proxies API/socket traffic to 3001 via `client/package.json`'s `"proxy"` field. In production, Express serves the React build directly from `client/build/` — only one process runs.

### Render deployment
Render runs `npm install` (triggers `postinstall` → client install), then `npm run build` (builds React), then `npm start`. No manual steps. Build command: `npm run build`. Start command: `npm start`.

### Real-time state model
There is no database. All game state lives in a single in-memory `rooms` object inside `roomManager.js`. Socket.IO is the exclusive mechanism for syncing state from server to clients — the server emits `roomUpdate` and `gameStateChange` events that drive all UI transitions in `Room.js`. Client components are purely reactive; they never mutate shared state directly.

### Game phase lifecycle
`gameLoop.js` drives phase transitions via `setTimeout`. The sequence per round is:
```
WAITING → DRAWING (90/60/45s) → VOTING (20s) → RESULT (8s) → [next round or GAME_OVER]
```
Transitions fire automatically or early if all players have voted OR skipped. Three rounds total, each with increasing difficulty (Easy → Medium → Hard) and shorter draw time. After 3 rounds, a `gameOver` event is emitted with full stats and achievements.

### Anonymization for voting
When the DRAWING phase ends, `roomManager.getAnonymousDrawings()` shuffles drawings and assigns each a letter label (A, B, C…), storing a bidirectional mapping between `anonId` ↔ `socketId`. The `vote` event takes an `anonId`, which the server resolves internally. Clients never see real socket IDs during voting.

### Voting + skip logic
Each player can take exactly one action per voting phase: **vote** for a drawing OR **skip** (no preference). Both lock the client UI immediately. The server tracks skips in `room.skips` (a `Set`). `getVoteInfo()` returns `totalActed = votes + skips` for the progress counter. `allPlayersActed()` triggers early phase end when every active player has voted or skipped. Skips contribute zero votes — they only advance the phase.

Socket events:
- Client emits `vote { anonId }` → server calls `castAnonVote()`, responds `{ success, error }`
- Client emits `skipVote` → server calls `recordSkip()`, no callback
- Server emits `voteUpdate { totalVotes, totalPlayers }` after each action (totalVotes = votes + skips)

### Drawing data flow
Strokes are sent from `Canvas.js` via `drawStroke` events as `{ points, color, lineWidth, type }` arrays. The server accumulates them in `room.drawings[socketId]`. During voting, the full stroke arrays are sent to all clients via `gameStateChange`, and each `Voting.js` card re-renders strokes onto a `<canvas>` element client-side.

### Reconnection window
On disconnect, `roomManager.disconnectPlayer()` soft-deletes the player and starts a 30-second `setTimeout`. If the player reconnects within that window (matched by username + roomId), their session is restored. After 30 seconds, `finalizeLeave()` permanently removes them.

### Scoring
- 100 points per vote received during voting phase
- 50 bonus points for the drawing with the most votes
- Bonus from `rateDrawing.js`: score (0–10) × 10 points, based on stroke count (effort 40%), bounding box coverage (25%), color variety (20%), and points-per-stroke detail (20%)

### Avatar system
Avatars are PNG images served from `client/public/avatar/`. 18 files named `Avatar (1).png` through `Avatar (18).png`. Referenced via public URL `/avatar/Avatar (N).png` — no import needed.

The avatar object sent to the server on join is `{ emoji: '', color: '#2A2D7A', url: '/avatar/Avatar (N).png' }`. The server sanitiser (`socketHandlers.js`) preserves all three fields. All components check `avatar.url` first and render the PNG if present, falling back to `emoji`/`color` for legacy sessions.

A dice image at `client/public/assets/dice.png` is used in JoinRoom as a clickable randomize button.

### Key backend files
| File | Responsibility |
|---|---|
| `server.js` | Express + Socket.IO setup, static serving, graceful shutdown |
| `socketHandlers.js` | All socket event registration, rate limiting (60 draw/s, 1 chat/s), avatar sanitisation, `vote` + `skipVote` handlers |
| `roomManager.js` | In-memory room/player state, vote tallying, skip tracking, achievement calculation |
| `gameLoop.js` | Phase timers and transition logic |
| `rateDrawing.js` | Drawing quality scoring algorithm |
| `prompts.js` | Tiered prompt library, repeat-prevention (last 3) |
| `avatars.js` | Fallback emoji+color avatar assignment when no client avatar provided |

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
- True 3-column layout: `PlayerList` (200px, self-contained) | center `flex-1` | `Chat` (260px expanded / 8px minimized, self-contained)
- Header bar (`h-14`) always visible: DOODUEL logo + LEAVE (left), Timer MM:SS + round/difficulty (center), clickable room code copy (right)
- Phase transitions: `animate-phase-slide` on a keyed wrapper div (key = `phaseKey` counter incremented in `Room.js`)

---

## Static Assets

```
client/public/
├── avatar/
│   ├── Avatar (1).png … Avatar (18).png   ← player avatar PNGs
└── assets/
    └── dice.png                            ← randomize button in JoinRoom
```

All files in `client/public/` are served as-is. Reference them with absolute paths from root: `/avatar/Avatar (1).png`, `/assets/dice.png`. No imports needed.

---

## Component Reference

### `App.js`
Entry point and router. Imports `./tailwind.css`. Manages `roomState`, `socketId`, `roomId`. Renders: loading screen → `JoinRoom` → `Room`.

**`SpaceLayer` component** (inline in App.js): 4 pixel SVG clouds with staggered `animate-cloud-*` + 15 twinkling `animate-twinkle-*` star divs. Fixed, `pointer-events-none`, `z-index: 0`.

**Loading screen**: Animated gold bar (`animate-load-bar`), cycles messages every 560ms (`animate-blink-step`).

**Header**: Commented out — no persistent header bar in App.js. The DOODUEL title appears in JoinRoom (above card) and in Room.js header bar.

---

### `JoinRoom.js`
Login screen. Pure Tailwind. State: `username`, `roomId`, `error`, `joining`, `avatarIdx`, `shake`.

**Layout**: `flex-col items-center justify-center` — DOODUEL title rendered above the card, outside it.

**Title** (outside card): DOO in `text-pixel-gold` + DUEL in `text-pixel-pink`, `text-3xl`, hard text-shadows.

**Avatar carousel**: 18 PNG avatars from `/avatar/Avatar (N).png`, built as `AVATARS` array via `Array.from`. No imports — public folder URLs.
- Dice image (`/assets/dice.png`, `w-8 h-8`) sits to the left of the avatar box, top-aligned via `items-start`. Clicking it randomizes `avatarIdx`.
- Avatar preview box: `w-32 h-32 border-4`, PNG rendered with `imageRendering: pixelated`
- Counter below box: `{avatarIdx + 1} / 18`
- Arrow buttons below counter: `pixel-btn-secondary px-2 py-0.5 text-sm`, centered under avatar box (not under dice)
- Dice and avatar column are siblings in a `flex-row items-start` row so arrows stay centered under the avatar

**Live name hero**: `{username.trim() ? username.trim().toUpperCase() : 'PLAYER 1'}?` — updates in real time as user types.

**Name limit**: 16 characters max with inline counter (`{n}/16` shown when `username.length > 0`).

**Room code**: 4 characters max, forced uppercase via `onChange`.

**Persistence**: Saves `username` + `avatarIdx` to `localStorage` key `dooduel_stats`.

**URL param**: Auto-fills room code from `?room=` query string on mount.

**Error state**: `animate-shake` class toggled via `shake` state (resets after 400ms) on the card wrapper.

**Join logic**: Two handlers — `handleJoin` (requires existing room code) and `handleCreate` (generates 4-char code then joins). Both call `doJoin(roomCode)`. Avatar sent as `{ emoji: '', color: '#2A2D7A', url: '/avatar/Avatar (N).png' }`.

**Buttons**: `.pixel-btn` (JOIN GAME), `.pixel-btn-secondary` (CREATE ROOM).

---

### `Room.js`
Main game container. Pure Tailwind. The most complex component.

**Layout**: `flex-col` with a fixed `h-14` header bar, then a `flex-row flex-1` body containing `PlayerList` | center section | `Chat`.

**Header bar** (`h-14 bg-pixel-bgdark`):
- Left: DOODUEL logo + LEAVE button
- Center: `<Timer>` (MM:SS) when active, round number + difficulty badge below
- Right: clickable room code — copies to clipboard, shows `✓ COPIED` for 2s

**State** (15+ variables):
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
| `voteInfo` | object | `{totalVotes, totalPlayers}` — votes + skips combined |
| `gameSummary` | object | Final summary for GameSummary component |
| `phaseKey` | number | Incremented to trigger `animate-phase-slide` |
| `toasts` | array | `{id, message, type, avatar}` — auto-dismiss after 3s |
| `disconnected` | bool | Socket connection state |
| `roomCodeCopied` | bool | Header room code copy feedback |

**Socket events listened**: `roomUpdate`, `gameStateChange`, `timerTick`, `voteUpdate`, `gameError`, `gameOver`, `playerJoined`, `playerLeft`, `disconnect`, `connect`

**Phase-specific JSX** (all keyed to `phaseKey`, wrapped with `animate-phase-slide`):
- `WAITING`: Round info cards (Easy/Medium/Hard), Start Game button (host only, ≥2 players), invite link
- `DRAWING`: Prompt banner (gold left border + difficulty badge), then `<Canvas>`
- `VOTING`: `<Voting voteInfo={voteInfo} .../>` — vote counter lives inside Voting component
- `RESULT`: `<Results socketId={socketId} .../>` + next-round hint
- `GAME_OVER`: Full-screen with header + `<GameSummary>`

**Overlays**:
- Toast notifications: fixed `top-16` (below header) center — green for join, red for leave, `animate-phase-slide`
- Reconnect banner: fixed `top-0 z-50`, red bg, blinking dot
- Floating reactions: fixed bottom, `animate-float-up` per emoji

**Difficulty badge colors**: Easy = `bg-pixel-green`, Medium = `bg-pixel-gold`, Hard = `bg-pixel-red`

---

### `Canvas.js`
HTML5 drawing tool. Pure Tailwind. Canvas resolution always **800×560**; scales to viewport via CSS `aspect-ratio`.

**Layout**: `flex-col` — canvas area on top (`flex-1`), horizontal toolbar below.

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

**Horizontal toolbar** (below canvas): tool buttons | divider | undo + clear | divider | 12 color swatches + custom color picker | divider | 5 size buttons. Active tool: `border-pixel-gold bg-pixel-gold text-pixel-black`. Active color: `border-pixel-gold scale-110`.

**Color palette**: `['#000000','#FFFFFF','#E83030','#FF8C00','#FFD700','#00C060','#44AAFF','#9B59B6','#FF66CC','#8B4513','#808080','#C0C0C0']` + custom `<input type="color">`.

---

### `Voting.js`
Displays anonymous drawings for voting. Pure Tailwind.

**Props**: `drawings` (`{anonId: {label, strokes}}`), `socketId`, `yourAnonId`, `voteInfo` (`{totalVotes, totalPlayers}`)

**State**: `action` (`null | { type: 'vote'|'skip', anonId }`), `locked` (bool), `voteError`

**Action model**: One action per player per round — either vote for a drawing or skip. Once `locked = true`, all interactive elements are inert. Vote button hidden on own drawing (not disabled).

**Handlers**:
- `handleVote(anonId)` — emits `vote { anonId }`, awaits callback, sets action + locked on success
- `handleSkip()` — emits `skipVote` (no callback), sets action + locked immediately

**`MiniCanvas`** (internal component): Replays strokes at **360×252** (45% scale). Uses `Canvas.drawSmoothStroke()` and `Canvas.replayFill()`.

**Drawing card states**:
- Default: `border-pixel-border`, hover `-translate-y-1 border-pixel-pink`
- Voted: `border-pixel-green`, `✓ VOTED` indicator inside
- Locked (not voted): `opacity-70`, `—` placeholder inside
- Self: `opacity-60 border-pixel-borderAlt`, no vote button, vertical "YOURS" label in letter strip

**SKIP button**: Shown below grid only when `!locked`. Disappears after any action.

**Status banner**: Shown after action — green for vote (`✓ YOU VOTED FOR DRAWING X`), dim for skip (`✓ YOU SKIPPED THIS ROUND`).

---

### `Results.js`
Display-only. Pure Tailwind. Props: `results` (`{winners, scores}`), `ratings` (`{socketId: {username, score, label, breakdown}}`), `socketId`.

**Avatar rendering**: `AvatarImg` helper component (defined locally) — renders PNG if `avatar.url` exists, falls back to emoji+color square.

**Privacy rule**: Own drawing card shows full breakdown (EFFORT/COVERAGE/COLORS/DETAIL bars + `+X PTS`). Other players' cards show only score + label + "— details private". Enforced client-side by `sid === socketId`.

**Own card**: `pixel-card-light border-pixel-gold shadow-pixel-gold`, wider (`minWidth: 200px`).
**Others' cards**: `pixel-card border-pixel-borderAlt`, compact (`minWidth: 150px`).

**Sections**:
1. **Winner cards**: `animate-winner-pop`, `border-pixel-gold`, `shadow-pixel-gold`
2. **Rating cards**: privacy-gated breakdown (see above)
3. **Scoreboard table**: First-place row `bg-pixel-gold text-pixel-black`

---

### `GameSummary.js`
End-of-game screen. Pure Tailwind. Props: `summary` (`{roundHistory, finalScores, achievements}`), `roomId`, `socketId`, `onBackToLobby`.

**Avatar rendering**: `AvatarImg` helper component (defined locally) — PNG-first with emoji fallback. Used in podium, standings table, and achievements grid.

**Sections**:
1. **Podium**: 2nd | 1st | 3rd display order (center tallest), staggered `animate-winner-pop`, medal border colors
2. **Achievements grid**: 2-column, `.pixel-card-light`, Champion / Fan Favorite / Picasso / Consistent badges
3. **Best Drawings collage**: `CollageCanvas` component using `Canvas.drawSmoothStroke()` / `Canvas.replayFill()`, labeled with round/prompt/winner

**Share / download** (two actions):
- **Personal card** (600×800px offscreen canvas): renders avatar PNG via `new Image()` async load, rank, score, achievements, best drawing, room code footer. `generatePersonalCard` is `async`.
- **Full collage** (dynamic height): all winning drawings in 3-column grid
- Both use `navigator.share()` with blob fallback to direct download

---

### `Timer.js`
Stateless. Pure Tailwind. Props: `remaining` (seconds), `total` (seconds).

Outputs a single `<span>` with MM:SS formatted time. No progress bar.

**Color bands**:
- >50% remaining: `text-pixel-green`
- >25% remaining: `text-pixel-gold`
- ≤25% remaining: `text-pixel-red`
- ≤10s: `animate-blink-fast`

---

### `PlayerList.js`
Stateless. Pure Tailwind. Props: `players`, `host`, `socketId`, `gameState`.

**Width**: `w-[200px] flex-shrink-0` — self-contained, no wrapper needed.

**Sort order**: Join order in `WAITING` phase; score descending in all other phases.

**Avatar rendering**: `AvatarImg` helper component (defined locally) — PNG-first with emoji fallback. Size `w-8 h-8`.

**Row layout**: rank `#N` | avatar | name + score column | HOST/YOU plain text labels (right-aligned).
- Self row: `bg-pixel-bgdark border-l-4 border-l-pixel-cyan`
- Host row: `border-l-4 border-l-pixel-gold`
- HOST label: `font-pixel text-[6px] text-pixel-gold`
- YOU label: `font-pixel text-[6px] text-pixel-cyan`
- Empty state: ghost emoji + "NO PLAYERS YET"

---

### `Chat.js`
Inline flex column in the 3-column game layout. Pure Tailwind. State: `messages` (max 100), `inputText`, `showEmojis`, `activeCategory`, `isMinimized`, `unreadCount`, `sendDisabled`, `cooldown`, `chatError`, `errorBorder`.

**Socket events**: listens `chatMessage`, `playerJoined`, `playerLeft`; emits `chatMessage`

**Avatar rendering**: inline PNG-first conditional — `msg.avatar?.url` renders `<img>`, otherwise emoji+color `<span>`. Size `w-4 h-4`.

**Width**: `w-[260px]` expanded, `w-8` minimized — `transition-[width] duration-200`.

**Minimized state** (`w-8`): vertical tab — unread badge (red) at top, rotated "💬 CHAT" label (`writingMode: 'vertical-rl', transform: 'rotate(180deg)'`) in center, `▶` arrow at bottom. Clicking anywhere on the tab expands + resets unread count.

**Expanded state**: header (`h-10`) with "💬 CHAT" and `◀` arrow (click to collapse), then messages, optional emoji picker, input row. All body content in `{!isMinimized && (<>...</>)}` — React conditional, not CSS.

**Behaviors**:
- Auto-scrolls to bottom on new message (`messagesEndRef`)
- 1-second client-side cooldown between sends — button shows `${cooldown}s` countdown
- Unread badge increments when minimized, resets on expand
- System messages (join/leave): centered, `text-pixel-green`
- Self messages: `border-pixel-cyan self-end`; others: `border-pixel-borderAlt self-start`

**Emoji picker**: 3 category tabs (`😀` / `🎮` / `✨`), each with 20 emojis in an 8-column grid. Max-height 96px.
