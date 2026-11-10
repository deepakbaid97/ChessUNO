# Chess UNO — System Architecture

## 1. Architectural Philosophy

Chess UNO follows a **Strict Authoritative Server** model. The backend acts as the sole referee and source of truth. The frontend is a dumb terminal and reactive projection that renders UI from authoritative state snapshots and validates nothing independently.

---

## 2. Component Topology

```text
+---------------------------------------------------------------------------------+
|                                 SVELTE FRONTEND                                 |
|                                                                                 |
|   +-----------------------+   +----------------------+   +------------------+   |
|   |   HomeScreen / Lobby  |   |   GameArena Screen   |   | GameOver Modal   |   |
|   +-----------------------+   +----------------------+   +------------------+   |
|               |                          |                         |            |
|   +-------------------------------------------------------------------------+   |
|   |                       Stores (gameStore, connectionStore)               |   |
|   +-------------------------------------------------------------------------+   |
|         |                                      |                     |          |
|   +-------------------+              +-------------------+   +--------------+   |
|   |   GameApiService  |              |   SignalRService  |   | WebRtcService|   |
|   +-------------------+              +-------------------+   +--------------+   |
+---------|--------------------------------------|---------------------|----------+
          | (REST)                               | (WebSockets)        | (P2P Data)
          v                                      v                     |
+-----------------------------------------------------------------+    |
|                      ASP.NET CORE 10 BACKEND                    |    |
|                                                                 |    |
|   +---------------------+            +---------------------+    |    |
|   |   GamesController   |            |       GameHub       |<---+----+
|   +---------------------+            +---------------------+    | (Signaling)
|              \                                  /               |
|               +----------------+---------------+                |
|                                |                                |
|             +------------------------------------+              |
|             |     IGameSessionRepository         |              |
|             |  (Thread-safe Session Locking)     |              |
|             +------------------------------------+              |
|                                |                                |
|             +------------------------------------+              |
|             |         TurnController             |              |
|             |   - Action Quotas & Phases         |              |
|             |   - Composite Sequences & Choices  |              |
|             +------------------------------------+              |
|                                |                                |
|             +------------------------------------+              |
|             |          ChessEngine               |              |
|             |   - Check/Checkmate/Draw           |              |
|             |   - King Safety & Revivals & Swaps |              |
|             +------------------------------------+              |
|                                |                                |
|             +------------------------------------+              |
|             |          DeckManager               |              |
|             |   - 108-Card Cryptographic RNG     |              |
|             +------------------------------------+              |
+-----------------------------------------------------------------+
```

---

## 3. Concurrency & Synchronization Model

To prevent race conditions, double submissions, and state corruption:
1. **Per-Session Synchronization**: Each `GameSession` manages a `SemaphoreSlim(1, 1)` instance. Every state-changing hub invocation (`DrawCard`, `SubmitMove`, `SubmitRevival`, `SubmitSwap`, `SubmitChoice`, `EndTurn`, `Resign`) acquires this lock asynchronously before executing.
2. **Monotonic Game Revisions**: `session.GameRevision` is incremented sequentially upon every successful action under the session lock.
3. **Anti-Regression in Frontend**: `gameStore.applyUpdate` verifies `updateData.revision >= currentRevision`, discarding out-of-order or stale network updates.

---

## 4. Multiplayer & WebRTC Architecture

- **SignalR Hub (`/hubs/game`)**:
  - Handles session creation, joining, group management (`game-{id}`), state broadcasts, and WebRTC signaling exchange (`offer`, `answer`, `candidate`).
  - Authoritative referee: All gameplay moves, card draws, and resignations are transmitted and committed via SignalR.
- **WebRTC DataChannel (`chess-uno-p2p`)**:
  - Direct peer-to-peer data channel between Player 1 (Host/White) and Player 2 (Guest/Black).
  - Used strictly for low-latency non-authoritative communication: peer cursors, pings, latency heartbeats, and peer chat.
  - Does NOT mutate authoritative board state. If P2P fails, the application falls back gracefully to SignalR without impacting gameplay.

---

## 5. Persistence & Durability Architecture

- **Session Repository (`InMemoryGameSessionRepository`)**:
  - High-performance, concurrent in-memory session registry.
  - Implements `ExportSessionSnapshotJsonAsync` and `RestoreSessionSnapshotJsonAsync` to serialize full game sessions (including remaining draw pile, discard pile, turn state, move history, and reserve pieces) into durable JSON snapshots.
  - Enables snapshot backups, database synchronization, and crash recovery.
  - Supports automatic session expiration and background cleanup (`CleanupExpiredSessionsAsync`).

