import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/__tests__/setup.ts", "./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    testTimeout: 15000,
    env: {
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID:
        "CFACTORY000000000000000000000000000000000000000000000000",
      NEXT_PUBLIC_NFT_CONTRACT_ID:
        "CNFT000000000000000000000000000000000000000000000000000000",
      NEXT_PUBLIC_GOVERNOR_CONTRACT_ID:
        "CGOV000000000000000000000000000000000000000000000000000000",
      NEXT_PUBLIC_GOVERNOR_START_LEDGER: "1500000",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
