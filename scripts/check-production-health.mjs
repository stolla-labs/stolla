#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const DEFAULT_TIMEOUT_MS = 10_000;

function truncateAddressMatch(address) {
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function sanitizeHealthLogText(input) {
  if (typeof input !== "string" || !input) return "";

  return input
    .replace(/\b(?:https?|wss?):\/\/[^\s"'<>)\]]+/gi, "[redacted-url]")
    .replace(/(\/[A-Za-z0-9._~:/%-]*)\?[^\s"'<>#)\]]*(?:#[^\s"'<>)\]]*)?/g, "$1")
    .replace(/\?[A-Za-z0-9_.-]+=[^\s"'<>)\]]+/g, "[redacted-query]")
    .replace(/\b(Bearer|Basic)\s+[^\s"',;)\]]+/gi, "$1 [redacted]")
    .replace(
      /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|auth[_-]?token|token|secret|password|passwd|pwd|authorization|signature|credential|credentials)\s*([:=])\s*[^\s&"',;)\]]+/gi,
      "$1$2[redacted]",
    )
    .replace(/\b[A-Za-z0-9._%+-]+:[^@\s"'/]+@[A-Za-z0-9.-]+/g, "[redacted-credentials]")
    .replace(/(?<![A-Z2-7])S[A-Z2-7]{55}(?![A-Z2-7])/g, "[redacted-secret]")
    .replace(/(?<![A-Z2-7])[GCM][A-Z2-7]{55,68}(?![A-Z2-7])/g, truncateAddressMatch)
    .replace(/\s+/g, " ")
    .trim();
}

export function safeDisplayUrl(url) {
  const displayUrl = new URL(url);
  displayUrl.username = "";
  displayUrl.password = "";
  displayUrl.search = "";
  displayUrl.hash = "";
  displayUrl.pathname = displayUrl.pathname
    .replace(/(?<![A-Z2-7])S[A-Z2-7]{55}(?![A-Z2-7])/g, "[redacted-secret]")
    .replace(/(?<![A-Z2-7])[GCM][A-Z2-7]{55,68}(?![A-Z2-7])/g, truncateAddressMatch);
  return displayUrl.toString();
}

function isStructuredHealthPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return false;
  }

  return (
    typeof payload.healthy === "boolean" ||
    typeof payload.reasonCode === "string" ||
    payload.status === "healthy" ||
    payload.status === "unhealthy" ||
    (typeof payload.rpc === "object" &&
      payload.rpc !== null &&
      typeof payload.registry === "object" &&
      payload.registry !== null)
  );
}

function summarizeProbe(label, surface) {
  if (!surface || typeof surface !== "object") return null;
  const configured =
    typeof surface.configured === "boolean" ? surface.configured : null;
  const probeStatus =
    surface.probe && typeof surface.probe.status === "string"
      ? sanitizeHealthLogText(surface.probe.status)
      : null;
  const probeReason =
    surface.probe && typeof surface.probe.reasonCode === "string"
      ? sanitizeHealthLogText(surface.probe.reasonCode)
      : null;
  const probeMessage =
    surface.probe && typeof surface.probe.message === "string"
      ? sanitizeHealthLogText(surface.probe.message)
      : null;

  const parts = [];
  if (configured !== null) parts.push(`configured=${configured}`);
  if (typeof surface.readable === "boolean") {
    parts.push(`readable=${surface.readable}`);
  }
  if (probeStatus) parts.push(`probe=${probeStatus}`);
  if (probeReason) parts.push(`reason=${probeReason}`);
  if (probeMessage) parts.push(`message="${probeMessage}"`);

  return parts.length > 0 ? `${label}(${parts.join(", ")})` : null;
}

function summarizeSurfaceDiagnostics(payload) {
  const status =
    typeof payload.status === "string"
      ? sanitizeHealthLogText(payload.status)
      : "unknown";
  const reason =
    typeof payload.reasonCode === "string"
      ? sanitizeHealthLogText(payload.reasonCode)
      : "unspecified";

  const surfaces = [
    summarizeProbe("rpc", payload.rpc),
    summarizeProbe("communityFactory", payload.communityFactory),
    summarizeProbe("registry", payload.registry),
    payload.legacyContracts?.probe?.status === "failed" ||
    payload.legacyContracts?.partiallyConfigured === true ||
    (payload.legacyContracts?.configured === true &&
      payload.legacyContracts?.validContractIds === false)
      ? summarizeProbe("legacyContracts", payload.legacyContracts)
      : null,
  ].filter(Boolean);

  const base = `status="${status}" reason="${reason}"`;
  return surfaces.length > 0 ? `${base} [${surfaces.join("; ")}]` : base;
}

function fail(failureClass, url, message) {
  const safeMessage = sanitizeHealthLogText(message);
  console.error(`[health-check] ${failureClass}: ${url} — ${safeMessage}`);
  process.exitCode = 1;
}

export async function runProductionHealthCheck(env = process.env) {
  const configuredUrl = env.HEALTH_URL?.trim();

  if (!configuredUrl) {
    fail(
      "CONFIGURATION",
      "(not configured)",
      "set the PRODUCTION_HEALTH_URL repository variable or provide a manual health_url input",
    );
    return 1;
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
    return 1;
  }

  const displayUrl = safeDisplayUrl(healthUrl);
  const configuredTimeout = Number(env.HEALTH_TIMEOUT_MS);
  const timeoutMs = env.HEALTH_TIMEOUT_MS
    ? configuredTimeout
    : DEFAULT_TIMEOUT_MS;

  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    fail(
      "CONFIGURATION",
      displayUrl,
      "HEALTH_TIMEOUT_MS must be a positive integer",
    );
    return 1;
  }

  let response;

  try {
    response = await fetch(healthUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const timedOut =
      error?.name === "TimeoutError" || error?.name === "AbortError";
    fail(
      timedOut ? "TIMEOUT" : "NETWORK",
      displayUrl,
      timedOut
        ? `no response within ${timeoutMs}ms`
        : "request failed before receiving a response",
    );
    return 1;
  }

  const rawBody = await response.text();
  let payload = null;
  let parsedJson = false;

  if (rawBody.trim()) {
    try {
      payload = JSON.parse(rawBody);
      parsedJson = true;
    } catch {
      parsedJson = false;
    }
  }

  if (!response.ok) {
    if (parsedJson && isStructuredHealthPayload(payload)) {
      const failureClass =
        payload.status === "degraded" ? "DEGRADED" : "UNHEALTHY";
      fail(
        failureClass,
        displayUrl,
        `HTTP ${response.status} — ${summarizeSurfaceDiagnostics(payload)}`,
      );
      return 1;
    }

    fail("HTTP", displayUrl, `received HTTP ${response.status}`);
    return 1;
  }

  if (!parsedJson) {
    fail("PAYLOAD", displayUrl, "response was not valid JSON");
    return 1;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    fail("PAYLOAD", displayUrl, "response payload must be a JSON object");
    return 1;
  }

  if (payload.status === "degraded") {
    fail("DEGRADED", displayUrl, summarizeSurfaceDiagnostics(payload));
    return 1;
  }

  if (payload.status === "unhealthy" || payload.healthy === false) {
    fail("UNHEALTHY", displayUrl, summarizeSurfaceDiagnostics(payload));
    return 1;
  }

  if (payload.healthy !== true || payload.status !== "healthy") {
    const status =
      typeof payload.status === "string"
        ? sanitizeHealthLogText(payload.status)
        : "missing";
    fail(
      "PAYLOAD",
      displayUrl,
      `expected healthy=true and status "healthy", received status "${status}"`,
    );
    return 1;
  }

  const rpcReadable =
    payload.rpc?.configured === true && payload.rpc?.probe?.status === "ok";
  const factoryReadable =
    payload.communityFactory?.configured === true &&
    payload.communityFactory?.probe?.status === "ok";
  const registryReadable =
    payload.registry?.configured === true &&
    payload.registry?.readable === true &&
    payload.registry?.probe?.status === "ok";

  if (!rpcReadable || !factoryReadable || !registryReadable) {
    fail(
      "PAYLOAD",
      displayUrl,
      "healthy response did not prove RPC, CommunityFactory, and registry readability",
    );
    return 1;
  }

  if (
    payload.capabilities &&
    (payload.capabilities.rpc !== true ||
      payload.capabilities.communityFactory !== true)
  ) {
    fail(
      "CAPABILITY",
      displayUrl,
      "active network is missing RPC or CommunityFactory capability",
    );
    return 1;
  }

  console.log(`[health-check] OK: ${displayUrl} is healthy (registry readable)`);
  return 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const exitCode = await runProductionHealthCheck();
  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}
