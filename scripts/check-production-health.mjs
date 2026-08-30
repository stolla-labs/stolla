#!/usr/bin/env node

const DEFAULT_TIMEOUT_MS = 10_000;

function fail(failureClass, url, message) {
  console.error(`[health-check] ${failureClass}: ${url} — ${message}`);
  process.exitCode = 1;
}

function safeDisplayUrl(url) {
  const displayUrl = new URL(url);
  displayUrl.username = "";
  displayUrl.password = "";
  displayUrl.search = "";
  displayUrl.hash = "";
  return displayUrl.toString();
}

const configuredUrl = process.env.HEALTH_URL?.trim();

if (!configuredUrl) {
  fail(
    "CONFIGURATION",
    "(not configured)",
    "set the PRODUCTION_HEALTH_URL repository variable or provide a manual health_url input",
  );
  process.exit();
}

let healthUrl;

try {
  healthUrl = new URL(configuredUrl);
  if (!["http:", "https:"].includes(healthUrl.protocol)) {
    throw new Error("URL must use http or https");
  }
} catch {
  fail(
    "CONFIGURATION",
    "(invalid URL)",
    "HEALTH_URL must be a valid http or https URL",
  );
  process.exit();
}

const displayUrl = safeDisplayUrl(healthUrl);
const configuredTimeout = Number(process.env.HEALTH_TIMEOUT_MS);
const timeoutMs = process.env.HEALTH_TIMEOUT_MS
  ? configuredTimeout
  : DEFAULT_TIMEOUT_MS;

if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
  fail(
    "CONFIGURATION",
    displayUrl,
    "HEALTH_TIMEOUT_MS must be a positive integer",
  );
  process.exit();
}

let response;

try {
  response = await fetch(healthUrl, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
} catch (error) {
  const timedOut = error.name === "TimeoutError" || error.name === "AbortError";
  fail(
    timedOut ? "TIMEOUT" : "NETWORK",
    displayUrl,
    timedOut
      ? `no response within ${timeoutMs}ms`
      : "request failed before receiving a response",
  );
  process.exit();
}

if (!response.ok) {
  fail("HTTP", displayUrl, `received HTTP ${response.status}`);
  process.exit();
}

let payload;

try {
  payload = await response.json();
} catch {
  fail("PAYLOAD", displayUrl, "response was not valid JSON");
  process.exit();
}

if (!payload || typeof payload !== "object" || payload.status !== "ok") {
  const status =
    payload && typeof payload === "object" && typeof payload.status === "string"
      ? payload.status
      : "missing";
  fail("PAYLOAD", displayUrl, `expected status \"ok\", received \"${status}\"`);
  process.exit();
}

if (
  payload.capabilities &&
  (payload.capabilities.rpc !== true ||
    (payload.capabilities.communityFactory !== true &&
      payload.capabilities.legacyContracts !== true))
) {
  fail(
    "CAPABILITY",
    displayUrl,
    "active network has no RPC or deployable contract capability",
  );
  process.exit();
}

console.log(`[health-check] OK: ${displayUrl} is healthy`);
