# Chess UNO — Security, Authentication & CORS Policy

## 1. Authentication & Token Management

1. **Cryptographically Secure Tokens**:
   - Invitation tokens and secret player tokens are generated using .NET's `RandomNumberGenerator.GetBytes(32)` (256 bits of high entropy), converted to URL-safe Base64 strings.
2. **Keyed HMAC-SHA256 Token Hashing**:
   - Plaintext invitation tokens and player secret tokens are **never stored** in the database or serialized into snapshots.
   - All tokens are hashed using a keyed HMAC-SHA256 (`TokenHasher.HashToken`) and compared using constant-time equality checks (`CryptographicOperations.FixedTimeEquals`) to eliminate timing attacks.
   - Database tables `game_sessions` store only `invitation_token_hash`, `player_white_token_hash`, and `player_black_token_hash`.
   - The plaintext column `invitation_token` has been removed from the database schema via EF Core migration `SecureTokenStorage`.
3. **Snapshot Security**:
   - In-memory `GameSessionSnapshot` serializes only `InvitationTokenHash` and `TokenHash`.
   - `SecretToken` on `PlayerSession` is marked `[JsonIgnore]` and is strictly transient in memory during initial creation/joining HTTP responses.
   - Recovered sessions after server restart or across instances restore authentication via token hash verification, preventing credential exposure even if snapshot JSON or database backups are exfiltrated.
4. **No Credential Logging**:
   - Player secret tokens are sanitized from all server logs, frontend console logs, and SignalR event broadcasts.
   - Opponent state snapshots contain zero secrets about the other player's tokens or cards in draw deck order.

---

## 2. Authorization & Room Guardrails

1. **Session Authorization**:
   - Every hub invocation (`DrawCard`, `SubmitMove`, `SubmitChoice`, `SubmitRevival`, `SubmitSwap`, `EndTurn`, `Resign`, `SendSignal`) requires `(gameId, playerToken)`.
   - The hub verifies that `playerToken` hashes match `PlayerWhite` or `PlayerBlack` of that exact `gameId`.
   - Players cannot join unrelated game rooms or send signals across session boundaries.
2. **Turn Authorization**:
   - State-changing actions verify that `player.Color == session.EngineController.ActivePlayer`. Actions out of turn are rejected immediately with `NOT_YOUR_TURN`.
3. **Terminal State Shielding**:
   - Once a session transitions to `Completed`, `Expired`, or `Cancelled`, all subsequent gameplay actions are rejected with `SESSION_TERMINAL`.

---

## 3. Atomic State Persistence & Action Idempotency

1. **Single-Transaction Atomicity**:
   - State mutations and idempotency records are committed within an atomic EF Core database transaction (`IDbContextTransaction`).
   - If either the game snapshot update or action record insertion fails, both roll back completely.
2. **In-Memory State Rollback**:
   - Before mutating the in-memory `TurnController` and `GameState`, a snapshot is taken.
   - If the database transaction fails or encounters a concurrency conflict, the in-memory state is restored in-place from the snapshot, guaranteeing memory never drifts ahead of persistent storage.
3. **Idempotency Scoping**:
   - Action idempotency keys are protected by composite primary key `(game_id, action_id)`.
   - Retries return cached action results without executing game rules or incrementing game revisions twice.
   - Mismatched payloads or action types for an existing action ID are rejected with `IDEMPOTENCY_MISMATCH`.

---

## 4. Cross-Instance Concurrency Protection

1. **Database-Backed Revision Verification**:
   - Every state update checks that `entity.GameRevision == session.GameRevision` within the database transaction.
   - If another application instance committed an action and incremented the revision, the current instance detects `CONCURRENCY_CONFLICT` or `DbUpdateConcurrencyException`, rolls back, reloads the committed database snapshot, and rejects stale actions.

---

## 5. Safe Integration Test Environment

1. **Destructive Operation Guardrails**:
   - Integration tests executing `EnsureDeletedAsync()` validate that the configured database name explicitly contains `test` (e.g. `chessuno_test`).
   - If pointed at `chessuno` or a production database, tests fail-fast with `InvalidOperationException`.
2. **Credential Sanitization in Tests**:
   - Tests read credentials via `CHESSUNO_TEST_PASSWORD` or `CHESSUNO_TEST_CONNECTION_STRING` environment variables rather than hardcoded credentials.

---

## 6. Secret Rotation Procedure

If a database password or token HMAC key is compromised:
1. **Database User Rotation**:
   - Connect to PostgreSQL administrative shell and update credentials:
     ```sql
     ALTER USER chessuno_user WITH PASSWORD '<NEW_STRONG_PASSWORD>';
     ```
2. **Application Configuration**:
   - Update production environment variable `ConnectionStrings__DefaultConnection`.
   - Update local development user secrets:
     ```bash
     dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=chessuno;Username=postgres;Password=<NEW_STRONG_PASSWORD>" --project backend/ChessUno/ChessUno.Web
     ```
3. **Verification & Revocation**:
   - Verify health endpoint `/health` and run integration test suite.
   - Revoke old credentials.

---

## 7. CORS & Network Security

1. **Explicit Origin Allowlist**:
   - Wildcard origin reflection in production is strictly disabled.
   - Origins are configured via `Cors:AllowedOrigins` in `appsettings.json` or environment variables:
     ```json
     "Cors": {
       "AllowedOrigins": [
         "http://localhost:5173",
         "https://localhost:5173",
         "http://localhost:4173",
         "https://localhost:4173"
       ]
     }
     ```
2. **Secure Credentials Flag**:
   - `.AllowCredentials()` is only permitted alongside specific, trusted origins.
3. **Automated Secret Scanning**:
   - Automated test `SecretScanningTests` runs during CI to prevent committed passwords or secrets in tracked files.
