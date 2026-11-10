# ♟️ Chess UNO

**Chess UNO** is a real-time multiplayer strategy game combining traditional chess mechanics with UNO-style cards, abilities, and turn dynamics. Players take turns drawing cards from a 108-card deck, receiving movement quotas or special tactical abilities (piece swaps, friendly piece revivals, skips, and wild choices) before executing moves on an interactive 8×8 chessboard.

---

## 🏗️ Architecture Overview

- **Backend (`backend/ChessUno/`)**:
  - **.NET 10 ASP.NET Core Web API**: Authoritative game session controller, move validation, and game lifecycle management.
  - **SignalR Hub (`/hubs/game`)**: Real-time bidirectional WebSocket synchronization for board moves, card draws, and game events.
  - **WebRTC Signaling**: Peer-to-peer data channel relay for ultra-low latency multiplayer interaction.
  - **Rules & Engine**: Strict King safety, FEN-based board state, and JSON-configurable card effect executor.
- **Frontend (`frontend/`)**:
  - **Svelte 4 + TypeScript + Vite 5**: High-performance, reactive UI without bloated utility frameworks.
  - **Custom Strategy Design Tokens (`src/app.css`)**: Dark-themed velvet boards, physical card tactile aesthetics, and animated indicators.
  - **Zero Engine Duplication**: Frontend acts purely as an interactive view; move legality is filtered strictly from server-validated UCI lists.

---

## 📋 Prerequisites

Before running the application, make sure you have installed:

1. **[.NET 10 SDK](https://dotnet.microsoft.com/)** (`dotnet --version` should return `10.x`)
2. **[Node.js](https://nodejs.org/)** (v18 or higher) and `npm`

---

## 🚀 Running the Application Locally

To play a local two-player game, run the backend and frontend in two separate terminal windows.

### 1. Start the Backend Server

Open your first terminal in the repository root:

```powershell
dotnet run --project backend/ChessUno/ChessUno.Web --urls "http://localhost:5000"
```

Once running, the backend will listen on:
- **API & Hub Base**: `http://localhost:5000`
- **Health Check**: `http://localhost:5000/health`
- **SignalR Endpoint**: `http://localhost:5000/hubs/game`

### 2. Start the Frontend Dev Server

Open a second terminal, navigate to `frontend/`, install dependencies (if first time), and start Vite:

```powershell
cd frontend
npm install
npm run dev
```

The frontend will start at:
- **Web App**: **`http://localhost:5173`**
*(Vite proxies `/api` and `/hubs` requests to `http://localhost:5000` automatically).*

---

## 🎮 How to Play a Two-Player Match

1. **Player 1 (Host - White)**:
   - Open **[http://localhost:5173](http://localhost:5173)** in your browser.
   - Enter your player name (e.g., `Alice`) and click **"Create Match"**.
   - In the **Waiting Room**, click **"Copy Link"** to copy your unique invitation URL (e.g., `http://localhost:5173/join/<TOKEN>`).

2. **Player 2 (Guest - Black)**:
   - Open a **separate browser window** or an **Incognito / Private tab** (to avoid session collisions in the same browser).
   - Paste the invitation URL into the address bar.
   - Enter your player name (e.g., `Bob`) and click **"Join Match"**.

3. **Gameplay**:
   - Both browser screens will transition into the **Game Arena**.
   - **White moves first**: The active player clicks **"Click to Draw"** to draw a card from the deck.
   - **Number Cards (1–9)**: Grant up to that number of legal chess moves in the turn. Select a friendly piece to see valid destination dots (`dest-dot`), then click the target square to execute the move.
   - **Action Cards**:
     - **Reverse**: Activate swap mode to exchange the positions of two friendly non-king pieces.
     - **Draw Two / Revive**: Resurrect captured friendly pieces from reserves onto empty squares on your half of the board.
     - **Skip**: Retain initiative and skip the opponent's turn.
     - **0 Card / Pass**: End turn without making chess moves.
   - When turn quotas are consumed (or if you click **"End Turn"**), the turn passes to the opponent.
   - **Resignation & Checkmate**: Matches conclude with an authoritative **Game Over** overlay indicating Victory or Defeat.

---

## 🧪 Running Tests

### Backend Unit & Integration Tests (xUnit)
Run all 95 tests across Core, Engine, Card Engine, and API:
```powershell
dotnet test tests/Engine.Tests/Engine.Tests.csproj
dotnet test tests/CardEngine.Tests/CardEngine.Tests.csproj
dotnet test tests/Config.Tests/Config.Tests.csproj
dotnet test tests/Api.Tests/Api.Tests.csproj
```

Or run all test suites in one go:
```powershell
Get-ChildItem -Path tests -Filter "*.csproj" -Recurse | ForEach-Object { dotnet test $_.FullName }
```

### Frontend Unit & Component Tests (Vitest)
From the `frontend/` directory:
```powershell
cd frontend
npm test
```

### Production Build
Test production bundling:
```powershell
cd frontend
npm run build
```

### End-to-End Browser Tests (Playwright)
Run the automated two-player browser flow (creates match, joins via URL, draws cards, makes moves, tests page reload persistence, and concludes via resignation):
```powershell
cd frontend
npx playwright test
```

---

## ⚙️ Configuration & Customization

Game rules, board settings, piece constraints, card definitions, and deck quantities are completely data-driven and configured in:
- **[`configs/chess-uno.json`](configs/chess-uno.json)**: Card counts, initial FEN, turn timers, and piece revival permissions.
- **[`configs/chess-uno.schema.json`](configs/chess-uno.schema.json)**: JSON schema validating card effect parameters.

