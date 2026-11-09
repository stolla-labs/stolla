#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const DEFAULT_WASM_DIR = path.join(
  ROOT_DIR,
  "contracts",
  "target",
  "wasm32v1-none",
  "release",
);

function printHelp() {
  console.log(`Usage: rotate-factory-wasm-hashes.mjs [OPTIONS]

Rotate approved Community NFT and Community Governor WASM hashes on CommunityFactory.

Options:
  --factory-id ID             CommunityFactory contract ID (or NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID)
  --nft-wasm PATH             Path to community_nft.wasm to hash/upload
  --governor-wasm PATH        Path to community_governor.wasm to hash/upload
  --nft-wasm-hash HEX         Explicit 64-char hex NFT WASM hash
  --governor-wasm-hash HEX    Explicit 64-char hex Governor WASM hash
  --identity NAME             Stellar CLI identity name (default: deployer)
  --network NET               Stellar network (default: testnet)
  --allow-mainnet             Explicitly allow mainnet execution
  --rpc-url URL               Soroban RPC URL (default: https://soroban-testnet.stellar.org)
  --dry-run                   Print exact args and hashes without submitting transactions (default)
  --apply                     Verify FactoryOwner auth and submit set_code_hashes transaction
  -h, --help                  Show this help message`);
}

export function computeWasmSha256(filePath) {
  const bytes = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export function isValidWasmHash(hash) {
  if (typeof hash !== "string") {
    return false;
  }
  const normalized = hash.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    return false;
  }
  return !/^0{64}$/.test(normalized);
}

export function buildSetCodeHashesArgs({
  factoryId,
  identity,
  network,
  rpcUrl,
  nftWasmHash,
  governorWasmHash,
}) {
  return [
    "contract",
    "invoke",
    "--id",
    factoryId,
    "--source-account",
    identity,
    "--network",
    network,
    "--rpc-url",
    rpcUrl,
    "--",
    "set_code_hashes",
    "--nft_wasm_hash",
    nftWasmHash.toLowerCase(),
    "--governor_wasm_hash",
    governorWasmHash.toLowerCase(),
  ];
}

function runStellar(stellarBin, args) {
  const useNodeRunner = /\.(?:mjs|cjs|js)$/i.test(stellarBin);
  return spawnSync(
    useNodeRunner ? process.execPath : stellarBin,
    useNodeRunner ? [stellarBin, ...args] : args,
    {
      encoding: "utf8",
      env: process.env,
      shell: !useNodeRunner && process.platform === "win32",
    },
  );
}

function cleanAddressOutput(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

async function main() {
  const argv = process.argv.slice(2);
  let factoryId =
    process.env.NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID?.trim() || "";
  let nftWasmPath = "";
  let governorWasmPath = "";
  let nftWasmHash = process.env.NFT_WASM_HASH?.trim() || "";
  let governorWasmHash = process.env.GOVERNOR_WASM_HASH?.trim() || "";
  let identity = process.env.DEPLOYER_IDENTITY?.trim() || "deployer";
  let network = process.env.NEXT_PUBLIC_STELLAR_NETWORK?.trim() || "testnet";
  let rpcUrl =
    process.env.NEXT_PUBLIC_STELLAR_RPC_URL?.trim() ||
    "https://soroban-testnet.stellar.org";
  let dryRun = true;
  let allowMainnet = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      printHelp();
      return;
    } else if (arg === "--factory-id") {
      factoryId = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--nft-wasm") {
      nftWasmPath = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--governor-wasm") {
      governorWasmPath = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--nft-wasm-hash") {
      nftWasmHash = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--governor-wasm-hash") {
      governorWasmHash = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--identity") {
      identity = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--network") {
      network = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--rpc-url") {
      rpcUrl = argv[i + 1] ?? "";
      i += 1;
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--apply") {
      dryRun = false;
    } else if (arg === "--allow-mainnet") {
      allowMainnet = true;
    } else {
      console.error(`[factory-rotate] ARGUMENT_ERROR: unknown option "${arg}"`);
      process.exitCode = 1;
      return;
    }
  }

  const normalizedNetwork = network.trim().toLowerCase();
  if (
    (normalizedNetwork === "mainnet" || normalizedNetwork === "public") &&
    !allowMainnet
  ) {
    console.error(
      "[factory-rotate] MAINNET_GUARD: refusing to rotate hashes on mainnet without --allow-mainnet",
    );
    process.exitCode = 1;
    return;
  }

  if (!factoryId) {
    console.error(
      "[factory-rotate] CONFIGURATION: --factory-id or NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID is required",
    );
    process.exitCode = 1;
    return;
  }

  if (!nftWasmHash && nftWasmPath) {
    nftWasmHash = computeWasmSha256(nftWasmPath);
  } else if (!nftWasmHash) {
    const defaultNftWasm = path.join(DEFAULT_WASM_DIR, "community_nft.wasm");
    if (fs.existsSync(defaultNftWasm)) {
      nftWasmPath = defaultNftWasm;
      nftWasmHash = computeWasmSha256(defaultNftWasm);
    }
  }

  if (!governorWasmHash && governorWasmPath) {
    governorWasmHash = computeWasmSha256(governorWasmPath);
  } else if (!governorWasmHash) {
    const defaultGovWasm = path.join(
      DEFAULT_WASM_DIR,
      "community_governor.wasm",
    );
    if (fs.existsSync(defaultGovWasm)) {
      governorWasmPath = defaultGovWasm;
      governorWasmHash = computeWasmSha256(defaultGovWasm);
    }
  }

  if (!isValidWasmHash(nftWasmHash) || !isValidWasmHash(governorWasmHash)) {
    console.error(
      "[factory-rotate] INVALID_HASH: both NFT and Governor WASM hashes must be non-zero 64-character hex strings",
    );
    process.exitCode = 1;
    return;
  }

  const normalizedNftHash = nftWasmHash.trim().toLowerCase();
  const normalizedGovHash = governorWasmHash.trim().toLowerCase();
  const invokeArgs = buildSetCodeHashesArgs({
    factoryId,
    identity,
    network: normalizedNetwork,
    rpcUrl,
    nftWasmHash: normalizedNftHash,
    governorWasmHash: normalizedGovHash,
  });

  const stellarBin = process.env.STELLAR_BIN?.trim() || "stellar";

  console.log(`[factory-rotate] Factory Contract:   ${factoryId}`);
  console.log(`[factory-rotate] Network:            ${normalizedNetwork}`);
  console.log(`[factory-rotate] Identity:           ${identity}`);
  console.log(`[factory-rotate] NFT WASM Hash:      ${normalizedNftHash}`);
  console.log(`[factory-rotate] Governor WASM Hash: ${normalizedGovHash}`);

  if (dryRun) {
    if (nftWasmPath) {
      console.log(
        `[factory-rotate] DRY_RUN upload NFT: ${stellarBin} contract upload --wasm ${nftWasmPath} --source-account ${identity} --network ${normalizedNetwork}`,
      );
    }
    if (governorWasmPath) {
      console.log(
        `[factory-rotate] DRY_RUN upload Governor: ${stellarBin} contract upload --wasm ${governorWasmPath} --source-account ${identity} --network ${normalizedNetwork}`,
      );
    }
    console.log(
      `[factory-rotate] DRY_RUN invoke: ${stellarBin} ${invokeArgs.join(" ")}`,
    );
    return;
  }

  // Apply mode: 1) verify caller identity matches FactoryOwner before mutating
  const pubKeyRes = runStellar(stellarBin, ["keys", "public-key", identity]);
  if (pubKeyRes.error || pubKeyRes.status !== 0) {
    console.error(
      `[factory-rotate] AUTH_ERROR: could not resolve public key for identity "${identity}"`,
    );
    process.exitCode = 1;
    return;
  }
  const callerAddress = cleanAddressOutput(pubKeyRes.stdout);

  const ownerRes = runStellar(stellarBin, [
    "contract",
    "invoke",
    "--id",
    factoryId,
    "--source-account",
    identity,
    "--network",
    normalizedNetwork,
    "--rpc-url",
    rpcUrl,
    "--",
    "owner",
  ]);
  if (ownerRes.error || ownerRes.status !== 0) {
    console.error(
      `[factory-rotate] AUTH_ERROR: could not read on-chain owner from factory ${factoryId}`,
    );
    process.exitCode = 1;
    return;
  }
  const factoryOwner = cleanAddressOutput(ownerRes.stdout);

  if (!callerAddress || callerAddress !== factoryOwner) {
    console.error(
      `[factory-rotate] AUTH_ERROR: caller ${callerAddress || "(unknown)"} is not factory owner ${factoryOwner || "(unknown)"}`,
    );
    process.exitCode = 1;
    return;
  }

  // 2) Upload WASM files if paths were supplied
  if (nftWasmPath) {
    const uploadNft = runStellar(stellarBin, [
      "contract",
      "upload",
      "--wasm",
      nftWasmPath,
      "--source-account",
      identity,
      "--network",
      normalizedNetwork,
      "--rpc-url",
      rpcUrl,
    ]);
    if (uploadNft.error || uploadNft.status !== 0) {
      console.error("[factory-rotate] UPLOAD_ERROR: failed to upload NFT WASM");
      process.exitCode = 1;
      return;
    }
  }

  if (governorWasmPath) {
    const uploadGov = runStellar(stellarBin, [
      "contract",
      "upload",
      "--wasm",
      governorWasmPath,
      "--source-account",
      identity,
      "--network",
      normalizedNetwork,
      "--rpc-url",
      rpcUrl,
    ]);
    if (uploadGov.error || uploadGov.status !== 0) {
      console.error(
        "[factory-rotate] UPLOAD_ERROR: failed to upload Governor WASM",
      );
      process.exitCode = 1;
      return;
    }
  }

  // 3) Invoke set_code_hashes
  const rotateRes = runStellar(stellarBin, invokeArgs);
  if (rotateRes.error || rotateRes.status !== 0) {
    console.error(
      `[factory-rotate] ROTATE_ERROR: set_code_hashes failed: ${rotateRes.stderr?.trim() || rotateRes.status}`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `[factory-rotate] ROTATED factory=${factoryId} owner=${factoryOwner} nft_wasm_hash=${normalizedNftHash} governor_wasm_hash=${normalizedGovHash}`,
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) ===
    path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  await main();
}
