#!/usr/bin/env node

export const DAY_IN_LEDGERS = 17_280;
export const STORAGE_EXTEND_AMOUNT = 30 * DAY_IN_LEDGERS; // 518,400 ledgers
export const STORAGE_TTL_THRESHOLD = STORAGE_EXTEND_AMOUNT - DAY_IN_LEDGERS; // 501,120 ledgers

const CONTRACT_STRKEY_RE = /^C[A-Z2-7]{55}$/;

export function resolveConfiguredContracts(env = process.env, cliContracts = "") {
  const candidates = [];
  if (cliContracts) {
    for (const part of cliContracts.split(",")) {
      const trimmed = part.trim();
      if (trimmed) candidates.push({ role: "cli", contractId: trimmed });
    }
  } else {
    const mappings = [
      ["factory", env.NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID],
      ["nft", env.NEXT_PUBLIC_NFT_CONTRACT_ID],
      ["governor", env.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID],
      ["timelock", env.NEXT_PUBLIC_TIMELOCK_CONTRACT_ID],
    ];
    for (const [role, value] of mappings) {
      const trimmed = value?.trim();
      if (trimmed) candidates.push({ role, contractId: trimmed });
    }
  }

  const invalid = candidates.find((c) => !CONTRACT_STRKEY_RE.test(c.contractId));
  if (invalid) {
    throw new Error(
      `Invalid Soroban contract ID for ${invalid.role}: ${invalid.contractId}`,
    );
  }
  return candidates;
}

export function parseArgs(argv = process.argv.slice(2)) {
  let mode = "dry-run"; // default is dry-run
  let allowMainnet = false;
  let contractsArg = "";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--list") mode = "list";
    else if (arg === "--check" || arg === "--dry-run") mode = "dry-run";
    else if (arg === "--extend" || arg === "--apply") mode = "extend";
    else if (arg === "--allow-mainnet") allowMainnet = true;
    else if (arg === "--contracts" && argv[i + 1]) {
      contractsArg = argv[i + 1];
      i += 1;
    } else if (arg.startsWith("--contracts=")) {
      contractsArg = arg.slice("--contracts=".length);
    }
  }

  return { mode, allowMainnet, contractsArg };
}

async function rpcCall(rpcUrl, method, params = {}) {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });
  if (!response.ok) {
    throw new Error(`RPC HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload.error) {
    throw new Error(payload.error.message || "RPC error");
  }
  return payload.result;
}

export async function runKeeper({
  argv = process.argv.slice(2),
  env = process.env,
  stdout = console.log,
  stderr = console.error,
} = {}) {
  const { mode, allowMainnet, contractsArg } = parseArgs(argv);
  const network = (
    env.STELLAR_NETWORK ||
    env.NEXT_PUBLIC_STELLAR_NETWORK ||
    "testnet"
  )
    .trim()
    .toLowerCase();

  if ((network === "mainnet" || network === "public") && !allowMainnet) {
    stderr(
      "[ttl-keeper] GUARD: refusing to run against mainnet without explicit --allow-mainnet flag",
    );
    return 1;
  }

  let contracts;
  try {
    contracts = resolveConfiguredContracts(env, contractsArg);
  } catch (error) {
    stderr(`[ttl-keeper] CONFIGURATION: ${error.message}`);
    return 1;
  }

  if (contracts.length === 0) {
    stderr(
      "[ttl-keeper] CONFIGURATION: no contract IDs configured. Set NEXT_PUBLIC_*_CONTRACT_ID or pass --contracts C...",
    );
    return 1;
  }

  if (mode === "list") {
    for (const item of contracts) {
      stdout(
        `[ttl-keeper] CONTRACT role=${item.role} id=${item.contractId} threshold=${STORAGE_TTL_THRESHOLD} extendTo=${STORAGE_EXTEND_AMOUNT}`,
      );
    }
    return 0;
  }

  const rpcUrl = (
    env.SOROBAN_RPC_URL ||
    env.NEXT_PUBLIC_SOROBAN_RPC_URL ||
    "https://soroban-testnet.stellar.org"
  ).trim();

  try {
    const latest = await rpcCall(rpcUrl, "getLatestLedger");
    const currentLedger = Number(latest?.sequence ?? 0);

    for (const item of contracts) {
      const ttlInfo = await rpcCall(rpcUrl, "getContractTtl", {
        contractId: item.contractId,
      }).catch(() => ({ liveUntilLedgerSeq: currentLedger + DAY_IN_LEDGERS }));

      const liveUntil = Number(
        ttlInfo?.liveUntilLedgerSeq ?? currentLedger + DAY_IN_LEDGERS,
      );
      const headroom = Math.max(0, liveUntil - currentLedger);
      const needsRenewal = headroom <= STORAGE_TTL_THRESHOLD;

      stdout(
        `[ttl-keeper] CHECK role=${item.role} id=${item.contractId} currentLedger=${currentLedger} liveUntil=${liveUntil} headroom=${headroom} needsRenewal=${needsRenewal} mode=${mode}`,
      );

      if (mode === "extend" && needsRenewal) {
        const txResult = await rpcCall(rpcUrl, "extendInstanceTtl", {
          contractId: item.contractId,
          extendTo: STORAGE_EXTEND_AMOUNT,
          threshold: STORAGE_TTL_THRESHOLD,
        });
        const txHash = txResult?.txHash || txResult?.hash || "unknown";
        stdout(
          `[ttl-keeper] EXTENDED role=${item.role} id=${item.contractId} txHash=${txHash}`,
        );
      }
    }
    return 0;
  } catch (error) {
    stderr(`[ttl-keeper] ERROR: ${error.message}`);
    return 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const code = await runKeeper();
  process.exitCode = code;
}
