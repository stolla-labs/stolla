import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AsyncState } from "./AsyncState";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { FreshnessNotice } from "./FreshnessNotice";

describe("shared async states", () => {
  it("announces loading as a busy, non-interruptive status", () => {
    render(<AsyncState>Loading communities…</AsyncState>);

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-busy", "true");
  });

  it("announces a completed empty result as a status", () => {
    render(<EmptyState>No communities are registered yet.</EmptyState>);

    expect(screen.getByRole("status")).toHaveTextContent(
      "No communities are registered yet.",
    );
  });

  it("announces errors and invokes the supplied retry callback", async () => {
    const retry = vi.fn();
    render(
      <ErrorState title="Community unavailable" onRetry={retry}>
        RPC request failed.
      </ErrorState>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByRole("alert")).toHaveTextContent("RPC request failed.");
    expect(retry).toHaveBeenCalledOnce();
  });

  it("qualifies partial data without presenting it as an error", () => {
    render(
      <FreshnessNotice title="Some data is unavailable">
        Successful records remain visible.
      </FreshnessNotice>,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Successful records remain visible.",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
