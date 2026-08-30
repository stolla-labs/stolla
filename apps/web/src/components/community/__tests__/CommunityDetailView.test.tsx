import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommunityDetailView } from "@/components/community/CommunityDetailView";
import {
  atlasCommunity,
  beaconCommunity,
  driftwoodCommunity,
  multiCommunityRegistry,
} from "@/test-support/stellar";

const atlasName = atlasCommunity.metadata!.name;
const beaconName = beaconCommunity.metadata!.name;

describe("CommunityDetailView route resolution", () => {
  it("selects the correct registry record for the routed community id", async () => {
    render(
      <CommunityDetailView
        communityId={beaconCommunity.record.id}
        registry={multiCommunityRegistry}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: beaconName }),
    ).toBeInTheDocument();
    expect(screen.getByText(beaconCommunity.record.governorContract)).toBeInTheDocument();
    expect(screen.getByText(beaconCommunity.record.nftContract)).toBeInTheDocument();
    // Must not render the other community's on-chain data.
    expect(screen.queryByText(atlasCommunity.record.governorContract)).not.toBeInTheDocument();
  });

  it("renders canonical breadcrumb links for the resolved community", async () => {
    render(
      <CommunityDetailView
        communityId={atlasCommunity.record.id}
        registry={multiCommunityRegistry}
      />,
    );

    await screen.findByRole("heading", { name: atlasName });

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(within(nav).getByRole("link", { name: "Communities" })).toHaveAttribute(
      "href",
      "/community",
    );
    expect(within(nav).getByText(atlasName)).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders a canonical scoped proposal link for the resolved community", async () => {
    render(
      <CommunityDetailView
        communityId={atlasCommunity.record.id}
        registry={multiCommunityRegistry}
      />,
    );

    const link = await screen.findByRole("link", { name: "View proposals" });
    expect(link).toHaveAttribute("href", `/community/${atlasCommunity.record.id}/proposals`);
  });

  it("produces not-found behavior for an unknown community id", async () => {
    render(
      <CommunityDetailView
        communityId="does-not-exist"
        registry={multiCommunityRegistry}
      />,
    );

    expect(await screen.findByText("Community not found")).toBeInTheDocument();
    expect(screen.getByText("does-not-exist")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: atlasName }),
    ).not.toBeInTheDocument();
  });

  it("preserves on-chain identifiers and navigation when metadata fails to load", async () => {
    render(
      <CommunityDetailView
        communityId={driftwoodCommunity.record.id}
        registry={multiCommunityRegistry}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: /Community c{8}/ }),
    ).toBeInTheDocument();
    // On-chain identifiers still render even though there is no metadataUri.
    expect(screen.getByText(driftwoodCommunity.record.governorContract)).toBeInTheDocument();
    expect(screen.getByText(driftwoodCommunity.record.nftContract)).toBeInTheDocument();
    // Navigation (breadcrumbs, proposals link) still works.
    expect(screen.getByRole("link", { name: "View proposals" })).toHaveAttribute(
      "href",
      `/community/${driftwoodCommunity.record.id}/proposals`,
    );
    expect(
      screen.getByText(/Community details are temporarily unavailable/i),
    ).toBeInTheDocument();
  });

  it("preserves on-chain identifiers and navigation when the metadata fetch itself rejects", async () => {
    const failedMetadata = structuredClone(atlasCommunity);
    failedMetadata.metadata = null;
    failedMetadata.metadataError = "network down";
    const failingRegistry = {
      ...multiCommunityRegistry,
      get: async () => ({ status: "found" as const, community: failedMetadata }),
    };

    render(
      <CommunityDetailView
        communityId={atlasCommunity.record.id}
        registry={failingRegistry}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: /Community a{8}/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(atlasCommunity.record.governorContract)).toBeInTheDocument();
    expect(
      screen.getByText(/Community details are temporarily unavailable/i),
    ).toBeInTheDocument();
  });

  it("keeps breadcrumb links keyboard reachable and activatable", async () => {
    const user = userEvent.setup();
    render(
      <CommunityDetailView
        communityId={atlasCommunity.record.id}
        registry={multiCommunityRegistry}
      />,
    );
    await screen.findByRole("heading", { name: atlasName });

    await user.tab();
    expect(screen.getByRole("link", { name: "Home" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("link", { name: "Communities" })).toHaveFocus();
  });
});
