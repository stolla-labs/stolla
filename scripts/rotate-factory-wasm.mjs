#!/usr/bin/env node
// Operator script: rotate the approved NFT/Governor WASM hashes on a deployed
// CommunityFactory (ADR-005). Only affects communities created afterwards.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const MAINNET_CONFIRMATION = "I_ACKNOWLEDGE_STOLLA_MAINNET";
const NETWORKS = new Set(["testnet", "mainnet"]);
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const CONTRACT_ID_PATTERN = /^C[A-Z2-7]{55}$/;
const ACCOUNT_PATTERN = /^G[A-Z2-7]{55}$/;

export const HELP_TEXT = `Usage: rotate-factory-wasm.mjs --factory-id ID --identity NAME [OPTIONS]

Register new NFT and Governor WASM hashes on a deployed CommunityFactory.
Existing communities are never migrated. Defaults to dry-run; pass --apply to
broadcast.

Required:
  --factory-id ID         CommunityFactory contract ID (C...)
  --identity NAME         Stellar CLI identity that must be the factory owner

Hash inputs (one per template; a WASM path is hashed with sha256 and uploaded
on --apply, a hash must already be installed on the target network):
  --nft-wasm PATH         Built community_nft.wasm
  --nft-hash HEX          64-char lowercase hex NFT WASM hash
  --governor-wasm PATH    Built community_governor.wasm
  --governor-hash HEX     64-char lowercase hex Governor WASM hash

Options:
  --network NET           testnet (default) or mainnet
  --dry-run               Print exact hashes and commands only (default)
  --apply                 Run prechecks, upload, set_code_hashes, and verify
  -h, --help              Show this help message

Mainnet --apply additionally requires MAINNET_CHANGE_ID and
CONFIRM_MAINNET=${MAINNET_CONFIRMATION} in the environment.
`;

export class RotationError extends Error {}

/** Parse CLI arguments into a validated options object. */
export function parseArgs(argv) {
  const options = {
    network: "testnet",
    apply: false,
    help: false,
  };
  const valueFlags = {
    "--factory-id": "factoryId",
    "--identity": "identity",
    "--network": "network",
    "--nft-wasm": "nftWasm",
    "--nft-hash": "nftHash",
    "--governor-wasm": "governorWasm",
    "--governor-hash": "governorHash",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--dry-run") {
      options.apply = false;
    } else if (valueFlags[arg]) {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new RotationError(`Missing value for ${arg}`);
      }
      options[valueFlags[arg]] = value;
      index += 1;
    } else {
      throw new RotationError(`Unknown option '${arg}'`);
    }
  }
  return options;
}

/** Soroban WASM hash: sha256 over the raw WASM bytes, lowercase hex. */
export function computeWasmHash(wasmBytes) {
  return createHash("sha256").update(wasmBytes).digest("hex");
}

/** Normalize and validate a 32-byte hex hash (rejects the all-zero hash). */
export function normalizeHash(value, label) {
  const hash = String(value ?? "").trim().toLowerCase();
  if (!HASH_PATTERN.test(hash)) {
    throw new RotationError(`${label} must be 64 hex characters, got '${value}'`);
  }
  if (/^0+$/.test(hash)) {
    throw new RotationError(`${label} must not be the all-zero hash`);
  }
  return hash;
}

/**
 * Parse CLI output of `owner` (a JSON string, or bare address) into an address.
 */
export function parseOwnerOutput(output) {
  const text = String(output).trim().replace(/^"|"$/g, "");
  if (!ACCOUNT_PATTERN.test(text) && !CONTRACT_ID_PATTERN.test(text)) {
    throw new RotationError(`Cannot parse factory owner from: ${output}`);
  }
  return text;
}

/**
 * Parse CLI output of `code_hashes` (JSON tuple of two hex strings).
 * Returns { nftHash, governorHash }.
 */
export function parseCodeHashesOutput(output) {
  let parsed;
  try {
    parsed = JSON.parse(String(output).trim());
  } catch {
    throw new RotationError(`Cannot parse code_hashes output: ${output}`);
  }
  if (!Array.isArray(parsed) || parsed.length !== 2) {
    throw new RotationError(`Expected a 2-tuple from code_hashes, got: ${output}`);
  }
  return {
    nftHash: normalizeHash(parsed[0], "on-chain NFT hash"),
    governorHash: normalizeHash(parsed[1], "on-chain Governor hash"),
  };
}

/** Resolve a template hash from either a WASM path or an explicit hash. */
function resolveTemplate(label, wasmPath, hash, readFile) {
  if (wasmPath && hash) {
    throw new RotationError(`Pass either --${label}-wasm or --${label}-hash, not both`);
  }
  if (wasmPath) {
    return { wasmPath, hash: computeWasmHash(readFile(wasmPath)) };
  }
  if (hash) {
    return { wasmPath: null, hash: normalizeHash(hash, `--${label}-hash`) };
  }
  throw new RotationError(`Provide --${label}-wasm or --${label}-hash`);
}

/** Validate options and resolve hashes into an immutable rotation plan. */
export function buildPlan(options, readFile = readFileSync) {
  if (!options.factoryId || !CONTRACT_ID_PATTERN.test(options.factoryId)) {
    throw new RotationError("--factory-id must be a contract ID starting with C");
  }
  if (!options.identity) {
    throw new RotationError("--identity is required");
  }
  if (!NETWORKS.has(options.network)) {
    throw new RotationError(`Refusing unknown network '${options.network}'`);
  }

  const nft = resolveTemplate("nft", options.nftWasm, options.nftHash, readFile);
  const governor = resolveTemplate(
    "governor",
    options.governorWasm,
    options.governorHash,
    readFile,
  );

  return {
    factoryId: options.factoryId,
    identity: options.identity,
    network: options.network,
    nft,
    governor,
  };
}

/** Refuse mainnet apply unless the runbook gates are present in the env. */
export function assertMainnetGates(plan, env) {
  if (plan.network !== "mainnet") return;
  if (!env.MAINNET_CHANGE_ID) {
    throw new RotationError("Mainnet requires MAINNET_CHANGE_ID (approved change ID)");
  }
  if (env.CONFIRM_MAINNET !== MAINNET_CONFIRMATION) {
    throw new RotationError(
      `Mainnet requires CONFIRM_MAINNET=${MAINNET_CONFIRMATION}`,
    );
  }
}

/** Refuse unless the signing identity is the factory owner. */
export function assertFactoryAuth(signerAddress, ownerAddress) {
  if (signerAddress !== ownerAddress) {
    throw new RotationError(
      `Identity ${signerAddress} is not the factory owner ${ownerAddress}; ` +
        "refusing to apply. Use the owner key or multisig flow in the runbook.",
    );
  }
}

/** Build every stellar CLI argv used by the rotation (no execution). */
export function buildCommands(plan) {
  const base = ["--source-account", plan.identity, "--network", plan.network];
  const invoke = (extra, ...fnArgs) => [
    "contract", "invoke", "--id", plan.factoryId, ...base, ...extra, "--", ...fnArgs,
  ];
  const upload = (wasmPath) => [
    "contract", "upload", "--wasm", wasmPath, ...base,
  ];

  return {
    signerKey: ["keys", "public-key", plan.identity],
    owner: invoke(["--send=no"], "owner"),
    codeHashes: invoke(["--send=no"], "code_hashes"),
    uploadNft: plan.nft.wasmPath ? upload(plan.nft.wasmPath) : null,
    uploadGovernor: plan.governor.wasmPath ? upload(plan.governor.wasmPath) : null,
    setCodeHashes: invoke(
      ["--send=yes"],
      "set_code_hashes",
      "--nft_wasm_hash", plan.nft.hash,
      "--governor_wasm_hash", plan.governor.hash,
    ),
  };
}

const formatCommand = (argv) => `stellar ${argv.join(" ")}`;

/** Lines printed by dry-run: exact hashes and exact commands. */
export function renderDryRun(plan) {
  const commands = buildCommands(plan);
  const lines = [
    "[dry-run] No transactions will be broadcast.",
    `[dry-run] Network: ${plan.network}`,
    `[dry-run] Factory: ${plan.factoryId}`,
    `[dry-run] Identity: ${plan.identity}`,
    `[dry-run] NFT WASM hash: ${plan.nft.hash}`,
    `[dry-run] Governor WASM hash: ${plan.governor.hash}`,
    "[dry-run] Prechecks on --apply:",
    `[dry-run]   ${formatCommand(commands.signerKey)}`,
    `[dry-run]   ${formatCommand(commands.owner)}`,
    `[dry-run]   ${formatCommand(commands.codeHashes)}   (record as rollback values)`,
  ];
  if (commands.uploadNft) lines.push(`[dry-run] Upload: ${formatCommand(commands.uploadNft)}`);
  if (commands.uploadGovernor) {
    lines.push(`[dry-run] Upload: ${formatCommand(commands.uploadGovernor)}`);
  }
  lines.push(`[dry-run] Apply: ${formatCommand(commands.setCodeHashes)}`);
  lines.push(`[dry-run] Verify: ${formatCommand(commands.codeHashes)}`);
  return lines;
}

/** Default command runner: executes the stellar CLI and returns stdout. */
export function runStellar(argv) {
  const result = spawnSync("stellar", argv, { encoding: "utf8" });
  if (result.error) throw new RotationError(`Cannot run stellar CLI: ${result.error.message}`);
  if (result.status !== 0) {
    throw new RotationError(
      `${formatCommand(argv)} failed: ${(result.stderr || result.stdout).trim()}`,
    );
  }
  return result.stdout.trim();
}

/**
 * Apply the rotation: gates, auth check, upload, set_code_hashes, verify.
 * `run` and `log` are injectable for tests.
 */
export function applyRotation(plan, { env = process.env, run = runStellar, log = console.log } = {}) {
  assertMainnetGates(plan, env);
  const commands = buildCommands(plan);

  const signer = run(commands.signerKey).trim();
  const owner = parseOwnerOutput(run(commands.owner));
  assertFactoryAuth(signer, owner);
  log(`Factory owner confirmed: ${owner}`);

  const previous = parseCodeHashesOutput(run(commands.codeHashes));
  log(`Rollback values -> NFT: ${previous.nftHash} Governor: ${previous.governorHash}`);

  if (commands.uploadNft) log(`Uploaded NFT WASM: ${run(commands.uploadNft)}`);
  if (commands.uploadGovernor) log(`Uploaded Governor WASM: ${run(commands.uploadGovernor)}`);

  run(commands.setCodeHashes);

  const current = parseCodeHashesOutput(run(commands.codeHashes));
  if (current.nftHash !== plan.nft.hash || current.governorHash !== plan.governor.hash) {
    throw new RotationError(
      `Verification failed: on-chain hashes (${current.nftHash}, ${current.governorHash}) ` +
        `differ from expected (${plan.nft.hash}, ${plan.governor.hash})`,
    );
  }
  log(`Verified on-chain hashes -> NFT: ${current.nftHash} Governor: ${current.governorHash}`);
  return { previous, current };
}

export function main(argv = process.argv.slice(2), env = process.env) {
  try {
    const options = parseArgs(argv);
    if (options.help) {
      process.stdout.write(HELP_TEXT);
      return 0;
    }
    const plan = buildPlan(options);
    if (!options.apply) {
      renderDryRun(plan).forEach((line) => console.log(line));
      return 0;
    }
    applyRotation(plan, { env });
    return 0;
  } catch (error) {
    if (!(error instanceof RotationError)) throw error;
    console.error(`Error: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
