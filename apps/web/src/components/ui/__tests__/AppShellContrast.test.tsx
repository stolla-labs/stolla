import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  AppButton,
  appButtonBaseClass,
  appButtonToneClass,
} from "../AppButton";

describe("App-shell interactive contrast & accessibility (#391)", () => {
  it("keeps 3px visible focus outlines and non-color-only disabled affordances on AppButton", () => {
    expect(appButtonBaseClass).toContain("focus-visible:outline-[3px]");
    expect(appButtonToneClass.primary).toContain("disabled:cursor-not-allowed");
    expect(appButtonToneClass.secondary).toContain("disabled:border-dashed");
    expect(appButtonToneClass.secondary).toContain("text-slate-100");

    render(
      <AppButton tone="secondary" disabled>
        Disabled Secondary Action
      </AppButton>,
    );

    const btn = screen.getByRole("button", {
      name: "Disabled Secondary Action",
    });
    expect(btn).toBeDisabled();
    expect(btn.className).toContain("disabled:border-dashed");
  });
});
