import { beforeEach, describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: navigation.redirect,
}));

describe("community/new redirect", () => {
  beforeEach(() => {
    navigation.redirect.mockClear();
  });

  it("permanently redirects to the canonical /communities/create wizard", async () => {
    const { default: CommunityNewRedirectPage } = await import(
      "@/app/(app)/community/new/page"
    );

    expect(() => CommunityNewRedirectPage()).toThrow("NEXT_REDIRECT");
    expect(navigation.redirect).toHaveBeenCalledTimes(1);
    expect(navigation.redirect).toHaveBeenCalledWith("/communities/create");
  });
});
