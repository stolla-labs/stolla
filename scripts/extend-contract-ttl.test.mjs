import assert from "node:assert/strict";
import http from "node:http";
import { after, before, test } from "node:test";
import { runKeeper } from "./extend-contract-ttl.mjs";

const SAMPLE_CONTRACT = `C${"A".repeat(55)}`;

let server;
let rpcUrl;
let extendCalls = 0;

before(async () => {
  server = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body || "{}");

    if (payload.method === "getLatestLedger") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { sequence: 1000 } }));
      return;
    }

    if (payload.method === "getContractTtl") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: { liveUntilLedgerSeq: 15_000 },
        }),
      );
      return;
    }

    if (payload.method === "extendInstanceTtl") {
      extendCalls += 1;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: { txHash: "tx_abc1234567890" },
        }),
      );
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  rpcUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

test("dry-run default reports TTL headroom and never submits transactions (#393)", async () => {
  extendCalls = 0;
  const logs = [];
  const errors = [];

  const code = await runKeeper({
    argv: ["--contracts", SAMPLE_CONTRACT],
    env: { SOROBAN_RPC_URL: rpcUrl, STELLAR_NETWORK: "testnet" },
    stdout: (msg) => logs.push(msg),
    stderr: (msg) => errors.push(msg),
  });

  assert.equal(code, 0);
  assert.equal(errors.length, 0);
  assert.equal(extendCalls, 0);
  assert.match(logs.join("\n"), /mode=dry-run/);
});

test("extend mode submits renewal and logs txHash (#393)", async () => {
  extendCalls = 0;
  const logs = [];

  const code = await runKeeper({
    argv: ["--extend", "--contracts", SAMPLE_CONTRACT],
    env: { SOROBAN_RPC_URL: rpcUrl, STELLAR_NETWORK: "testnet" },
    stdout: (msg) => logs.push(msg),
    stderr: () => {},
  });

  assert.equal(code, 0);
  assert.equal(extendCalls, 1);
  assert.match(logs.join("\n"), /EXTENDED.*txHash=tx_abc1234567890/);
});

test("refuses mainnet execution without --allow-mainnet flag (#393)", async () => {
  const errors = [];
  const code = await runKeeper({
    argv: ["--extend", "--contracts", SAMPLE_CONTRACT],
    env: { SOROBAN_RPC_URL: rpcUrl, STELLAR_NETWORK: "mainnet" },
    stdout: () => {},
    stderr: (msg) => errors.push(msg),
  });

  assert.equal(code, 1);
  assert.match(errors.join("\n"), /--allow-mainnet/);
});
