#!/usr/bin/env node

import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { Address, Keypair, Networks, StrKey, xdr } from "@stellar/stellar-sdk";

const DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org";
const DEFAULT_EXTEND_TO = 518_400; // 30 days at five seconds per ledger
const DEFAULT_WARNING = 241_920; // 14 days

const usage = `Usage: node apps/web/scripts/contract-ttl-keeper.mjs <list|check|extend> [options]

  --contract LABEL=ID       Repeat for each factory, NFT, or Governor instance
  --network testnet|mainnet  Default: testnet
  --rpc-url URL              Default: public testnet RPC; required for mainnet
  --warning-ledgers N       Alert threshold (default: 241920)
  --extend-to-ledgers N     Target TTL from submission ledger (default: 518400)
  --submit                  Submit extensions; extend is a dry-run by default
  --allow-mainnet           Required with --network mainnet

For --submit, set KEEPER_SECRET_KEY to a funded fee-paying account's secret key.
The key is never accepted as a command-line argument.`;

function positiveInteger(value, name) {
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new Error(`${name} must be a positive integer`);
  }
  return Number(value);
}

export function parseArgs(args) {
  if (args.includes("--help") || args.includes("-h")) return { help: true };
  const [command, ...rest] = args;
  if (!["list", "check", "extend"].includes(command)) throw new Error(usage);

  const options = {
    command,
    contracts: [],
    network: "testnet",
    rpcUrl: undefined,
    warningLedgers: DEFAULT_WARNING,
    extendToLedgers: DEFAULT_EXTEND_TO,
    submit: false,
    allowMainnet: false,
  };
  const labels = new Set();
  const ids = new Set();
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    if (flag === "--submit" || flag === "--allow-mainnet") {
      options[flag === "--submit" ? "submit" : "allowMainnet"] = true;
      continue;
    }
    if (!["--contract", "--network", "--rpc-url", "--warning-ledgers", "--extend-to-ledgers"].includes(flag)) {
      throw new Error(`Unknown option: ${flag}`);
    }
    const value = rest[++i];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`);
    if (flag === "--contract") {
      const match = /^([a-zA-Z][a-zA-Z0-9_-]*)=(C[A-Z2-7]+)$/.exec(value);
      if (!match || !StrKey.isValidContract(match[2])) throw new Error(`Invalid --contract: expected LABEL=valid-contract-ID`);
      if (labels.has(match[1]) || ids.has(match[2])) throw new Error(`Duplicate contract label or ID: ${match[1]}`);
      labels.add(match[1]);
      ids.add(match[2]);
      options.contracts.push({ label: match[1], id: match[2] });
    } else if (flag === "--network") {
      options.network = value;
    } else if (flag === "--rpc-url") {
      options.rpcUrl = value;
    } else if (flag === "--warning-ledgers") {
      options.warningLedgers = positiveInteger(value, flag);
    } else {
      options.extendToLedgers = positiveInteger(value, flag);
    }
  }
  if (options.contracts.length === 0) throw new Error("Specify at least one --contract LABEL=ID");
  if (!["testnet", "mainnet"].includes(options.network)) throw new Error("Only testnet and mainnet are supported");
  if (options.network === "mainnet" && !options.allowMainnet) throw new Error("Mainnet requires --allow-mainnet");
  if (options.network === "mainnet" && !options.rpcUrl) throw new Error("Mainnet requires --rpc-url");
  if (options.submit && command !== "extend") throw new Error("--submit is only valid with extend");
  if (options.warningLedgers >= options.extendToLedgers) throw new Error("--warning-ledgers must be less than --extend-to-ledgers");
  options.rpcUrl ??= DEFAULT_RPC_URL;
  const url = new URL(options.rpcUrl);
  if (url.username || url.password) throw new Error("--rpc-url must not contain credentials");
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) {
    throw new Error("--rpc-url must use HTTPS (HTTP is allowed for localhost only)");
  }
  return options;
}

function instanceKey(id) {
  return xdr.LedgerKey.contractData(new xdr.LedgerKeyContractData({
    contract: new Address(id).toScAddress(),
    key: xdr.ScVal.scvLedgerKeyContractInstance(),
    durability: xdr.ContractDataDurability.persistent(),
  })).toXDR("base64");
}

async function rpcCall(url, method, params) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${method} HTTP ${response.status}`);
  const body = await response.json();
  if (body.error) throw new Error(`${method} RPC error ${body.error.code}: ${body.error.message}`);
  if (!body.result) throw new Error(`${method} returned no result`);
  return body.result;
}

async function runCli(args, input, env = {}) {
  return new Promise((resolve, reject) => {
    // CLI identities and network settings must not silently override the reviewed inputs.
    const childEnv = { ...process.env, ...env };
    delete childEnv.KEEPER_SECRET_KEY;
    for (const name of ["STELLAR_ACCOUNT", "STELLAR_NETWORK", "STELLAR_NETWORK_PASSPHRASE", "STELLAR_RPC_URL", "STELLAR_RPC_HEADERS", "STELLAR_SIGN_WITH_LAB", "STELLAR_SIGN_WITH_LEDGER"]) {
      delete childEnv[name];
    }
    if (!env.STELLAR_SIGN_WITH_KEY) delete childEnv.STELLAR_SIGN_WITH_KEY;
    const child = spawn("stellar", args, { env: childEnv, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve(stdout.trim());
      let safeError = env.STELLAR_SIGN_WITH_KEY
        ? stderr.replaceAll(env.STELLAR_SIGN_WITH_KEY, "[redacted]")
        : stderr;
      const rpcUrlIndex = args.indexOf("--rpc-url");
      const rpcUrl = rpcUrlIndex >= 0 ? args[rpcUrlIndex + 1] : undefined;
      if (rpcUrl) safeError = safeError.replaceAll(rpcUrl, "[rpc-url]");
      reject(new Error(`stellar ${args.slice(0, 2).join(" ")} failed (exit ${code}): ${safeError.trim()}`));
    });
    child.stdin.end(input);
  });
}

async function readHeadroom(options, call) {
  const passphrase = options.network === "testnet" ? Networks.TESTNET : Networks.PUBLIC;
  const network = await call(options.rpcUrl, "getNetwork", {});
  if (network.passphrase !== passphrase) throw new Error(`RPC network does not match ${options.network}`);
  const keys = options.contracts.map(({ id }) => instanceKey(id));
  const [latest, data] = await Promise.all([
    call(options.rpcUrl, "getLatestLedger", {}),
    call(options.rpcUrl, "getLedgerEntries", { keys }),
  ]);
  if (!Number.isSafeInteger(latest.sequence) || !Array.isArray(data.entries)) throw new Error("Invalid ledger response");
  const entries = new Map(data.entries.map((entry) => [entry.key, entry]));
  return options.contracts.map((contract, index) => {
    const liveUntil = entries.get(keys[index])?.liveUntilLedgerSeq;
    if (!Number.isSafeInteger(liveUntil) || liveUntil <= latest.sequence) {
      return { ...contract, liveUntil, headroom: 0, status: "EXPIRED_OR_MISSING" };
    }
    const headroom = liveUntil - latest.sequence;
    return { ...contract, liveUntil, headroom, status: headroom <= options.warningLedgers ? "WARN" : "OK" };
  });
}

export async function runKeeper(args, { call = rpcCall, cli = runCli, env = process.env, log = console.log } = {}) {
  const options = parseArgs(args);
  if (options.help) { log(usage); return 0; }
  if (options.command === "list") {
    for (const { label, id } of options.contracts) log(`${label}: ${id}`);
    return 0;
  }
  const rows = await readHeadroom(options, call);
  for (const row of rows) log(`${row.label} ${row.id}: ${row.status}; live until ${row.liveUntil ?? "unknown"}; headroom ${row.headroom} ledgers`);
  if (options.command === "check") return rows.some((row) => row.status !== "OK") ? 1 : 0;

  const candidates = rows.filter((row) => row.status === "WARN");
  if (rows.some((row) => row.status === "EXPIRED_OR_MISSING")) {
    throw new Error("An instance is expired or missing; restore or investigate before extending");
  }
  if (!options.submit) {
    for (const row of candidates) log(`[dry-run] Would extend ${row.label} to at least ${options.extendToLedgers} ledgers of headroom`);
    if (!candidates.length) log("[dry-run] No instance needs extension");
    return 0;
  }
  if (!candidates.length) { log("No instance needs extension"); return 0; }
  let signer;
  try { signer = Keypair.fromSecret(env.KEEPER_SECRET_KEY ?? ""); } catch { throw new Error("Set a valid KEEPER_SECRET_KEY for --submit"); }
  const passphrase = options.network === "testnet" ? Networks.TESTNET : Networks.PUBLIC;
  for (const row of candidates) {
    const common = ["--rpc-url", options.rpcUrl, "--network-passphrase", passphrase];
    const unsigned = await cli(["contract", "extend", "--id", row.id, "--ledgers-to-extend", String(options.extendToLedgers), "--source-account", signer.publicKey(), ...common, "--build-only"]);
    const signed = await cli(["tx", "sign", ...common], unsigned, { STELLAR_SIGN_WITH_KEY: env.KEEPER_SECRET_KEY });
    const hash = await cli(["tx", "hash", ...common], signed);
    if (!/^[a-f0-9]{64}$/i.test(hash)) throw new Error(`Unable to determine transaction hash for ${row.label}`);
    try {
      await cli(["tx", "send", ...common], signed);
    } catch (error) {
      throw new Error(`${row.label} transaction ${hash} may have been submitted: ${error.message}`);
    }
    log(`${row.label}: submitted transaction ${hash}`);
    const refreshed = (await readHeadroom({ ...options, contracts: [row] }, call))[0];
    if (refreshed.status === "EXPIRED_OR_MISSING" || refreshed.headroom <= row.headroom) {
      throw new Error(`${row.label} transaction ${hash} did not increase instance TTL; investigate before retrying`);
    }
    log(`${row.label}: new headroom ${refreshed.headroom} ledgers`);
  }
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runKeeper(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(`TTL keeper: ${error.message}`);
    process.exitCode = 1;
  });
}
