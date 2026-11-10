# Chess UNO — PostgreSQL Persistence & Game Recovery Architecture

## 1. Overview

Chess UNO uses **PostgreSQL 17** via **Entity Framework Core 10** (`Npgsql.EntityFrameworkCore.PostgreSQL`) as its authoritative persistence engine. While active game turns are managed in an in-memory cache for ultra-low latency, every authoritative state change (creating a game, joining, card drawing, chess moves, revivals, piece swaps, turn completion, resignation) is committed transactionally to PostgreSQL.

---

## 2. Database Schema & Tables

### 2.1. `game_sessions` Table
The primary table storing the lifecycle state and serialized snapshot of each game session. Plaintext invitation and player tokens are never stored.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `game_id` | `UUID` | `PRIMARY KEY` | Globally unique session ID |
| `invitation_token_hash` | `VARCHAR(64)` | `NOT NULL`, `UNIQUE` | Keyed HMAC-SHA256 hash of the invitation token |
| `status` | `INTEGER` / `VARCHAR` | `NOT NULL`, `INDEXED` | Enum: `WaitingForPlayer`, `Ready`, `InProgress`, `Completed`, `Expired`, `Cancelled` |
| `player_white_id` | `UUID` | `NULLABLE` | Host player UUID |
| `player_white_name` | `VARCHAR(128)` | `NULLABLE` | Host display name |
| `player_white_token_hash`| `VARCHAR(64)` | `NULLABLE` | Keyed HMAC-SHA256 hash of host secret token |
| `player_white_connected` | `BOOLEAN` | `DEFAULT FALSE` | Real-time presence flag |
| `player_black_id` | `UUID` | `NULLABLE` | Guest player UUID |
| `player_black_name` | `VARCHAR(128)` | `NULLABLE` | Guest display name |
| `player_black_token_hash`| `VARCHAR(64)` | `NULLABLE` | Keyed HMAC-SHA256 hash of guest secret token |
| `player_black_connected` | `BOOLEAN` | `DEFAULT FALSE` | Real-time presence flag |
| `board_fen` | `VARCHAR(128)` | `NOT NULL` | Standard FEN notation of current board |
| `game_revision` | `INTEGER` | `NOT NULL` | Monotonic revision counter (optimistic concurrency) |
| `winner` | `VARCHAR(32)` | `NULLABLE` | Winner (`White`, `Black`, `Draw`) |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL` | Session creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | Last authoritative state change timestamp |
| `expires_at` | `TIMESTAMPTZ` | `NULLABLE` | Session expiration timestamp |
| `snapshot_json` | `TEXT` | `NOT NULL` | Serialized JSON of `GameSessionSnapshot` (omitting secret tokens) |

### 2.2. `game_actions` Table
Audit and idempotency log preventing duplicate execution of player actions.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `game_id` | `UUID` | `NOT NULL`, `PK (Composite)` | Associated game session ID |
| `action_id` | `VARCHAR(128)` | `NOT NULL`, `PK (Composite)` | Client-generated idempotency key (e.g. UUID) |
| `player_color` | `VARCHAR(64)` | `NOT NULL` | Active player color (`White`, `Black`) |
| `action_type` | `VARCHAR(64)` | `NOT NULL` | `DrawCard`, `SubmitMove`, `SubmitChoice`, `SubmitRevival`, `SubmitSwap`, `EndTurn`, `Resign` |
| `revision` | `INTEGER` | `NOT NULL` | Game revision resulting from this action |
| `payload_json` | `TEXT` | `NULLABLE` | Serialized input payload |
| `result_json` | `TEXT` | `NULLABLE` | Cached execution outcome |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL` | Action execution timestamp |

---

## 3. Server Restart Recovery Model

When the backend application restarts (e.g., container redeployment, host restart, failure recovery):
1. In-memory session dictionaries start empty.
2. When a player reconnects or requests game information by `gameId` or `invitationToken`:
   - `PostgreSqlGameSessionRepository.GetByIdAsync` or `GetByInvitationTokenAsync` queries `game_sessions` table by hash.
   - The serialized `snapshot_json` is parsed into `GameSessionSnapshot`.
   - The authoritative `TurnController`, `ChessState`, `DeckManager`, `CardEffectExecutor`, and active turn phase are restored to their exact pre-restart positions.
   - The session is repopulated into the in-memory cache.
3. Both players can immediately reconnect via SignalR using their existing player tokens:
   - Authentication hashes the presented token and validates against `PlayerWhiteTokenHash` / `PlayerBlackTokenHash`.
   - Players resume the match without data loss or re-creating identities.

---

## 4. Idempotency & Concurrency Strategy

1. **Atomic Transaction Scope**: State updates and action records commit within an atomic EF Core `IDbContextTransaction`. If the database write fails, the in-memory game state is rolled back to a pre-action snapshot.
2. **Action Idempotency**: If a client sends an `actionId`:
   - The repository queries `game_actions` for `(gameId, actionId)`.
   - If found, it immediately returns the cached success result without re-executing or double-incrementing moves or card draws.
3. **Cross-Instance Concurrency**:
   - The repository validates that `entity.GameRevision == session.GameRevision` at the database level.
   - If a competing instance committed another action, a `CONCURRENCY_CONFLICT` is returned and the losing instance reloads the authoritative database state.
4. **Database Thread-Safety**: The repository utilizes `IDbContextFactory<ChessUnoDbContext>` to create short-lived, isolated context instances for each operation, preventing context multithreading collisions in singleton service lifecycles.
