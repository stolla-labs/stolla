/** Covers issue #408: mainnet readiness gate checklist, driven by /api/health. */
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HealthGate } from "@/lib/network";

const mocks = vi.hoisted(() => ({ notFound: vi.fn() }));

vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
}));

import MainnetReadinessPage from "@/app/(app)/settings/readiness/page";

function gate(overrides: Partial<HealthGate> = {}): HealthGate {
  return {
    name: "rpc",
    label: "RPC endpoint",
    available: true,
    reason: null,
    requiredEnvironment: [],
    runbookAnchor: "network-safety-shell",
    ...overrides,
  };
}

function stubFetch(payload: unknown, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 503,
    json: () => Promise.resolve(payload),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("MainnetReadinessPage", () => {
  beforeEach(() => {
    mocks.notFound.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("is hidden (notFound, no fetch) when NEXT_PUBLIC_SHOW_READINESS is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_SHOW_READINESS", "");
    const fetchMock = stubFetch({ status: "ok", gates: [] });

    render(<MainnetReadinessPage />);

    expect(mocks.notFound).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is hidden for any value other than exactly \"1\"", () => {
    vi.stubEnv("NEXT_PUBLIC_SHOW_READINESS", "true");
    stubFetch({ status: "ok", gates: [] });

    render(<MainnetReadinessPage />);

    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });

  it("renders pass/fail per gate with the reason for a failing gate, when enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHOW_READINESS", "1");
    stubFetch({
      status: "degraded",
      gates: [
        gate({ name: "rpc", label: "RPC endpoint", available: true }),
        gate({
          name: "privilegedWrites",
          label: "Mainnet writes",
          available: false,
          reason: "Mainnet writes are off. You can still browse the registry and proposals.",
          requiredEnvironment: ["NEXT_PUBLIC_ALLOW_MAINNET_WRITES"],
          runbookAnchor: "final-activation-gate",
        }),
      ],
    });

    render(<MainnetReadinessPage />);

    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(await screen.findByText("RPC endpoint")).toBeInTheDocument();
    expect(screen.getByText("Mainnet writes")).toBeInTheDocument();
    expect(screen.getAllByText("Pass")).toHaveLength(1);
    expect(screen.getAllByText("Fail")).toHaveLength(1);
    const failureAlert = screen.getByRole("alert");
    expect(failureAlert.textContent).toMatch(/Mainnet writes are off/);
    expect(failureAlert.textContent).toMatch(/NEXT_PUBLIC_ALLOW_MAINNET_WRITES/);
    expect(screen.getByText(/Degraded/)).toBeInTheDocument();

    const runbookLinks = screen.getAllByRole("link", { name: "Open runbook section" });
    expect(runbookLinks.some((link) => link.getAttribute("href")?.endsWith("#final-activation-gate"))).toBe(
      true,
    );
  });

  it("shows every gate as passing with no failure copy when the environment is complete", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHOW_READINESS", "1");
    stubFetch({
      healthy: true,
      status: "healthy",
      gates: [gate(), gate({ name: "explorer", label: "Explorer" })],
    });

    render(<MainnetReadinessPage />);

    expect(await screen.findByText(/Ready/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renders an unhealthy banner when core readiness gates return HTTP 503 with gates", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHOW_READINESS", "1");
    stubFetch(
      {
        healthy: false,
        status: "unhealthy",
        gates: [
          gate({
            name: "communityFactory",
            label: "CommunityFactory contract",
            available: false,
            reason: "CommunityFactory is unavailable for the active deployment.",
            requiredEnvironment: ["NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID"],
            runbookAnchor: "3-deploy-in-dependency-order",
          }),
        ],
      },
      false,
    );

    render(<MainnetReadinessPage />);

    expect(await screen.findByText(/Unhealthy/)).toBeInTheDocument();
    expect(screen.getByText("CommunityFactory contract")).toBeInTheDocument();
  });

  it("shows a retryable error state when the health endpoint cannot be reached", async () => {
    vi.stubEnv("NEXT_PUBLIC_SHOW_READINESS", "1");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    render(<MainnetReadinessPage />);

    expect(await screen.findByText("network down")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry health check" })).toBeInTheDocument();
  });
});
