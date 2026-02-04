const { defineConfig } = require('@playwright/test');

const FRONTEND_PORT = process.env.E2E_FRONTEND_PORT || '5174';
const BACKEND_PORT = process.env.E2E_BACKEND_PORT || '3002';
process.env.E2E_API_BASE = process.env.E2E_API_BASE || `http://localhost:${BACKEND_PORT}/api`;

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60 * 1000,
  expect: {
    timeout: 10 * 1000,
  },
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: `http://localhost:${FRONTEND_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium' },
    {
      name: 'edge',
      use: {
        channel: 'msedge',
      },
    },
  ],
  webServer: [
    {
      command: 'node server/index.js',
      url: `http://localhost:${BACKEND_PORT}/api/status`,
      reuseExistingServer: false,
      timeout: 120 * 1000,
      env: {
        PORT: BACKEND_PORT,
      },
    },
    {
      command: `npm --prefix client run dev -- --host 127.0.0.1 --port ${FRONTEND_PORT}`,
      url: `http://localhost:${FRONTEND_PORT}`,
      reuseExistingServer: false,
      timeout: 120 * 1000,
      env: {
        VITE_API_BASE: `http://localhost:${BACKEND_PORT}/api`,
      },
    },
  ],
});
