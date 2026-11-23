import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(process.cwd(), "src/app/globals.css"), "utf8");

function token(name: string) {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i"));
  if (!match) throw new Error(`Missing hex color token --${name}`);
  return match[1];
}

function luminance(hex: string) {
  const [red, green, blue] = [1, 3, 5]
    .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) =>
      channel <= 0.04045
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );
  return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrast(first: string, second: string) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("app-shell contrast tokens", () => {
  it("keeps muted text and action text above AA on their surfaces", () => {
    expect(contrast(token("shell-muted"), token("surface"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", token("shell-primary"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", token("shell-primary-hover"))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token("shell-disabled-text"), token("shell-disabled-bg"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps control boundaries and keyboard focus visible against the card", () => {
    expect(contrast(token("shell-border"), token("surface"))).toBeGreaterThanOrEqual(3);
    expect(contrast(token("shell-disabled-border"), token("surface"))).toBeGreaterThanOrEqual(3);
    expect(contrast(token("focus-ring"), token("surface"))).toBeGreaterThanOrEqual(3);
  });
});
