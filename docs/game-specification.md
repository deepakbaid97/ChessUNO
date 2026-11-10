# Chess UNO — Canonical Game Specification

## 1. Executive Summary

**Chess UNO** is a real-time, two-player multiplayer strategy game combining traditional chess mechanics with UNO-style tactical cards, action quotas, and special abilities. The ASP.NET Core backend acts as the authoritative referee, verifying every move, card draw, revival, and piece swap. The Svelte 4 frontend serves purely as a reactive presentation layer and command emitter.

---

## 2. Intended Architecture & Component Roles

```mermaid
flowchart TD
    ClientA["Player A (White) Client<br/>Svelte 4 + TypeScript"]
    ClientB["Player B (Black) Client<br/>Svelte 4 + TypeScript"]
    Hub["SignalR Hub (/hubs/game)<br/>Authentication & Session Group"]
    Engine["TurnController & ChessEngine<br/>Strict King Safety & Move Legality"]
    Deck["DeckManager<br/>108-Card Cryptographic Shuffling"]
    Repo["GameSessionRepository<br/>Per-Session Concurrency Lock & Snapshots"]

    ClientA <-->|SignalR WebSockets| Hub
    ClientB <-->|SignalR WebSockets| Hub
    ClientA <-.->|WebRTC P2P DataChannel<br/>(Low-latency Cursor/Pings)| ClientB
    Hub --> Repo
    Repo --> Engine
    Engine --> Deck
```

### Core Components
1. **Authoritative Backend (`backend/ChessUno/`)**:
   - Built on **.NET 10 ASP.NET Core Web API**.
   - Hosts the SignalR hub (`/hubs/game`) for bidirectional state synchronization, authorization, and WebRTC signaling.
   - Enforces game rules, legal chess moves, card effect quotas, checkmate/stalemate/draw detection, and King safety via `TurnController` and `ChessEngine`.
2. **Frontend (`frontend/`)**:
   - Built on **Svelte 4 + TypeScript + Vite 5**.
   - No duplicate chess engine. Move legality is projected strictly from server-validated UCI lists.
   - Manages connection lifecycle (SignalR automatic reconnect, WebRTC peer connection, and session restoration on page reload).
3. **Multiplayer Communication**:
   - **SignalR**: Authoritative channel for all gameplay actions (cards, moves, revivals, swaps, resignation).
   - **WebRTC DataChannel**: Peer-to-peer data relay for low-latency peer cursors, pings, and chat; never mutates authoritative game state directly.

---

## 3. Confirmed Requirements vs Inferred Behavior

| Feature / Rule | Specification Status | Behavior in Implementation |
|---|---|---|
| **Authoritative Referee** | **[CONFIRMED]** | Backend validates all moves, revivals, swaps, and choices. |
| **Number Cards (0-9)** | **[CONFIRMED]** | Card 0 passes turn; Cards 1–9 grant up to $N$ legal chess moves. |
| **Repeated Movement** | **[CONFIRMED]** | The same piece may move consecutively on multi-move cards. |
| **Captured Pieces Reserve** | **[CONFIRMED]** | Captured pieces enter the original owner's reserve pool (graveyard style) and can only be revived by their original owner. |
| **Revival Placement** | **[CONFIRMED]** | Revived pieces must be placed on empty squares on the player's own half (Ranks 1–4 for White, Ranks 5–8 for Black). Pawns cannot be placed on Rank 1 or Rank 8. Kings cannot be revived. |
| **Reverse Card Effect** | **[CONFIRMED]** | Swaps positions of any two friendly non-king pieces on the board. King safety is strictly enforced. |
| **Skip Card Effect** | **[CONFIRMED]** | Skips the opponent's turn. Active player retains initiative and immediately draws another card for a new turn. |
| **Wild Cards** | **[CONFIRMED]** | Wild cards prompt player with choice. Backend validates choice before granting quotas. |
| **Composite Sequences** | **[CONFIRMED]** | Sequences (e.g. `REVIVE_TWO_AND_MOVE_TWO`) execute sub-effects in order (Revive first, then Move). |
| **King Safety at Turn End** | **[CONFIRMED]** | Ending a turn with one's King in check is illegal and triggers immediate defeat/checkmate. |
| **Checkmate on Multi-Move** | **[CONFIRMED]** | Delivering checkmate on any move terminates the match immediately with victory for active player. |
| **Draw Conditions** | **[CONFIRMED]** | Stalemate, Fifty-Move Rule (100 half-moves), Threefold Repetition, and Insufficient Material are evaluated authoritatively. |
| **Monotonic Revisions** | **[CONFIRMED]** | `GameRevision` increments monotonically on every accepted state change under per-session synchronization. |
| **Session Lifecycle** | **[CONFIRMED]** | Supports `WaitingForPlayer`, `Ready`, `InProgress`, `Completed`, `Expired`, `Cancelled`. |

---

## 4. Authoritative Data Contracts

### Authoritative Server Game State (`GameState`)
- `gameId`: `Guid` — Unique match identifier.
- `configVersion`: `string` — Rules configuration version.
- `eventSequenceNumber`: `long` — Monotonically increasing event log sequence number.
- `fen`: `string` — FEN representation of piece placement, active turn, castling rights, and en passant square.
- `activePlayer`: `PlayerColor` — `White` or `Black`.
- `status`: `GameStatus` — `Active`, `Check`, `Checkmate`, `Stalemate`, `DrawByInsufficientMaterial`, `DrawByFiftyMoveRule`, `DrawByThreefoldRepetition`, `Resigned`, `Timeout`.
- `winner`: `PlayerColor?` — Winning color if finished, otherwise `null`.
- `inCheck`: `bool` — Whether the player whose initiative it is is in check.
- `halfMoveClock`: `int` — Count of half-moves since last pawn advance or piece capture.
- `fullMoveNumber`: `int` — Turn number incremented after Black's move.
- `reserves`: `Dictionary<PlayerColor, List<ReservePiece>>` — Captured pieces available for revival.
- `moveHistory`: `List<ChessActionRecord>` — Audit trail of SAN/UCI moves and tactical card actions.
- `initialFen`: `string` — Starting FEN used for position repetition tracking.

