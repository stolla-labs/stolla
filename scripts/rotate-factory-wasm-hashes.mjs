#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const HEX_64_RE = /^[0-9a-f]{64}$/i;
const CONTRACT_ID_RE = /^C[A-Z2-7]{55}$/;

export function showHelp() {
  return `Usage: rotate-factory-wasm-hashes.mjs [OPTIONS]

Rotate the approved Community NFT and Community Governor WASM hashes stored in
CommunityFactory (set_code_hashes). Defaults to --dry-run unless --apply is set.

Options:
  --factory-id ID             CommunityFactory contract ID (C... 56 chars)
  --nft-wasm-hash HEX         64-character hex SHA-256 hash of uploaded NFT WASM
  --governor-wasm-hash HEX    64-character hex SHA-256 hash of uploaded Governor WASM
  --identity NAME             Stellar CLI source identity (default: deployer)
  --network NET               Target network: testnet | mainnet (default: testnet)
  --dry-run                   Print the stellar CLI invocation without broadcasting (default)
  --apply                     Execute the stellar contract invoke command
  -h, --help                  Show this help message
`;
}

export function parseRotationArgs(argv, env = process.env) {
  const options = {
    factoryId: env.NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID ?? "",
    nftWasmHash: "",
    governorWasmHash: "",
    identity: "deployer",
    network: "testnet",
    mode: "dry-run",
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case "-h":
      case "--help":
        options.help = true;
        break;
      case "--dry-run":
        options.mode = "dry-run";
        break;
      case "--apply":
        options.mode = "apply";
        break;
      case "--factory-id":
        options.factoryId = argv[++i] ?? "";
        break;
      case "--nft-wasm-hash":
        options.nftWasmHash = argv[++i] ?? "";
        break;
      case "--governor-wasm-hash":
        options.governorWasmHash = argv[++i] ?? "";
        break;
      case "--identity":
        options.identity = argv[++i] ?? "";
        break;
      case "--network":
        options.network = argv[++i] ?? "";
        break;
      default:
        throw new Error(`Unknown option '${arg}'`);
    }
  }

  return options;
}

export function validateRotationOptions(options, env = process.env) {
  if (!CONTRACT_ID_RE.test(options.factoryId)) {
    throw new Error(
      `Invalid --factory-id '${options.factoryId}'. Expected a 56-character Soroban contract ID starting with 'C'.`,
    );
  }
  if (!HEX_64_RE.test(options.nftWasmHash)) {
    throw new Error(
      `Invalid --nft-wasm-hash '${options.nftWasmHash}'. Expected a 64-character hex hash.`,
    );
  }
  if (!HEX_64_RE.test(options.governorWasmHash)) {
    throw new Error(
      `Invalid --governor-wasm-hash '${options.governorWasmHash}'. Expected a 64-character hex hash.`,
    );
  }
  if (
    options.nftWasmHash.toLowerCase() === options.governorWasmHash.toLowerCase()
  ) {
    throw new Error(
      "--nft-wasm-hash and --governor-wasm-hash must not be identical.",
    );
  }
  if (!options.identity || !options.identity.trim()) {
    throw new Error("--identity must not be empty.");
  }
  if (options.network !== "testnet" && options.network !== "mainnet") {
    throw new Error(
      `Unsupported --network '${options.network}'. Expected 'testnet' or 'mainnet'.`,
    );
  }
  if (
    options.network === "mainnet" &&
    options.mode === "apply" &&
    env.CONFIRM_MAINNET !== "I_ACKNOWLEDGE_STOLLA_MAINNET"
  ) {
    throw new Error(
      "Refusing mainnet --apply without CONFIRM_MAINNET=I_ACKNOWLEDGE_STOLLA_MAINNET.",
    );
  }
}

export function buildStellarRotationArgs(options) {
  return [
    "contract",
    "invoke",
    "--id",
    options.factoryId,
    "--source-account",
    options.identity,
    "--network",
    options.network,
    "--",
    "set_code_hashes",
    "--nft_wasm_hash",
    options.nftWasmHash.toLowerCase(),
    "--governor_wasm_hash",
    options.governorWasmHash.toLowerCase(),
  ];
}

export function runCli(argv = process.argv.slice(2), env = process.env) {
  const options = parseRotationArgs(argv, env);
  if (options.help) {
    process.stdout.write(showHelp());
    return 0;
  }

  validateRotationOptions(options, env);
  const stellarArgs = buildStellarRotationArgs(options);
  const formattedCommand = `stellar ${stellarArgs.join(" ")}`;

  if (options.mode === "dry-run") {
    process.stdout.write(`[dry-run] ${formattedCommand}\n`);
    process.stdout.write(
      JSON.stringify(
        {
          mode: "dry-run",
          network: options.network,
          factoryId: options.factoryId,
          identity: options.identity,
          nftWasmHash: options.nftWasmHash.toLowerCase(),
          governorWasmHash: options.governorWasmHash.toLowerCase(),
        },
        null,
        2,
      ) + "\n",
    );
    return 0;
  }

  const output = execFileSync("stellar", stellarArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  process.stdout.write(output);
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = runCli();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}
