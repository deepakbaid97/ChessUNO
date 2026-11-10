# Chess UNO — Phase 4.5 Technical Audit Findings Report

**Date**: November 2026  
**Focus**: PostgreSQL Persistence, Security, Session Lifecycle, and Multiplayer Reliability

---

## 1. Executive Summary

This report establishes the baseline implementation state of **Chess UNO** prior to Phase 4.5 remediation. While the core chess and card engine mechanics are complete, fully validated, and 100% covered by unit tests, critical gaps exist in durability, connection lifecycle, concurrency idempotency, WebRTC candidate negotiation, and production security.

---

## 2. Detailed Findings by Category

### 2.1. PostgreSQL Persistence & Session Management
- **Status**: **Missing / Incomplete**
- **References**:
  - `backend/ChessUno/ChessUno.Web/Program.cs#L11-L12`:
    ```csharp
    builder.Services.AddSingleton<IGameSessionRepository, InMemoryGameSessionRepository>();
    ```
  - `backend/ChessUno/ChessUno.Core/Sessions/InMemoryGameSessionRepository.cs`
- **Assessment**:
  - The application relies exclusively on an in-memory dictionary (`InMemoryGameSessionRepository`).
  - No database entities, `DbContext`, migrations, or PostgreSQL connection strings are configured.
  - When the backend service restarts, all active game sessions, player tokens, and state snapshots are permanently lost.
  - Snapshot export/import methods (`ExportSessionSnapshotJsonAsync`, `RestoreSessionSnapshotJsonAsync`) exist as in-memory JSON serializers, but are not persisted to any database table or transaction log.
  - `_sessionRepository.UpdateSessionAsync(session)` is never called on state-mutating actions in `GameHub.cs`, meaning even the in-memory repository is never notified of game state changes after initial creation.

### 2.2. Session Lifecycle & Reconnection Flow
- **Status**: **Implemented but Incomplete / Unsafe**
- **References**:
  - `backend/ChessUno/ChessUno.Core/Sessions/GameSessionModels.cs#L18-L34`
  - `backend/ChessUno/ChessUno.Web/Hubs/GameHub.cs#L25-L96`
  - `frontend/src/App.svelte#L153-L205`
- **Assessment**:
  - Lifecycle statuses (`WaitingForPlayer`, `Ready`, `InProgress`, `Completed`, `Expired`, `Cancelled`) exist as enums.
  - `PlayerSession` includes `bool IsConnected = false`, but it is an immutable property that is never modified when players join or disconnect.
  - `GameHub.OnDisconnectedAsync` is not implemented: when a player closes their browser or loses connectivity, the opponent is never informed, and the player remains marked as connected in the session.
  - When a player reconnects (`JoinGameRoom`), duplicate connections are not handled cleanly, and the hub sends a generic `PlayerConnected` event rather than a `PlayerReconnected` event with current presence status.
  - Reconnection returns a game snapshot, but does not verify whether the game was completed, expired, or cancelled while the player was away.

### 2.3. SignalR Concurrency, Synchronization & Idempotency
- **Status**: **Implemented but Incomplete**
- **References**:
  - `backend/ChessUno/ChessUno.Web/Hubs/GameHub.cs#L118-L155`, `#L203-L251`
  - `frontend/src/lib/services/signalrService.ts`
- **Assessment**:
  - In-memory concurrency is protected via `session.SessionLock` (`SemaphoreSlim(1, 1)`).
  - However, **Idempotency keys / Action IDs are completely absent**. If a network timeout causes the client to retry `DrawCard`, `SubmitMove`, or `SubmitRevival`, the backend treats it as a new action and either applies it again (if rules permit) or returns `false` without returning the cached result of the original action.
  - Monotonic revision checking is performed on the frontend (`gameStore.applyUpdate` ignores `update.revision <= current`), but the backend does not validate `expectedRevision` from the client; stale actions submitted by a lagged client could execute against newer state.
  - Rejected actions fail silently with `return false;` instead of broadcasting or returning an explicit `ActionRejected` error payload with diagnostic reasons (e.g., `REVISION_MISMATCH`, `NOT_YOUR_TURN`, `INVALID_ACTION`).

### 2.4. WebRTC Connection Reliability & Negotiation State Machine
- **Status**: **Incorrect / Unsafe**
- **References**:
  - `frontend/src/lib/services/webrtcService.ts#L79-L95`
- **Assessment**:
  - `handleSignal` processes `candidate` immediately:
    ```ts
    else if (signalType === 'candidate') {
      const candidate = JSON.parse(payload);
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
    ```
    If an ICE candidate arrives before `setRemoteDescription` completes (which happens frequently over network signaling), the browser throws an `InvalidStateError` ("Remote description not set") and the candidate is permanently dropped. Candidates must be queued until `remoteDescription` is set.
  - Peer messages have no protocol versions, message sequence IDs, or acknowledgment mechanism.
  - No timeout or fallback mechanism is implemented when WebRTC connection fails or times out; the UI does not clearly communicate whether it is in P2P or SignalR mode.

### 2.5. Security, Authentication & Production Configuration
- **Status**: **Implemented but Incomplete / Unsafe in Production**
- **References**:
  - `backend/ChessUno/ChessUno.Web/Program.cs#L14-L27`
  - `backend/ChessUno/ChessUno.Core/Sessions/GameSessionModels.cs#L68-L75`
- **Assessment**:
  - CORS policy allows all origins in development (`if (builder.Environment.IsDevelopment()) return true;`) and hardcodes `localhost` check in non-development. No production domain allowlist is configurable via `appsettings.json` or environment variables.
  - Plaintext tokens: Invitation tokens and secret player tokens are stored and compared in plaintext without hashing.
  - Rate limiting: Neither `GamesController` nor `GameHub` employs rate limiting; malicious callers could spam game creation or SignalR invocations.
  - Secrets & Settings: No database connection strings or TURN credentials exist in `appsettings.json`.

### 2.6. Automated Testing Verification
- **Status**: **Not Verifiable Through Existing Tests**
- **Assessment**:
  - Existing backend tests (114 tests) cover the domain engine, card effects, and in-memory hub calls, but zero tests cover PostgreSQL database persistence, schema migrations, snapshot restoration after server restart, or concurrent database transactions.
  - Existing E2E Playwright test covers single-session flow on a single running server, but does not test server restart, browser refresh with recovery, or database transaction rollback.

---

## 3. Findings Classification Summary

| Component | Status | Severity | Risk |
|---|:---:|:---:|---|
| PostgreSQL Persistence | Missing | **Critical** | Server restart loses all active games |
| Database Transactionality & Updates | Incomplete | **Critical** | Hub never updates repository on game actions |
| SignalR Idempotency & Action IDs | Missing | **High** | Network retries can execute actions twice or fail |
| Reconnection & Disconnection Tracking | Incomplete | **High** | Opponent unaware of disconnect; duplicate joins unhandled |
| WebRTC ICE Candidate Queuing | Incorrect | **High** | Early ICE candidates fail with `InvalidStateError` |
| Security: Token Hashing & CORS Config | Incomplete | **Medium** | Plaintext tokens in DB; rigid CORS rules |
| Action Rejection Protocol | Missing | **Medium** | Rejections return bare `false` with no reason |
| DB & Restart Integration Tests | Missing | **High** | Persistence not verified by automated test harness |

---

## 4. Remediation Plan

1. **Part 2 — PostgreSQL Persistence**:
   - Create `ChessUnoDbContext` with entities for `GameSessionEntity` and `GameActionHistoryEntity`.
   - Implement `PostgresGameSessionRepository : IGameSessionRepository` with snapshot serialization, optimistic concurrency, and async database transactions.
   - Configure PostgreSQL in `Program.cs` via DI, with fallback to in-memory for unit tests.
   - Add database migrations / automatic schema setup.
2. **Part 3 — Session Lifecycle & Reconnection**:
   - Implement `OnDisconnectedAsync` and connection status tracking on `PlayerSession`.
   - Implement robust reconnection flow that sends `GameStateSnapshot`, presence updates, and re-registers the player's connection ID.
3. **Part 4 — SignalR Concurrency & Idempotency**:
   - Add `actionId` and `expectedRevision` to hub state-changing actions.
   - Implement idempotency cache in repository (`GameActionHistoryEntity`) to deduplicate retried actions.
   - Broadcast `ActionRejected` on validation/revision failure.
4. **Part 5 — WebRTC Reliability**:
   - Implement candidate queuing in `webrtcService.ts` before `setRemoteDescription`.
   - Add message IDs, protocol versions, and fallback to SignalR if P2P fails.
5. **Part 6 — Security Hardening**:
   - Store secure token hashes (`SHA256`) in database entities.
   - Provide explicit configurable CORS allowlist in `appsettings.json`.
6. **Part 7 — Test-Driven Verification**:
   - Write comprehensive integration tests verifying PostgreSQL persistence, restart recovery, idempotency, and concurrent transactions on real PostgreSQL.
   - Add Playwright E2E tests verifying browser refresh and server recovery.

