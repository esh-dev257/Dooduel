# Dooduel

A real-time multiplayer draw-and-vote game. Players simultaneously draw a secret prompt, then vote anonymously on each other's artwork. Built with React, Express, and Socket.IO — no database, no accounts.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Tailwind CSS v3, HTML5 Canvas |
| Backend | Node.js, Express 5, Socket.IO 4 |
| Real-time | Socket.IO (WebSocket / long-poll) |
| Styling | Tailwind CSS v3 + Press Start 2P pixel-art theme |
| State | In-memory only (no database) |


---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & Run (development)

```bash
# Install server + client dependencies in one step
npm install          # postinstall auto-runs: cd client && npm install

# Start both servers concurrently (recommended)
npm run dev          # Express on :3001  +  React dev server on :3000
```

- Frontend: http://localhost:3000
- Backend API / sockets: http://localhost:3001 (proxied automatically)

### Production build

```bash
npm run build        # builds React into client/build/
npm start            # Express serves everything on port 3001
```

### Health check

```bash
curl http://localhost:3001/health
```

---

## How to Play

1. Open the app, pick a username and one of 18 pixel-art avatars.
2. **Create** a private room (4-character code) or **Join** an existing one.
3. The host starts the game once at least 2 players have joined.
4. **Drawing phase** — everyone draws the same prompt simultaneously.
   - Round 1 (Easy) — 1 min 30 s
   - Round 2 (Medium) — 1 min
   - Round 3 (Hard) — 45 s
5. **Voting phase** — drawings are anonymised (labeled A, B, C…). Vote for your favourite or skip. You cannot vote for your own drawing.
6. **Results** — votes tallied, scores awarded, drawing quality ratings shown per player.
7. After 3 rounds the **Game Over** screen shows final rankings, achievements, best-drawing collage, and share options.

---

## Scoring

| Source | Points |
|---|---|
| Per vote received | 100 pts |
| Round winner bonus (most votes) | +50 pts |
| Drawing quality bonus | 0 – 100 pts |

Drawing quality is rated 0–10 based on: stroke effort (40%), canvas coverage (25%), colour variety (20%), and stroke detail (15%). The rating × 10 is added to the score.

### Achievements

| Badge | Condition |
|---|---|
| Champion | Highest final score |
| Fan Favorite | Most votes received overall |
| Picasso | Highest average drawing quality |
| Consistent | Smallest score variance across rounds |

---

## Drawing Tools

| Tool | Behaviour |
|---|---|
| Pen | Smooth bezier stroke in the selected colour |
| Eraser | Draws solid white — restores the canvas background |
| Fill | BFS flood fill with 30 px colour tolerance |
| Undo | Full stroke-history replay (no snapshot stack) |

Colours: 12 palette swatches + custom colour picker. Five brush sizes.

---

## Responsive Design

The UI adapts to phone, tablet, and desktop without separate routes:

| Breakpoint | Layout |
|---|---|
| < 1280 px (phone / tablet) | Single column — player strip at top, mobile chat bar pinned to bottom |
| ≥ 1280 px (laptop / desktop) | 3-column — PlayerList sidebar (200 px) · content · Chat panel (260 px) |

- **Chat**: starts collapsed on desktop (click to expand); fixed bottom bar on mobile (tap to open).
- **Player strip**: compact horizontal scroll strip shown during active game phases; hidden in lobby.
- **Canvas toolbar**: 3-row compact layout on mobile; single-row layout on desktop.
- **Game Over**: responsive podium and achievement grid; no chat panel on this screen.

---

## Project Structure

```
dooduel/
├── server.js              # Express + Socket.IO setup, static serving
├── socketHandlers.js      # Socket event registration + rate limiting
├── roomManager.js         # In-memory room/player state, vote tallying
├── gameLoop.js            # Phase timers and automatic transitions
├── rateDrawing.js         # Drawing quality scoring algorithm
├── prompts.js             # Tiered prompt library (Easy / Medium / Hard)
├── avatars.js             # Fallback emoji+colour avatar assignment
└── client/
    ├── public/
    │   ├── avatar/        # Avatar (1).png … Avatar (18).png
    │   └── assets/        # dice.png (randomise button)
    └── src/
        ├── App.js                    # Entry point, routing, animated background
        ├── socket.js                 # Shared Socket.IO client instance
        ├── tailwind.css              # Global styles + component classes
        └── components/
            ├── JoinRoom.js           # Login / room creation screen
            ├── Room.js               # Main game container, socket event hub
            ├── Canvas.js             # Drawing tool (pen, eraser, fill, undo)
            ├── Voting.js             # Anonymous voting cards with canvas replays
            ├── Results.js            # Round results, rating bars, scoreboard
            ├── GameSummary.js        # End screen — podium, achievements, share
            ├── Timer.js              # MM:SS countdown with colour-coded urgency
            ├── PlayerList.js         # Desktop sidebar sorted by score
            └── Chat.js               # Collapsible chat with emoji picker
```

---

## Architecture Notes

**No database** — all state lives in a single in-memory `rooms` object in `roomManager.js`. Restarting the server clears all rooms.

**Real-time sync** — the server emits `roomUpdate` and `gameStateChange` events that drive every UI transition. Client components are purely reactive.

**Anonymous voting** — drawings are shuffled and assigned letter labels (A, B, C…). The server maintains the `anonId ↔ socketId` mapping; clients never see real socket IDs during voting.

**Reconnection** — on disconnect, a 30-second grace window allows the same username to reconnect to the same room and resume their session.

**Deployment (Render)** — `npm install` → `npm run build` → `npm start`. No manual steps needed. Build command: `npm run build`. Start command: `npm start`.
