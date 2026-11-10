# Chess UNO — Game Rules Specification

## 1. Overview & Objective

Chess UNO merges traditional chess objectives with UNO tactical cards and action economies.
- **Victory Conditions**: Checkmate the opponent's King, or opponent resignation, or opponent timeout.
- **Draw Conditions**: Stalemate, Fifty-Move Rule (100 half-moves), Threefold Repetition, Insufficient Material, or Mutual Agreement.

---

## 2. Turn Structure

Every turn proceeds through three distinct phases:
1. **Draw Phase**:
   - The active player MUST draw 1 card from the authoritative deck.
   - Drawing a card moves it from the draw pile into the discard pile and determines the action quota for the turn.
   - If the draw pile is depleted, the discard pile is reshuffled cryptographically into a fresh draw pile.
2. **Action Phase**:
   - The player exercises the movement quota or special abilities granted by the drawn card.
   - For number cards (1–9), players may make standard chess moves. The same piece may move repeatedly, or different friendly pieces may move.
   - For action cards (Reverse, Draw Two, Skip), players execute piece swaps, revivals, or skip opponent.
   - For wild cards, players submit their choice before executing the chosen ability.
3. **Turn End Phase**:
   - A turn ends when the action quota is exhausted, or when the player manually clicks **"End Turn"**.
   - **King Safety Requirement**: At the end of every legal turn, the active player's King must NOT be in check. If a player ends their turn in check, they are declared checkmated and defeated.

---

## 3. Chess Engine Rules & Edge Cases

1. **King Safety**:
   - A player cannot make any move or tactical action that leaves their own King in check.
   - If a player starts their turn in check, their actions MUST resolve check.
   - If a player is in check and draws a card that provides no escape routes (e.g. Card 0, or a revival card with an empty reserve), checkmate defeat is triggered immediately.
2. **Multi-Move Sequential Actions**:
   - If a player moves on move 1 of a multi-move card and delivers checkmate to the opponent, the match terminates immediately with victory.
   - En passant capture is valid on the opponent's immediate next turn following a pawn double-step.
   - Pawn promotion occurs immediately upon reaching the 8th rank (Rank 1 for Black). If more moves remain on the active card, the newly promoted piece may move again immediately.
3. **Piece Swapping (Reverse Card)**:
   - Allows exchanging positions of any two friendly non-king pieces on the board.
   - Kings can never be swapped.
   - Opponent pieces cannot be swapped.
   - Swapping must NOT leave the player's own King in check.
   - If a swapped Rook leaves its original corner square (`a1`, `h1`, `a8`, `h8`), castling rights for that corner are revoked.
4. **Reserves and Piece Revival (Draw Two / Wild Cards)**:
   - When a piece is captured, it is placed into its **original owner's reserve pool**.
   - Only captured friendly pieces in the reserve can be revived.
   - Revived pieces must be placed on empty squares on the player's own half (Ranks 1–4 for White, Ranks 5–8 for Black).
   - Pawns cannot be revived on Rank 1 or Rank 8.
   - Kings can never be revived (there is exactly one King per side).
   - Reviving a piece must not leave the player's own King in check.
5. **Draw Detection**:
   - **Stalemate**: Active player has no legal moves and is not in check.
   - **Fifty-Move Rule**: 100 consecutive half-moves (50 full moves) without a pawn move or capture.
   - **Threefold Repetition**: Identical board position (placement, turn, castling rights, and en passant square) occurs 3 times.
   - **Insufficient Material**: Bare Kings, King + Knight vs King, King + Bishop vs King, or King + Bishop vs King + Bishop on same color squares.

