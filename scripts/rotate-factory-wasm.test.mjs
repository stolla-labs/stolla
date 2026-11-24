import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  RotationError,
  applyRotation,
  buildCommands,
  buildPlan,
  computeWasmHash,
  normalizeHash,
  parseArgs,
  parseCodeHashesOutput,
  parseOwnerOutput,
} from "./rotate-factory-wasm.mjs";

const scriptPath = fileURLToPath(new URL("./rotate-factory-wasm.mjs", import.meta.url));
const FACTORY_ID = "CC67AYTYD52YNMSFXUMGGINQPFIZG5M5YELUA36UOKZK5YMOLNE7Y3EH";
const OWNER = "GA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJVSGZ";
const OTHER = "GDRXE2BQUC3AZNPVFSCEZ76NJ3WWL25FYFK6RGZGIEKWE4SOOHSUJUJ6";
const NFT_HASH = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const GOV_HASH = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
const OLD_NFT = "a".repeat(64);
const OLD_GOV = "b".repeat(64);

const baseArgs = [
  "--factory-id", FACTORY_ID,
  "--identity", "operator",
  "--nft-hash", NFT_HASH,
  "--governor-hash", GOV_HASH,
];

function runCli(args, env = {}) {
  return spawnSync("node", [scriptPath, ...args], {
    encoding: "utf8",
    env: { ...process.env, MAINNET_CHANGE_ID: "", CONFIRM_MAINNET: "", ...env },
  });
}

/** Fake stellar CLI keyed on the invoked function name. */
function fakeRunner({ signer = OWNER, owner = OWNER, afterHashes } = {}) {
  const calls = [];
  let rotated = false;
  const run = (argv) => {
    calls.push(argv);
    if (argv[0] === "keys") return signer;
    if (argv.includes("owner")) return JSON.stringify(owner);
    if (argv.includes("set_code_hashes")) {
      rotated = true;
      return "null";
    }
    if (argv.includes("code_hashes")) {
      return rotated
        ? JSON.stringify(afterHashes ?? [NFT_HASH, GOV_HASH])
        : JSON.stringify([OLD_NFT, OLD_GOV]);
    }
    if (argv[1] === "upload") return `${NFT_HASH}`;
    throw new Error(`unexpected command ${argv.join(" ")}`);
  };
  return { run, calls };
}

test("computeWasmHash matches the known sha256 of raw bytes", () => {
  assert.equal(
    computeWasmHash(Buffer.from("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("normalizeHash lowercases and rejects bad or zero hashes", () => {
  assert.equal(normalizeHash(NFT_HASH.toUpperCase(), "h"), NFT_HASH);
  assert.throws(() => normalizeHash("abc", "h"), RotationError);
  assert.throws(() => normalizeHash("g".repeat(64), "h"), RotationError);
  assert.throws(() => normalizeHash("0".repeat(64), "h"), /all-zero/);
});

test("parseOwnerOutput and parseCodeHashesOutput parse CLI output", () => {
  assert.equal(parseOwnerOutput(`"${OWNER}"\n`), OWNER);
  assert.throws(() => parseOwnerOutput("nope"), RotationError);
  assert.deepEqual(parseCodeHashesOutput(JSON.stringify([OLD_NFT, OLD_GOV])), {
    nftHash: OLD_NFT,
    governorHash: OLD_GOV,
  });
  assert.throws(() => parseCodeHashesOutput("[]"), RotationError);
  assert.throws(() => parseCodeHashesOutput("not json"), RotationError);
});

test("parseArgs rejects unknown flags and missing values", () => {
  assert.throws(() => parseArgs(["--bogus"]), /Unknown option/);
  assert.throws(() => parseArgs(["--factory-id"]), /Missing value/);
  assert.equal(parseArgs(["--apply"]).apply, true);
  assert.equal(parseArgs([]).apply, false);
});

test("buildPlan hashes WASM files and validates inputs", () => {
  const plan = buildPlan(
    { ...parseArgs(["--factory-id", FACTORY_ID, "--identity", "op",
      "--nft-wasm", "nft.wasm", "--governor-hash", GOV_HASH]) },
    () => Buffer.from("abc"),
  );
  assert.equal(plan.nft.hash, computeWasmHash(Buffer.from("abc")));
  assert.equal(plan.nft.wasmPath, "nft.wasm");
  assert.equal(plan.governor.wasmPath, null);

  assert.throws(() => buildPlan(parseArgs(baseArgs.slice(2))), /factory-id/);
  assert.throws(
    () => buildPlan(parseArgs([...baseArgs, "--network", "futurenet"])),
    /unknown network/,
  );
  assert.throws(
    () => buildPlan(parseArgs([...baseArgs, "--nft-wasm", "x.wasm"])),
    /not both/,
  );
  assert.throws(
    () => buildPlan(parseArgs(["--factory-id", FACTORY_ID, "--identity", "op"])),
    /Provide --nft-wasm/,
  );
});

test("buildCommands produces exact set_code_hashes arguments", () => {
  const commands = buildCommands(buildPlan(parseArgs(baseArgs)));
  assert.deepEqual(commands.setCodeHashes, [
    "contract", "invoke", "--id", FACTORY_ID,
    "--source-account", "operator", "--network", "testnet", "--send=yes",
    "--", "set_code_hashes",
    "--nft_wasm_hash", NFT_HASH, "--governor_wasm_hash", GOV_HASH,
  ]);
  assert.equal(commands.uploadNft, null);
});

test("--help prints usage", () => {
  const result = runCli(["--help"]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage: rotate-factory-wasm\.mjs/);
  assert.match(result.stdout, /--apply/);
});

test("dry-run (default) prints exact hashes and args without broadcasting", () => {
  const result = runCli(baseArgs);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, new RegExp(`NFT WASM hash: ${NFT_HASH}`));
  assert.match(result.stdout, new RegExp(`Governor WASM hash: ${GOV_HASH}`));
  assert.match(
    result.stdout,
    new RegExp(`stellar contract invoke --id ${FACTORY_ID} .* -- set_code_hashes --nft_wasm_hash ${NFT_HASH} --governor_wasm_hash ${GOV_HASH}`),
  );
  assert.match(result.stdout, /No transactions will be broadcast/);
});

test("invalid input exits non-zero with an error", () => {
  const result = runCli(["--factory-id", "bad", "--identity", "op"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Error: --factory-id/);
});

test("apply refuses when the signer is not the factory owner", () => {
  const plan = buildPlan(parseArgs(baseArgs));
  const { run, calls } = fakeRunner({ signer: OTHER });
  assert.throws(
    () => applyRotation(plan, { env: {}, run, log: () => {} }),
    /not the factory owner/,
  );
  assert.ok(!calls.some((argv) => argv.includes("set_code_hashes")));
});

test("apply rotates, records rollback values, and verifies on-chain hashes", () => {
  const plan = buildPlan(parseArgs(baseArgs));
  const { run, calls } = fakeRunner();
  const logs = [];
  const result = applyRotation(plan, { env: {}, run, log: (l) => logs.push(l) });
  assert.deepEqual(result.previous, { nftHash: OLD_NFT, governorHash: OLD_GOV });
  assert.ok(logs.some((l) => l.includes(OLD_NFT) && l.includes("Rollback")));
  assert.equal(calls.filter((argv) => argv.includes("set_code_hashes")).length, 1);
});

test("apply fails when on-chain hashes differ after rotation", () => {
  const plan = buildPlan(parseArgs(baseArgs));
  const { run } = fakeRunner({ afterHashes: [OLD_NFT, OLD_GOV] });
  assert.throws(() => applyRotation(plan, { env: {}, run, log: () => {} }), /Verification failed/);
});

test("mainnet apply requires change ID and exact confirmation", () => {
  const plan = buildPlan(parseArgs([...baseArgs, "--network", "mainnet"]));
  const { run, calls } = fakeRunner();
  assert.throws(() => applyRotation(plan, { env: {}, run, log: () => {} }), /MAINNET_CHANGE_ID/);
  assert.throws(
    () => applyRotation(plan, { env: { MAINNET_CHANGE_ID: "CHG-1", CONFIRM_MAINNET: "yes" }, run, log: () => {} }),
    /CONFIRM_MAINNET/,
  );
  assert.equal(calls.length, 0);
  applyRotation(plan, {
    env: { MAINNET_CHANGE_ID: "CHG-1", CONFIRM_MAINNET: "I_ACKNOWLEDGE_STOLLA_MAINNET" },
    run,
    log: () => {},
  });
});
