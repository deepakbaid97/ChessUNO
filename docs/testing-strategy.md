# Chess UNO — Comprehensive Testing Strategy

## 1. Overview and Core Principles

Chess UNO follows strict **Test-Driven Development (Red $\to$ Green $\to$ Refactor)** across both backend (.NET 9 C#) and frontend (Svelte 5 / TypeScript). 

Key engineering mandates:
1. **Authoritative Backend**: Game rules, turn phases, chess legality, effect validation, and session states are evaluated and enforced exclusively on the backend. Frontend tests confirm UI reaction, store integrity, and input handling; they never validate gameplay.
2. **Deterministic Shuffling in Tests**: Deck generation supports an optional test seed parameter. When provided, deck generation yields identical, deterministic card orders across both C# unit tests and Playwright E2E tests (`?seed=42`). In production, a secure cryptographic random generator (`RandomNumberGenerator.GetInt32`) is used.
3. **No Mocks of Business Logic**: Domain logic (chess engine, card registry, deck manager, turn controller) is tested with real, in-memory instances rather than mocking domain algorithms.
4. **Complete Test Pyramid**:
   - **Unit Tests (C#)**: Configuration validation, chess legality, draw rules, King safety, piece reserve revival, card effect resolution, composite sequence execution.
   - **Integration Tests (C#)**: SignalR game session lifecycle, room routing, concurrent action locking, snapshot export/restore.
   - **Frontend Unit / Component Tests (Vitest)**: Svelte stores, SignalR/WebRTC client services, optimistic anti-regression guard, card hand choices rendering.
   - **End-to-End Tests (Playwright)**: Full browser dual-player match creation, invitation joining, deck drawing, multi-move execution, and victory determination.

---

## 2. Test Pyramid & Directory Structure

```text
tests/
├── Config.Tests/                  # Configuration & Schema validation (10 tests)
│   ├── ConfigValidationTests.cs
│   └── EffectCatalogTests.cs
├── Engine.Tests/                  # Authoritative Chess Rules & Draw Conditions (46 tests)
│   ├── ChessLegalityTests.cs
│   ├── MultiMoveTests.cs
│   ├── SequentialMoveTests.cs
│   ├── DrawConditionTests.cs
│   ├── KingSafetyTests.cs
│   └── ReserveRevivalTests.cs
├── CardEngine.Tests/              # Deck Management, Effects & Turn Controller (43 tests)
│   ├── DeckManagerTests.cs
│   ├── EffectExecutionTests.cs
│   ├── TurnControllerTests.cs
│   ├── WildCardChoiceTests.cs
│   └── CompositeEffectTests.cs
├── Api.Tests/                     # SignalR Hub, Concurrency & Session Durability (15 tests)
│   ├── GameSessionLifecycleTests.cs
│   ├── ConcurrencyAndLockingTests.cs
│   ├── SessionSnapshotTests.cs
│   └── HubAuthorizationTests.cs
frontend/
├── src/tests/                     # Vitest Frontend Stores & Services (28 tests)
│   ├── gameStore.test.ts
│   ├── signalrService.test.ts
│   ├── webrtcService.test.ts
│   └── CardHand.test.ts
└── e2e/                           # Playwright Browser E2E Tests (1 suite / passing)
    └── multiplayer.spec.ts
```

---

## 3. Backend Test Suites

### 3.1. Configuration Tests (`Config.Tests` — 10 tests)
- **JSON Schema Validation**: Asserts that `configs/chess-uno.json` strictly conforms to `configs/chess-uno.schema.json`.
- **Negative Schema Tests**: Rejects configurations containing negative card counts, unrecognized effect types, missing FEN strings, or invalid promotion ranks.
- **Semantic Integrity**:
  - Total card quantities in the standard deck sum to 108 cards.
  - Every `effectKey` referenced in `cards` maps to a registered handler in `effects`.
  - Composite `SEQUENCE` and `CHOOSE_EFFECT` definitions reference valid children and avoid cyclic definitions.

### 3.2. Chess Engine Tests (`Engine.Tests` — 46 tests)
- **Standard Piece Legality**: Pawns, Knights, Bishops, Rooks, Queens, Kings legal move calculation using `ChessDotNet` integration.
- **King Safety**:
  - Absolute ban on self-check or moving pinned pieces into check.
  - Validates that King must escape check on the immediate move; ending turn in check results in instant defeat.
- **Multi-Move Sequences**:
  - Validates that playing a number card (e.g. Card 3) allows up to 3 legal moves.
  - Moving the same piece consecutively is fully legal.
  - Intermediate opponent check does not prematurely end turn if more moves remain, but opponent checkmate instantly concludes the match as victory.
- **Capture & Reserve**:
  - Captures send pieces to the captured piece's *owner's* reserve.
  - Opponents cannot revive pieces from another player's reserve.
- **Revival & Piece Swapping**:
  - Validates piece revival onto empty squares on the player's own half of the board (ranks 1–4 for White, ranks 5–8 for Black).
  - Validates `ApplySwap` exchanges coordinates of two friendly pieces and verifies that neither the swap nor post-swap leaves the King in check.
- **Draw Conditions**:
  - Fifty-Move Rule: Triggers `DrawByFiftyMoveRule` when `halfMoveClock >= 100`.
  - Threefold Repetition: Evaluates historical position keys against `InitialFen` and subsequent moves; triggers `DrawByThreefoldRepetition` on third occurrence.
  - Insufficient Material: Detects bare King vs King, King+Knight vs King, King+Bishop vs King, and King+Bishop vs King+Bishop with bishops on matching square colors (`DrawByInsufficientMaterial`).
- **Terminal State Lock**: Confirms no further moves, revivals, or card plays are permitted once a terminal state is reached.

### 3.3. Card Engine & Turn Controller Tests (`CardEngine.Tests` — 43 tests)
- **Deck Management**:
  - Validates deterministic shuffling when initialized with a random seed.
  - Validates draw pile exhaustion: discard pile is reshuffled into draw pile automatically.
  - Verifies exact hand size tracking and card play discarding.
- **Single Effects**:
  - `MOVE_1` through `MOVE_9`: Correctly grants allocated moves and decrements count per move.
  - `PASS_TURN_EFFECT`: Sets remaining moves to 0 and transitions active turn.
  - `SKIP_OPPONENT`: Bypasses opponent turn, allowing active player to draw next card immediately.
  - `REVIVE_UP_TO_TWO`, `REVIVE_UP_TO_FOUR`: Sets remaining revivals without granting moves.
  - `SWAP_OWN_PIECES`: Sets swap allowed flag.
- **Composite & Wild Cards**:
  - `REVIVE_TWO_AND_MOVE_TWO`: Sets up step 1 (`REVIVE_UP_TO_TWO`), stores `MOVE_2` in `PendingSequence`, and automatically triggers step 2 upon revival depletion or manual pass.
  - `WILD_CHOICE`: Transitions `TurnPhase` to `AwaitingChoice`, populates `AvailableChoices`, and activates selected effect upon player choice submission.
  - `WILD_DRAW_FOUR`: Triggers opponent forced draw of 4 cards and skips opponent's turn.

### 3.4. API & Integration Tests (`Api.Tests` — 15 tests)
- **Session Lifecycle**: Creation of session, player color assignment (White for host, Black for guest), transitioning state from `WaitingForPlayer` $\to$ `Ready` $\to$ `InProgress` $\to$ `Completed`.
- **Per-Session Concurrency & Locking**: Confirms `SessionLock` (`SemaphoreSlim(1, 1)`) prevents race conditions and state corruption under concurrent SignalR invocations.
- **Snapshot Export & Restoration**: Serializes in-memory game session (board FEN, reserves, hands, deck piles, turn state, revision) into JSON and restores it to an exact matching state.
- **Authorization & Safety**:
  - Rejects actions using invalid player tokens with `Invalid player token`.
  - Rejects actions out of turn with `Not player's turn`.
  - Rejects actions on completed or expired sessions.

---

## 4. Frontend Test Suites

### 4.1. Unit & Component Tests (`frontend/src/tests` — 28 tests)
- **Game Store (`gameStore.test.ts`)**:
  - State initialization and update via `setFullState`.
  - Anti-regression guard: ignores stale updates with lower revision numbers.
  - Handling of `availableChoices` updates during wild card selection.
- **SignalR Client Service (`signalrService.test.ts`)**:
  - Hub connection establishment, token injection, message listeners.
  - Methods: `joinGame`, `drawCard`, `playCard`, `submitMove`, `submitRevival`, `submitSwap`, `submitChoice`, `endTurn`, `resignGame`.
- **WebRTC Client Service (`webrtcService.test.ts`)**:
  - Initialization of `RTCPeerConnection` with STUN/TURN configuration.
  - Typed DataChannel communication (`ping`, `pong`, `cursor`, `chat`).
  - Graceful closure and reconnection handlers.
- **UI Components (`CardHand.test.ts`)**:
  - Card rendering, playable card highlighting, disabled state during opponent turn.
  - Selection interface for wild card options when phase is `AwaitingChoice`.

### 4.2. Playwright End-to-End Tests (`frontend/e2e` — 1 suite)
- **Multiplayer Duel Flow (`multiplayer.spec.ts`)**:
  - Host creates match with deterministic seed (`?seed=42`).
  - Host receives invitation token/link.
  - Guest joins match via invitation URL.
  - Board initializes with standard FEN.
  - Host draws card, plays card, executes legal chess move on board.
  - Opponent screen updates authoritatively via SignalR broadcast.
  - Verifies turn transitions and victory notifications.

---

## 5. Running the Tests

### Execute All Backend Tests
```powershell
dotnet test ChessUno.sln
```

### Execute Specific Backend Test Projects
```powershell
dotnet test tests/Config.Tests/Config.Tests.csproj
dotnet test tests/Engine.Tests/Engine.Tests.csproj
dotnet test tests/CardEngine.Tests/CardEngine.Tests.csproj
dotnet test tests/Api.Tests/Api.Tests.csproj
```

### Execute Frontend Unit & Component Tests
```powershell
cd frontend
npm test -- --run
```

### Execute Frontend E2E Tests
```powershell
cd frontend
npx playwright test
```

