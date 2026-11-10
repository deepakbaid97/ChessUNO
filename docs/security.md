# Chess UNO — Security, Authentication & CORS Policy

## 1. Authentication & Token Management

1. **Cryptographically Secure Tokens**:
   - Invitation tokens and secret player tokens are generated using .NET's `RandomNumberGenerator.GetBytes(32)` (256 bits of high entropy), converted to URL-safe Base64 strings.
2. **Keyed HMAC-SHA256 Token Hashing**:
   - Plaintext invitation tokens and player secret tokens are **never stored** in the database or serialized into snapshots.
   - All tokens are hashed using a keyed HMAC-SHA256 (`TokenHasher.HashToken`) and compared using constant-time equality checks (`CryptographicOperations.FixedTimeEquals`) to eliminate timing attacks.
   - The HMAC key is loaded at startup from `TokenSecurity:HmacKey` (or environment variable `CHESSUNO_HMAC_KEY`).
   - Production startup **strictly fails** with `InvalidOperationException` if the key is missing or shorter than 32 characters (256 bits). Fallback to development keys in production is completely forbidden.
   - In development/testing, an ephemeral 32-byte non-production key is initialized with a startup warning if not explicitly configured.
   - Database tables `game_sessions` store only `invitation_token_hash`, `player_white_token_hash`, and `player_black_token_hash`.
   - The plaintext column `invitation_token` has been removed from the database schema via EF Core migration `SecureTokenStorage`.
3. **HMAC Key Rotation & Existing Sessions**:
   - `TokenHasher` supports dual-key grace periods via `TokenSecurity:PreviousHmacKey` (or environment variable `CHESSUNO_PREVIOUS_HMAC_KEY`).
   - During key rotation:
     - New hashes are always computed using the primary key.
     - Token authentication checks the primary key first, and if unmatched, falls back to the previous key.
     - Once active matches conclude, the previous key configuration is cleared, revoking old sessions.
4. **Legacy Snapshot Sanitization**:
   - `LegacySnapshotSanitizer` automatically scrubs legacy snapshot JSONs stored in `game_sessions.snapshot_json` and on-disk files.
   - If an old snapshot contains raw `SecretToken` or `InvitationToken` fields, the sanitizer derives missing token hashes via `TokenHasher` and strips all raw secrets.
   - On application startup after migration, `PostgreSqlGameSessionRepository.SanitizeAllExistingSnapshotsAsync` sweeps existing database records to purge historical raw tokens.
5. **Snapshot Security**:
   - In-memory `GameSessionSnapshot` serializes only `InvitationTokenHash` and `TokenHash`.
   - `SecretToken` on `PlayerSession` is marked `[JsonIgnore]` and is strictly transient in memory during initial creation/joining HTTP responses.
   - Recovered sessions after server restart or across instances restore authentication via token hash verification, preventing credential exposure even if snapshot JSON or database backups are exfiltrated.
6. **No Credential Logging**:
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
   - State mutations, session status updates, and idempotency records are committed within an atomic EF Core database transaction (`IDbContextTransaction`).
   - If either the game snapshot update or action record insertion fails, both roll back completely.
2. **In-Memory State Rollback**:
   - Before mutating the in-memory `TurnController` and `GameState` (or session status in `JoinSessionAsync`, `CancelSessionAsync`, `UpdateSessionAsync`), a snapshot is taken.
   - If the database transaction fails or encounters a concurrency conflict, the in-memory state is restored in-place from the snapshot, guaranteeing memory never drifts ahead of persistent storage.
3. **Comprehensive Idempotency Enforcement**:
   - Action idempotency keys are protected by composite primary key `(game_id, action_id)`.
   - The actual action payload is normalized and stored in `game_actions.payload_json`.
   - When a retry arrives:
     - The repository checks for existing `(game_id, action_id)` **before** performing revision checks. This prevents false `REVISION_MISMATCH` errors when a client retries with the initial revision.
     - Compares `action_type`, `player_color`, and `payload_json`.
     - Exact retries return the original successful result without re-executing game rules or advancing revisions.
     - Reusing an action ID with a different payload or player is rejected with `IDEMPOTENCY_CONFLICT`.
4. **Complete Atomic Session Mutations**:
   - `JoinSessionAsync` and `CancelSessionAsync` execute inside database transactions with optimistic revision checks.
   - If two instances attempt to join the same game room concurrently, exactly one succeeds; the second receives `null` and memory is cleanly rolled back without session corruption.

---

## 4. Cross-Instance Concurrency Protection

1. **Database-Backed Revision Verification**:
   - Every state update checks that `entity.GameRevision == session.GameRevision` within the database transaction.
   - If another application instance committed an action and incremented the revision, the current instance detects `CONCURRENCY_CONFLICT` or `DbUpdateConcurrencyException`, rolls back, reloads the committed database snapshot, and rejects stale actions.

---

## 5. Strict PostgreSQL Test Isolation & Multi-Layer Guardrails

1. **Ephemeral Per-Fixture Databases**:
   - Real PostgreSQL integration tests do not share a single static database name.
   - `PostgreSqlTestDatabaseManager` provisions a unique isolated database per fixture matching strict regex: `^chessuno_test_isolated_[a-f0-9]{8,32}$`.
2. **Multi-Layer Destructive Operation Guardrails**:
   - Before any cleanup or drop operation:
     1. Database name must match the strict isolation regex.
     2. Database name must not contain protected keywords (`prod`, `production`, `postgres`, `template1`, `chessuno`).
     3. An explicit test isolation marker table `chessuno_test_isolation_marker` must exist in the database and contain the matching ephemeral `run_token`.
   - Dropping or deleting any database lacking the valid isolation marker is strictly blocked with `InvalidOperationException`.
3. **Credential Sanitization in Tests**:
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
