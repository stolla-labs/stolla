import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProposalSummaryCard } from "@/components/ProposalSummaryCard";
import type { ProposalSummary } from "@/lib/proposal-events";

const FULL_ID = "ab".repeat(32);

function baseSummary(
  overrides: Partial<
    Omit<ProposalSummary, "description"> & { description?: string | null }
  > = {},
): Pick<ProposalSummary, "proposalId"> &
  Partial<Pick<ProposalSummary, "proposer" | "voteSnapshot" | "voteEnd">> & {
    description?: string | null;
  } {
  return {
    proposalId: FULL_ID,
    ...overrides,
  };
}

describe("ProposalSummaryCard", () => {
  it("renders a complete summary with accessible detail link", () => {
    render(
      <ProposalSummaryCard
        summary={baseSummary({
          description: "Fund community grants",
          proposer: "GABCDEFGHIJKLMNOPQRSTUVWXYZ",
        })}
        showDescription
        stateStatus="ready"
        stateLabel="Active"
      />,
    );

    const link = screen.getByRole("link", {
      name: new RegExp(`View proposal ${FULL_ID}, state Active`),
    });
    expect(link).toHaveAttribute("href", `/proposals/${FULL_ID}`);
    expect(screen.getByText("Fund community grants")).toBeInTheDocument();
    expect(screen.getByText("GABCDEFGHIJKLMNOPQRSTUVWXYZ")).toBeInTheDocument();
  });

  it("clamps long descriptions without nested interactive controls", () => {
    const longDescription = "A".repeat(280);
    const { container } = render(
      <ProposalSummaryCard
        summary={baseSummary({ description: longDescription })}
        showDescription
        stateStatus="ready"
        stateLabel="Active"
      />,
    );

    const description = screen.getByText(longDescription);
    expect(description.tagName).toBe("P");
    expect(description.className).toContain("line-clamp-2");
    expect(description).toHaveAttribute("title", longDescription);
    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(description.closest("a")).toBeTruthy();
    expect(description.querySelector("button,a")).toBeNull();
  });

  it("shows an explicit fallback for empty and unavailable descriptions", () => {
    const { rerender } = render(
      <ProposalSummaryCard
        summary={baseSummary({ description: "" })}
        showDescription
        stateStatus="ready"
        stateLabel="Pending"
      />,
    );
    expect(screen.getByText("Description unavailable")).toBeInTheDocument();
    expect(screen.queryByText("No description provided")).not.toBeInTheDocument();

    rerender(
      <ProposalSummaryCard
        summary={baseSummary({ description: null })}
        showDescription
        stateStatus="ready"
        stateLabel="Pending"
      />,
    );
    expect(screen.getByText("Description unavailable")).toBeInTheDocument();
  });

  it("shows placeholders for partial optional metadata", () => {
    render(
      <ProposalSummaryCard
        summary={baseSummary({
          proposer: null,
        })}
        stateStatus="ready"
        stateLabel="Pending"
      />,
    );

    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
  });

  it("supports loading and failed state presentation", () => {
    const { rerender } = render(
      <ProposalSummaryCard
        summary={baseSummary()}
        stateStatus="loading"
      />,
    );
    expect(screen.getByText("…")).toBeInTheDocument();

    const onRetryState = vi.fn();
    rerender(
      <ProposalSummaryCard
        summary={baseSummary()}
        stateStatus="unavailable"
        onRetryState={onRetryState}
      />,
    );
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: `Retry loading state for proposal ${FULL_ID}`,
      }),
    );
    expect(onRetryState).toHaveBeenCalledTimes(1);
  });

  it("copies the proposal id via the shared identifier control", async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    render(
      <ProposalSummaryCard
        summary={baseSummary()}
        stateStatus="ready"
        stateLabel="Active"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy Proposal ID" }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(FULL_ID);
  });

  it("keeps long proposal IDs from breaking the layout", () => {
    const { container } = render(
      <ProposalSummaryCard
        summary={baseSummary({ proposalId: "ff".repeat(32) })}
        stateStatus="ready"
        stateLabel="Queued"
      />,
    );

    const mono = container.querySelector(".truncate.font-mono");
    expect(mono).toBeTruthy();
    expect(mono).toHaveAttribute("title", "ff".repeat(32));
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `/proposals/${"ff".repeat(32)}`,
    );
  });
});
