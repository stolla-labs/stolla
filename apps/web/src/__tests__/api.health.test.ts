import { Buffer } from "buffer";
import { Networks, StrKey } from "@stellar/stellar-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MOCK_ACCOUNT_ALICE,
  MOCK_ACCOUNT_CREATOR,
  MOCK_ACCOUNT_OWNER,
  MOCK_FACTORY_CONTRACT_ID,
  MOCK_GOVERNOR_CONTRACT_ID,
  MOCK_NFT_CONTRACT_ID,
} from "@/test-support/stellar/fixtures";

const rpcMocks = vi.hoisted(() => ({
  getHealth: vi.fn(),
  getNetwork: vi.fn(),
  getLatestLedger: vi.fn(),
  buildAssembledTx: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk/rpc", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@stellar/stellar-sdk/rpc")>();
  class MockRpcServer {
    getHealth = rpcMocks.getHealth;
    getNetwork = rpcMocks.getNetwork;
    getLatestLedger = rpcMocks.getLatestLedger;
  }
  return {
    ...actual,
    Server: MockRpcServer,
  };
});

vi.mock("@stellar/stellar-sdk/contract", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@stellar/stellar-sdk/contract")>();
  return {
    ...actual,
    AssembledTransaction: {
      ...actual.AssembledTransaction,
      build: rpcMocks.buildAssembledTx,
    },
  };
});

const originalEnv = { ...process.env };
const healthEnvKeys = [
  "NEXT_PUBLIC_STELLAR_NETWORK",
  "NEXT_PUBLIC_STELLAR_RPC_URL",
  "NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL",
  "NEXT_PUBLIC_ALLOW_MAINNET_WRITES",
  "ALLOW_MAINNET_WRITES",
  "NEXT_PUBLIC_NFT_CONTRACT_ID",
  "NEXT_PUBLIC_GOVERNOR_CONTRACT_ID",
  "NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID",
  "NEXT_PUBLIC_GOVERNOR_START_LEDGER",
] as const;

const contractIds = {
  NEXT_PUBLIC_NFT_CONTRACT_ID: MOCK_NFT_CONTRACT_ID,
  NEXT_PUBLIC_GOVERNOR_CONTRACT_ID: MOCK_GOVERNOR_CONTRACT_ID,
  NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID: MOCK_FACTORY_CONTRACT_ID,
  NEXT_PUBLIC_GOVERNOR_START_LEDGER: "12345",
};

const MOCK_SECRET_SEED = StrKey.encodeEd25519SecretSeed(
  Buffer.from(Uint8Array.from({ length: 32 }, (_, index) => index + 11)),
);

function validRegistryRecord() {
  return {
    community_id: "11".repeat(32),
    nft_contract: MOCK_NFT_CONTRACT_ID,
    governor_contract: MOCK_GOVERNOR_CONTRACT_ID,
    creator: MOCK_ACCOUNT_CREATOR,
    community_owner: MOCK_ACCOUNT_OWNER,
    created_at_ledger: 420,
    creation_index: 0,
    metadata_uri: "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    metadata_hash: "22".repeat(32),
    metadata_schema_version: 1,
  };
}

function stubHealthyProbes(passphrase: string = Networks.TESTNET) {
  rpcMocks.getHealth.mockResolvedValue({ status: "healthy" });
  rpcMocks.getNetwork.mockResolvedValue({
    passphrase,
    protocolVersion: "22",
  });
  rpcMocks.getLatestLedger.mockResolvedValue({
    id: "ledger-hash",
    sequence: 120_000,
    protocolVersion: "22",
  });

  rpcMocks.buildAssembledTx.mockImplementation(
    async ({ method }: { method: string }) => {
      switch (method) {
        case "is_paused":
          return { result: false };
        case "community_count":
          return { result: 1n };
        case "list_communities":
          return {
            result: {
              records: [validRegistryRecord()],
              next_cursor: null,
            },
          };
        case "name":
          return { result: "Stolla Membership" };
        case "voting_delay":
          return { result: 24n };
        default:
          throw new Error(`Unexpected contract method ${method}`);
      }
    },
  );
}

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

beforeEach(() => {
  rpcMocks.getHealth.mockReset();
  rpcMocks.getNetwork.mockReset();
  rpcMocks.getLatestLedger.mockReset();
  rpcMocks.buildAssembledTx.mockReset();
  stubHealthyProbes(Networks.TESTNET);
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("GET /api/health", () => {
  it("returns an uncached healthy response proving RPC, CommunityFactory, registry, and legacy reads", async () => {
    const { response, body } = await requestHealth({
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
      ...contractIds,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body).toMatchObject({
      healthy: true,
      status: "healthy",
      reasonCode: null,
      network: {
        selected: "testnet",
        passphraseConfigured: true,
        passphraseMatched: true,
      },
      rpc: {
        configured: true,
        validUrl: true,
        latestLedger: 120_000,
        probe: { status: "ok", reasonCode: null, message: null },
      },
      communityFactory: {
        configured: true,
        validContractId: true,
        paused: false,
        communityCount: 1,
        probe: { status: "ok", reasonCode: null, message: null },
      },
      registry: {
        configured: true,
        readable: true,
        sampleCount: 1,
        hasNextPage: false,
        malformedRecords: 0,
        probe: { status: "ok", reasonCode: null, message: null },
      },
      legacyContracts: {
        optional: true,
        configured: true,
        partiallyConfigured: false,
        nftConfigured: true,
        governorConfigured: true,
        validContractIds: true,
        nftReadable: true,
        governorReadable: true,
        probe: { status: "ok", reasonCode: null, message: null },
      },
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
        privilegedWrites: true,
      },
      unavailableCapabilities: [],
    });
    expect(body.gates).toEqual([
      { name: "rpc", label: "RPC endpoint", available: true, reason: null, requiredEnvironment: [], runbookAnchor: "network-safety-shell" },
      { name: "explorer", label: "Explorer", available: true, reason: null, requiredEnvironment: [], runbookAnchor: "network-safety-shell" },
      { name: "communityFactory", label: "CommunityFactory contract", available: true, reason: null, requiredEnvironment: [], runbookAnchor: "3-deploy-in-dependency-order" },
      { name: "legacyContracts", label: "Legacy NFT/Governor contracts", available: true, reason: null, requiredEnvironment: [], runbookAnchor: "3-deploy-in-dependency-order" },
      { name: "proposalDiscovery", label: "Proposal discovery", available: true, reason: null, requiredEnvironment: [], runbookAnchor: "5-verify-on-chain-state-independently" },
      { name: "privilegedWrites", label: "Mainnet writes", available: true, reason: null, requiredEnvironment: [], runbookAnchor: "final-activation-gate" },
    ]);
  });

  it("returns healthy when optional legacy contracts are omitted and the registry is readable", async () => {
    const { response, body } = await requestHealth({
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
      NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID: MOCK_FACTORY_CONTRACT_ID,
    });

    expect(response.status).toBe(200);
    expect(body.healthy).toBe(true);
    expect(body.status).toBe("healthy");
    expect(body.reasonCode).toBeNull();
    expect(body.registry.readable).toBe(true);
    expect(body.legacyContracts).toMatchObject({
      optional: true,
      configured: false,
      partiallyConfigured: false,
      probe: {
        status: "skipped",
        reasonCode: "missing_legacy_config",
      },
    });
    expect(body.contracts).toEqual({
      nftConfigured: false,
      governorConfigured: false,
      communityFactoryConfigured: true,
      allConfigured: false,
    });
  });

  it("distinguishes missing factory config from RPC failures and registry-read failures", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const missingFactory = await requestHealth({
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
      NEXT_PUBLIC_NFT_CONTRACT_ID: contractIds.NEXT_PUBLIC_NFT_CONTRACT_ID,
      NEXT_PUBLIC_GOVERNOR_CONTRACT_ID:
        contractIds.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID,
      NEXT_PUBLIC_GOVERNOR_START_LEDGER:
        contractIds.NEXT_PUBLIC_GOVERNOR_START_LEDGER,
    });

    expect(missingFactory.response.status).toBe(503);
    expect(missingFactory.body.healthy).toBe(false);
    expect(missingFactory.body.status).toBe("unhealthy");
    expect(missingFactory.body.reasonCode).toBe("missing_factory_config");
    expect(missingFactory.body.rpc.probe.status).toBe("ok");
    expect(missingFactory.body.communityFactory.configured).toBe(false);
    expect(missingFactory.body.communityFactory.probe).toMatchObject({
      status: "skipped",
      reasonCode: "missing_factory_config",
    });
    expect(missingFactory.body.registry.readable).toBe(false);
    expect(missingFactory.body.unavailableCapabilities).toContain(
      "communityFactory",
    );

    const factoryGate = missingFactory.body.gates.find(
      (gate: { name: string }) => gate.name === "communityFactory",
    );
    expect(factoryGate.available).toBe(false);
    expect(factoryGate.requiredEnvironment).toContain(
      "NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID",
    );

    rpcMocks.getHealth.mockRejectedValueOnce(new Error("RPC socket hang up"));
    const rpcReadFailure = await requestHealth({
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
      ...contractIds,
    });

    expect(rpcReadFailure.response.status).toBe(503);
    expect(rpcReadFailure.body.healthy).toBe(false);
    expect(rpcReadFailure.body.status).toBe("unhealthy");
    expect(rpcReadFailure.body.reasonCode).toBe("rpc_unreachable");
    expect(rpcReadFailure.body.rpc.configured).toBe(true);
    expect(rpcReadFailure.body.rpc.probe.status).toBe("failed");
    expect(rpcReadFailure.body.communityFactory.configured).toBe(true);
    expect(rpcReadFailure.body.communityFactory.probe).toMatchObject({
      status: "skipped",
      reasonCode: "rpc_unavailable",
    });

    stubHealthyProbes(Networks.TESTNET);
    rpcMocks.buildAssembledTx.mockImplementation(
      async ({ method }: { method: string }) => {
        if (method === "is_paused") return { result: false };
        if (method === "community_count") return { result: 2n };
        if (method === "list_communities") {
          throw new Error("list_communities storage entry missing");
        }
        if (method === "name") return { result: "Stolla Membership" };
        if (method === "voting_delay") return { result: 24n };
        throw new Error(`Unexpected method ${method}`);
      },
    );

    const registryReadFailure = await requestHealth({
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
      ...contractIds,
    });

    expect(registryReadFailure.response.status).toBe(503);
    expect(registryReadFailure.body.healthy).toBe(false);
    expect(registryReadFailure.body.status).toBe("unhealthy");
    expect(registryReadFailure.body.reasonCode).toBe("registry_read_failed");
    expect(registryReadFailure.body.rpc.probe.status).toBe("ok");
    expect(registryReadFailure.body.communityFactory.probe.status).toBe("ok");
    expect(registryReadFailure.body.registry.readable).toBe(false);
    expect(registryReadFailure.body.registry.probe.status).toBe("failed");
  });

  it("returns unhealthy when mainnet RPC configuration is missing or whitespace-only", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const missingRpc = await requestHealth({
      NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
      ...contractIds,
    });

    expect(missingRpc.response.status).toBe(503);
    expect(missingRpc.body.healthy).toBe(false);
    expect(missingRpc.body.status).toBe("unhealthy");
    expect(missingRpc.body.reasonCode).toBe("missing_rpc_config");
    expect(missingRpc.body.network.selected).toBe("mainnet");
    expect(missingRpc.body.rpc.configured).toBe(false);

    const whitespaceOnly = await requestHealth({
      NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
      NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL: "   ",
      NEXT_PUBLIC_NFT_CONTRACT_ID: "\t",
      NEXT_PUBLIC_GOVERNOR_CONTRACT_ID: "\n",
      NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID: "  ",
    });

    expect(whitespaceOnly.response.status).toBe(503);
    expect(whitespaceOnly.body.healthy).toBe(false);
    expect(whitespaceOnly.body.status).toBe("unhealthy");
    expect(whitespaceOnly.body.rpc.configured).toBe(false);
    expect(whitespaceOnly.body.contracts.allConfigured).toBe(false);
  });

  it("returns degraded (HTTP 200, healthy=false) when core registry reads succeed but optional legacy contracts or factory state degrade", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const partialLegacy = await requestHealth({
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
      NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID: MOCK_FACTORY_CONTRACT_ID,
      NEXT_PUBLIC_GOVERNOR_CONTRACT_ID: MOCK_GOVERNOR_CONTRACT_ID,
    });

    expect(partialLegacy.response.status).toBe(200);
    expect(partialLegacy.body.healthy).toBe(false);
    expect(partialLegacy.body.status).toBe("degraded");
    expect(partialLegacy.body.reasonCode).toBe("partial_legacy_config");
    expect(partialLegacy.body.registry.readable).toBe(true);
    expect(partialLegacy.body.legacyContracts.partiallyConfigured).toBe(true);

    rpcMocks.buildAssembledTx.mockImplementation(
      async ({ method }: { method: string }) => {
        if (method === "is_paused") return { result: false };
        if (method === "community_count") return { result: 1n };
        if (method === "list_communities") {
          return { result: { records: [validRegistryRecord()], next_cursor: null } };
        }
        if (method === "name") {
          throw new Error("legacy NFT archived entry");
        }
        if (method === "voting_delay") return { result: 24n };
        throw new Error(`Unexpected method ${method}`);
      },
    );

    const legacyProbeFailed = await requestHealth({
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
      ...contractIds,
    });

    expect(legacyProbeFailed.response.status).toBe(200);
    expect(legacyProbeFailed.body.healthy).toBe(false);
    expect(legacyProbeFailed.body.status).toBe("degraded");
    expect(legacyProbeFailed.body.reasonCode).toBe("legacy_read_failed");
    expect(legacyProbeFailed.body.registry.readable).toBe(true);
    expect(legacyProbeFailed.body.legacyContracts.probe.status).toBe("failed");
    expect(warnSpy).toHaveBeenCalled();
  });

  it("never exposes query strings, credentials, configured endpoints, or full wallet addresses in JSON or logs", async () => {
    const errorLogs: string[] = [];
    const warnLogs: string[] = [];
    vi.spyOn(console, "error").mockImplementation((...args) => {
      errorLogs.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "warn").mockImplementation((...args) => {
      warnLogs.push(args.map(String).join(" "));
    });

    const secretRpcUrl =
      "https://rpc-admin:super-secret-pass@secret-rpc.example.com/v1?api_key=SECRET_API_KEY_777&token=SECRET_TOKEN_888#private";

    stubHealthyProbes(Networks.PUBLIC);
    const healthyMainnet = await requestHealth({
      NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
      NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL: secretRpcUrl,
      ...contractIds,
    });

    expect(healthyMainnet.response.status).toBe(200);
    expect(healthyMainnet.body.healthy).toBe(true);
    expect(healthyMainnet.body.status).toBe("healthy");
    const healthySerialized = JSON.stringify(healthyMainnet.body);
    expect(healthySerialized).not.toContain("secret-rpc.example.com");
    expect(healthySerialized).not.toContain("rpc-admin");
    expect(healthySerialized).not.toContain("super-secret-pass");
    expect(healthySerialized).not.toContain("SECRET_API_KEY_777");
    expect(healthySerialized).not.toContain("SECRET_TOKEN_888");
    expect(healthySerialized).not.toContain(MOCK_FACTORY_CONTRACT_ID);
    expect(healthySerialized).not.toContain(MOCK_NFT_CONTRACT_ID);
    expect(healthySerialized).not.toContain(MOCK_GOVERNOR_CONTRACT_ID);

    rpcMocks.getHealth.mockRejectedValueOnce(
      new Error(
        `Upstream error at ${secretRpcUrl} for account ${MOCK_ACCOUNT_ALICE} signer=${MOCK_SECRET_SEED} Authorization: Bearer SECRET_BEARER_JWT`,
      ),
    );

    const failingMainnet = await requestHealth({
      NEXT_PUBLIC_STELLAR_NETWORK: "mainnet",
      NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL: secretRpcUrl,
      ...contractIds,
    });

    expect(failingMainnet.response.status).toBe(503);
    const combinedOutput = [
      JSON.stringify(failingMainnet.body),
      ...errorLogs,
      ...warnLogs,
    ].join("\n");

    expect(combinedOutput).not.toContain("secret-rpc.example.com");
    expect(combinedOutput).not.toContain("rpc-admin");
    expect(combinedOutput).not.toContain("super-secret-pass");
    expect(combinedOutput).not.toContain("SECRET_API_KEY_777");
    expect(combinedOutput).not.toContain("SECRET_TOKEN_888");
    expect(combinedOutput).not.toContain("SECRET_BEARER_JWT");
    expect(combinedOutput).not.toContain(MOCK_SECRET_SEED);
    expect(combinedOutput).not.toContain(MOCK_ACCOUNT_ALICE);
    expect(combinedOutput).toContain(
      `${MOCK_ACCOUNT_ALICE.slice(0, 4)}…${MOCK_ACCOUNT_ALICE.slice(-4)}`,
    );
  });
});
