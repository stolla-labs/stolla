import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };
const healthEnvKeys = [
  "NEXT_PUBLIC_STELLAR_NETWORK",
  "NEXT_PUBLIC_STELLAR_RPC_URL",
  "NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL",
  "NEXT_PUBLIC_NFT_CONTRACT_ID",
  "NEXT_PUBLIC_GOVERNOR_CONTRACT_ID",
  "NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID",
] as const;

const contractIds = {
  NEXT_PUBLIC_NFT_CONTRACT_ID:
    "CCV3ODX5QNB6XH2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2",
  NEXT_PUBLIC_GOVERNOR_CONTRACT_ID:
    "CCV3ODX5QNB6XH2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2XZ2",
  NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID: "CCFACTORY"
};

vi.mock("@stellar/stellar-sdk", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    rpc: {
      Server: class {
        constructor(public url: string) {}
        async getHealth() {
          return { status: "healthy" };
        }
      }
    }
  };
});

vi.mock("@/lib/community/registry", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    checkRegistryReadable: async () => true,
  };
});

async function requestHealth(env: Record<string, string>) {
  process.env = { ...originalEnv };
  for (const key of healthEnvKeys) delete process.env[key];
  Object.assign(process.env, env);

  vi.resetModules();
  const { GET } = await import("@/app/api/health/route");
  const response = await GET();

  return {
    response,
    body: await response.json(),
  };
}

afterEach(() => {
  process.env = { ...originalEnv };
  vi.resetModules();
});

describe("GET /api/health", () => {
  it("returns an uncached ok response for complete testnet configuration", async () => {
    const { response, body } = await requestHealth({
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
      ...contractIds,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body).toEqual({
      status: "ok",
      healthy: true,
      network: { selected: "testnet", passphraseConfigured: true },
      rpc: { configured: true, reachable: true },
      factory: { configured: true },
      registry: { readable: true },
      contracts: {
        nftConfigured: true,
        governorConfigured: true,
        allConfigured: true,
      },
    });
  });

  it("returns degraded when factory is missing", async () => {
    const { response, body } = await requestHealth({
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
      NEXT_PUBLIC_NFT_CONTRACT_ID: contractIds.NEXT_PUBLIC_NFT_CONTRACT_ID,
      NEXT_PUBLIC_GOVERNOR_CONTRACT_ID: contractIds.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID,
    });

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.healthy).toBe(false);
    expect(body.factory).toEqual({ configured: false });
  });

  it("returns degraded when mainnet RPC configuration is missing", async () => {
    const { response, body } = await requestHealth({
      NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
      ...contractIds,
    });

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.network.selected).toBe("mainnet");
    expect(body.rpc.configured).toBe(false);
  });

  it("returns ok for complete mainnet configuration without exposing values", async () => {
    const secretRpcUrl = "https://secret-rpc.example.com";
    const secretNftId = "CCSECRET_NFT_CONTRACT_ID";
    const secretGovernorId = "CCSECRET_GOVERNOR_CONTRACT_ID";
    const secretFactoryId = "CCSECRET_FACTORY_CONTRACT_ID";
    const { response, body } = await requestHealth({
      NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
      NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL: secretRpcUrl,
      NEXT_PUBLIC_NFT_CONTRACT_ID: secretNftId,
      NEXT_PUBLIC_GOVERNOR_CONTRACT_ID: secretGovernorId,
      NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID: secretFactoryId,
    });

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.network.selected).toBe("mainnet");
    expect(JSON.stringify(body)).not.toContain(secretRpcUrl);
    expect(JSON.stringify(body)).not.toContain(secretNftId);
    expect(JSON.stringify(body)).not.toContain(secretGovernorId);
    expect(JSON.stringify(body)).not.toContain(secretFactoryId);
  });

  it("treats whitespace-only configuration as missing", async () => {
    const { response, body } = await requestHealth({
      NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
      NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL: "   ",
      NEXT_PUBLIC_NFT_CONTRACT_ID: "\t",
      NEXT_PUBLIC_GOVERNOR_CONTRACT_ID: "\n",
      NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID: " ",
    });

    expect(response.status).toBe(503);
    expect(body.rpc.configured).toBe(false);
    expect(body.factory.configured).toBe(false);
    expect(body.contracts.allConfigured).toBe(false);
  });
});
