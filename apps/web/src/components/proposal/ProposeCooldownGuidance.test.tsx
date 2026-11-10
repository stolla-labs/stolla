import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  clearProposeCooldown,
  describeProposeRejection,
  getRemainingProposeCooldownMs,
  PROPOSE_COOLDOWN_MS,
  recordProposeTimestamp,
} from "@/lib/proposeCooldown";
import { ProposeCooldownGuidance } from "./ProposeCooldownGuidance";

describe("ProposeCooldownGuidance and proposeCooldown helpers (#398)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("tracks and expires per-wallet propose cooldown timestamps", () => {
    const start = 1_700_000_000_000;
    expect(getRemainingProposeCooldownMs("CGOV", "GWALLET", start)).toBe(0);

    recordProposeTimestamp("CGOV", "GWALLET", start);
    expect(
      getRemainingProposeCooldownMs("CGOV", "GWALLET", start + 5_000),
    ).toBe(PROPOSE_COOLDOWN_MS - 5_000);
    expect(
      getRemainingProposeCooldownMs(
        "CGOV",
        "GWALLET",
        start + PROPOSE_COOLDOWN_MS + 1,
      ),
    ).toBe(0);

    clearProposeCooldown("CGOV", "GWALLET");
    expect(getRemainingProposeCooldownMs("CGOV", "GWALLET", start + 1_000)).toBe(
      0,
    );
  });

  it("maps Governor cooldown, proposal threshold, and duplicate active proposal rejections", () => {
    expect(
      describeProposeRejection(
        new Error("HostError: Error(Contract, #5018) ProposeCooldown"),
      )?.kind,
    ).toBe("cooldown");
    expect(
      describeProposeRejection(
        new Error("HostError: Error(Contract, #5012) ProposalThreshold"),
      )?.kind,
    ).toBe("threshold");
    expect(
      describeProposeRejection(new Error("Already active proposal exists"))
        ?.kind,
    ).toBe("duplicate_active");
    expect(describeProposeRejection(new Error("unrelated error"))).toBeNull();
  });

  it("renders accessible cooldown banner and rejection guidance", () => {
    render(
      <ProposeCooldownGuidance
        remainingCooldownMs={8_200}
        proposalThreshold="5"
        error={new Error("HostError: Error(Contract, #5012) ProposalThreshold")}
      />,
    );

    expect(
      screen.getByText(/proposal threshold \(5\)/i),
    ).toBeInTheDocument();
    const cooldownBanner = screen.getByTestId("propose-cooldown-banner");
    expect(cooldownBanner).toHaveAttribute("aria-live", "polite");
    expect(cooldownBanner).toHaveTextContent(/wait 9s/i);

    const rejectionAlert = screen.getByTestId("propose-rejection-guidance");
    expect(rejectionAlert).toHaveTextContent(/Proposal threshold not met/i);
  });
});
