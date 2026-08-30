import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { ProposalActivity } from "./ProposalActivity";
import type { ProposalListResolution } from "@/lib/communities/proposals";

const mocked = vi.hoisted(() => ({
  resolution: { status: "loading" } as ProposalListResolution,
}));

vi.mock("@/lib/communities/proposals", () => ({
  useCommunityProposals: vi.fn(() => mocked.resolution),
}));

describe("ProposalActivity", () => {
  const ids = ["newest", "middle", "oldest", "fourth"];
  const props = { communityId: "community-1", governorContractId: "governor-1", proposalIds: ids };

  it("shows loading as Delayed", () => {
    mocked.resolution = { status: "loading" };
    render(<ProposalActivity {...props} />);
    expect(screen.getByLabelText("Discovery freshness: Delayed")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Loading proposal activity");
  });

  it("distinguishes a successful empty result from unavailable discovery", () => {
    mocked.resolution = { status: "ready", entries: [] };
    const { rerender } = render(<ProposalActivity {...props} />);
    expect(screen.getByText("No proposals yet")).toBeInTheDocument();
    expect(screen.getByLabelText("Discovery freshness: Current")).toBeInTheDocument();

    mocked.resolution = { status: "error", error: "RPC unavailable" };
    rerender(<ProposalActivity {...props} />);
    expect(screen.getByText("Proposal discovery is unavailable")).toBeInTheDocument();
    expect(screen.getByLabelText("Discovery freshness: Unavailable")).toBeInTheDocument();
    expect(screen.queryByText("No proposals yet")).not.toBeInTheDocument();
  });

  it("counts active proposals and links the three newest ready proposals", () => {
    mocked.resolution = {
      status: "ready",
      entries: [
        { id: "newest", status: "ready", state: ProposalState.Active },
        { id: "middle", status: "ready", state: ProposalState.Succeeded },
        { id: "oldest", status: "ready", state: ProposalState.Active },
        { id: "fourth", status: "ready", state: ProposalState.Defeated },
      ],
    };
    render(<ProposalActivity {...props} />);
    expect(screen.getByRole("region")).toHaveTextContent(/2\s+active proposals?/);
    const recent = screen.getByRole("list", { name: "Recent proposals" });
    const links = within(recent).getAllByRole("link");
    expect(links).toHaveLength(3);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/communities/community-1/proposals/newest",
      "/communities/community-1/proposals/middle",
      "/communities/community-1/proposals/oldest",
    ]);
    expect(screen.getByLabelText("Discovery freshness: Current")).toBeInTheDocument();
  });

  it("shows Stale for partial failures while preserving ready entries", () => {
    mocked.resolution = {
      status: "ready",
      entries: [
        { id: "newest", status: "ready", state: ProposalState.Active },
        { id: "middle", status: "error", error: "timeout" },
      ],
    };
    render(<ProposalActivity {...props} />);
    expect(screen.getByLabelText("Discovery freshness: Stale")).toBeInTheDocument();
    expect(screen.getByText(/Some proposals failed to load/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /newest/ })).toBeInTheDocument();
  });
});
