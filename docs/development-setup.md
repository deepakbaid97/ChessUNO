# Chess UNO — Local Development & Testing Guide

## 1. Prerequisites

Ensure you have installed:
- **[.NET 10 SDK](https://dotnet.microsoft.com/)** (`dotnet --version` should output `10.x`)
- **[Node.js](https://nodejs.org/)** (v18 or higher) and `npm`
- **Modern Web Browser** (Chrome / Edge / Firefox)

---

## 2. Running the Application Locally

Run the backend API and frontend dev server in two separate terminal windows.

### Terminal 1: Backend API & SignalR Hub
```powershell
dotnet run --project backend/ChessUno/ChessUno.Web --urls "http://localhost:5000"
```
The backend will be available at:
- **Base URL & Hub**: `http://localhost:5000`
- **Health Endpoint**: `http://localhost:5000/health`
- **SignalR Endpoint**: `http://localhost:5000/hubs/game`

### Terminal 2: Frontend Client (Vite Dev Server)
```powershell
cd frontend
npm install
npm run dev
```
The application will open at:
- **Web App**: **`http://localhost:5173`**
*(Vite proxies `/api` and `/hubs` requests to `http://localhost:5000` automatically).*

---

## 3. Running Automated Tests

### Backend Unit & Integration Tests (114 tests)
Run all backend tests:
```powershell
dotnet test
```
Or run individual project test suites:
```powershell
dotnet test tests/Engine.Tests/Engine.Tests.csproj
dotnet test tests/CardEngine.Tests/CardEngine.Tests.csproj
dotnet test tests/Config.Tests/Config.Tests.csproj
dotnet test tests/Api.Tests/Api.Tests.csproj
```

### Frontend Unit & Component Tests (28 tests)
```powershell
cd frontend
npm test
```

### Production Bundling
Verify production build:
```powershell
cd frontend
npm run build
```

### End-to-End Multi-Context Browser Tests (Playwright)
Runs an automated two-browser match (create match, join via link, draw cards, execute chess moves, test page refresh recovery, and conclude match):
```powershell
cd frontend
npx playwright test
```

