# Chess UNO — Multiplayer Protocol & Signaling Specification

## 1. Overview

Communication between clients and the authoritative server uses **ASP.NET Core SignalR** over WebSockets, supplemented by a **WebRTC DataChannel** for low-latency peer interactions.

---

## 2. SignalR Hub Endpoints (`/hubs/game`)

### Client-to-Server Invocations

| Method | Parameters | Return Type | Description |
|---|---|---|---|
| `JoinGameRoom` | `gameId: Guid, playerToken: string` | `bool` | Authenticates and joins the game room `game-{id}`. Sends private initial snapshot to caller. |
| `SendSignal` | `gameId: Guid, playerToken: string, signalType: string, payload: string` | `bool` | Relays WebRTC signaling payloads (`offer`, `answer`, `candidate`) to opponent. |
| `DrawCard` | `gameId: Guid, playerToken: string` | `bool` | Authoritatively draws active card for the turn. |
| `SubmitChoice` | `gameId: Guid, playerToken: string, choiceEffectKey: string` | `bool` | Submits choice when in `AwaitingChoice` phase. |
| `SubmitMove` | `gameId: Guid, playerToken: string, from: string, to: string, promotion?: string` | `bool` | Validates and applies chess move on the authoritative board. |
| `SubmitRevival` | `gameId: Guid, playerToken: string, pieceType: string, targetSquare: string` | `bool` | Revives a friendly captured piece onto the specified square. |
| `SubmitSwap` | `gameId: Guid, playerToken: string, sq1: string, sq2: string` | `bool` | Swaps positions of two friendly non-king pieces. |
| `EndTurn` | `gameId: Guid, playerToken: string` | `bool` | Ends action phase, advances sequence step, or passes turn. Verifies King safety. |
| `Resign` | `gameId: Guid, playerToken: string` | `bool` | Concludes match by player resignation. |
| `GetLegalMoves` | `gameId: Guid, playerToken: string` | `List<string>` | Returns current legal UCI chess moves for active player. |

---

## 3. Server-to-Client Events

| Event Name | Payload Schema | Target | Description |
|---|---|---|---|
| `GameStateSnapshot` | `{ gameId, status, assignedColor, boardFen, activePlayer, turnPhase, remainingMoves, remainingRevivals, canSwap, availableChoices, inCheck, gameStatus, winner, remainingDeckCount, playerWhiteName, playerBlackName, activeCard, whiteReserves, blackReserves, legalMoves, revision }` | Caller | Comprehensive private game state sent immediately on join or reconnection. |
| `GameStateUpdated` | `{ boardFen, activePlayer, turnPhase, remainingMoves, remainingRevivals, canSwap, availableChoices, inCheck, gameStatus, winner, revision, sessionStatus, remainingDeckCount, activeCard, whiteReserves, blackReserves, legalMoves }` | Room | Broadcast to all room members whenever authoritative state changes. |
| `CardDrawn` | `{ player, cardName, remainingDeckCount }` | Room | Notifies players of card drawn. |
| `MoveAccepted` | `{ player, from, to, boardFen }` | Room | Broadcasts accepted chess move. |
| `PieceRevived` | `{ player, piece, targetSquare, boardFen }` | Room | Broadcasts accepted piece revival. |
| `PiecesSwapped` | `{ player, square1, square2, boardFen }` | Room | Broadcasts accepted piece swap. |
| `EffectChosen` | `{ player, choice }` | Room | Broadcasts selected ability from wild choice. |
| `PlayerConnected`| `{ playerName, color }` | Opponent | Notifies opponent that peer has joined room. |
| `ReceiveSignal` | `signalType: string, payload: string` | Opponent | WebRTC offer, answer, or ICE candidate relay. |

---

## 4. WebRTC Typed Peer-to-Peer Protocol

The WebRTC DataChannel (`chess-uno-p2p`) transmits non-authoritative JSON messages using the following typed contract:

```typescript
export type P2PMessageType = 'ping' | 'pong' | 'cursor' | 'chat';

export interface P2PMessage<T = any> {
  type: P2PMessageType;
  sender: string;
  payload?: T;
  timestamp: number;
}
```

### Supported Messages:
1. **`ping` / `pong`**: Measures real-time peer-to-peer latency.
2. **`cursor`**: Transmits normalized mouse pointer coordinates (`{ x: number, y: number }`) for live peer cursor rendering.
3. **`chat`**: Transmits peer text messages directly between browsers without server roundtrips.

