import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };
const healthEnvKeys = [
  "NEXT_PUBLIC_STELLAR_NETWORK",
  "NEXT_PUBLIC_STELLAR_RPC_URL",
  "NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL",
  "NEXT_PUBLIC_NFT_CONTRACT_ID",
  "NEXT_PUBLIC_GOVERNOR_CONTRACT_ID",
  "NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID",
  "NEXT_PUBLIC_GOVERNOR_START_LEDGER",
] as const;

const contractIds = {
  NEXT_PUBLIC_NFT_CONTRACT_ID:
    "CBNLN62LU545PM2ECR66E7SSUE6G3LOC5NSWH3SVYPS6J225NS72D2JB",
  NEXT_PUBLIC_GOVERNOR_CONTRACT_ID:
    "CBCGFEJRIVHLPFXPUNQJ2LSL4YDBNSZVEHIDVYPIQZR2CRDS5EK64QWL",
  NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID:
    "CC67AYTYD52YNMSFXUMGGINQPFIZG5M5YELUA36UOKZK5YMOLNE7Y3EH",
  NEXT_PUBLIC_GOVERNOR_START_LEDGER: "12345",
};

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
      network: { selected: "testnet", passphraseConfigured: true },
      rpc: { configured: true },
      contracts: {
        nftConfigured: true,
        governorConfigured: true,
        communityFactoryConfigured: true,
        allConfigured: true,
      },
      capabilities: {
        rpc: true,
        explorer: true,
        communityFactory: true,
        legacyContracts: true,
        proposalDiscovery: true,
      },
      unavailableCapabilities: [],
    });
  });

  it("returns degraded when a required contract id is missing", async () => {
    const { response, body } = await requestHealth({
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
      NEXT_PUBLIC_GOVERNOR_CONTRACT_ID:
        contractIds.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID,
    });

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.contracts).toEqual({
      nftConfigured: false,
      governorConfigured: true,
      communityFactoryConfigured: false,
      allConfigured: false,
    });
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
    const { response, body } = await requestHealth({
      NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
      NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL: secretRpcUrl,
      NEXT_PUBLIC_NFT_CONTRACT_ID: secretNftId,
      NEXT_PUBLIC_GOVERNOR_CONTRACT_ID: secretGovernorId,
      NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID:
        contractIds.NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID,
    });

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.network.selected).toBe("mainnet");
    expect(JSON.stringify(body)).not.toContain(secretRpcUrl);
    expect(JSON.stringify(body)).not.toContain(secretNftId);
    expect(JSON.stringify(body)).not.toContain(secretGovernorId);
  });

  it("treats whitespace-only configuration as missing", async () => {
    const { response, body } = await requestHealth({
      NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
      NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL: "   ",
      NEXT_PUBLIC_NFT_CONTRACT_ID: "\t",
      NEXT_PUBLIC_GOVERNOR_CONTRACT_ID: "\n",
      NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID: "  ",
    });

    expect(response.status).toBe(503);
    expect(body.rpc.configured).toBe(false);
    expect(body.contracts.allConfigured).toBe(false);
  });

  it("returns degraded when the community factory contract id is missing", async () => {
    const { response, body } = await requestHealth({
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
      NEXT_PUBLIC_NFT_CONTRACT_ID: contractIds.NEXT_PUBLIC_NFT_CONTRACT_ID,
      NEXT_PUBLIC_GOVERNOR_CONTRACT_ID:
        contractIds.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID,
      NEXT_PUBLIC_GOVERNOR_START_LEDGER:
        contractIds.NEXT_PUBLIC_GOVERNOR_START_LEDGER,
    });

    expect(response.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.contracts.communityFactoryConfigured).toBe(false);
    expect(body.contracts.allConfigured).toBe(false);
    expect(body.capabilities.communityFactory).toBe(false);
    expect(body.unavailableCapabilities).toContain("communityFactory");
  });
});
