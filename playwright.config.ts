import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  // The suite shares one server and one in-memory store, so tests that submit a
  // report would otherwise see each other's rows. Serial keeps assertions about
  // "the newest report" meaningful.
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Only kept for failures — enough to see what happened without producing a
    // trace file for every green run.
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    // The critical line: E2E runs against the in-memory store, never a real
    // database. Without it these tests would write rows into whatever backend
    // `.env` happens to name — polluting a developer's local Postgres, and
    // failing outright when Docker is down.
    env: { MISSED_HOUR_REPO: 'memory' },
    stdout: 'pipe',
  },
  projects: [{ name: 'chromium', use: devices['Desktop Chrome'] }],
});
