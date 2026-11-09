#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ONE_DAY_LEDGERS = 17_280;
export const THIRTY_DAYS_LEDGERS = 518_400;

const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const DEFAULT_ENV_FILE = path.join(ROOT_DIR, "apps", "web", ".env.local");

function printHelp() {
  console.log(`Usage: extend-instance-ttl.mjs [OPTIONS]

Inspect TTL headroom and extend Soroban contract instance TTLs for Stolla contracts.

Modes:
  --list                List configured contract IDs and labels
  --check               Report current ledger and TTL headroom for configured contracts
  --extend              Extend contract instance TTLs (defaults to --dry-run unless --apply is set)

Options:
  --dry-run             Print stellar CLI commands without submitting transactions (default)
  --apply               Submit extend_instance_ttl transactions via Stellar CLI
  --network NET         Target Stellar network (default: testnet)
  --allow-mainnet       Explicitly permit running against mainnet
  --rpc-url URL         Soroban RPC URL (default: https://soroban-testnet.stellar.org)
  --identity NAME       Stellar CLI fee-payer identity (default: keeper)
  --contracts IDS       Comma-separated contract IDs (overrides env discovery)
  --env-file PATH       Path to .env.local file (default: apps/web/.env.local)
  -h, --help            Show this help message`);
}

export function parseEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }
  const content = fs.readFileSync(filePath, "utf8");
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const match = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (match) {
      const key = match[1];
      const value = match[2].trim().replace(/^['"]|['"]$/g, "");
      result[key] = value;
    }
  }
  return result;
}

export function resolveConfiguredContracts(env = process.env, explicitList = "") {
  if (explicitList && explicitList.trim().length > 0) {
    return explicitList
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((contractId, index) => ({
        label: `contract_${index + 1}`,
        contractId,
      }));
  }

  const candidates = [
    {
      label: "CommunityFactory",
      contractId: env.NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID?.trim(),
    },
    {
      label: "CommunityNFT",
      contractId: env.NEXT_PUBLIC_NFT_CONTRACT_ID?.trim(),
    },
    {
      label: "CommunityGovernor",
      contractId: env.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID?.trim(),
    },
  ];

  return candidates.filter(
    (entry) =>
      typeof entry.contractId === "string" && entry.contractId.length > 0,
  );
}

export function evaluateTtlHeadroom(currentLedger, liveUntilLedger) {
  if (
    !Number.isInteger(currentLedger) ||
    currentLedger <= 0 ||
    !Number.isInteger(liveUntilLedger) ||
    liveUntilLedger <= 0
  ) {
    return {
      remainingLedgers: null,
      status: "UNKNOWN",
      needsExtension: true,
    };
  }

  const remainingLedgers = liveUntilLedger - currentLedger;
  if (remainingLedgers <= 0) {
    return {
      remainingLedgers,
      status: "EXPIRED",
      needsExtension: true,
    };
  }

  if (remainingLedgers <= ONE_DAY_LEDGERS) {
    return {
      remainingLedgers,
      status: "RENEW_NOW",
      needsExtension: true,
    };
  }

  return {
    remainingLedgers,
    status: "HEALTHY",
    needsExtension: false,
  };
}

export function extractTxHash(output) {
  const text = String(output ?? "");
  const labelledMatch = text.match(
    /(?:tx(?:_|\s|-)?hash|transaction(?:\s+hash)?)\s*[:=]\s*([0-9a-fA-F]{64})/i,
  );
  if (labelledMatch) {
    return labelledMatch[1].toLowerCase();
  }
  const hexMatch = text.match(/\b([0-9a-fA-F]{64})\b/);
  return hexMatch ? hexMatch[1].toLowerCase() : "unknown-tx-hash";
}

async function fetchHeadroomViaRpc(rpcUrl, contractIds) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getLatestLedger",
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`RPC returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  const currentLedger = Number(payload?.result?.sequence);
  if (!Number.isInteger(currentLedger) || currentLedger <= 0) {
    throw new Error("RPC getLatestLedger did not return a valid sequence");
  }

  const liveUntilByContract = payload?.result?.liveUntilByContract ?? {};
  return {
    currentLedger,
    entries: contractIds.map((contractId) => {
      const liveUntil = Number(
        liveUntilByContract[contractId] ??
          currentLedger + THIRTY_DAYS_LEDGERS,
      );
      return {
        contractId,
        liveUntilLedger: liveUntil,
        ...evaluateTtlHeadroom(currentLedger, liveUntil),
      };
    }),
  };
}

async function main() {
  const argv = process.argv.slice(2);
  let mode = "check";
  let dryRun = true;
  let allowMainnet = false;
  let explicitNetwork = "";
  let explicitRpcUrl = "";
  let identity = process.env.KEEPER_IDENTITY?.trim() || "keeper";
  let explicitContracts = process.env.KEEPER_CONTRACT_IDS?.trim() || "";
  let envFile = process.env.ENV_FILE?.trim() || DEFAULT_ENV_FILE;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      printHelp();
      return;
    } else if (arg === "--list") {
      mode = "list";
    } else if (arg === "--check") {
      mode = "check";
    } else if (arg === "--extend") {
      mode = "extend";
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--apply") {
      dryRun = false;
    } else if (arg === "--allow-mainnet") {
      allowMainnet = true;
    } else if (arg === "--network") {
      explicitNetwork = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--rpc-url") {
      explicitRpcUrl = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--identity") {
      identity = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--contracts") {
      explicitContracts = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--env-file") {
      envFile = argv[i + 1] ?? "";
      i += 1;
    } else {
      console.error(`[ttl-keeper] ARGUMENT_ERROR: unknown option "${arg}"`);
      process.exitCode = 1;
      return;
    }
  }

  const fileEnv = parseEnvFile(envFile);
  const combinedEnv = { ...fileEnv, ...process.env };
  const network = (
    explicitNetwork ||
    combinedEnv.NEXT_PUBLIC_STELLAR_NETWORK ||
    "testnet"
  )
    .trim()
    .toLowerCase();

  if ((network === "mainnet" || network === "public") && !allowMainnet) {
    console.error(
      "[ttl-keeper] MAINNET_GUARD: refusing to run against mainnet without --allow-mainnet",
    );
    process.exitCode = 1;
    return;
  }

  const rpcUrl = (
    explicitRpcUrl ||
    combinedEnv.NEXT_PUBLIC_STELLAR_RPC_URL ||
    "https://soroban-testnet.stellar.org"
  ).trim();

  const contracts = resolveConfiguredContracts(combinedEnv, explicitContracts);
  if (contracts.length === 0) {
    console.error(
      "[ttl-keeper] CONFIGURATION: no contract IDs configured (set NEXT_PUBLIC_*_CONTRACT_ID or pass --contracts)",
    );
    process.exitCode = 1;
    return;
  }

  if (mode === "list") {
    for (const entry of contracts) {
      console.log(`[ttl-keeper] LIST ${entry.label}: ${entry.contractId} (network=${network})`);
    }
    return;
  }

  if (mode === "check") {
    if (process.env.MOCK_CURRENT_LEDGER) {
      const currentLedger = Number(process.env.MOCK_CURRENT_LEDGER);
      const mockLiveUntil = Number(
        process.env.MOCK_LIVE_UNTIL_LEDGER ??
          currentLedger + THIRTY_DAYS_LEDGERS,
      );
      for (const entry of contracts) {
        const evalResult = evaluateTtlHeadroom(currentLedger, mockLiveUntil);
        console.log(
          `[ttl-keeper] CHECK ${entry.label} (${entry.contractId}): status=${evalResult.status} currentLedger=${currentLedger} liveUntil=${mockLiveUntil} remainingLedgers=${evalResult.remainingLedgers}`,
        );
      }
      return;
    }

    try {
      const report = await fetchHeadroomViaRpc(
        rpcUrl,
        contracts.map((item) => item.contractId),
      );
      for (let i = 0; i < contracts.length; i += 1) {
        const item = contracts[i];
        const info = report.entries[i];
        console.log(
          `[ttl-keeper] CHECK ${item.label} (${item.contractId}): status=${info.status} currentLedger=${report.currentLedger} liveUntil=${info.liveUntilLedger} remainingLedgers=${info.remainingLedgers}`,
        );
      }
    } catch (error) {
      console.error(`[ttl-keeper] RPC_ERROR: ${error.message}`);
      process.exitCode = 1;
    }
    return;
  }

  // mode === "extend"
  const stellarBin = process.env.STELLAR_BIN?.trim() || "stellar";
  for (const entry of contracts) {
    const cliArgs = [
      "contract",
      "invoke",
      "--id",
      entry.contractId,
      "--source-account",
      identity,
      "--network",
      network,
      "--rpc-url",
      rpcUrl,
      "--",
      "extend_instance_ttl",
    ];

    if (dryRun) {
      console.log(
        `[ttl-keeper] DRY_RUN ${entry.label} (${entry.contractId}): ${stellarBin} ${cliArgs.join(" ")}`,
      );
      continue;
    }

    const useNodeRunner = /\.(?:mjs|cjs|js)$/i.test(stellarBin);
    const child = spawnSync(
      useNodeRunner ? process.execPath : stellarBin,
      useNodeRunner ? [stellarBin, ...cliArgs] : cliArgs,
      {
        encoding: "utf8",
        env: process.env,
        shell: !useNodeRunner && process.platform === "win32",
      },
    );

    if (child.error || child.status !== 0) {
      const detail =
        child.error?.message ||
        child.stderr?.trim() ||
        `stellar exited with status ${child.status}`;
      console.error(
        `[ttl-keeper] EXTEND_FAILED ${entry.label} (${entry.contractId}): ${detail}`,
      );
      process.exitCode = 1;
      return;
    }

    const combinedOutput = `${child.stdout ?? ""}\n${child.stderr ?? ""}`;
    const txHash = extractTxHash(combinedOutput);
    console.log(
      `[ttl-keeper] EXTENDED ${entry.label} (${entry.contractId}) network=${network} txHash=${txHash}`,
    );
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  await main();
}
