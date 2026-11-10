# Chess UNO — Test-Driven Development (TDD) Strategy (Phase 0)

## 1. TDD Philosophy and Principles

Chess UNO follows strict **Test-Driven Development (Red $\to$ Green $\to$ Refactor)**:
1. **Red**: Write a failing unit or integration test describing expected behavior before touching production code.
2. **Green**: Implement the minimal, clean code necessary to pass the test.
3. **Refactor**: Clean up abstractions, improve naming, optimize performance while keeping all tests passing.

---

## 2. Test Pyramid & Taxonomy

```text
                  /\
                 /  \
                / E2E\            - Multiplayer sync & WebRTC/SignalR flow
               /------\
              / Integr \          - Config loading, SignalR Hubs, DB Persistence
             /----------\
            /    Unit    \        - Rule engine, JSON Schema, Effects, FEN legality
           /--------------\
```

---

## 3. Test Suites Overview

### A. Configuration & Semantic Validation (`Config.Tests`)
- **Schema Structural Conformance**: Validates `chess-uno.json` against `chess-uno.schema.json`.
- **Negative Schema Tests**: Ensures schema rejects negative quantities, unknown effect types, invalid FEN strings, and missing required properties.
- **Semantic Validation Tests**:
  - Total card quantity sums exactly to 108 (or defined deck total).
  - Every `effectKey` on every card references an existing definition in `effects`.
  - Recursive effects (like `SEQUENCE` and `CHOOSE_EFFECT`) only reference valid catalog keys and contain no cyclic dependencies.
  - Board dimensions are valid positive integers ($\ge 4$ and $\le 16$).
  - White and Black promotion ranks are within board row limits.

### B. Chess Legality & Board Engine Tests (`Engine.Tests/Chess`)
- **Move Generation**: Legal moves for Pawns, Knights, Bishops, Rooks, Queens, Kings.
- **Special Chess Rules**:
  - En passant eligibility and expiration after multi-move turns.
  - Kingside and queenside castling conditions (path empty, King not in check, squares not attacked).
  - Pawn promotion triggering on reaching configured promotion rank.
- **King Safety**:
  - Self-check prevention on every single move.
  - Pinned piece movement restrictions.

### C. Card & Effect System Tests (`Engine.Tests/Effects`)
- **Number Cards (0–9)**:
  - Card 0 ends turn with 0 moves permitted.
  - Card 3 allows up to 3 legal moves; verifies action counter decrements per move.
  - Consecutive moves with the same piece execute legally.
- **Special Cards**:
  - `REVIVE_PIECES`: Verifies revival fails if target square is occupied, or outside allowed half, or if piece is not in player's reserve.
  - `SWAP_PIECES`: Verifies swapping two friendly pieces exchanges coordinates without leaving King in check.
  - `SKIP_TURN`: Verifies opponent's turn flag is bypassed and player draws next card.
  - `CHOOSE_EFFECT`: Verifies engine only accepts valid option keys.

### D. Multiplayer & Security Tests (`Multiplayer.Tests` & `Api.Tests`)
- **Fog of War / Privacy**: Ensures serialized state sent to Player A contains zero information about opponent's secret hand or remaining deck order.
- **Event Sequence Order**: Out-of-order events rejected or trigger resynchronization.
- **Turn Ownership**: Client commands sent out of turn are rejected with `UNAUTHORIZED_TURN_ACTION`.

---

## 4. Phase 0 Readiness Gate (Prerequisites for Phase 1)

Before Phase 1 implementation (Core Board & Chess Engine) begins, the following must pass:
- [x] Versioned JSON configuration schema created (`chess-uno.schema.json`).
- [x] Standard 108-card configuration created (`chess-uno.json`).
- [x] Game rules, state design, effect system, and event contracts documented.
- [ ] Automated tests in `Config.Tests` validating schema structural parsing and semantic rules.
- [ ] 100% test pass rate with green test run.

