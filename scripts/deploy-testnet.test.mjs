import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
  new URL("./deploy-testnet.sh", import.meta.url),
);

function runDeployScript(args = [], env = {}) {
  return new Promise((resolve) => {
    const child = spawn("bash", [scriptPath, ...args], {
      env: {
        ...process.env,
        ...env,
      },
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

test("shows usage help with --help", async () => {
  const result = await runDeployScript(["--help"]);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /Usage: deploy-testnet\.sh \[IDENTITY\] \[OPTIONS\]/);
  assert.match(result.stdout, /--dry-run/);
  assert.match(result.stdout, /--network NET/);
  assert.match(result.stdout, /--rpc-url URL/);
});

test("dry-run generates complete CLI commands and outputs contract IDs, WASM hashes, and explorer links", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stolla-deploy-test-"));
  const tempEnvFile = path.join(tempDir, ".env.local");

  try {
    const result = await runDeployScript(["--dry-run"], {
      ENV_FILE: tempEnvFile,
    });

    assert.equal(result.code, 0);

    // Identity and build
    assert.match(result.stdout, /\[dry-run\] Using deployer identity 'deployer'/);
    assert.match(result.stdout, /stellar contract build/);

    // Upload WASM commands
    assert.match(
      result.stdout,
      /stellar contract upload --wasm .*community_nft\.wasm --source-account deployer --network testnet/,
    );
    assert.match(
      result.stdout,
      /stellar contract upload --wasm .*community_governor\.wasm --source-account deployer --network testnet/,
    );

    // Deploy CommunityFactory command with owner and WASM hashes
    assert.match(
      result.stdout,
      /stellar contract deploy --wasm .*community_factory\.wasm --source-account deployer --network testnet -- --owner .* --nft_wasm_hash .* --governor_wasm_hash .*/,
    );

    // Summary section
    assert.match(result.stdout, /Stolla Testnet Deployment Complete/);
    assert.match(result.stdout, /NFT WASM Hash:/);
    assert.match(result.stdout, /Governor WASM Hash:/);
    assert.match(result.stdout, /CommunityFactory:\s+CFACTORY/);
    assert.match(result.stdout, /Community NFT:\s+CNFT/);
    assert.match(result.stdout, /Community Governor:\s+CGOV/);
    assert.match(result.stdout, /Deploy Ledger:\s+\d+/);

    // Explorer links
    assert.match(result.stdout, /https:\/\/stellar\.expert\/explorer\/testnet\/contract\/CFACTORY/);
    assert.match(result.stdout, /https:\/\/stellar\.expert\/explorer\/testnet\/contract\/CNFT/);
    assert.match(result.stdout, /https:\/\/stellar\.expert\/explorer\/testnet\/contract\/CGOV/);
    assert.match(result.stdout, /https:\/\/stellar\.expert\/explorer\/testnet\/account\//);

    // Environment file written
    assert.equal(fs.existsSync(tempEnvFile), true);
    const envContent = fs.readFileSync(tempEnvFile, "utf8");
    assert.match(envContent, /NEXT_PUBLIC_STELLAR_NETWORK=testnet/);
    assert.match(envContent, /NEXT_PUBLIC_STELLAR_RPC_URL=https:\/\/soroban-testnet\.stellar\.org/);
    assert.match(envContent, /NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID=CFACTORY/);
    assert.match(envContent, /NEXT_PUBLIC_NFT_CONTRACT_ID=CNFT/);
    assert.match(envContent, /NEXT_PUBLIC_GOVERNOR_CONTRACT_ID=CGOV/);
    assert.match(envContent, /NEXT_PUBLIC_GOVERNOR_START_LEDGER=\d+/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("dry-run supports custom identity argument in CLI arguments", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stolla-deploy-test-"));
  const tempEnvFile = path.join(tempDir, ".env.local");

  try {
    const result = await runDeployScript(["my-custom-deployer", "--dry-run"], {
      ENV_FILE: tempEnvFile,
    });

    assert.equal(result.code, 0);
    assert.match(result.stdout, /\[dry-run\] Using deployer identity 'my-custom-deployer'/);
    assert.match(result.stdout, /--source-account my-custom-deployer/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("preserves unrelated existing variables and comments in .env.local", async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "stolla-deploy-test-"));
  const tempEnvFile = path.join(tempDir, ".env.local");

  try {
    const initialEnv = [
      "# Custom comments that must stay",
      "CUSTOM_SECRET_KEY=keep_this_unaltered",
      "NEXT_PUBLIC_IPFS_GATEWAY_URL=https://custom-gateway.io/ipfs/",
      "NEXT_PUBLIC_NFT_CONTRACT_ID=OLD_NFT_ID",
      "# End of config",
    ].join("\n");
    fs.writeFileSync(tempEnvFile, initialEnv, "utf8");

    const result = await runDeployScript(["--dry-run"], {
      ENV_FILE: tempEnvFile,
    });

    assert.equal(result.code, 0);
    const updatedContent = fs.readFileSync(tempEnvFile, "utf8");

    // Existing unrelated variables and comments preserved
    assert.match(updatedContent, /# Custom comments that must stay/);
    assert.match(updatedContent, /CUSTOM_SECRET_KEY=keep_this_unaltered/);
    assert.match(updatedContent, /NEXT_PUBLIC_IPFS_GATEWAY_URL=https:\/\/custom-gateway\.io\/ipfs\//);
    assert.match(updatedContent, /# End of config/);

    // Managed variables updated in-place or added
    assert.match(updatedContent, /NEXT_PUBLIC_NFT_CONTRACT_ID=CNFT/);
    assert.doesNotMatch(updatedContent, /OLD_NFT_ID/);
    assert.match(updatedContent, /NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID=CFACTORY/);
    assert.match(updatedContent, /NEXT_PUBLIC_GOVERNOR_CONTRACT_ID=CGOV/);
    assert.match(updatedContent, /NEXT_PUBLIC_GOVERNOR_START_LEDGER=1500000/);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("fails with non-zero exit code on unknown options", async () => {
  const result = await runDeployScript(["--invalid-flag"]);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /Unknown option '--invalid-flag'/);
});
