# Chess UNO — Card Definitions & Effect Engine

## 1. 108-Card Standard Deck Composition

The official 108-card deck is configuration-driven from `configs/chess-uno.json`:

| Card ID | Card Name | Category | Quantity | Effect Key | Description |
|---|---|---|---:|---|---|
| `card-0` | **0 Card** | NUMBER | 4 | `PASS_TURN_EFFECT` | Grants 0 moves. Player turn ends immediately without chess moves. |
| `card-1` | **1 Card** | NUMBER | 8 | `MOVE_1` | Make up to 1 legal chess move. |
| `card-2` | **2 Card** | NUMBER | 8 | `MOVE_2` | Make up to 2 legal chess moves. |
| `card-3` | **3 Card** | NUMBER | 8 | `MOVE_3` | Make up to 3 legal chess moves. |
| `card-4` | **4 Card** | NUMBER | 8 | `MOVE_4` | Make up to 4 legal chess moves. |
| `card-5` | **5 Card** | NUMBER | 8 | `MOVE_5` | Make up to 5 legal chess moves. |
| `card-6` | **6 Card** | NUMBER | 8 | `MOVE_6` | Make up to 6 legal chess moves. |
| `card-7` | **7 Card** | NUMBER | 8 | `MOVE_7` | Make up to 7 legal chess moves. |
| `card-8` | **8 Card** | NUMBER | 8 | `MOVE_8` | Make up to 8 legal chess moves. |
| `card-9` | **9 Card** | NUMBER | 8 | `MOVE_9` | Make up to 9 legal chess moves. |
| `card-reverse` | **Reverse** | ACTION | 8 | `SWAP_OWN_PIECES` | Swap positions of two eligible friendly non-king pieces. |
| `card-skip` | **Skip** | ACTION | 8 | `SKIP_OPPONENT` | Skips opponent's next turn. Player retains initiative and draws again. |
| `card-draw-two` | **Draw Two (+2)** | ACTION | 8 | `REVIVE_UP_TO_TWO` | Revives up to 2 captured friendly pieces onto player's half. |
| `card-wild` | **Wild** | WILD | 4 | `WILD_CHOICE` | Player chooses: Move 1 piece, Revive up to 2 pieces, or Swap 2 friendly pieces. |
| `card-wild-draw-four` | **Wild Draw Four (+4)** | WILD | 4 | `WILD_DRAW_FOUR` | Player chooses: Revive up to 4 pieces OR Revive 2 pieces + Make 2 moves. |

**Total Deck Count**: $4 + (9 \times 8) + 8 + 8 + 8 + 4 + 4 = 108\text{ cards}$.

---

## 2. Effect Engine Handlers & State Transitions

1. **`MOVE_PIECES`** (`MOVE_1` through `MOVE_9`):
   - Sets `RemainingMoves = moveCount`.
   - Each move executed decrements `RemainingMoves`.
   - When `RemainingMoves == 0`, turn passes to opponent unless a composite sequence remains.
2. **`SKIP_TURN`** (`SKIP_OPPONENT`):
   - Sets `SkipOpponent = true`.
   - `TurnController` starts a new DrawPhase for the SAME player, retaining turn initiative.
3. **`SWAP_PIECES`** (`SWAP_OWN_PIECES`):
   - Sets `CanSwap = true`.
   - Player selects two friendly non-king squares.
   - Verified by `ChessEngine.ApplySwap` for King safety and piece ownership.
4. **`REVIVE_PIECES`** (`REVIVE_UP_TO_TWO`, `REVIVE_UP_TO_FOUR`):
   - Sets `RemainingRevivals = maxRevivals`.
   - Player selects a piece type from friendly reserves and an eligible empty square in their own half.
5. **`CHOOSE_EFFECT`** (`WILD_CHOICE`, `WILD_DRAW_FOUR`):
   - Sets `TurnPhase = AwaitingChoice` with `AvailableChoices`.
   - Player submits choice via SignalR (`SubmitChoice`).
   - Choice is validated against `AvailableChoices` and executed authoritatively.
6. **`SEQUENCE`** (`REVIVE_TWO_AND_MOVE_TWO`):
   - Activates Step 1 (`REVIVE_UP_TO_TWO`) with `RemainingRevivals = 2`.
   - Queues remaining step (`MOVE_2`) in `PendingSequence`.
   - When revivals are consumed or ended, automatically advances to Step 2 (`MOVE_2`).

