import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(appDirectory, "../..");

if (
  process.env.NODE_ENV === "production" &&
  (process.env.NEXT_PUBLIC_E2E_WALLET ||
    process.env.NEXT_PUBLIC_E2E_MOCKS === "true")
) {
  throw new Error(
    "An E2E browser fixture flag is set. Test fixtures must never be bundled into a production build.",
  );
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    root: repositoryRoot,
  },
  outputFileTracingRoot: repositoryRoot,
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
