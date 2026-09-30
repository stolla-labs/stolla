import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { VotingPowerCompositionDisplay } from "../VotingPowerCompositionDisplay";

describe("VotingPowerCompositionDisplay", () => {
  it("renders nothing when user is disconnected", () => {
    const { container } = render(
      <VotingPowerCompositionDisplay
        account={null}
        balance={5}
        totalVotes={5}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders loading indicator when isLoading is true", () => {
    render(
      <VotingPowerCompositionDisplay
        account="GACCOUNT1"
        balance={1}
        totalVotes={1}
        isLoading={true}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading voting power composition…",
    );
  });

  it("renders self-only breakdown when member is self-delegated", () => {
    render(
      <VotingPowerCompositionDisplay
        account="GACCOUNT1"
        balance={4}
        totalVotes={4}
        delegate="GACCOUNT1"
      />,
    );

    expect(screen.getByRole("group", { name: "Voting power breakdown" })).toBeInTheDocument();
    expect(screen.getByText("Own tokens (self-delegated)")).toBeInTheDocument();
    expect(screen.getByText("Received from others (delegated-in)")).toBeInTheDocument();
    expect(screen.queryByText(/Undelegated tokens do not count/i)).not.toBeInTheDocument();
  });

  it("renders delegated-in breakdown when receiving votes from others", () => {
    render(
      <VotingPowerCompositionDisplay
        account="GACCOUNT1"
        balance={1}
        totalVotes={10}
        delegate="GACCOUNT1"
      />,
    );

    expect(screen.getByText("10")).toBeInTheDocument(); // Total
    expect(screen.getByText("1")).toBeInTheDocument(); // Self
    expect(screen.getByText("9")).toBeInTheDocument(); // Delegated-in
  });

  it("shows note explaining that undelegated tokens do not count", () => {
    render(
      <VotingPowerCompositionDisplay
        account="GACCOUNT1"
        balance={3}
        totalVotes={0}
        delegate={null}
      />,
    );

    expect(
      screen.getByText(/3 tokens held without delegation\. Undelegated tokens do not count toward voting power\./i),
    ).toBeInTheDocument();
  });

  it("shows delegated-out address and tokens when delegated to a third party", () => {
    render(
      <VotingPowerCompositionDisplay
        account="GACCOUNT1"
        balance={2}
        totalVotes={0}
        delegate="GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
      />,
    );

    expect(screen.getByText(/Delegated to/i)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
