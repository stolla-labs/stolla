import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ProposalSummaryCard } from "@/components/ProposalSummaryCard";
import type { ProposalSummary } from "@/lib/proposal-events";
import { VERSIONED_PROPOSAL_DESCRIPTION } from "@/lib/proposal-metadata/fixtures";

const FULL_ID = "ab".repeat(32);

function baseSummary(
  overrides: Partial<Omit<ProposalSummary, "voteEnd" | "voteSnapshot" | "description">> & {
    voteEnd?: number | null;
    voteSnapshot?: number | null;
    description?: string | null;
  } = {},
): Pick<ProposalSummary, "proposalId"> & {
    proposer?: string | null;
    voteSnapshot?: number | null;
    voteEnd?: number | null;
    description?: string | null;
  } {
  return {
    proposalId: FULL_ID,
    ...overrides,
  };
}

describe("ProposalSummaryCard", () => {
  it("shows an exact deadline and approximate time at the last known ledger", () => {
    render(
      <ProposalSummaryCard
        summary={baseSummary({ voteSnapshot: 10_000, voteEnd: 20_000 })}
        currentLedger={19_280}
        stateStatus="ready"
        stateLabel="Active"
      />,
    );

    expect(screen.getByText("Voting end ledger:").parentElement).toHaveTextContent(
      "Voting end ledger: 20000 (Approx. ~1h remaining at last scan; assumes ~5s/ledger)",
    );
    expect(screen.getByText(/Approx\. ~1h remaining/)).toHaveAttribute(
      "title",
      expect.stringMatching(/~5s per ledger/),
    );
  });

  it("shows a window estimate without a head ledger and none without a deadline", () => {
    const { rerender } = render(
      <ProposalSummaryCard
        summary={baseSummary({ voteSnapshot: 19_280, voteEnd: 20_000 })}
        stateStatus="ready"
      />,
    );
    expect(screen.getByText(/Approx\. voting window: ~1h/)).toBeInTheDocument();

    rerender(
      <ProposalSummaryCard
        summary={baseSummary({ voteSnapshot: 19_280, voteEnd: null })}
        stateStatus="ready"
      />,
    );
    expect(screen.getByText("Voting end ledger:").parentElement).toHaveTextContent(
      "Voting end ledger: Unavailable",
    );
    expect(screen.queryByText(/Approx\./)).not.toBeInTheDocument();
  });

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
        onCopyId={() => void navigator.clipboard.writeText(FULL_ID)}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: `Copy proposal ID ${FULL_ID}` }));
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

  it("surfaces a validated discussion link beside the detail link", () => {
    const { container } = render(
      <ProposalSummaryCard
        summary={baseSummary({
          description: VERSIONED_PROPOSAL_DESCRIPTION,
        })}
        showDescription
        stateStatus="ready"
        stateLabel="Active"
      />,
    );

    const discussionLink = screen.getByRole("link", {
      name: /Join discussion/,
    });
    expect(discussionLink).toHaveAttribute(
      "href",
      "https://forum.example.org/t/governance-tooling",
    );
    expect(discussionLink).toHaveAttribute("target", "_blank");
    expect(discussionLink).toHaveAttribute("rel", "noopener noreferrer");
    // The discussion link lives outside the nested detail link (no <a> in <a>).
    expect(discussionLink.closest("a")).toBe(discussionLink);
    expect(container.querySelectorAll("a")).toHaveLength(2);
  });

  it("omits the discussion link for legacy or discussion-free descriptions", () => {
    const { rerender } = render(
      <ProposalSummaryCard
        summary={baseSummary({ description: "Plain legacy proposal text" })}
        showDescription
        stateStatus="ready"
        stateLabel="Active"
      />,
    );
    expect(screen.queryByRole("link", { name: /Join discussion/ })).toBeNull();

    rerender(
      <ProposalSummaryCard
        summary={baseSummary({ description: null })}
        showDescription
        stateStatus="ready"
        stateLabel="Active"
      />,
    );
    expect(screen.queryByRole("link", { name: /Join discussion/ })).toBeNull();
  });
});
