import { StrKey, nativeToScVal, scValToNative, xdr } from "@stellar/stellar-sdk";
import { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import { Api, Server as RpcServer } from "@stellar/stellar-sdk/rpc";
import { parseRegistryRecord } from "@/lib/community/registry";
import {
  buildHealthGates,
  type ActiveNetworkId,
  type HealthGate,
  type NetworkCapabilities,
  type NetworkCapabilityName,
} from "@/lib/network";

export const DEFAULT_HEALTH_PROBE_TIMEOUT_MS = 5_000;

export type ProbeStatus = "ok" | "failed" | "skipped";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export type HealthReasonCode =
  | "missing_rpc_config"
  | "invalid_rpc_url"
  | "rpc_unreachable"
  | "rpc_network_mismatch"
  | "missing_factory_config"
  | "invalid_factory_contract_id"
  | "factory_read_failed"
  | "factory_paused"
  | "registry_read_failed"
  | "registry_malformed_records"
  | "missing_legacy_config"
  | "partial_legacy_config"
  | "invalid_legacy_contract_id"
  | "legacy_read_failed"
  | "rpc_unavailable"
  | "factory_unavailable";

export type HealthProbeResult = {
  status: ProbeStatus;
  reasonCode: HealthReasonCode | null;
  message: string | null;
  latencyMs: number | null;
};

export type RpcHealthSurface = {
  configured: boolean;
  validUrl: boolean;
  latestLedger: number | null;
  probe: HealthProbeResult;
};

export type CommunityFactoryHealthSurface = {
  configured: boolean;
  validContractId: boolean;
  paused: boolean | null;
  communityCount: number | null;
  probe: HealthProbeResult;
};

export type RegistryHealthSurface = {
  configured: boolean;
  readable: boolean;
  sampleCount: number | null;
  hasNextPage: boolean | null;
  malformedRecords: number | null;
  probe: HealthProbeResult;
};

export type LegacyContractsHealthSurface = {
  optional: true;
  configured: boolean;
  partiallyConfigured: boolean;
  nftConfigured: boolean;
  governorConfigured: boolean;
  validContractIds: boolean;
  nftReadable: boolean | null;
  governorReadable: boolean | null;
  probe: HealthProbeResult;
};

export type DeploymentHealthResponse = {
  healthy: boolean;
  status: HealthStatus;
  reasonCode: HealthReasonCode | null;
  network: {
    selected: ActiveNetworkId;
    passphraseConfigured: boolean;
    passphraseMatched: boolean | null;
  };
  rpc: RpcHealthSurface;
  communityFactory: CommunityFactoryHealthSurface;
  registry: RegistryHealthSurface;
  legacyContracts: LegacyContractsHealthSurface;
  contracts: {
    nftConfigured: boolean;
    governorConfigured: boolean;
    communityFactoryConfigured: boolean;
    allConfigured: boolean;
  };
  capabilities: Record<NetworkCapabilityName, boolean>;
  unavailableCapabilities: NetworkCapabilityName[];
  gates: HealthGate[];
};

export type RpcProbeOutput = {
  latestLedger: number;
  passphraseMatched: boolean;
};

export type CommunityFactoryProbeOutput = {
  paused: boolean;
  communityCount: number;
};

export type RegistryListingProbeOutput = {
  sampleCount: number;
  hasNextPage: boolean;
  malformedRecords: number;
};

export type LegacyContractsProbeOutput = {
  nftReadable: boolean;
  governorReadable: boolean;
};

export interface HealthProbeDriver {
  probeRpc(input: {
    rpcUrl: string;
    expectedNetworkPassphrase: string;
    timeoutMs: number;
  }): Promise<RpcProbeOutput>;
  probeCommunityFactory(input: {
    rpcUrl: string;
    networkPassphrase: string;
    contractId: string;
    timeoutMs: number;
  }): Promise<CommunityFactoryProbeOutput>;
  probeRegistryListing(input: {
    rpcUrl: string;
    networkPassphrase: string;
    contractId: string;
    timeoutMs: number;
  }): Promise<RegistryListingProbeOutput>;
  probeLegacyContracts(input: {
    rpcUrl: string;
    networkPassphrase: string;
    nftContractId: string;
    governorContractId: string;
    timeoutMs: number;
  }): Promise<LegacyContractsProbeOutput>;
}

export interface HealthLogger {
  warn(message: string): void;
  error(message: string): void;
}

export class HealthProbeError extends Error {
  constructor(
    readonly reasonCode: HealthReasonCode,
    message: string,
  ) {
    super(message);
    this.name = "HealthProbeError";
  }
}

const CAPABILITY_NAMES: readonly NetworkCapabilityName[] = [
  "rpc",
  "explorer",
  "communityFactory",
  "legacyContracts",
  "proposalDiscovery",
  "privilegedWrites",
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function truncateAddressMatch(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/**
 * Scrubs URLs, query strings, auth credentials, Stellar secret seeds, and full
 * wallet/contract addresses from diagnostic text before it reaches JSON or logs.
 */
export function sanitizeHealthText(
  input: string,
  extraSensitiveValues: readonly string[] = [],
): string {
  let sanitized = input
    .replace(/\b(?:https?|wss?):\/\/[^\s"'<>)\]]+/gi, "[redacted-url]")
    .replace(/(\/[A-Za-z0-9._~:/%-]*)\?[^\s"'<>#)\]]*(?:#[^\s"'<>)\]]*)?/g, "$1")
    .replace(/\?[A-Za-z0-9_.-]+=[^\s"'<>)\]]+/g, "[redacted-query]")
    .replace(/\b(Bearer|Basic)\s+[^\s"',;)\]]+/gi, "$1 [redacted]")
    .replace(
      /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|token|secret|password|passwd|pwd|authorization|signature|credential|credentials)\s*([:=])\s*[^\s&"',;)\]]+/gi,
      "$1$2[redacted]",
    )
    .replace(/\b[A-Za-z0-9._%+-]+:[^@\s"'/]+@[A-Za-z0-9.-]+/g, "[redacted-credentials]")
    .replace(/(?<![A-Z2-7])S[A-Z2-7]{55}(?![A-Z2-7])/g, "[redacted-secret]")
    .replace(/(?<![A-Z2-7])[GCM][A-Z2-7]{55,68}(?![A-Z2-7])/g, truncateAddressMatch);

  for (const rawValue of extraSensitiveValues) {
    const trimmed = rawValue.trim();
    if (trimmed.length >= 4) {
      sanitized = sanitized.replace(
        new RegExp(escapeRegExp(trimmed), "g"),
        "[redacted]",
      );
    }
  }

  return sanitized.replace(/\s+/g, " ").trim();
}

export function isValidHttpUrl(value: string): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidContractAddress(value: string): boolean {
  return Boolean(value) && StrKey.isValidContract(value);
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value instanceof Map) {
    return Object.fromEntries(value) as Record<string, unknown>;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asNonNegativeSafeInteger(value: unknown): number | null {
  if (typeof value === "bigint") {
    const converted = Number(value);
    return Number.isSafeInteger(converted) && converted >= 0 ? converted : null;
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }
  return null;
}

async function withProbeTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(timeoutMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

async function simulateContractRead(input: {
  rpcUrl: string;
  networkPassphrase: string;
  contractId: string;
  method: string;
  args?: xdr.ScVal[];
}): Promise<unknown> {
  const transaction = await AssembledTransaction.build<unknown>({
    contractId: input.contractId,
    method: input.method,
    args: input.args ?? [],
    networkPassphrase: input.networkPassphrase,
    rpcUrl: input.rpcUrl,
    allowHttp: input.rpcUrl.startsWith("http://"),
    parseResultXdr: (value) => scValToNative(value),
  });

  if (transaction.simulation && Api.isSimulationError(transaction.simulation)) {
    throw new Error(transaction.simulation.error);
  }

  return transaction.result;
}

export function createSorobanHealthProbeDriver(): HealthProbeDriver {
  return {
    async probeRpc({ rpcUrl, expectedNetworkPassphrase, timeoutMs }) {
      return withProbeTimeout(
        async () => {
          const server = new RpcServer(rpcUrl, {
            allowHttp: rpcUrl.startsWith("http://"),
          });
          const [health, network, latestLedger] = await Promise.all([
            server.getHealth(),
            server.getNetwork(),
            server.getLatestLedger(),
          ]);

          if (health.status !== "healthy") {
            throw new HealthProbeError(
              "rpc_unreachable",
              `RPC reported non-healthy status "${String(health.status)}".`,
            );
          }

          if (network.passphrase !== expectedNetworkPassphrase) {
            throw new HealthProbeError(
              "rpc_network_mismatch",
              "RPC network passphrase does not match the active network.",
            );
          }

          const ledger = asNonNegativeSafeInteger(latestLedger.sequence);
          if (ledger === null || ledger <= 0) {
            throw new HealthProbeError(
              "rpc_unreachable",
              "RPC returned an invalid latest ledger sequence.",
            );
          }

          return {
            latestLedger: ledger,
            passphraseMatched: true,
          };
        },
        timeoutMs,
        `RPC probe timed out after ${timeoutMs}ms.`,
      );
    },

    async probeCommunityFactory({ rpcUrl, networkPassphrase, contractId, timeoutMs }) {
      return withProbeTimeout(
        async () => {
          const [rawPaused, rawCount] = await Promise.all([
            simulateContractRead({
              rpcUrl,
              networkPassphrase,
              contractId,
              method: "is_paused",
            }),
            simulateContractRead({
              rpcUrl,
              networkPassphrase,
              contractId,
              method: "community_count",
            }),
          ]);

          if (typeof rawPaused !== "boolean") {
            throw new HealthProbeError(
              "factory_read_failed",
              "CommunityFactory is_paused read returned an unexpected value.",
            );
          }

          const communityCount = asNonNegativeSafeInteger(rawCount);
          if (communityCount === null) {
            throw new HealthProbeError(
              "factory_read_failed",
              "CommunityFactory community_count read returned an invalid count.",
            );
          }

          return {
            paused: rawPaused,
            communityCount,
          };
        },
        timeoutMs,
        `CommunityFactory probe timed out after ${timeoutMs}ms.`,
      );
    },

    async probeRegistryListing({ rpcUrl, networkPassphrase, contractId, timeoutMs }) {
      return withProbeTimeout(
        async () => {
          const rawPage = asObject(
            await simulateContractRead({
              rpcUrl,
              networkPassphrase,
              contractId,
              method: "list_communities",
              args: [xdr.ScVal.scvVoid(), nativeToScVal(1, { type: "u32" })],
            }),
          );

          if (!rawPage || !Array.isArray(rawPage.records)) {
            throw new HealthProbeError(
              "registry_read_failed",
              "Registry list_communities probe returned a malformed page.",
            );
          }

          const nextCursor =
            rawPage.next_cursor === null || rawPage.next_cursor === undefined
              ? null
              : asNonNegativeSafeInteger(rawPage.next_cursor);

          if (
            rawPage.next_cursor !== null &&
            rawPage.next_cursor !== undefined &&
            nextCursor === null
          ) {
            throw new HealthProbeError(
              "registry_read_failed",
              "Registry list_communities probe returned an invalid pagination cursor.",
            );
          }

          let malformedRecords = 0;
          const seen = new Set<string>();
          for (const rawRecord of rawPage.records) {
            const parsed = parseRegistryRecord(rawRecord);
            if (!parsed || seen.has(parsed.id)) {
              malformedRecords += 1;
              continue;
            }
            seen.add(parsed.id);
          }

          return {
            sampleCount: rawPage.records.length,
            hasNextPage: nextCursor !== null,
            malformedRecords,
          };
        },
        timeoutMs,
        `Registry list_communities probe timed out after ${timeoutMs}ms.`,
      );
    },

    async probeLegacyContracts({
      rpcUrl,
      networkPassphrase,
      nftContractId,
      governorContractId,
      timeoutMs,
    }) {
      return withProbeTimeout(
        async () => {
          const [nftName, votingDelay] = await Promise.all([
            simulateContractRead({
              rpcUrl,
              networkPassphrase,
              contractId: nftContractId,
              method: "name",
            }),
            simulateContractRead({
              rpcUrl,
              networkPassphrase,
              contractId: governorContractId,
              method: "voting_delay",
            }),
          ]);

          if (typeof nftName !== "string") {
            throw new HealthProbeError(
              "legacy_read_failed",
              "Legacy NFT contract name read returned an unexpected value.",
            );
          }

          if (asNonNegativeSafeInteger(votingDelay) === null) {
            throw new HealthProbeError(
              "legacy_read_failed",
              "Legacy Governor voting_delay read returned an unexpected value.",
            );
          }

          return {
            nftReadable: true,
            governorReadable: true,
          };
        },
        timeoutMs,
        `Legacy contracts probe timed out after ${timeoutMs}ms.`,
      );
    },
  };
}

function skippedProbe(
  reasonCode: HealthReasonCode,
  message: string,
): HealthProbeResult {
  return {
    status: "skipped",
    reasonCode,
    message,
    latencyMs: null,
  };
}

function okProbe(
  latencyMs: number,
  reasonCode: HealthReasonCode | null = null,
  message: string | null = null,
): HealthProbeResult {
  return {
    status: "ok",
    reasonCode,
    message,
    latencyMs,
  };
}

function failedProbe(
  reasonCode: HealthReasonCode,
  error: unknown,
  fallbackMessage: string,
  latencyMs: number,
  sensitiveValues: readonly string[],
): HealthProbeResult {
  const rawMessage =
    error instanceof Error && error.message.trim()
      ? error.message
      : fallbackMessage;
  const sanitized = sanitizeHealthText(rawMessage, sensitiveValues);
  return {
    status: "failed",
    reasonCode: error instanceof HealthProbeError ? error.reasonCode : reasonCode,
    message: sanitized || fallbackMessage,
    latencyMs,
  };
}

function updateGateWithProbe(
  gate: HealthGate,
  probeAvailable: boolean,
  probeMessage: string | null,
): HealthGate {
  if (!gate.available || probeAvailable) {
    return gate;
  }

  return {
    ...gate,
    available: false,
    reason: probeMessage ?? `${gate.label} failed its live read probe.`,
    requiredEnvironment: [],
  };
}

const defaultHealthProbeDriver = createSorobanHealthProbeDriver();

export async function evaluateDeploymentHealth(
  capabilities: NetworkCapabilities,
  options: {
    driver?: HealthProbeDriver;
    timeoutMs?: number;
    logger?: HealthLogger | null;
  } = {},
): Promise<{ response: DeploymentHealthResponse; statusCode: number }> {
  const driver = options.driver ?? defaultHealthProbeDriver;
  const timeoutMs = options.timeoutMs ?? DEFAULT_HEALTH_PROBE_TIMEOUT_MS;
  const logger = options.logger === undefined ? console : options.logger;

  const sensitiveValues = [
    capabilities.rpc.url,
    capabilities.rpc.horizonUrl,
    capabilities.rpc.friendbotUrl ?? "",
    capabilities.network.networkPassphrase,
    capabilities.contracts.communityFactory,
    capabilities.contracts.legacyNft,
    capabilities.contracts.legacyGovernor,
  ].filter(Boolean);

  const rpcConfigured = capabilities.rpc.available;
  const rpcValidUrl = rpcConfigured && isValidHttpUrl(capabilities.rpc.url);
  let passphraseMatched: boolean | null = null;
  let latestLedger: number | null = null;
  let rpcProbe: HealthProbeResult;

  if (!rpcConfigured) {
    rpcProbe = skippedProbe(
      "missing_rpc_config",
      "RPC endpoint is not configured for the active network.",
    );
  } else if (!rpcValidUrl) {
    rpcProbe = skippedProbe(
      "invalid_rpc_url",
      "Configured RPC URL must use http or https.",
    );
  } else {
    const startedAt = Date.now();
    try {
      const rpcResult = await driver.probeRpc({
        rpcUrl: capabilities.rpc.url,
        expectedNetworkPassphrase: capabilities.network.networkPassphrase,
        timeoutMs,
      });
      latestLedger = rpcResult.latestLedger;
      passphraseMatched = rpcResult.passphraseMatched;
      rpcProbe = okProbe(Math.max(0, Date.now() - startedAt));
    } catch (error) {
      if (
        error instanceof HealthProbeError &&
        error.reasonCode === "rpc_network_mismatch"
      ) {
        passphraseMatched = false;
      }
      rpcProbe = failedProbe(
        "rpc_unreachable",
        error,
        "Soroban RPC read probe failed.",
        Math.max(0, Date.now() - startedAt),
        sensitiveValues,
      );
    }
  }

  const factoryConfigured = capabilities.communityFactory.available;
  const factoryValidContractId =
    factoryConfigured && isValidContractAddress(capabilities.communityFactory.contractId);
  let factoryPaused: boolean | null = null;
  let communityCount: number | null = null;
  let factoryProbe: HealthProbeResult;

  if (!factoryConfigured) {
    factoryProbe = skippedProbe(
      "missing_factory_config",
      "CommunityFactory contract ID is not configured.",
    );
  } else if (!factoryValidContractId) {
    factoryProbe = skippedProbe(
      "invalid_factory_contract_id",
      "Configured CommunityFactory contract ID is not a valid Stellar contract address.",
    );
  } else if (rpcProbe.status !== "ok") {
    factoryProbe = skippedProbe(
      "rpc_unavailable",
      "Skipped CommunityFactory probe because RPC is unavailable.",
    );
  } else {
    const startedAt = Date.now();
    try {
      const factoryResult = await driver.probeCommunityFactory({
        rpcUrl: capabilities.rpc.url,
        networkPassphrase: capabilities.network.networkPassphrase,
        contractId: capabilities.communityFactory.contractId,
        timeoutMs,
      });
      factoryPaused = factoryResult.paused;
      communityCount = factoryResult.communityCount;
      factoryProbe = okProbe(
        Math.max(0, Date.now() - startedAt),
        factoryPaused ? "factory_paused" : null,
        factoryPaused ? "CommunityFactory is currently paused for new deployments." : null,
      );
    } catch (error) {
      factoryProbe = failedProbe(
        "factory_read_failed",
        error,
        "CommunityFactory read probe failed.",
        Math.max(0, Date.now() - startedAt),
        sensitiveValues,
      );
    }
  }

  let registryReadable = false;
  let registrySampleCount: number | null = null;
  let registryHasNextPage: boolean | null = null;
  let registryMalformedRecords: number | null = null;
  let registryProbe: HealthProbeResult;

  if (!factoryConfigured) {
    registryProbe = skippedProbe(
      "missing_factory_config",
      "Skipped registry listing probe because CommunityFactory is not configured.",
    );
  } else if (!factoryValidContractId) {
    registryProbe = skippedProbe(
      "invalid_factory_contract_id",
      "Skipped registry listing probe because CommunityFactory contract ID is invalid.",
    );
  } else if (rpcProbe.status !== "ok") {
    registryProbe = skippedProbe(
      "rpc_unavailable",
      "Skipped registry listing probe because RPC is unavailable.",
    );
  } else if (factoryProbe.status !== "ok") {
    registryProbe = skippedProbe(
      "factory_unavailable",
      "Skipped registry listing probe because CommunityFactory read probe failed.",
    );
  } else {
    const startedAt = Date.now();
    try {
      const registryResult = await driver.probeRegistryListing({
        rpcUrl: capabilities.rpc.url,
        networkPassphrase: capabilities.network.networkPassphrase,
        contractId: capabilities.communityFactory.contractId,
        timeoutMs,
      });
      registryReadable = true;
      registrySampleCount = registryResult.sampleCount;
      registryHasNextPage = registryResult.hasNextPage;
      registryMalformedRecords = registryResult.malformedRecords;
      registryProbe = okProbe(
        Math.max(0, Date.now() - startedAt),
        registryMalformedRecords > 0 ? "registry_malformed_records" : null,
        registryMalformedRecords > 0
          ? "Registry listing succeeded with malformed community records in the probed page."
          : null,
      );
    } catch (error) {
      registryProbe = failedProbe(
        "registry_read_failed",
        error,
        "Registry list_communities read probe failed.",
        Math.max(0, Date.now() - startedAt),
        sensitiveValues,
      );
    }
  }

  const nftConfigured = Boolean(capabilities.contracts.legacyNft);
  const governorConfigured = Boolean(capabilities.contracts.legacyGovernor);
  const legacyConfigured = capabilities.legacyContracts.available;
  const legacyPartiallyConfigured = nftConfigured !== governorConfigured;
  const legacyValidContractIds =
    legacyConfigured &&
    isValidContractAddress(capabilities.contracts.legacyNft) &&
    isValidContractAddress(capabilities.contracts.legacyGovernor);
  let nftReadable: boolean | null = null;
  let governorReadable: boolean | null = null;
  let legacyProbe: HealthProbeResult;

  if (!nftConfigured && !governorConfigured) {
    legacyProbe = skippedProbe(
      "missing_legacy_config",
      "Optional legacy single-instance contracts are not configured.",
    );
  } else if (legacyPartiallyConfigured) {
    legacyProbe = skippedProbe(
      "partial_legacy_config",
      "Only one optional legacy contract ID is configured; configure both NFT and Governor or neither.",
    );
  } else if (!legacyValidContractIds) {
    legacyProbe = skippedProbe(
      "invalid_legacy_contract_id",
      "Configured legacy contract IDs must be valid Stellar contract addresses.",
    );
  } else if (rpcProbe.status !== "ok") {
    legacyProbe = skippedProbe(
      "rpc_unavailable",
      "Skipped optional legacy contracts probe because RPC is unavailable.",
    );
  } else {
    const startedAt = Date.now();
    try {
      const legacyResult = await driver.probeLegacyContracts({
        rpcUrl: capabilities.rpc.url,
        networkPassphrase: capabilities.network.networkPassphrase,
        nftContractId: capabilities.contracts.legacyNft,
        governorContractId: capabilities.contracts.legacyGovernor,
        timeoutMs,
      });
      nftReadable = legacyResult.nftReadable;
      governorReadable = legacyResult.governorReadable;
      legacyProbe = okProbe(Math.max(0, Date.now() - startedAt));
    } catch (error) {
      nftReadable = false;
      governorReadable = false;
      legacyProbe = failedProbe(
        "legacy_read_failed",
        error,
        "Optional legacy contract read probe failed.",
        Math.max(0, Date.now() - startedAt),
        sensitiveValues,
      );
    }
  }

  let status: HealthStatus;
  let reasonCode: HealthReasonCode | null = null;

  if (!rpcConfigured) {
    status = "unhealthy";
    reasonCode = "missing_rpc_config";
  } else if (!rpcValidUrl) {
    status = "unhealthy";
    reasonCode = "invalid_rpc_url";
  } else if (rpcProbe.status !== "ok") {
    status = "unhealthy";
    reasonCode = rpcProbe.reasonCode ?? "rpc_unreachable";
  } else if (!factoryConfigured) {
    status = "unhealthy";
    reasonCode = "missing_factory_config";
  } else if (!factoryValidContractId) {
    status = "unhealthy";
    reasonCode = "invalid_factory_contract_id";
  } else if (factoryProbe.status !== "ok") {
    status = "unhealthy";
    reasonCode = factoryProbe.reasonCode ?? "factory_read_failed";
  } else if (!registryReadable || registryProbe.status !== "ok") {
    status = "unhealthy";
    reasonCode = registryProbe.reasonCode ?? "registry_read_failed";
  } else if (factoryPaused === true) {
    status = "degraded";
    reasonCode = "factory_paused";
  } else if ((registryMalformedRecords ?? 0) > 0) {
    status = "degraded";
    reasonCode = "registry_malformed_records";
  } else if (legacyPartiallyConfigured) {
    status = "degraded";
    reasonCode = "partial_legacy_config";
  } else if (legacyConfigured && !legacyValidContractIds) {
    status = "degraded";
    reasonCode = "invalid_legacy_contract_id";
  } else if (legacyConfigured && legacyProbe.status !== "ok") {
    status = "degraded";
    reasonCode = legacyProbe.reasonCode ?? "legacy_read_failed";
  } else {
    status = "healthy";
    reasonCode = null;
  }

  const healthy = status === "healthy" && registryReadable;

  const rpcAvailable = rpcConfigured && rpcValidUrl && rpcProbe.status === "ok";
  const communityFactoryAvailable =
    factoryConfigured &&
    factoryValidContractId &&
    factoryProbe.status === "ok" &&
    registryReadable &&
    registryProbe.status === "ok";
  const legacyContractsAvailable =
    legacyConfigured && legacyValidContractIds && legacyProbe.status === "ok";
  const proposalDiscoveryAvailable =
    capabilities.proposalDiscovery.available &&
    rpcAvailable &&
    (!legacyConfigured || legacyContractsAvailable);

  const liveCapabilities: Record<NetworkCapabilityName, boolean> = {
    rpc: rpcAvailable,
    explorer: capabilities.explorer.available,
    communityFactory: communityFactoryAvailable,
    legacyContracts: legacyContractsAvailable,
    proposalDiscovery: proposalDiscoveryAvailable,
    privilegedWrites: capabilities.privilegedWrites.available,
  };

  const unavailableCapabilities = CAPABILITY_NAMES.filter(
    (name) => !liveCapabilities[name],
  );

  const gates = buildHealthGates(capabilities).map((gate) => {
    if (gate.name === "rpc") {
      return updateGateWithProbe(gate, rpcAvailable, rpcProbe.message);
    }
    if (gate.name === "communityFactory") {
      const failureMessage =
        factoryProbe.status !== "ok" ? factoryProbe.message : registryProbe.message;
      return updateGateWithProbe(gate, communityFactoryAvailable, failureMessage);
    }
    if (gate.name === "legacyContracts") {
      return updateGateWithProbe(gate, legacyContractsAvailable, legacyProbe.message);
    }
    if (gate.name === "proposalDiscovery") {
      const failureMessage = !rpcAvailable ? rpcProbe.message : legacyProbe.message;
      return updateGateWithProbe(gate, proposalDiscoveryAvailable, failureMessage);
    }
    return gate;
  });

  if (logger && status !== "healthy") {
    const detail = sanitizeHealthText(
      [
        rpcProbe.status === "failed" ? `rpc=${rpcProbe.message}` : "",
        factoryProbe.status === "failed" ? `factory=${factoryProbe.message}` : "",
        registryProbe.status === "failed" ? `registry=${registryProbe.message}` : "",
        legacyProbe.status === "failed" ? `legacy=${legacyProbe.message}` : "",
      ]
        .filter(Boolean)
        .join("; "),
      sensitiveValues,
    );
    const logMessage = detail
      ? `[health] status=${status} network=${capabilities.network.id} reason=${reasonCode ?? "unknown"} detail="${detail}"`
      : `[health] status=${status} network=${capabilities.network.id} reason=${reasonCode ?? "unknown"}`;
    if (status === "unhealthy") {
      logger.error(logMessage);
    } else {
      logger.warn(logMessage);
    }
  }

  return {
    response: {
      healthy,
      status,
      reasonCode,
      network: {
        selected: capabilities.network.id,
        passphraseConfigured: Boolean(capabilities.network.networkPassphrase),
        passphraseMatched,
      },
      rpc: {
        configured: rpcConfigured,
        validUrl: rpcValidUrl,
        latestLedger,
        probe: rpcProbe,
      },
      communityFactory: {
        configured: factoryConfigured,
        validContractId: factoryValidContractId,
        paused: factoryPaused,
        communityCount,
        probe: factoryProbe,
      },
      registry: {
        configured: factoryConfigured,
        readable: registryReadable,
        sampleCount: registrySampleCount,
        hasNextPage: registryHasNextPage,
        malformedRecords: registryMalformedRecords,
        probe: registryProbe,
      },
      legacyContracts: {
        optional: true,
        configured: legacyConfigured,
        partiallyConfigured: legacyPartiallyConfigured,
        nftConfigured,
        governorConfigured,
        validContractIds: legacyValidContractIds,
        nftReadable,
        governorReadable,
        probe: legacyProbe,
      },
      contracts: {
        nftConfigured,
        governorConfigured,
        communityFactoryConfigured: factoryConfigured,
        allConfigured: legacyConfigured && factoryConfigured,
      },
      capabilities: liveCapabilities,
      unavailableCapabilities,
      gates,
    },
    statusCode: status === "unhealthy" ? 503 : 200,
  };
}
