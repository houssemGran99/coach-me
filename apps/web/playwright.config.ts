import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;

/**
 * End-to-end tests run against a production build with the in-memory backend and the mock model
 * (MOCK_BACKEND_ALLOW_PRODUCTION lets the mock backend start in a production build; never set it for real deployments).
 * Locally: `pnpm build` once, then `pnpm test:e2e`. Set PW_CHANNEL=msedge or chrome to use an installed browser.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    locale: "en-US",
  },
  projects: [
    {
      name: "mobile-360",
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 740 }, channel: process.env.PW_CHANNEL || undefined },
    },
  ],
  webServer: {
    command: `pnpm exec next start --port ${PORT}`,
    url: `http://localhost:${PORT}/templates`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { NEGOTIATE_LANGUAGE: "1", MOCK_BACKEND: "1", MOCK_BACKEND_ALLOW_PRODUCTION: "1", NODE_ENV: "production" },
  },
});
