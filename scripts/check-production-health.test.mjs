import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(
  new URL("./check-production-health.mjs", import.meta.url),
);

const SAMPLE_WALLET_ADDRESS =
  "GD4GQO72YZ6LTEKTLCZRLXB6YKX7WM5NTOJNLXU75PPYRWXWUY23BZ2O";
const SAMPLE_CONTRACT_ADDRESS =
  "CC67AYTYD52YNMSFXUMGGINQPFIZG5M5YELUA36UOKZK5YMOLNE7Y3EH";

function healthyPayload(overrides = {}) {
  return {
    healthy: true,
    status: "healthy",
    reasonCode: null,
    rpc: {
      configured: true,
      validUrl: true,
      latestLedger: 250_000,
      probe: { status: "ok", reasonCode: null, message: null, latencyMs: 12 },
    },
    communityFactory: {
      configured: true,
      validContractId: true,
      paused: false,
      communityCount: 2,
      probe: { status: "ok", reasonCode: null, message: null, latencyMs: 18 },
    },
    registry: {
      configured: true,
      readable: true,
      sampleCount: 1,
      hasNextPage: true,
      malformedRecords: 0,
      probe: { status: "ok", reasonCode: null, message: null, latencyMs: 20 },
    },
    legacyContracts: {
      optional: true,
      configured: false,
      partiallyConfigured: false,
      nftConfigured: false,
      governorConfigured: false,
      validContractIds: false,
      nftReadable: null,
      governorReadable: null,
      probe: {
        status: "skipped",
        reasonCode: "missing_legacy_config",
        message: "Optional legacy single-instance contracts are not configured.",
        latencyMs: null,
      },
    },
    capabilities: {
      rpc: true,
      explorer: true,
      communityFactory: true,
      legacyContracts: false,
      proposalDiscovery: false,
      privilegedWrites: true,
    },
    ...overrides,
  };
}

let server;
let baseUrl;

before(async () => {
  server = http.createServer((request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;

    if (pathname === "/healthy") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(healthyPayload()));
      return;
    }

    if (pathname === "/healthy-unreadable-registry") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify(
          healthyPayload({
            registry: {
              configured: true,
              readable: false,
              sampleCount: null,
              hasNextPage: null,
              malformedRecords: null,
              probe: {
                status: "skipped",
                reasonCode: "factory_unavailable",
                message: "Skipped registry probe.",
                latencyMs: null,
              },
            },
          }),
        ),
      );
      return;
    }

    if (pathname === "/degraded") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify(
          healthyPayload({
            healthy: false,
            status: "degraded",
            reasonCode: "legacy_read_failed",
            legacyContracts: {
              optional: true,
              configured: true,
              partiallyConfigured: false,
              nftConfigured: true,
              governorConfigured: true,
              validContractIds: true,
              nftReadable: false,
              governorReadable: false,
              probe: {
                status: "failed",
                reasonCode: "legacy_read_failed",
                message: "Optional legacy contract read probe failed.",
                latencyMs: 31,
              },
            },
          }),
        ),
      );
      return;
    }

    if (pathname === "/unhealthy-missing-factory") {
      response.writeHead(503, { "content-type": "application/json" });
      response.end(
        JSON.stringify(
          healthyPayload({
            healthy: false,
            status: "unhealthy",
            reasonCode: "missing_factory_config",
            communityFactory: {
              configured: false,
              validContractId: false,
              paused: null,
              communityCount: null,
              probe: {
                status: "skipped",
                reasonCode: "missing_factory_config",
                message: "CommunityFactory contract ID is not configured.",
                latencyMs: null,
              },
            },
            registry: {
              configured: false,
              readable: false,
              sampleCount: null,
              hasNextPage: null,
              malformedRecords: null,
              probe: {
                status: "skipped",
                reasonCode: "missing_factory_config",
                message: "Skipped registry listing probe.",
                latencyMs: null,
              },
            },
          }),
        ),
      );
      return;
    }

    if (pathname === "/unhealthy-rpc") {
      response.writeHead(503, { "content-type": "application/json" });
      response.end(
        JSON.stringify(
          healthyPayload({
            healthy: false,
            status: "unhealthy",
            reasonCode: "rpc_unreachable",
            rpc: {
              configured: true,
              validUrl: true,
              latestLedger: null,
              probe: {
                status: "failed",
                reasonCode: "rpc_unreachable",
                message:
                  `RPC failed at https://rpc-user:rpc-secret@private-rpc.example.com/v1?api_key=LEAKED_KEY&token=LEAKED_TOK for wallet ${SAMPLE_WALLET_ADDRESS} contract ${SAMPLE_CONTRACT_ADDRESS} Authorization: Bearer LEAKED_JWT`,
                latencyMs: 45,
              },
            },
          }),
        ),
      );
      return;
    }

    if (pathname === "/unhealthy-registry") {
      response.writeHead(503, { "content-type": "application/json" });
      response.end(
        JSON.stringify(
          healthyPayload({
            healthy: false,
            status: "unhealthy",
            reasonCode: "registry_read_failed",
            registry: {
              configured: true,
              readable: false,
              sampleCount: null,
              hasNextPage: null,
              malformedRecords: null,
              probe: {
                status: "failed",
                reasonCode: "registry_read_failed",
                message: "Registry list_communities read probe failed.",
                latencyMs: 28,
              },
            },
          }),
        ),
      );
      return;
    }

    if (pathname === "/http-error") {
      response.writeHead(503, { "content-type": "text/plain" });
      response.end("Service Unavailable");
      return;
    }

    if (pathname === "/slow") {
      setTimeout(() => {
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify(healthyPayload()));
      }, 200);
      return;
    }

    response.writeHead(404);
    response.end();
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

function runHealthCheck(environment = {}) {
  const childEnvironment = { ...process.env };
  delete childEnvironment.HEALTH_URL;
  delete childEnvironment.HEALTH_TIMEOUT_MS;
  Object.assign(childEnvironment, environment);

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [scriptPath], {
      env: childEnvironment,
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

test("accepts a healthy payload with readable registry and redacts URL details", async () => {
  const result = await runHealthCheck({
    HEALTH_URL: `${baseUrl}/healthy?token=do-not-log#private`,
  });

  assert.equal(result.code, 0);
  assert.match(result.stdout, /\[health-check\] OK:.*registry readable/);
  assert.doesNotMatch(result.stdout, /do-not-log|private/);
});

test("rejects a healthy status when registry readability is not proven", async () => {
  const result = await runHealthCheck({
    HEALTH_URL: `${baseUrl}/healthy-unreadable-registry`,
  });

  assert.equal(result.code, 1);
  assert.match(
    result.stderr,
    /\[health-check\] PAYLOAD:.*registry readability/,
  );
});

test("classifies a degraded response payload with reason details", async () => {
  const result = await runHealthCheck({
    HEALTH_URL: `${baseUrl}/degraded`,
  });

  assert.equal(result.code, 1);
  assert.match(
    result.stderr,
    /\[health-check\] DEGRADED:.*reason="legacy_read_failed"/,
  );
});

test("distinguishes missing factory config, RPC failure, and registry-read failure on unhealthy responses without leaking secrets or full wallet addresses", async () => {
  const missingFactory = await runHealthCheck({
    HEALTH_URL: `${baseUrl}/unhealthy-missing-factory?api_key=URL_SECRET`,
  });
  assert.equal(missingFactory.code, 1);
  assert.match(
    missingFactory.stderr,
    /\[health-check\] UNHEALTHY:.*HTTP 503.*reason="missing_factory_config"/,
  );
  assert.doesNotMatch(missingFactory.stderr, /URL_SECRET/);

  const rpcFailure = await runHealthCheck({
    HEALTH_URL: `${baseUrl}/unhealthy-rpc?token=QUERY_TOKEN`,
  });
  assert.equal(rpcFailure.code, 1);
  assert.match(
    rpcFailure.stderr,
    /\[health-check\] UNHEALTHY:.*HTTP 503.*reason="rpc_unreachable"/,
  );
  assert.doesNotMatch(
    rpcFailure.stderr,
    /rpc-user|rpc-secret|private-rpc\.example\.com|LEAKED_KEY|LEAKED_TOK|LEAKED_JWT|QUERY_TOKEN/,
  );
  assert.doesNotMatch(rpcFailure.stderr, new RegExp(SAMPLE_WALLET_ADDRESS));
  assert.doesNotMatch(rpcFailure.stderr, new RegExp(SAMPLE_CONTRACT_ADDRESS));
  assert.match(rpcFailure.stderr, /GD4G…BZ2O/);

  const registryFailure = await runHealthCheck({
    HEALTH_URL: `${baseUrl}/unhealthy-registry`,
  });
  assert.equal(registryFailure.code, 1);
  assert.match(
    registryFailure.stderr,
    /\[health-check\] UNHEALTHY:.*HTTP 503.*reason="registry_read_failed"/,
  );
});

test("classifies a non-JSON HTTP error status", async () => {
  const result = await runHealthCheck({
    HEALTH_URL: `${baseUrl}/http-error`,
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /\[health-check\] HTTP:.*HTTP 503/);
});

test("does not expose URL credentials in network failures", async () => {
  const result = await runHealthCheck({
    HEALTH_URL: `http://username:password@127.0.0.1:${server.address().port}/healthy?token=secret`,
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /\[health-check\] NETWORK:/);
  assert.doesNotMatch(result.stderr, /username|password|token|secret/);
});

test("classifies a bounded request timeout", async () => {
  const result = await runHealthCheck({
    HEALTH_URL: `${baseUrl}/slow`,
    HEALTH_TIMEOUT_MS: "25",
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /\[health-check\] TIMEOUT:.*25ms/);
});

test("fails clearly when the target URL is not configured", async () => {
  const result = await runHealthCheck();

  assert.equal(result.code, 1);
  assert.match(result.stderr, /\[health-check\] CONFIGURATION:/);
});
