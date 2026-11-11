# Chess UNO — Multiplayer Protocol & Signaling Specification

## 1. Overview

Communication between clients and the authoritative server uses **ASP.NET Core SignalR** over WebSockets, supplemented by an optional **WebRTC DataChannel** for low-latency peer interactions (cursor tracking, pings, chat). The server remains 100% authoritative for all game state.

---

## 2. SignalR Hub Endpoints (`/hubs/game`)

### Client-to-Server Invocations

| Method | Parameters | Return Type | Description |
|---|---|---|---|
| `JoinGameRoom` | `gameId: Guid, playerToken: string` | `bool` | Authenticates caller, marks presence `connected`, and joins room `game-{id}`. Sends private snapshot to caller and announces connection to opponent. |
| `SendSignal` | `gameId: Guid, playerToken: string, signalType: string, payload: string` | `bool` | Relays WebRTC signaling payloads (`offer`, `answer`, `candidate`) to opponent. |
| `DrawCard` | `gameId: Guid, playerToken: string` | `bool` | Authoritatively draws active card for turn. |
| `DrawCardWithIdempotency` | `gameId, playerToken, actionId: string, expectedRevision?: int` | `bool` | Idempotent card draw. Deduplicates retries and enforces revision checks. |
| `SubmitChoice` | `gameId, playerToken, choiceEffectKey: string` | `bool` | Submits choice when in `AwaitingChoice` phase. |
| `SubmitChoiceWithIdempotency` | `gameId, playerToken, choiceEffectKey, actionId, expectedRevision?` | `bool` | Idempotent choice submission. |
| `SubmitMove` | `gameId, playerToken, from: string, to: string, promotion?: string` | `bool` | Validates and applies chess move on the authoritative board. |
| `SubmitMoveWithIdempotency` | `gameId, playerToken, from, to, promotion, actionId, expectedRevision?` | `bool` | Idempotent move submission. |
| `SubmitRevival` | `gameId, playerToken, pieceType: string, targetSquare: string` | `bool` | Revives a friendly captured piece onto the specified square. |
| `SubmitRevivalWithIdempotency` | `gameId, playerToken, pieceType, targetSquare, actionId, expectedRevision?` | `bool` | Idempotent revival submission. |
| `SubmitSwap` | `gameId, playerToken, sq1: string, sq2: string` | `bool` | Swaps positions of two friendly non-king pieces. |
| `SubmitSwapWithIdempotency` | `gameId, playerToken, sq1, sq2, actionId, expectedRevision?` | `bool` | Idempotent swap submission. |
| `EndTurn` | `gameId, playerToken` | `bool` | Ends action phase or passes turn. Verifies King safety. |
| `EndTurnWithIdempotency` | `gameId, playerToken, actionId, expectedRevision?` | `bool` | Idempotent turn end submission. |
| `Resign` | `gameId, playerToken` | `bool` | Concludes match by player resignation. |
| `GetLegalMoves` | `gameId, playerToken` | `List<string>` | Returns current legal UCI chess moves for active player. |

---

## 3. Server-to-Client Events

| Event Name | Payload Schema | Target | Description |
|---|---|---|---|
| `GameStateSnapshot` | `{ gameId, status, assignedColor, boardFen, activePlayer, turnPhase, remainingMoves, remainingRevivals, canSwap, availableChoices, inCheck, gameStatus, winner, remainingDeckCount, playerWhiteName, playerBlackName, activeCard, whiteReserves, blackReserves, legalMoves, revision }` | Caller | Comprehensive private game state sent immediately on join or reconnection. |
| `GameStateUpdated` | `{ boardFen, activePlayer, turnPhase, remainingMoves, remainingRevivals, canSwap, availableChoices, inCheck, gameStatus, winner, revision, sessionStatus, remainingDeckCount, activeCard, whiteReserves, blackReserves, legalMoves }` | Room | Broadcast to all room members whenever authoritative state changes. Transactionally saved to PostgreSQL. |
| `CardDrawn` | `{ player, cardName, remainingDeckCount }` | Room | Notifies players of card drawn. |
| `MoveAccepted` | `{ player, from, to, boardFen }` | Room | Broadcasts accepted chess move. |
| `PieceRevived` | `{ player, piece, targetSquare, boardFen }` | Room | Broadcasts accepted piece revival. |
| `PiecesSwapped` | `{ player, square1, square2, boardFen }` | Room | Broadcasts accepted piece swap. |
| `EffectChosen` | `{ player, choice }` | Room | Broadcasts selected ability from wild choice. |
| `PlayerConnected`| `{ playerName, color, isReconnected }` | Opponent | Notifies opponent that peer has connected or reconnected. |
| `PlayerDisconnected` | `{ playerName, color }` | Opponent | Notifies opponent that peer disconnected. |
| `ActionRejected` | `{ reason, currentRevision, expectedRevision? }` | Caller | Returned when an action fails validation or revision check (`REVISION_MISMATCH`, `NOT_YOUR_TURN`, `SESSION_TERMINAL`, `ILLEGAL_MOVE`). |
| `ReceiveSignal` | `signalType: string, payload: string` | Opponent | WebRTC offer, answer, or ICE candidate relay. |

---

## 4. WebRTC Typed Peer-to-Peer Protocol

The WebRTC DataChannel (`chess-uno-p2p`) transmits non-authoritative JSON messages using the following contract:

```typescript
export const PROTOCOL_VERSION = '1.0';

export type P2PMessageType = 'ping' | 'pong' | 'cursor' | 'chat' | 'voice-status';

export interface VoiceStatusPayload {
  speaking: boolean;
  voiceActive: boolean;
}

export interface P2PMessage<T = any> {
  id: string;
  version: string;
  type: P2PMessageType;
  sender: string;
  payload?: T;
  timestamp: number;
}
```

### Reliability, Candidate Queuing & Voice Chat
1. **Candidate Queuing**: ICE candidates arriving before `setRemoteDescription` are queued and drained safely after remote description installation, avoiding browser `InvalidStateError`.
2. **Negotiation Timeout & Fallback**: If peer connection does not connect within 12 seconds, WebRTC transitions to fallback mode and the UI notifies the user that communication is routed via SignalR.
3. **WebRTC Push-to-Talk Voice Chat**:
   - Initial SDP offers and answers include an audio transceiver (`direction: 'sendrecv'`) pre-negotiated upfront.
   - Microphone capture is opt-in via `navigator.mediaDevices.getUserMedia(...)`.
   - Audio tracks are muted by default (`track.enabled = false`) and actively unmuted only while the Push-to-Talk button or keyboard key (`Space` or `V`) is held down.
   - P2P message `voice-status` synchronizes speaking wave indicators and opponent mute status across peers in real time without SDP renegotiation glare.
