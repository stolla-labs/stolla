import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PLAYWRIGHT_PORT ?? "3100";
const baseURL = `http://127.0.0.1:${PORT}`;
const FACTORY_ID = `C${"A".repeat(55)}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: {
    /**
     * Dev server keeps `NODE_ENV !== "production"` so `NEXT_PUBLIC_E2E_MOCKS`
     * can unlock the browser `__STOLLA_E2E__` bridge used by creation and
     * multi-community fixtures. Production builds intentionally fail closed.
     */
    command: `npx next dev --port ${PORT} --hostname 127.0.0.1`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      NEXT_PUBLIC_E2E_MOCKS: "true",
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
      NEXT_PUBLIC_E2E_MOCKS: "true",
      NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID: FACTORY_ID,
      NEXT_PUBLIC_NFT_CONTRACT_ID: `C${"B".repeat(55)}`,
      NEXT_PUBLIC_GOVERNOR_CONTRACT_ID: `C${"C".repeat(55)}`,
      NEXT_PUBLIC_GOVERNOR_START_LEDGER: "1500000",
    },
  },
});
