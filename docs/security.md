# Chess UNO — Security, Authentication & CORS Policy

## 1. Authentication & Token Management

1. **Cryptographically Secure Tokens**:
   - Invitation tokens and secret player tokens are generated using .NET's `RandomNumberGenerator.GetBytes()` (16 bytes for invitation tokens, 24 bytes for secret player tokens), converted to URL-safe Base64 strings.
2. **Token Hashing in Persistence**:
   - In PostgreSQL, tokens are stored alongside SHA-256 hashes (`invitation_token_hash`, `player_white_token_hash`, `player_black_token_hash`) for indexing and validation.
3. **No Credential Logging**:
   - Player secret tokens are sanitized from all server logs, frontend console logs, and SignalR event broadcasts.
   - Opponent state snapshots contain zero secrets about the other player's tokens or cards in draw deck order.

---

## 2. Authorization & Room Guardrails

1. **Session Authorization**:
   - Every hub invocation (`DrawCard`, `SubmitMove`, `SubmitChoice`, `SubmitRevival`, `SubmitSwap`, `EndTurn`, `Resign`, `SendSignal`) requires `(gameId, playerToken)`.
   - The hub verifies that `playerToken` belongs to `PlayerWhite` or `PlayerBlack` of that exact `gameId`.
   - Players cannot join unrelated game rooms or send signals across session boundaries.
2. **Turn Authorization**:
   - State-changing actions verify that `player.Color == session.EngineController.ActivePlayer`. Actions out of turn are rejected immediately with `NOT_YOUR_TURN`.
3. **Terminal State Shielding**:
   - Once a session transitions to `Completed`, `Expired`, or `Cancelled`, all subsequent gameplay actions are rejected with `SESSION_TERMINAL`.

---

## 3. CORS & Network Security

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
3. **Rate Limiting & DoS Mitigation**:
   - Concurrency locking per session (`SemaphoreSlim(1, 1)`) prevents burst spamming from corrupting game logic.

