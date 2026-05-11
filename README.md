# Dooduel

A real-time multiplayer draw-and-vote game. Players take turns drawing a prompt, then vote anonymously on each other's work. Built with React, Express, and Socket.IO.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Tailwind CSS v3, HTML5 Canvas |
| Backend | Node.js, Express 5, Socket.IO 4 |
| Real-time | Socket.IO (WebSocket / long-poll) |
| Styling | Tailwind CSS + Press Start 2P (pixel art theme) |
| State | In-memory (no database) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & Run (development)

```bash
# Install all dependencies (server + client)
npm run setup

# Start both servers concurrently
npm run dev
```

- Backend: http://localhost:3001
- Frontend: http://localhost:3000 (proxies API/socket to 3001)

### Production

```bash
npm run build-client   # Build React into client/build/
npm start              # Serve everything from Express on port 3001
```

### Health check

```bash
curl http://localhost:3001/health
```

---

## How to Play

1. Open the app and pick a username + avatar.
2. Create a private room (4-character code) or join an existing one with a room code.
3. The host starts the game once at least 2 players have joined.
4. **Drawing phase** — everyone draws the same prompt simultaneously (90 / 60 / 45 seconds across 3 rounds).
5. **Voting phase** — drawings are shuffled and shown anonymously (labeled A, B, C…). Vote for your favourite — you can't vote for your own.
6. **Results** — votes are tallied, scores awarded, and drawing quality ratings shown.
7. After 3 rounds (Easy → Medium → Hard), the Game Summary screen shows final rankings, achievements, and a collage of the best drawings.

---

## Scoring

- **100 pts** per vote received
- **50 bonus pts** for the drawing with the most votes in a round
- **Drawing quality bonus** — up to 100 pts based on stroke count, bounding box coverage, color variety, and detail level

### Achievements

| Achievement | Condition |
|---|---|
| Champion | Highest final score |
| Fan Favorite | Most votes received overall |
| Picasso | Highest average drawing quality rating |
| Consistent | Smallest score variance across rounds |

---

## Project Structure

```
dooduel/
├── server.js              # Express + Socket.IO setup, static serving
├── socketHandlers.js      # All socket event registration + rate limiting
├── roomManager.js         # In-memory room/player state, vote tallying
├── gameLoop.js            # Phase timers and automatic transitions
├── rateDrawing.js         # Drawing quality scoring algorithm
├── prompts.js             # Tiered prompt library (Easy / Medium / Hard)
└── client/
    └── src/
        ├── App.js                    # Entry point, routing, background layer
        ├── socket.js                 # Shared Socket.IO client instance
        ├── tailwind.css              # Global styles + component classes
        └── components/
            ├── JoinRoom.js           # Login / room creation screen
            ├── Room.js               # Main game container, socket event hub
            ├── Canvas.js             # Drawing tool (pen, eraser, flood fill, undo)
            ├── Voting.js             # Anonymous voting cards with mini canvas replays
            ├── Results.js            # Round results, rating bars, scoreboard
            ├── GameSummary.js        # End screen — podium, achievements, collage, share
            ├── Timer.js              # Countdown bar with color-coded urgency
            ├── PlayerList.js         # Sidebar player list sorted by score
            └── Chat.js               # Fixed chat panel with emoji picker
```

---

## Architecture Notes

**No database** — all state lives in a single in-memory `rooms` object in `roomManager.js`. Restarting the server clears all rooms.

**Real-time sync** — the server emits `roomUpdate` and `gameStateChange` events that drive every UI transition. Client components are purely reactive.

**Anonymous voting** — drawings are shuffled and assigned letter labels (A, B, C…). The server maintains the `anonId` ↔ `socketId` mapping internally; clients never see real socket IDs during voting.

**Reconnection** — on disconnect, a 30-second grace window allows the same username to reconnect to the same room and resume their session.
