import { Buffer } from "buffer";
import { Networks, StrKey } from "@stellar/stellar-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSorobanHealthProbeDriver,
  evaluateDeploymentHealth,
  HealthProbeError,
  sanitizeHealthText,
  type HealthProbeDriver,
} from "./health";
import { createNetworkCapabilitiesFixture } from "@/test-support/stellar/capabilities";
import {
  MOCK_ACCOUNT_ALICE,
  MOCK_ACCOUNT_CREATOR,
  MOCK_ACCOUNT_OWNER,
  MOCK_FACTORY_CONTRACT_ID,
  MOCK_GOVERNOR_CONTRACT_ID,
  MOCK_NFT_CONTRACT_ID,
} from "@/test-support/stellar/fixtures";

const sdkMocks = vi.hoisted(() => ({
  getHealth: vi.fn(),
  getNetwork: vi.fn(),
  getLatestLedger: vi.fn(),
  buildAssembledTx: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk/rpc", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@stellar/stellar-sdk/rpc")>();
  class MockRpcServer {
    getHealth = sdkMocks.getHealth;
    getNetwork = sdkMocks.getNetwork;
    getLatestLedger = sdkMocks.getLatestLedger;
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
      build: sdkMocks.buildAssembledTx,
    },
  };
});

const MOCK_SECRET_SEED = StrKey.encodeEd25519SecretSeed(
  Buffer.from(Uint8Array.from({ length: 32 }, (_, index) => index + 7)),
);

function createMockDriver(
  overrides: Partial<HealthProbeDriver> = {},
): HealthProbeDriver {
  return {
    probeRpc: vi.fn().mockResolvedValue({
      latestLedger: 987_654,
      passphraseMatched: true,
    }),
    probeCommunityFactory: vi.fn().mockResolvedValue({
      paused: false,
      communityCount: 3,
    }),
    probeRegistryListing: vi.fn().mockResolvedValue({
      sampleCount: 1,
      hasNextPage: true,
      malformedRecords: 0,
    }),
    probeLegacyContracts: vi.fn().mockResolvedValue({
      nftReadable: true,
      governorReadable: true,
    }),
    ...overrides,
  };
}

function validRawRegistryRecord() {
  return {
    community_id: "aa".repeat(32),
    nft_contract: MOCK_NFT_CONTRACT_ID,
    governor_contract: MOCK_GOVERNOR_CONTRACT_ID,
    creator: MOCK_ACCOUNT_CREATOR,
    community_owner: MOCK_ACCOUNT_OWNER,
    created_at_ledger: 120,
    creation_index: 0,
    metadata_uri: "ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    metadata_hash: "bb".repeat(32),
    metadata_schema_version: 1,
  };
}

describe("sanitizeHealthText", () => {
  it("redacts URLs, query strings, credentials, secret seeds, and full wallet addresses", () => {
    const raw = [
      `Request to https://rpc-user:rpc-pass@private-rpc.example.com/soroban?api_key=TOPSECRET123&token=tok_abc#frag failed`,
      `path=/v1/rpc?secret=s3cr3t&sig=deadbeef`,
      `Authorization: Bearer jwt_secret_token_999`,
      `api_key=INLINE_API_KEY`,
      `signer=${MOCK_SECRET_SEED}`,
      `wallet=${MOCK_ACCOUNT_ALICE}`,
      `contract=${MOCK_FACTORY_CONTRACT_ID}`,
    ].join(" | ");

    const sanitized = sanitizeHealthText(raw, ["CUSTOM_ENV_CONTRACT_VALUE"]);

    expect(sanitized).not.toContain("private-rpc.example.com");
    expect(sanitized).not.toContain("rpc-user");
    expect(sanitized).not.toContain("rpc-pass");
    expect(sanitized).not.toContain("TOPSECRET123");
    expect(sanitized).not.toContain("tok_abc");
    expect(sanitized).not.toContain("s3cr3t");
    expect(sanitized).not.toContain("jwt_secret_token_999");
    expect(sanitized).not.toContain("INLINE_API_KEY");
    expect(sanitized).not.toContain(MOCK_SECRET_SEED);
    expect(sanitized).not.toContain(MOCK_ACCOUNT_ALICE);
    expect(sanitized).not.toContain(MOCK_FACTORY_CONTRACT_ID);
    expect(sanitized).toContain(
      `${MOCK_ACCOUNT_ALICE.slice(0, 4)}…${MOCK_ACCOUNT_ALICE.slice(-4)}`,
    );
    expect(sanitized).toContain("[redacted-secret]");
  });
});

describe("createSorobanHealthProbeDriver", () => {
  beforeEach(() => {
    sdkMocks.getHealth.mockReset();
    sdkMocks.getNetwork.mockReset();
    sdkMocks.getLatestLedger.mockReset();
    sdkMocks.buildAssembledTx.mockReset();
  });

  it("verifies RPC health, network passphrase, factory state, registry page, and legacy reads", async () => {
    sdkMocks.getHealth.mockResolvedValue({ status: "healthy" });
    sdkMocks.getNetwork.mockResolvedValue({
      passphrase: Networks.TESTNET,
      protocolVersion: "22",
    });
    sdkMocks.getLatestLedger.mockResolvedValue({
      id: "ledger-1",
      sequence: 54321,
      protocolVersion: "22",
    });

    sdkMocks.buildAssembledTx.mockImplementation(
      async ({ method }: { method: string }) => {
        if (method === "is_paused") return { result: false };
        if (method === "community_count") return { result: 2n };
        if (method === "list_communities") {
          return {
            result: {
              records: [validRawRegistryRecord()],
              next_cursor: 1n,
            },
          };
        }
        if (method === "name") return { result: "Stolla NFT" };
        if (method === "voting_delay") return { result: 100n };
        throw new Error(`Unexpected method ${method}`);
      },
    );

    const driver = createSorobanHealthProbeDriver();

    await expect(
      driver.probeRpc({
        rpcUrl: "https://soroban-testnet.stellar.org",
        expectedNetworkPassphrase: Networks.TESTNET,
        timeoutMs: 1_000,
      }),
    ).resolves.toEqual({ latestLedger: 54321, passphraseMatched: true });

    await expect(
      driver.probeCommunityFactory({
        rpcUrl: "https://soroban-testnet.stellar.org",
        networkPassphrase: Networks.TESTNET,
        contractId: MOCK_FACTORY_CONTRACT_ID,
        timeoutMs: 1_000,
      }),
    ).resolves.toEqual({ paused: false, communityCount: 2 });

    await expect(
      driver.probeRegistryListing({
        rpcUrl: "https://soroban-testnet.stellar.org",
        networkPassphrase: Networks.TESTNET,
        contractId: MOCK_FACTORY_CONTRACT_ID,
        timeoutMs: 1_000,
      }),
    ).resolves.toEqual({
      sampleCount: 1,
      hasNextPage: true,
      malformedRecords: 0,
    });

    await expect(
      driver.probeLegacyContracts({
        rpcUrl: "https://soroban-testnet.stellar.org",
        networkPassphrase: Networks.TESTNET,
        nftContractId: MOCK_NFT_CONTRACT_ID,
        governorContractId: MOCK_GOVERNOR_CONTRACT_ID,
        timeoutMs: 1_000,
      }),
    ).resolves.toEqual({ nftReadable: true, governorReadable: true });
  });

  it("distinguishes RPC network passphrase mismatches and counts malformed registry records", async () => {
    sdkMocks.getHealth.mockResolvedValue({ status: "healthy" });
    sdkMocks.getNetwork.mockResolvedValue({
      passphrase: Networks.PUBLIC,
      protocolVersion: "22",
    });
    sdkMocks.getLatestLedger.mockResolvedValue({
      id: "ledger-1",
      sequence: 900,
      protocolVersion: "22",
    });

    const driver = createSorobanHealthProbeDriver();

    await expect(
      driver.probeRpc({
        rpcUrl: "https://soroban-testnet.stellar.org",
        expectedNetworkPassphrase: Networks.TESTNET,
        timeoutMs: 1_000,
      }),
    ).rejects.toMatchObject({
      name: "HealthProbeError",
      reasonCode: "rpc_network_mismatch",
    });

    sdkMocks.buildAssembledTx.mockResolvedValue({
      result: {
        records: [{ community_id: "invalid" }],
        next_cursor: null,
      },
    });

    await expect(
      driver.probeRegistryListing({
        rpcUrl: "https://soroban-testnet.stellar.org",
        networkPassphrase: Networks.TESTNET,
        contractId: MOCK_FACTORY_CONTRACT_ID,
        timeoutMs: 1_000,
      }),
    ).resolves.toEqual({
      sampleCount: 1,
      hasNextPage: false,
      malformedRecords: 1,
    });
  });

  it("surfaces Soroban contract simulation errors as failed probes", async () => {
    sdkMocks.buildAssembledTx.mockResolvedValue({
      simulation: { error: "HostError: Error(WasmVm, InvalidAction)" },
      result: null,
    });

    const driver = createSorobanHealthProbeDriver();

    await expect(
      driver.probeRegistryListing({
        rpcUrl: "https://soroban-testnet.stellar.org",
        networkPassphrase: Networks.TESTNET,
        contractId: MOCK_FACTORY_CONTRACT_ID,
        timeoutMs: 1_000,
      }),
    ).rejects.toThrow(/InvalidAction/);
  });
});

describe("evaluateDeploymentHealth", () => {
  it("reports healthy when factory and registry are readable without optional legacy contracts", async () => {
    const capabilities = createNetworkCapabilitiesFixture("testnet", {
      NEXT_PUBLIC_NFT_CONTRACT_ID: "",
      NEXT_PUBLIC_GOVERNOR_CONTRACT_ID: "",
      NEXT_PUBLIC_GOVERNOR_START_LEDGER: "",
    });
    const driver = createMockDriver();
    const logger = { warn: vi.fn(), error: vi.fn() };

    const { response, statusCode } = await evaluateDeploymentHealth(
      capabilities,
      { driver, logger },
    );

    expect(statusCode).toBe(200);
    expect(response.healthy).toBe(true);
    expect(response.status).toBe("healthy");
    expect(response.reasonCode).toBeNull();
    expect(response.registry.readable).toBe(true);
    expect(response.legacyContracts).toMatchObject({
      optional: true,
      configured: false,
      partiallyConfigured: false,
      probe: {
        status: "skipped",
        reasonCode: "missing_legacy_config",
      },
    });
    expect(driver.probeLegacyContracts).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("distinguishes missing factory config from RPC and registry-read failures", async () => {
    const missingFactory = await evaluateDeploymentHealth(
      createNetworkCapabilitiesFixture("testnet", {
        NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID: "",
      }),
      { driver: createMockDriver(), logger: null },
    );

    const rpcFailure = await evaluateDeploymentHealth(
      createNetworkCapabilitiesFixture("testnet"),
      {
        driver: createMockDriver({
          probeRpc: vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")),
        }),
        logger: null,
      },
    );

    const passphraseMismatch = await evaluateDeploymentHealth(
      createNetworkCapabilitiesFixture("testnet"),
      {
        driver: createMockDriver({
          probeRpc: vi
            .fn()
            .mockRejectedValue(
              new HealthProbeError(
                "rpc_network_mismatch",
                "RPC passphrase mismatch.",
              ),
            ),
        }),
        logger: null,
      },
    );

    const registryFailure = await evaluateDeploymentHealth(
      createNetworkCapabilitiesFixture("testnet"),
      {
        driver: createMockDriver({
          probeRegistryListing: vi
            .fn()
            .mockRejectedValue(new Error("list_communities trapped")),
        }),
        logger: null,
      },
    );

    expect(missingFactory.statusCode).toBe(503);
    expect(missingFactory.response.reasonCode).toBe("missing_factory_config");
    expect(missingFactory.response.rpc.probe.status).toBe("ok");
    expect(missingFactory.response.communityFactory.configured).toBe(false);

    expect(rpcFailure.statusCode).toBe(503);
    expect(rpcFailure.response.reasonCode).toBe("rpc_unreachable");
    expect(rpcFailure.response.rpc.probe.status).toBe("failed");
    expect(rpcFailure.response.communityFactory.configured).toBe(true);
    expect(rpcFailure.response.communityFactory.probe.status).toBe("skipped");

    expect(passphraseMismatch.statusCode).toBe(503);
    expect(passphraseMismatch.response.reasonCode).toBe("rpc_network_mismatch");
    expect(passphraseMismatch.response.network.passphraseMatched).toBe(false);

    expect(registryFailure.statusCode).toBe(503);
    expect(registryFailure.response.reasonCode).toBe("registry_read_failed");
    expect(registryFailure.response.rpc.probe.status).toBe("ok");
    expect(registryFailure.response.communityFactory.probe.status).toBe("ok");
    expect(registryFailure.response.registry.readable).toBe(false);
    expect(registryFailure.response.registry.probe.status).toBe("failed");
  });

  it("reports degraded when core registry reads succeed alongside paused factory, malformed records, or legacy issues", async () => {
    const pausedFactory = await evaluateDeploymentHealth(
      createNetworkCapabilitiesFixture("testnet"),
      {
        driver: createMockDriver({
          probeCommunityFactory: vi.fn().mockResolvedValue({
            paused: true,
            communityCount: 4,
          }),
        }),
        logger: null,
      },
    );
    expect(pausedFactory.statusCode).toBe(200);
    expect(pausedFactory.response.healthy).toBe(false);
    expect(pausedFactory.response.status).toBe("degraded");
    expect(pausedFactory.response.reasonCode).toBe("factory_paused");
    expect(pausedFactory.response.registry.readable).toBe(true);

    const malformedRegistry = await evaluateDeploymentHealth(
      createNetworkCapabilitiesFixture("testnet"),
      {
        driver: createMockDriver({
          probeRegistryListing: vi.fn().mockResolvedValue({
            sampleCount: 1,
            hasNextPage: false,
            malformedRecords: 1,
          }),
        }),
        logger: null,
      },
    );
    expect(malformedRegistry.statusCode).toBe(200);
    expect(malformedRegistry.response.healthy).toBe(false);
    expect(malformedRegistry.response.status).toBe("degraded");
    expect(malformedRegistry.response.reasonCode).toBe(
      "registry_malformed_records",
    );

    const failedLegacy = await evaluateDeploymentHealth(
      createNetworkCapabilitiesFixture("testnet"),
      {
        driver: createMockDriver({
          probeLegacyContracts: vi
            .fn()
            .mockRejectedValue(new Error("legacy governor read failed")),
        }),
        logger: null,
      },
    );
    expect(failedLegacy.statusCode).toBe(200);
    expect(failedLegacy.response.healthy).toBe(false);
    expect(failedLegacy.response.status).toBe("degraded");
    expect(failedLegacy.response.reasonCode).toBe("legacy_read_failed");
    expect(failedLegacy.response.registry.readable).toBe(true);
  });
});
