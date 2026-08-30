import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommunitySwitcher } from "@/components/community/CommunitySwitcher";
import {
  atlasCommunity,
  beaconCommunity,
  multiCommunityFixtures,
} from "@/test/fixtures/communities";

describe("CommunitySwitcher", () => {
  it("links to every registered community with correct hrefs", () => {
    render(
      <CommunitySwitcher
        communities={multiCommunityFixtures}
        activeCommunityId={atlasCommunity.record.id}
      />,
    );

    for (const community of multiCommunityFixtures) {
      const name = community.metadata?.name ?? community.record.id;
      expect(screen.getByRole("link", { name })).toHaveAttribute(
        "href",
        `/community/${community.record.id}`,
      );
    }
  });

  it("marks only the active community as current", () => {
    render(
      <CommunitySwitcher
        communities={multiCommunityFixtures}
        activeCommunityId={beaconCommunity.record.id}
      />,
    );

    expect(screen.getByRole("link", { name: beaconCommunity.metadata!.name })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: atlasCommunity.metadata!.name }),
    ).not.toHaveAttribute("aria-current");
  });

  it("renders nothing when no communities are registered", () => {
    const { container } = render(
      <CommunitySwitcher communities={[]} activeCommunityId={undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("is fully keyboard reachable in registry order", async () => {
    const user = userEvent.setup();
    render(
      <CommunitySwitcher
        communities={multiCommunityFixtures}
        activeCommunityId={atlasCommunity.record.id}
      />,
    );

    for (const community of multiCommunityFixtures) {
      await user.tab();
      const name = community.metadata?.name ?? community.record.id;
      expect(screen.getByRole("link", { name })).toHaveFocus();
    }
  });
});
