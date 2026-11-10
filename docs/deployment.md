# Chess UNO — Production Deployment & Environment Guide

## 1. Prerequisites

- **.NET Runtime**: .NET 10 runtime / SDK.
- **PostgreSQL**: PostgreSQL 14+ (tested on PostgreSQL 17).
- **Node.js**: Node 18+ (tested on Node 20 / 22 with npm).

---

## 2. Configuration & Environment Variables

| Variable | Description | Example / Default |
|---|---|---|
| `ConnectionStrings__DefaultConnection` | Mandatory PostgreSQL connection string in Production | `Host=postgres.internal;Port=5432;Database=chessuno;Username=chessuno;Password=YOUR_POSTGRES_PASSWORD_HERE;` |
| `UseInMemoryRepository` | Explicitly enables volatile in-memory repository (**Development/Testing only**, rejected in Production) | `false` |
| `Cors__AllowedOrigins__0` | Trusted frontend origin 1 | `https://chessuno.yourdomain.com` |
| `Cors__AllowedOrigins__1` | Trusted frontend origin 2 | `https://staging.chessuno.yourdomain.com` |
| `VITE_ICE_SERVERS` (Frontend) | JSON string of STUN/TURN servers | `[{"urls":"turn:turn.yourdomain.com:3478","username":"user","credential":"pwd"}]` |
| `ASPNETCORE_ENVIRONMENT` | Environment mode | `Production` or `Development` |

> [!IMPORTANT]
> In `Production` environment, `ConnectionStrings__DefaultConnection` is mandatory. The application fails startup immediately if the connection string is absent or contains placeholders. Silent fallback to memory is strictly forbidden.

---

## 3. Database Migration & Initialization

On application startup, the backend automatically invokes `initDb.Database.Migrate()` via `Program.cs`. To apply migrations manually or via CI/CD:
```powershell
dotnet ef database update --project backend/ChessUno/ChessUno.Web/ChessUno.Web.csproj
```

Active migrations:
- `20261110114300_InitialCreate`: Initial relational schema (`game_sessions`, `game_actions`).
- `20261110120813_SecureTokenStorage`: Dropped plaintext `invitation_token`, added unique index on `invitation_token_hash`.

---

## 4. Production Build & Execution

### 4.1. Backend Build & Run
```powershell
dotnet publish backend/ChessUno/ChessUno.Web/ChessUno.Web.csproj -c Release -o ./publish/backend
cd ./publish/backend
dotnet ChessUno.Web.dll
```

### 4.2. Frontend Build
```powershell
cd frontend
npm ci
npm run build
```
Static output is generated in `frontend/dist/` and can be hosted behind Nginx, Caddy, or Cloudflare Pages.
