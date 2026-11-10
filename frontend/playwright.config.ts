import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure'
  },
  webServer: [
    {
      command: 'dotnet run --project ../backend/ChessUno/ChessUno.Web --urls "http://localhost:5000"',
      url: 'http://localhost:5000/health',
      reuseExistingServer: false,
      timeout: 30000,
      env: {
        CHESSUNO_TEST_PASSWORD: process.env.CHESSUNO_TEST_PASSWORD || ''
      }
    },
    {
      command: 'npm run dev -- --port 5173',
      url: 'http://localhost:5173',
      reuseExistingServer: false,
      timeout: 20000
    }
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});

