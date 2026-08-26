import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AppButton, type AppButtonTone } from "./AppButton";
import { AppLinkButton } from "./AppLinkButton";

const tones: AppButtonTone[] = ["primary", "secondary", "danger", "success"];

const toneClassExpectations: Record<AppButtonTone, string> = {
  primary: "bg-indigo-500",
  secondary: "border-slate-700",
  danger: "border-rose-700",
  success: "bg-emerald-600",
};

describe("AppButton", () => {
  it("renders every tone with the expected tone class", () => {
    render(
      <div>
        {tones.map((tone) => (
          <AppButton key={tone} tone={tone}>
            {tone}
          </AppButton>
        ))}
      </div>,
    );

    for (const tone of tones) {
      const button = screen.getByRole("button", { name: tone });
      expect(button).toBeInTheDocument();
      expect(button.className).toContain(toneClassExpectations[tone]);
    }
  });

  it("defaults to type=button and preserves an explicit type", () => {
    render(
      <div>
        <AppButton>Default</AppButton>
        <AppButton type="submit">Submit</AppButton>
      </div>,
    );
    expect(screen.getByRole("button", { name: "Default" })).toHaveAttribute(
      "type",
      "button",
    );
    expect(screen.getByRole("button", { name: "Submit" })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("renders both sizes", () => {
    const { rerender } = render(<AppButton size="sm">Small</AppButton>);
    const button = screen.getByRole("button", { name: "Small" });
    expect(button.className).toContain("min-h-9");

    rerender(<AppButton size="md">Small</AppButton>);
    expect(screen.getByRole("button", { name: "Small" }).className).toContain(
      "min-h-11",
    );
  });

  it("merges layout-only className at the call site", () => {
    render(<AppButton className="mt-4 w-full">Continue</AppButton>);
    const button = screen.getByRole("button", { name: "Continue" });
    expect(button.className).toContain("mt-4");
    expect(button.className).toContain("w-full");
  });

  it("preserves click handlers", async () => {
    const onClick = vi.fn();
    render(<AppButton onClick={onClick}>Click me</AppButton>);
    await userEvent.click(screen.getByRole("button", { name: "Click me" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("forwards refs", () => {
    const ref = createRef<HTMLButtonElement>();
    render(<AppButton ref={ref}>With ref</AppButton>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("exposes disabled semantics and blocks handlers", async () => {
    const onClick = vi.fn();
    render(
      <AppButton disabled onClick={onClick}>
        Disabled
      </AppButton>,
    );
    const button = screen.getByRole("button", { name: "Disabled" });
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("preserves native button attributes", () => {
    render(
      <AppButton type="submit" aria-label="Save" data-testid="save-btn">
        Save
      </AppButton>,
    );
    const button = screen.getByTestId("save-btn");
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toHaveAttribute("aria-label", "Save");
  });
});

describe("AppLinkButton", () => {
  it("preserves href and external-link attributes", () => {
    render(
      <AppLinkButton
        href="/community/demo"
        target="_blank"
        rel="noreferrer"
      >
        Open community
      </AppLinkButton>,
    );
    const link = screen.getByRole("link", { name: "Open community" });
    expect(link).toHaveAttribute("href", "/community/demo");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
  });

  it("renders tones and sizes identically to AppButton", () => {
    render(
      <AppLinkButton href="/proposals" tone="danger" size="sm">
        Discard
      </AppLinkButton>,
    );
    const link = screen.getByRole("link", { name: "Discard" });
    expect(link.className).toContain("min-h-9");
    expect(link.className).toContain("border-rose-700");
  });
});
