import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CommunityAvatar } from "./CommunityAvatar";
import { resolveCommunityResourceUrls } from "@/lib/community/schema";

describe("IPFS gateway failover for community logos (#399)", () => {
  it("resolves ipfs:// URIs into deduplicated ordered gateway URLs", () => {
    const urls = resolveCommunityResourceUrls("ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/logo.png", [
      "https://ipfs.io/ipfs/",
      "https://dweb.link/ipfs",
      "https://w3s.link/ipfs/",
    ]);
    expect(urls).toEqual([
      "https://ipfs.io/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/logo.png",
      "https://dweb.link/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/logo.png",
      "https://w3s.link/ipfs/bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/logo.png",
    ]);
  });

  it("advances across fallback IPFS gateways on error and renders initials after all fail", () => {
    const { container } = render(
      <CommunityAvatar
        communityId="community-1"
        name="Stellar Builders"
        logo="ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi/logo.png"
      />,
    );

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toContain("https://ipfs.io/ipfs/");

    // Fail primary gateway -> switches to 2nd gateway (dweb.link)
    fireEvent.error(img!);
    const imgAfterFirstError = container.querySelector("img");
    expect(imgAfterFirstError).not.toBeNull();
    expect(imgAfterFirstError?.getAttribute("src")).toContain(
      "https://dweb.link/ipfs/",
    );

    // Fail 2nd gateway -> switches to 3rd gateway (w3s.link)
    fireEvent.error(imgAfterFirstError!);
    const imgAfterSecondError = container.querySelector("img");
    expect(imgAfterSecondError).not.toBeNull();
    expect(imgAfterSecondError?.getAttribute("src")).toContain(
      "https://w3s.link/ipfs/",
    );

    // Fail 3rd gateway -> falls back to community initial ("S") without looping
    fireEvent.error(imgAfterSecondError!);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("S")).toBeInTheDocument();
  });
});
