import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProposalExportControls } from "../ProposalExportControls";
import * as proposalExportModule from "@/lib/proposal-export";

describe("ProposalExportControls", () => {
  beforeEach(() => {
    vi.spyOn(proposalExportModule, "downloadFile").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("disables export buttons and displays explanation when loading", () => {
    render(
      <ProposalExportControls
        communityId="atlas-dao"
        communityName="Atlas DAO"
        proposals={[]}
        isLoading={true}
      />,
    );

    const csvBtn = screen.getByRole("button", {
      name: /Export CSV \(unavailable while proposals are loading\)/i,
    });
    const jsonBtn = screen.getByRole("button", {
      name: /Export JSON \(unavailable while proposals are loading\)/i,
    });

    expect(csvBtn).toBeDisabled();
    expect(jsonBtn).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Export unavailable while proposals are loading",
    );
  });

  it("enables export buttons and triggers CSV download when clicked", () => {
    const proposals: proposalExportModule.ExportableProposal[] = [
      {
        id: "prop-1",
        title: "Test Proposal",
        state: "Active",
        discoveryStatus: "ready",
      },
    ];

    render(
      <ProposalExportControls
        communityId="atlas-dao"
        communityName="Atlas DAO"
        proposals={proposals}
        isLoading={false}
      />,
    );

    const csvBtn = screen.getByRole("button", { name: /Export proposals as CSV/i });
    expect(csvBtn).not.toBeDisabled();

    fireEvent.click(csvBtn);

    expect(proposalExportModule.downloadFile).toHaveBeenCalledWith(
      expect.stringContaining("prop-1,Test Proposal"),
      expect.stringMatching(/^proposals-atlas-dao-\d{4}-\d{2}-\d{2}\.csv$/),
      "text/csv",
    );

    expect(screen.getByRole("status")).toHaveTextContent("Downloaded CSV");
  });

  it("triggers JSON download when JSON button is clicked", () => {
    const proposals: proposalExportModule.ExportableProposal[] = [
      {
        id: "prop-2",
        title: "Proposal 2",
        state: "Succeeded",
        discoveryStatus: "ready",
      },
    ];

    render(
      <ProposalExportControls
        communityId="atlas-dao"
        communityName="Atlas DAO"
        proposals={proposals}
        isLoading={false}
      />,
    );

    const jsonBtn = screen.getByRole("button", { name: /Export proposals as JSON/i });
    fireEvent.click(jsonBtn);

    expect(proposalExportModule.downloadFile).toHaveBeenCalledWith(
      expect.stringContaining('"communityId": "atlas-dao"'),
      expect.stringMatching(/^proposals-atlas-dao-\d{4}-\d{2}-\d{2}\.json$/),
      "application/json",
    );

    expect(screen.getByRole("status")).toHaveTextContent("Downloaded JSON");
  });
});
