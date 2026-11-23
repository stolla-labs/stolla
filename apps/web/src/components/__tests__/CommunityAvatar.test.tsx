import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommunityAvatar } from "../CommunityAvatar";

describe("CommunityAvatar", () => {
  it("uses fixed image dimensions and a decorative alt value", () => {
    render(
      <CommunityAvatar
        communityId={"ab".repeat(32)}
        name="Builders Guild"
        logo="https://example.test/logo.png"
      />,
    );
    const image = screen.getByRole("presentation");
    expect(image).toHaveAttribute("width", "48");
    expect(image).toHaveAttribute("height", "48");
  });

  it("replaces a broken logo with a deterministic initial fallback", () => {
    render(
      <CommunityAvatar
        communityId={"cd".repeat(32)}
        name="Civic DAO"
        logo="https://example.test/broken.png"
      />,
    );
    fireEvent.error(screen.getByRole("presentation"));
    expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
    expect(screen.getByText("C")).toHaveAttribute("aria-hidden", "true");
  });

  it("shows the primary gateway first and fails over before the placeholder", () => {
    process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL = "https://ipfs.io/ipfs/";
    process.env.NEXT_PUBLIC_IPFS_GATEWAY_URLS = "https://one.example/ipfs/";
    render(
      <CommunityAvatar
        communityId={"ef".repeat(32)}
        name="Guild"
        logo="ipfs://bafy-logo/logo.png"
      />,
    );
    const image = screen.getByRole("presentation");
    expect(image).toHaveAttribute(
      "src",
      "https://one.example/ipfs/bafy-logo/logo.png",
    );
    fireEvent.error(image);
    expect(screen.getByRole("presentation")).toHaveAttribute(
      "src",
      "https://ipfs.io/ipfs/bafy-logo/logo.png",
    );
    fireEvent.error(screen.getByRole("presentation"));
    expect(screen.queryByRole("presentation")).not.toBeInTheDocument();
    expect(screen.getByText("G")).toHaveAttribute("aria-hidden", "true");
    delete process.env.NEXT_PUBLIC_IPFS_GATEWAY_URLS;
  });
});
