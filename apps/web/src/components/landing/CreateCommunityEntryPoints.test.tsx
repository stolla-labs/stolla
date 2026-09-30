import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CtaSection } from "./CtaSection";
import { HeroSection } from "./HeroSection";
import { LandingHeader } from "./LandingHeader";
import { ShowcaseSection } from "./ShowcaseSection";

describe("landing community creation entry points", () => {
  it("links both accessible actions to the canonical wizard route with fee copy", () => {
    render(
      <>
        <HeroSection />
        <CtaSection />
      </>,
    );
    const actions = screen.getAllByRole("link", {
      name: "Create a community",
    });
    expect(actions).toHaveLength(2);
    for (const action of actions) {
      expect(action).toHaveAttribute("href", "/communities/create");
    }
    expect(screen.getAllByText(/network fees/)).toHaveLength(2);
  });
});

describe("landing header app handoff", () => {
  it("points both Enter app CTAs at /communities with ghost weight", () => {
    render(<LandingHeader />);
    const ctas = screen.getAllByRole("link", { name: "Enter app" });
    expect(ctas).toHaveLength(2);
    for (const cta of ctas) {
      expect(cta).toHaveAttribute("href", "/communities");
      expect(cta).toHaveClass("lp-btn-ghost");
    }
  });

  it("exposes app destinations in the mobile menu", () => {
    render(<LandingHeader />);
    expect(
      screen.queryByRole("link", { name: "Communities" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByText("Explore the app")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Communities" })).toHaveAttribute(
      "href",
      "/communities",
    );
    expect(screen.getByRole("link", { name: "Proposals" })).toHaveAttribute(
      "href",
      "/proposals",
    );
  });
});

describe("showcase illustrative labeling", () => {
  it("visibly marks examples as illustrative demo data", () => {
    render(<ShowcaseSection />);
    expect(
      screen.getByText("Showcase · Illustrative demo"),
    ).toBeInTheDocument();
    expect(screen.getByText(/not live on-chain data/)).toBeInTheDocument();
  });
});
