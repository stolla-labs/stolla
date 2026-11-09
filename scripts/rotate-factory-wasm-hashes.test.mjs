import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildSetCodeHashesArgs,
  computeWasmSha256,
  isValidWasmHash,
} from "./rotate-factory-wasm-hashes.mjs";

const scriptPath = fileURLToPath(
  new URL("./rotate-factory-wasm-hashes.mjs", import.meta.url),
);

const SAMPLE_NFT_HASH =
  "1111111111111111111111111111111111111111111111111111111111111111";
const SAMPLE_GOV_HASH =
  "2222222222222222222222222222222222222222222222222222222222222222";

function runRotate(args = [], env = {}) {
  const childEnv = { ...process.env };
  delete childEnv.NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID;
  delete childEnv.NEXT_PUBLIC_STELLAR_NETWORK;
  delete childEnv.NFT_WASM_HASH;
  delete childEnv.GOVERNOR_WASM_HASH;
  delete childEnv.STELLAR_BIN;
  Object.assign(childEnv, env);

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      env: childEnv,
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

test("validates WASM hashes and computes SHA-256 from WASM files", () => {
  assert.equal(isValidWasmHash(SAMPLE_NFT_HASH), true);
  assert.equal(isValidWasmHash("0".repeat(64)), false);
  assert.equal(isValidWasmHash("not-a-hash"), false);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stolla-wasm-hash-"));
  const wasmFile = path.join(tempDir, "dummy.wasm");
  try {
    fs.writeFileSync(wasmFile, Buffer.from([0x00, 0x61, 0x73, 0x6d]));
    const digest = computeWasmSha256(wasmFile);
    assert.equal(digest.length, 64);
    assert.equal(isValidWasmHash(digest), true);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("buildSetCodeHashesArgs produces exact CommunityFactory set_code_hashes CLI invocation", () => {
  const args = buildSetCodeHashesArgs({
    factoryId: "CFACTORY123",
    identity: "admin",
    network: "testnet",
    rpcUrl: "https://soroban-testnet.stellar.org",
    nftWasmHash: SAMPLE_NFT_HASH,
    governorWasmHash: SAMPLE_GOV_HASH,
  });

  assert.deepEqual(args, [
    "contract",
    "invoke",
    "--id",
    "CFACTORY123",
    "--source-account",
    "admin",
    "--network",
    "testnet",
    "--rpc-url",
    "https://soroban-testnet.stellar.org",
    "--",
    "set_code_hashes",
    "--nft_wasm_hash",
    SAMPLE_NFT_HASH,
    "--governor_wasm_hash",
    SAMPLE_GOV_HASH,
  ]);
});

test("dry-run prints exact args and hashes without invoking stellar CLI", async () => {
  const res = await runRotate(
    [
      "--factory-id",
      "CFACTORY123",
      "--nft-wasm-hash",
      SAMPLE_NFT_HASH,
      "--governor-wasm-hash",
      SAMPLE_GOV_HASH,
      "--dry-run",
    ],
    { STELLAR_BIN: "/nonexistent/stellar-should-not-run" },
  );

  assert.equal(res.code, 0);
  assert.match(res.stdout, new RegExp(`NFT WASM Hash:\\s+${SAMPLE_NFT_HASH}`));
  assert.match(
    res.stdout,
    new RegExp(`Governor WASM Hash:\\s+${SAMPLE_GOV_HASH}`),
  );
  assert.match(
    res.stdout,
    new RegExp(
      `DRY_RUN invoke: .* set_code_hashes --nft_wasm_hash ${SAMPLE_NFT_HASH} --governor_wasm_hash ${SAMPLE_GOV_HASH}`,
    ),
  );
});

test("apply mode refuses when caller lacks factory owner authority and succeeds when authorized", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stolla-rotate-auth-"));
  const fakeStellarJs = path.join(tempDir, "fake-stellar.mjs");

  try {
    fs.writeFileSync(
      fakeStellarJs,
      `
const args = process.argv.slice(2);
if (args[0] === "keys" && args[1] === "public-key") {
  console.log(process.env.MOCK_CALLER_ADDRESS || "GCALLER_UNAUTHORIZED");
  process.exit(0);
}
if (args.includes("owner")) {
  console.log(JSON.stringify(process.env.MOCK_FACTORY_OWNER || "GFACTORY_OWNER"));
  process.exit(0);
}
if (args.includes("set_code_hashes")) {
  console.log("OK");
  process.exit(0);
}
process.exit(1);
`,
      "utf8",
    );

    const unauthorized = await runRotate(
      [
        "--factory-id",
        "CFACTORY123",
        "--nft-wasm-hash",
        SAMPLE_NFT_HASH,
        "--governor-wasm-hash",
        SAMPLE_GOV_HASH,
        "--apply",
      ],
      {
        STELLAR_BIN: fakeStellarJs,
        MOCK_CALLER_ADDRESS: "GCALLER_UNAUTHORIZED",
        MOCK_FACTORY_OWNER: "GFACTORY_OWNER",
      },
    );

    assert.equal(unauthorized.code, 1);
    assert.match(
      unauthorized.stderr,
      /\[factory-rotate\] AUTH_ERROR: caller GCALLER_UNAUTHORIZED is not factory owner GFACTORY_OWNER/,
    );

    const authorized = await runRotate(
      [
        "--factory-id",
        "CFACTORY123",
        "--nft-wasm-hash",
        SAMPLE_NFT_HASH,
        "--governor-wasm-hash",
        SAMPLE_GOV_HASH,
        "--apply",
      ],
      {
        STELLAR_BIN: fakeStellarJs,
        MOCK_CALLER_ADDRESS: "GFACTORY_OWNER",
        MOCK_FACTORY_OWNER: "GFACTORY_OWNER",
      },
    );

    assert.equal(authorized.code, 0, `stderr: ${authorized.stderr}`);
    assert.match(
      authorized.stdout,
      new RegExp(
        `\\[factory-rotate\\] ROTATED factory=CFACTORY123 owner=GFACTORY_OWNER nft_wasm_hash=${SAMPLE_NFT_HASH} governor_wasm_hash=${SAMPLE_GOV_HASH}`,
      ),
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
