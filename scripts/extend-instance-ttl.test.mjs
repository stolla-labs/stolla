import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  ONE_DAY_LEDGERS,
  THIRTY_DAYS_LEDGERS,
  evaluateTtlHeadroom,
  extractTxHash,
} from "./extend-instance-ttl.mjs";

const scriptPath = fileURLToPath(
  new URL("./extend-instance-ttl.mjs", import.meta.url),
);

function runKeeper(args = [], env = {}) {
  const childEnv = { ...process.env };
  delete childEnv.NEXT_PUBLIC_STELLAR_NETWORK;
  delete childEnv.NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID;
  delete childEnv.NEXT_PUBLIC_NFT_CONTRACT_ID;
  delete childEnv.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID;
  delete childEnv.KEEPER_CONTRACT_IDS;
  delete childEnv.MOCK_CURRENT_LEDGER;
  delete childEnv.MOCK_LIVE_UNTIL_LEDGER;
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

test("evaluateTtlHeadroom classifies healthy, renew-now, and expired windows", () => {
  const healthy = evaluateTtlHeadroom(1_000_000, 1_000_000 + THIRTY_DAYS_LEDGERS);
  assert.equal(healthy.status, "HEALTHY");
  assert.equal(healthy.needsExtension, false);

  const renewBoundary = evaluateTtlHeadroom(
    1_000_000,
    1_000_000 + ONE_DAY_LEDGERS,
  );
  assert.equal(renewBoundary.status, "RENEW_NOW");
  assert.equal(renewBoundary.needsExtension, true);

  const expired = evaluateTtlHeadroom(1_000_000, 999_990);
  assert.equal(expired.status, "EXPIRED");
  assert.equal(expired.needsExtension, true);
});

test("extractTxHash parses 64-char hex transaction hashes from CLI output", () => {
  const sampleHash =
    "a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0";
  assert.equal(
    extractTxHash(`Signing transaction...\nTransaction hash: ${sampleHash}\nDone`),
    sampleHash,
  );
});

test("--list and --check report configured contracts and TTL headroom", async () => {
  const env = {
    NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID: "CFACTORY111",
    NEXT_PUBLIC_NFT_CONTRACT_ID: "CNFT222",
    NEXT_PUBLIC_GOVERNOR_CONTRACT_ID: "CGOV333",
    MOCK_CURRENT_LEDGER: "1500000",
    MOCK_LIVE_UNTIL_LEDGER: "1510000",
  };

  const listRes = await runKeeper(["--list"], env);
  assert.equal(listRes.code, 0);
  assert.match(listRes.stdout, /LIST CommunityFactory: CFACTORY111/);
  assert.match(listRes.stdout, /LIST CommunityNFT: CNFT222/);
  assert.match(listRes.stdout, /LIST CommunityGovernor: CGOV333/);

  const checkRes = await runKeeper(["--check"], env);
  assert.equal(checkRes.code, 0);
  assert.match(
    checkRes.stdout,
    /CHECK CommunityFactory \(CFACTORY111\): status=RENEW_NOW currentLedger=1500000 liveUntil=1510000 remainingLedgers=10000/,
  );
});

test("--extend defaults to dry-run and never invokes the stellar binary", async () => {
  const res = await runKeeper(["--extend"], {
    NEXT_PUBLIC_NFT_CONTRACT_ID: "CNFT222",
    STELLAR_BIN: "/nonexistent/stellar-binary-should-not-run",
  });

  assert.equal(res.code, 0);
  assert.match(
    res.stdout,
    /\[ttl-keeper\] DRY_RUN CommunityNFT \(CNFT222\): .* contract invoke --id CNFT222 .* -- extend_instance_ttl/,
  );
});

test("--extend --apply invokes stellar CLI and logs transaction hashes", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stolla-ttl-keeper-"));
  const fakeStellarJs = path.join(tempDir, "fake-stellar.mjs");
  const expectedHash =
    "f0e1d2c3b4a5968778695a4b3c2d1e0f0123456789abcdef0123456789abcdef";

  try {
    fs.writeFileSync(
      fakeStellarJs,
      `console.log("Transaction hash: ${expectedHash}");\n`,
      "utf8",
    );

    const res = await runKeeper(
      ["--extend", "--apply", "--contracts", "CFACTORY111,CNFT222"],
      { STELLAR_BIN: fakeStellarJs },
    );

    assert.equal(res.code, 0, `stderr: ${res.stderr}`);
    assert.match(
      res.stdout,
      new RegExp(
        `\\[ttl-keeper\\] EXTENDED contract_1 \\(CFACTORY111\\) network=testnet txHash=${expectedHash}`,
      ),
    );
    assert.match(
      res.stdout,
      new RegExp(
        `\\[ttl-keeper\\] EXTENDED contract_2 \\(CNFT222\\) network=testnet txHash=${expectedHash}`,
      ),
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("refuses mainnet without --allow-mainnet and permits with --allow-mainnet", async () => {
  const blocked = await runKeeper(["--list", "--network", "mainnet"], {
    NEXT_PUBLIC_NFT_CONTRACT_ID: "CNFT222",
  });
  assert.equal(blocked.code, 1);
  assert.match(blocked.stderr, /MAINNET_GUARD/);

  const allowed = await runKeeper(
    ["--list", "--network", "mainnet", "--allow-mainnet"],
    { NEXT_PUBLIC_NFT_CONTRACT_ID: "CNFT222" },
  );
  assert.equal(allowed.code, 0);
  assert.match(allowed.stdout, /LIST CommunityNFT: CNFT222 \(network=mainnet\)/);
});
