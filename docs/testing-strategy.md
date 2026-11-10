# Chess UNO — Comprehensive Testing Strategy

## 1. Overview and Core Principles

Chess UNO adheres to strict **Test-Driven Development (Red $\to$ Green $\to$ Refactor)** across both backend (.NET 10 C#) and frontend (Svelte 5 / TypeScript).

Key engineering mandates:
1. **Authoritative Backend**: Game rules, turn phases, chess legality, effect validation, and session states are evaluated and enforced exclusively on the backend. Frontend stores reflect authoritative server updates.
2. **Real PostgreSQL Testing with Strict Safety Controls**: Database persistence, schema integrity, concurrency, and application restart recovery are tested against real PostgreSQL 17 test databases. Destructive operations validate that the database name explicitly contains `test`.
3. **Deterministic Shuffling in Tests**: Deck generation supports an optional test seed parameter. When provided, deck generation yields identical, deterministic card orders across both C# unit tests and Playwright E2E tests (`?seed=42`). In production, a secure cryptographic random generator (`RandomNumberGenerator.GetInt32`) is used.
4. **Complete Test Pyramid**:
   - **Unit Tests (C#)**: Configuration validation, chess legality, draw rules, King safety, piece reserve revival, card effect resolution, composite sequence execution.
   - **Database & Persistence Tests (C# & PostgreSQL)**: Real PostgreSQL session persistence, schema initialization, restart recovery, atomic action transactions, cross-instance concurrency conflicts, and action idempotency.
   - **Security & Token Isolation Tests (C#)**: Keyed HMAC-SHA256 token hashing, snapshot credential absence verification, public API view isolation, constant-time validation.
   - **SignalR Integration Tests (C#)**: SignalR game session lifecycle, room routing, revision mismatch rejections, client disconnections, concurrent action locking.
   - **Dependency Injection & Secret Scanning Tests (C#)**: Startup fail-fast validation in Production when database connection strings are missing or invalid, automated secret scanning across all repository source files.
   - **Frontend Unit / Component Tests (Vitest)**: Svelte stores, SignalR/WebRTC client services, WebRTC candidate queuing, message protocol validation, optimistic anti-regression guard, card hand choices rendering.
   - **End-to-End Tests (Playwright)**: Full browser dual-player match creation, invitation joining, deck drawing, multi-move execution, browser refresh, state recovery, and victory determination.

---

## 2. Test Pyramid & Directory Structure

```text
tests/
├── Config.Tests/                     # Configuration & Schema validation (10 tests)
│   ├── ConfigValidationTests.cs
│   └── EffectCatalogTests.cs
├── Engine.Tests/                     # Authoritative Chess Rules & Draw Conditions (46 tests)
│   ├── ChessLegalityTests.cs
│   ├── MultiMoveTests.cs
│   ├── SequentialMoveTests.cs
│   ├── DrawConditionTests.cs
│   ├── KingSafetyTests.cs
│   └── ReserveRevivalTests.cs
├── CardEngine.Tests/                 # Deck Management, Effects & Turn Controller (43 tests)
│   ├── DeckManagerTests.cs
│   ├── EffectExecutionTests.cs
│   ├── TurnControllerTests.cs
│   ├── WildCardChoiceTests.cs
│   └── CompositeEffectTests.cs
├── Api.Tests/                        # SignalR Hub, Persistence, Security & DI (31 tests)
│   ├── GameHubTests.cs
│   ├── GamesApiTests.cs
│   ├── GameHubSynchronizationTests.cs       # Revision mismatch & disconnect tests
│   ├── PostgreSqlPersistenceTests.cs        # Real PostgreSQL 17 database & concurrency tests (6 tests)
│   ├── TokenSecurityTests.cs                # Token hashing & snapshot sanitization tests (3 tests)
│   ├── DependencyInjectionConfigurationTests.cs # Production fail-fast & DI validation (4 tests)
│   └── SecretScanningTests.cs               # Automated credential scanning test (1 test)
frontend/
├── src/tests/                        # Vitest Frontend Stores & Services (30 tests)
│   ├── gameStore.test.ts
│   ├── signalrService.test.ts
│   ├── webrtcService.test.ts                # WebRTC candidate queue & message tests (4 tests)
│   ├── boardUtils.test.ts
│   ├── Cards.test.ts
│   └── Chessboard.test.ts
└── e2e/                              # Playwright Browser E2E Tests
    └── multiplayer.spec.ts                  # Multi-context browser duel with reload & victory
```

Total Automated Tests: **160 tests** (130 backend + 30 frontend), all passing.

---

## 3. Test Execution Commands

```powershell
# Run all backend unit, integration, and security tests
dotnet test ChessUno.slnx

# Run specific persistence and concurrency tests
dotnet test tests/Api.Tests/Api.Tests.csproj --filter FullyQualifiedName~PostgreSqlPersistenceTests

# Run secret scanning audit
dotnet test tests/Api.Tests/Api.Tests.csproj --filter FullyQualifiedName~SecretScanningTests

# Run frontend tests
npm --prefix frontend test -- --run
```
