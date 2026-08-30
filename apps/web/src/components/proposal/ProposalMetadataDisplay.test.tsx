import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProposalMetadataDisplay } from "./ProposalMetadataDisplay";
import {
  LEGACY_PROPOSAL_DESCRIPTION,
  VERSIONED_PROPOSAL_DESCRIPTION,
} from "@/lib/proposal-metadata/fixtures";

describe("ProposalMetadataDisplay", () => {
  it("renders versioned fields and a hardened external discussion link", () => {
    render(<ProposalMetadataDisplay description={VERSIONED_PROPOSAL_DESCRIPTION} />);
    expect(screen.getByRole("heading", { name: /Fund Unicode/ })).toBeVisible();
    expect(screen.getByText(/deterministic proposal metadata/)).toBeVisible();
    expect(screen.getByRole("link", { name: /Open discussion/ })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    expect(screen.getByRole("link", { name: /Open discussion/ })).toHaveAttribute(
      "target",
      "_blank",
    );
  });

  it("renders legacy text without interpreting markup", () => {
    render(<ProposalMetadataDisplay description={LEGACY_PROPOSAL_DESCRIPTION} />);
    expect(screen.getByText(LEGACY_PROPOSAL_DESCRIPTION)).toBeVisible();
    expect(screen.getByText("Legacy proposal format")).toBeVisible();
  });
});
