# Chess UNO — Comprehensive Testing Strategy

## 1. Overview and Core Principles

Chess UNO adheres to strict **Test-Driven Development (Red $\to$ Green $\to$ Refactor)** across both backend (.NET 10 C#) and frontend (Svelte 5 / TypeScript).

Key engineering mandates:
1. **Authoritative Backend**: Game rules, turn phases, chess legality, effect validation, and session states are evaluated and enforced exclusively on the backend. Frontend stores reflect authoritative server updates.
2. **Real PostgreSQL Testing**: Database persistence, schema integrity, concurrency, and application restart recovery are tested against real PostgreSQL 17 test databases rather than in-memory mocks.
3. **Deterministic Shuffling in Tests**: Deck generation supports an optional test seed parameter. When provided, deck generation yields identical, deterministic card orders across both C# unit tests and Playwright E2E tests (`?seed=42`). In production, a secure cryptographic random generator (`RandomNumberGenerator.GetInt32`) is used.
4. **Complete Test Pyramid**:
   - **Unit Tests (C#)**: Configuration validation, chess legality, draw rules, King safety, piece reserve revival, card effect resolution, composite sequence execution.
   - **Database & Persistence Tests (C# & PostgreSQL)**: Real PostgreSQL session persistence, schema initialization, restart recovery, and action idempotency.
   - **SignalR Integration Tests (C#)**: SignalR game session lifecycle, room routing, revision mismatch rejections, client disconnections, concurrent action locking.
   - **Frontend Unit / Component Tests (Vitest)**: Svelte stores, SignalR/WebRTC client services, WebRTC candidate queuing, message protocol validation, optimistic anti-regression guard, card hand choices rendering.
   - **End-to-End Tests (Playwright)**: Full browser dual-player match creation, invitation joining, deck drawing, multi-move execution, browser refresh, state recovery, and victory determination.

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
├── Api.Tests/                     # SignalR Hub, Concurrency, PostgreSQL Persistence (22 tests)
│   ├── GameSessionLifecycleTests.cs
│   ├── ConcurrencyAndLockingTests.cs
│   ├── SessionSnapshotTests.cs
│   ├── HubAuthorizationTests.cs
│   ├── PostgreSqlPersistenceTests.cs     # Real PostgreSQL 17 database tests (4 tests)
│   └── GameHubSynchronizationTests.cs    # Revision mismatch & disconnect tests (3 tests)
frontend/
├── src/tests/                     # Vitest Frontend Stores & Services (30 tests)
│   ├── gameStore.test.ts
│   ├── signalrService.test.ts
│   ├── webrtcService.test.ts             # WebRTC candidate queue & message tests (4 tests)
│   ├── boardUtils.test.ts
│   ├── Cards.test.ts
│   └── Chessboard.test.ts
└── e2e/                           # Playwright Browser E2E Tests (1 suite / passing)
    └── multiplayer.spec.ts               # Multi-context browser duel with reload & victory
```

---

## 3. Running the Tests

### Execute All Backend Tests (121 tests)
```powershell
dotnet test ChessUno.slnx
```

### Execute Specific Backend Test Projects
```powershell
dotnet test tests/Config.Tests/Config.Tests.csproj
dotnet test tests/Engine.Tests/Engine.Tests.csproj
dotnet test tests/CardEngine.Tests/CardEngine.Tests.csproj
dotnet test tests/Api.Tests/Api.Tests.csproj
```

### Execute Real PostgreSQL Persistence Tests
```powershell
dotnet test tests/Api.Tests/Api.Tests.csproj --filter PostgreSqlPersistenceTests
```

### Execute Frontend Unit & Component Tests (30 tests)
```powershell
cd frontend
npm test -- --run
```

### Execute Frontend Playwright E2E Tests
```powershell
cd frontend
npx playwright test
```
