import assert from "node:assert/strict";
import { test } from "node:test";
import { Keypair, Networks } from "@stellar/stellar-sdk";
import { parseArgs, runKeeper } from "./contract-ttl-keeper.mjs";

const id = "CBCBTZM3NF4EF47LFJLELVTN5KKIZG6LM6JWPCBBMXUGMQJJZRRMLHOK";
const args = ["--contract", `governor=${id}`];

function fakeRpc(liveUntil, calls = []) {
  return async (_url, method, params) => {
    calls.push(method);
    if (method === "getNetwork") return { passphrase: Networks.TESTNET };
    if (method === "getLatestLedger") return { sequence: 1_000_000 };
    if (method === "getLedgerEntries") return { entries: [{ key: params.keys[0], liveUntilLedgerSeq: typeof liveUntil === "function" ? liveUntil() : liveUntil }] };
    throw new Error(`Unexpected RPC method ${method}`);
  };
}

test("list does not contact RPC or submit", async () => {
  const output = [];
  const code = await runKeeper(["list", ...args], {
    call: () => { throw new Error("RPC called"); },
    cli: () => { throw new Error("CLI called"); },
    log: (line) => output.push(line),
  });
  assert.equal(code, 0);
  assert.deepEqual(output, [`governor: ${id}`]);
});

test("extend defaults to dry-run and never calls the CLI", async () => {
  const output = [];
  const code = await runKeeper(["extend", ...args], {
    call: fakeRpc(1_010_000),
    cli: () => { throw new Error("CLI called"); },
    log: (line) => output.push(line),
  });
  assert.equal(code, 0);
  assert.match(output.join("\n"), /\[dry-run\] Would extend governor/);
});

test("check alerts on low or missing TTL", async () => {
  assert.equal(await runKeeper(["check", ...args], { call: fakeRpc(1_010_000), log: () => {} }), 1);
  assert.equal(await runKeeper(["check", ...args], { call: fakeRpc(0), log: () => {} }), 1);
  assert.equal(await runKeeper(["check", ...args], { call: fakeRpc(1_500_000), log: () => {} }), 0);
});

test("submit signs, sends, reports hash, and verifies increased TTL", async () => {
  const signer = Keypair.random();
  const calls = [];
  const output = [];
  let reads = 0;
  const hash = "a".repeat(64);
  const code = await runKeeper(["extend", ...args, "--submit"], {
    env: { KEEPER_SECRET_KEY: signer.secret() },
    call: fakeRpc(() => (++reads === 1 ? 1_010_000 : 1_518_400)),
    cli: async (argv, input, childEnv) => {
      calls.push({ argv, input, childEnv });
      if (argv[0] === "contract") return "unsigned-xdr";
      if (argv[1] === "sign") return "signed-xdr";
      if (argv[1] === "hash") return hash;
      if (argv[1] === "send") return "success";
      throw new Error("Unexpected CLI call");
    },
    log: (line) => output.push(line),
  });
  assert.equal(code, 0);
  assert.deepEqual(calls.map(({ argv }) => argv.slice(0, 2)), [["contract", "extend"], ["tx", "sign"], ["tx", "hash"], ["tx", "send"]]);
  assert.ok(calls.every(({ argv }) => argv.includes("--rpc-url") && argv.includes("--network-passphrase")));
  assert.ok(calls.every(({ argv }) => !argv.includes(signer.secret())));
  assert.equal(calls[1].childEnv.STELLAR_SIGN_WITH_KEY, signer.secret());
  assert.match(output.join("\n"), new RegExp(`submitted transaction ${hash}`));
});

test("rejects network mismatch and mainnet without explicit flag", async () => {
  assert.throws(() => parseArgs(["extend", ...args, "--network", "mainnet"]), /--allow-mainnet/);
  assert.throws(() => parseArgs(["extend", ...args, "--network", "mainnet", "--allow-mainnet"]), /--rpc-url/);
  await assert.rejects(() => runKeeper(["extend", ...args], {
    call: async () => ({ passphrase: Networks.PUBLIC }),
    cli: () => { throw new Error("CLI called"); },
    log: () => {},
  }), /RPC network does not match testnet/);
});
