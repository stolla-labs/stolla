import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PriceOracleDebugPanel } from "../PriceOracleDebugPanel";
import type { PriceOracleRpc } from "@/lib/price-oracle/client";

const CONTRACT = "CORACLE000000000000000000000000000000000000000000000000001";

describe("PriceOracleDebugPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when the oracle contract id is not configured", () => {
    const { container } = render(
      <PriceOracleDebugPanel configured={false} contractId={null} />,
    );
    expect(container).toBeEmptyDOMElement();
    expect(
      screen.queryByTestId("price-oracle-debug-panel"),
    ).not.toBeInTheDocument();
  });

  it("labels the panel as experimental and links to #266", async () => {
    const prepare = vi.fn(async (invocation) => {
      if (invocation.method === "price") return BigInt(100);
      return 10;
    });
    const rpc: PriceOracleRpc = { prepare };

    render(
      <PriceOracleDebugPanel
        configured
        contractId={CONTRACT}
        defaultFeed="XLM_USDC"
        rpc={rpc}
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: /Experimental price oracle/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/not for custody/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /#266 decision notes/i }),
    ).toHaveAttribute(
      "href",
      "https://github.com/stolla-labs/stolla/issues/266",
    );
    await waitFor(() => expect(prepare).toHaveBeenCalled());
  });

  it("shows an actionable unset-feed error when the feed is empty", async () => {
    const prepare = vi.fn();
    const rpc: PriceOracleRpc = { prepare };

    render(
      <PriceOracleDebugPanel
        configured
        contractId={CONTRACT}
        defaultFeed=""
        rpc={rpc}
      />,
    );

    expect(
      await screen.findByText(/No oracle feed symbol is set/i),
    ).toBeInTheDocument();
    expect(prepare).not.toHaveBeenCalled();
  });

  it("displays mocked oracle responses and surfaces RPC failures", async () => {
    const user = userEvent.setup();
    const prepare = vi.fn(async (invocation) => {
      if (invocation.method === "price") return BigInt(55);
      if (invocation.method === "price_timestamp") return 7;
      throw new Error(`unexpected ${invocation.method}`);
    });

    const rpc: PriceOracleRpc = { prepare };

    render(
      <PriceOracleDebugPanel
        configured
        contractId={CONTRACT}
        defaultFeed="XLM_USDC"
        rpc={rpc}
      />,
    );

    expect(await screen.findByText("55")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();

    prepare.mockRejectedValue(new Error("network RPC timeout"));
    await user.click(
      screen.getByRole("button", { name: "Refresh oracle reading" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(/RPC failed/i);
  });
});
