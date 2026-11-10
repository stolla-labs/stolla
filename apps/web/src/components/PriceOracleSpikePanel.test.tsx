import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatOracleSample,
  resolveConfiguredPriceOracleId,
} from "@/lib/priceOracle";
import { PriceOracleSpikePanel } from "./PriceOracleSpikePanel";

const VALID_ORACLE_ID =
  "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";

describe("PriceOracleSpikePanel and priceOracle helpers", () => {
  afterEach(() => {
    cleanup();
  });

  it("hides the panel unless NEXT_PUBLIC_PRICE_ORACLE_CONTRACT_ID is configured", () => {
    expect(resolveConfiguredPriceOracleId({})).toBeNull();
    expect(
      resolveConfiguredPriceOracleId({
        NEXT_PUBLIC_PRICE_ORACLE_CONTRACT_ID: "invalid",
      }),
    ).toBeNull();
    expect(
      resolveConfiguredPriceOracleId({
        NEXT_PUBLIC_PRICE_ORACLE_CONTRACT_ID: VALID_ORACLE_ID,
      }),
    ).toBe(VALID_ORACLE_ID);

    const readQuote = vi.fn();
    const { container } = render(
      <PriceOracleSpikePanel oracleContractId={null} readQuote={readQuote} />,
    );
    expect(container.firstChild).toBeNull();
    expect(readQuote).not.toHaveBeenCalled();
  });

  it("formats SEP-40 oracle samples and renders the experimental disclaimer", async () => {
    const nowMs = 1_750_000_000_000;
    const sample = {
      assetSymbol: "XLM",
      quoteSymbol: "USD",
      rawPrice: 12_345_600_000_000n,
      decimals: 14,
      timestampSeconds: 1_750_000_000 - 120,
    };

    const formatted = formatOracleSample(sample, nowMs);
    expect(formatted.pairLabel).toBe("XLM/USD");
    expect(formatted.formattedPrice).toBe("0.1234");
    expect(formatted.stale).toBe(false);

    const readQuote = vi.fn().mockResolvedValue(sample);
    render(
      <PriceOracleSpikePanel
        oracleContractId={VALID_ORACLE_ID}
        assetSymbol="XLM"
        readQuote={readQuote}
        nowMs={nowMs}
      />,
    );

    expect(
      screen.getByText(/Experimental — not used for governance calculations/i),
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText("0.1234")).toBeInTheDocument(),
    );
    expect(screen.getByText("Fresh sample")).toBeInTheDocument();
  });

  it("surfaces oracle read errors without crashing", async () => {
    const readQuote = vi
      .fn()
      .mockRejectedValue(new Error("Oracle RPC simulation timed out"));

    render(
      <PriceOracleSpikePanel
        oracleContractId={VALID_ORACLE_ID}
        readQuote={readQuote}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Oracle RPC simulation timed out",
    );
  });
});
