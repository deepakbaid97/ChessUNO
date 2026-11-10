# Chess UNO — Production Deployment & Environment Guide

## 1. Prerequisites

- **.NET Runtime**: .NET 9 or .NET 10 runtime / SDK.
- **PostgreSQL**: PostgreSQL 14+ (tested on PostgreSQL 17.5).
- **Node.js**: Node 18+ (tested on Node 20 / 22 with npm).

---

## 2. Configuration & Environment Variables

| Variable | Description | Example / Default |
|---|---|---|
| `ConnectionStrings__DefaultConnection` | PostgreSQL connection string | `Host=localhost;Port=5432;Database=chessuno;Username=postgres;Password=secret;` |
| `Cors__AllowedOrigins__0` | Trusted frontend origin 1 | `https://chessuno.yourdomain.com` |
| `Cors__AllowedOrigins__1` | Trusted frontend origin 2 | `https://staging.chessuno.yourdomain.com` |
| `VITE_ICE_SERVERS` (Frontend) | JSON string of STUN/TURN servers | `[{"urls":"turn:turn.yourdomain.com:3478","username":"user","credential":"pwd"}]` |
| `ASPNETCORE_ENVIRONMENT` | Environment mode | `Production` or `Development` |

---

## 3. Database Migration & Initialization

On application startup, the backend automatically invokes `db.Database.EnsureCreated()` via `Program.cs`. If using external EF Core CLI migrations:
```powershell
dotnet ef database update --project backend/ChessUno/ChessUno.Web/ChessUno.Web.csproj
```

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

