import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildStellarRotationArgs,
  parseRotationArgs,
  validateRotationOptions,
} from "./rotate-factory-wasm-hashes.mjs";

const scriptPath = fileURLToPath(
  new URL("./rotate-factory-wasm-hashes.mjs", import.meta.url),
);

const VALID_FACTORY =
  "CC67AYTYD52YNMSFXUMGGINQPFIZG5M5YELUA36UOKZK5YMOLNE7Y3EH";
const VALID_NFT_HASH =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const VALID_GOV_HASH =
  "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";

function runScript(args = [], env = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("prints usage help with --help", async () => {
  const res = await runScript(["--help"]);
  assert.equal(res.code, 0);
  assert.match(res.stdout, /Usage: rotate-factory-wasm-hashes\.mjs/);
  assert.match(res.stdout, /--nft-wasm-hash HEX/);
  assert.match(res.stdout, /--governor-wasm-hash HEX/);
});

test("defaults to --dry-run and prints exact stellar contract invoke command", async () => {
  const res = await runScript([
    "--factory-id",
    VALID_FACTORY,
    "--nft-wasm-hash",
    VALID_NFT_HASH,
    "--governor-wasm-hash",
    VALID_GOV_HASH,
    "--identity",
    "ops-owner",
  ]);

  assert.equal(res.code, 0);
  assert.match(
    res.stdout,
    /\[dry-run\] stellar contract invoke --id CC67AYTYD52YNMSFXUMGGINQPFIZG5M5YELUA36UOKZK5YMOLNE7Y3EH --source-account ops-owner --network testnet -- set_code_hashes --nft_wasm_hash 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef --governor_wasm_hash fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210/,
  );
});

test("rejects malformed hashes, identical hashes, and unconfirmed mainnet apply", () => {
  assert.throws(
    () =>
      validateRotationOptions(
        parseRotationArgs([
          "--factory-id",
          VALID_FACTORY,
          "--nft-wasm-hash",
          "short",
          "--governor-wasm-hash",
          VALID_GOV_HASH,
        ]),
      ),
    /Invalid --nft-wasm-hash/,
  );

  assert.throws(
    () =>
      validateRotationOptions(
        parseRotationArgs([
          "--factory-id",
          VALID_FACTORY,
          "--nft-wasm-hash",
          VALID_NFT_HASH,
          "--governor-wasm-hash",
          VALID_NFT_HASH,
        ]),
      ),
    /must not be identical/,
  );

  assert.throws(
    () =>
      validateRotationOptions(
        parseRotationArgs([
          "--factory-id",
          VALID_FACTORY,
          "--nft-wasm-hash",
          VALID_NFT_HASH,
          "--governor-wasm-hash",
          VALID_GOV_HASH,
          "--network",
          "mainnet",
          "--apply",
        ]),
        {},
      ),
    /Refusing mainnet --apply without CONFIRM_MAINNET=I_ACKNOWLEDGE_STOLLA_MAINNET/,
  );

  const args = buildStellarRotationArgs(
    parseRotationArgs([
      "--factory-id",
      VALID_FACTORY,
      "--nft-wasm-hash",
      VALID_NFT_HASH.toUpperCase(),
      "--governor-wasm-hash",
      VALID_GOV_HASH,
    ]),
  );
  assert.ok(args.includes(VALID_NFT_HASH));
});
