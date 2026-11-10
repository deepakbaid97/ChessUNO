# Chess UNO — Game State Architecture, Effect System & Event Contracts (Phase 0)

## 1. Authoritative vs Projected Client State

The ASP.NET Core backend acts as the sole authoritative referee. Clients never dictate state; they submit intent commands (`Command`), and the server validates and dispatches deterministic domain events (`Event`).

```text
+-----------------------+          Commands          +-----------------------+
|                       |  ----------------------->  |                       |
|   Svelte Client       |                            |   ASP.NET Core Server |
|   (Projected State)   |  <-----------------------  |   (Authoritative)     |
|                       |       Events / Snapshots   |                       |
+-----------------------+                            +-----------------------+
```

---

## 2. Game State Definition

### Authoritative Server State (`GameState`)

| Field | Type | Description | Visibility |
|---|---|---|---|
| `GameId` | `Guid` | Unique game session identifier | Public |
| `ConfigVersion` | `string` | Semantic version of loaded `chess-uno.json` | Public |
| `EventSequenceNumber` | `long` | Monotonically increasing sequence number | Public |
| `Status` | `GameStatus` | `WAITING_FOR_PLAYERS`, `ACTIVE`, `FINISHED`, `ABORTED` | Public |
| `Board` | `ChessBoard` | 8x8 matrix / FEN state, piece positions, castling rights | Public |
| `ActivePlayer` | `PlayerColor` | `WHITE` or `BLACK` | Public |
| `TurnNumber` | `int` | Current turn count | Public |
| `TurnPhase` | `TurnPhase` | `DRAW`, `ACTION`, `TURN_END` | Public |
| `DrawDeck` | `List<CardInstance>` | Complete ordered deck of cards remaining | **Server Only (Strictly Private)** |
| `DiscardPile` | `List<CardInstance>` | Face-up pile of played cards | Public (Top card / history) |
| `PlayerHands` | `Dictionary<PlayerColor, List<CardInstance>>` | Cards held in hand (if hand variant enabled) | **Owner Only** (Opponent sees hand count) |
| `CurrentTurnCard` | `CardInstance?` | Active card drawn for current turn | Public |
| `RemainingActions` | `int` | Moves/actions remaining on active card | Public |
| `WhiteReserve` | `List<PieceType>` | Pieces available for revival by White | Public |
| `BlackReserve` | `List<PieceType>` | Pieces available for revival by Black | Public |
| `PendingEffect` | `ActiveEffectContext?` | Step state for multi-choice or sequence effects | Public / Owner (during choice) |
| `MoveHistory` | `List<GameActionRecord>` | History of SAN/UCI moves and card resolutions | Public |
| `Winner` | `PlayerColor?` | Winning player if finished | Public |
| `TerminationReason` | `TerminationReason?` | `CHECKMATE`, `RESIGNATION`, `TIMEOUT`, `STALEMATE`, etc. | Public |

### Client State Projection (`ClientGameState`)

The server sanitizes `GameState` before sending to clients:
- Strips `DrawDeck` entirely (only passes `DrawDeckCount`).
- Replaces opponent's private hand cards with hidden card back tokens.
- Projects validated legal moves/actions for the current turn to assist responsive UI rendering.

---

## 3. Safe Effect System Registry

The configuration file defines parameterized effects without executable code. The backend engine resolves them through a deterministic state machine:

```text
EffectType Registry:
├── MOVE_PIECES       -> Grants [moveCount] chess moves
├── REVIVE_PIECES     -> Revives up to [maxRevivals] eligible pieces to legal squares
├── SWAP_PIECES       -> Swaps 2 pieces matching [swapScope] & [eligiblePieces]
├── SKIP_TURN         -> Causes [skipTarget] to lose their next turn
├── PASS_TURN         -> Ends current player's turn with 0 actions
├── CHOOSE_EFFECT     -> Presents player with list of effect keys from [choices]
└── SEQUENCE          -> Executes a list of sub-effects in order [sequence]
```

### Safety & Determinism Constraints
1. **No Dynamic Code Evaluation**: JSON configuration never passes scripts, expressions, or function delegates.
2. **Strict Parameter Validation**: All parameters (`moveCount`, `maxRevivals`, `swapScope`) are bounded by JSON Schema and verified by C# semantic validators before game initialization.
3. **Rollback on Illegality**: If any intermediate move in a sequence violates King safety or chess movement rules, the transaction is rejected, leaving game state unchanged.

---

## 4. Event Contracts Specification

Communication occurs over ASP.NET Core SignalR hubs (with optional WebRTC data channels for low-latency peer cursors/pings, always subordinate to SignalR for game-critical state).

### Event Definitions

| Event Name | Direction | Sender | Receiver | Private Fields | Validation Requirements |
|---|---|---|---|---|---|
| `PLAYER_JOIN` | Client $\to$ Server | Client | Hub | No | Valid `GameId`, valid auth token / player session. |
| `PLAYER_JOINED` | Server $\to$ Client | Hub | All in Game | No | Broadcasts player seat and ready state. |
| `CARD_DRAWN` | Server $\to$ Client | Server | All in Game | Opponent sees only card back if secret; Public if active turn card | Server verifies active turn and empty action pool before draw. |
| `MOVE_SUBMITTED` | Client $\to$ Server | Client | Server | No | Player must be active, have $\ge 1$ remaining moves, move must be chess-legal. |
| `MOVE_ACCEPTED` | Server $\to$ Client | Server | All in Game | No | Dispatches UCI move, new FEN, decremented remaining actions, check status. |
| `PIECE_CAPTURED` | Server $\to$ Client | Server | All in Game | No | Emitted when move captures; updates reserves. |
| `ACTION_SUBMITTED` | Client $\to$ Server | Client | Server | No | Submits special action (swap coords, revival choices). |
| `PIECE_REVIVED` | Server $\to$ Client | Server | All in Game | No | Validates target square is unoccupied and in allowed half. |
| `EFFECT_CHOSEN` | Client $\to$ Server | Client | Server | No | Must be one of the keys in active `CHOOSE_EFFECT.choices`. |
| `PLAYER_SKIPPED` | Server $\to$ Client | Server | All in Game | No | Notifies players of skipped turn and initiative retention. |
| `TURN_COMPLETED` | Server $\to$ Client | Server | All in Game | No | Verifies King is safe, increments turn number, toggles active player. |
| `GAME_FINISHED` | Server $\to$ Client | Server | All in Game | No | Final event containing winner and termination reason. |
| `RESIGN_SUBMITTED` | Client $\to$ Server | Client | Server | No | Any active player may resign at any time. |

---

## 5. Security & Anti-Cheat Rules

1. **State Authority**: The client is a visual terminal and command emitter. The server maintains the true board position, legal move generator, and card deck.
2. **Secret Shuffling**: Card deck shuffling is performed on the server using `System.Security.Cryptography.RandomNumberGenerator`. Deck order is never leaked over the wire.
3. **Sequence Numbering**: Every event contains an ascending `EventSequenceNumber`. If a client detects a sequence gap, it requests a full authoritative state snapshot (`REQUEST_STATE_SNAPSHOT`).

