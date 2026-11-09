import { describe, expect, it } from "vitest";
import {
  appButtonBaseClass,
  appButtonToneClass,
} from "@/components/ui/AppButton";
import {
  APP_SHELL_CONTRAST_AUDIT,
  calculateContrastRatio,
} from "./contrastAudit";

describe("app-shell interactive contrast audit (#391)", () => {
  it("ensures every audited after-state color pair meets or exceeds its WCAG AA target", () => {
    for (const pair of APP_SHELL_CONTRAST_AUDIT) {
      const beforeRatio = calculateContrastRatio(
        pair.beforeForeground,
        pair.background,
      );
      const afterRatio = calculateContrastRatio(
        pair.afterForeground,
        pair.background,
      );

      expect(afterRatio, `${pair.id} should meet WCAG target`).toBeGreaterThanOrEqual(
        pair.wcagTargetRatio,
      );
      expect(afterRatio, `${pair.id} should improve over before state`).toBeGreaterThan(
        beforeRatio,
      );
    }
  });

  it("fixes the failing slate-500 caption contrast (3.05:1 -> 5.88:1) on card surfaces", () => {
    const captionPair = APP_SHELL_CONTRAST_AUDIT.find(
      (p) => p.id === "card-and-switcher-caption-text",
    )!;
    const beforeRatio = calculateContrastRatio(
      captionPair.beforeForeground,
      captionPair.background,
    );
    const afterRatio = calculateContrastRatio(
      captionPair.afterForeground,
      captionPair.background,
    );

    expect(beforeRatio).toBeLessThan(4.5);
    expect(afterRatio).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps disabled CTAs distinguishable without relying on color alone and preserves primary CTA classes", () => {
    expect(appButtonBaseClass).toContain("disabled:border-dashed");
    expect(appButtonBaseClass).toContain("disabled:cursor-not-allowed");
    expect(appButtonBaseClass).toContain("focus-visible:outline-[3px]");

    // No regression on primary / secondary / danger / success tones
    expect(appButtonToneClass.primary).toContain("bg-indigo-500");
    expect(appButtonToneClass.primary).toContain("disabled:btn-disabled-primary");
    expect(appButtonToneClass.secondary).toContain("border-slate-600");
    expect(appButtonToneClass.danger).toContain("border-rose-700");
    expect(appButtonToneClass.success).toContain("bg-emerald-600");
  });
});
