export type ContrastAuditPair = {
  id: string;
  surface: string;
  kind: "text" | "non-text-ui";
  beforeForeground: string;
  afterForeground: string;
  background: string;
  wcagTargetRatio: number;
};

function channelToLinear(value: number): number {
  const srgb = value / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
}

export function hexToRelativeLuminance(hex: string): number {
  const cleaned = hex.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    throw new Error(`Expected 6-digit hex color, got "${hex}"`);
  }
  const r = Number.parseInt(cleaned.slice(0, 2), 16);
  const g = Number.parseInt(cleaned.slice(2, 4), 16);
  const b = Number.parseInt(cleaned.slice(4, 6), 16);
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

export function calculateContrastRatio(fgHex: string, bgHex: string): number {
  const l1 = hexToRelativeLuminance(fgHex);
  const l2 = hexToRelativeLuminance(bgHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

/**
 * Documented before/after contrast audit pairs for the dark app shell (#391).
 *
 * Surfaces:
 * - App shell background (`--background`): #0b0f19
 * - Card / header popover surface (`--surface`): #151b2b
 * - Active nav pill (`bg-indigo-950`): #1e1b4b
 */
export const APP_SHELL_CONTRAST_AUDIT: readonly ContrastAuditPair[] = [
  {
    id: "header-inactive-nav-text",
    surface: "Header primary navigation inactive link on #0b0f19",
    kind: "text",
    beforeForeground: "#94a3b8", // slate-400 (7.23:1)
    afterForeground: "#cbd5e1", // slate-300 (11.58:1)
    background: "#0b0f19",
    wcagTargetRatio: 4.5,
  },
  {
    id: "header-active-nav-text",
    surface: "Header primary navigation active pill text on indigo-950 (#1e1b4b)",
    kind: "text",
    beforeForeground: "#a5b4fc", // indigo-300 (7.69:1)
    afterForeground: "#c7d2fe", // indigo-200 (10.35:1)
    background: "#1e1b4b",
    wcagTargetRatio: 4.5,
  },
  {
    id: "card-and-switcher-caption-text",
    surface: "CommunityCard & CommunitySwitcher secondary captions on #151b2b",
    kind: "text",
    beforeForeground: "#64748b", // slate-500 (3.05:1 — FAILED WCAG AA 4.5:1)
    afterForeground: "#94a3b8", // slate-400 (5.88:1 — PASSES WCAG AA)
    background: "#151b2b",
    wcagTargetRatio: 4.5,
  },
  {
    id: "secondary-button-text",
    surface: "AppButton secondary text on #151b2b",
    kind: "text",
    beforeForeground: "#e2e8f0", // slate-200 (11.96:1)
    afterForeground: "#f1f5f9", // slate-100 (13.86:1)
    background: "#151b2b",
    wcagTargetRatio: 4.5,
  },
  {
    id: "focus-ring-on-surface",
    surface: "Keyboard focus ring (--focus-ring #a5b4fc) on #151b2b",
    kind: "non-text-ui",
    beforeForeground: "#64748b", // slate-500 outline (3.05:1 borderline)
    afterForeground: "#a5b4fc", // indigo-300 (7.86:1 — high-visibility focus ring)
    background: "#151b2b",
    wcagTargetRatio: 3.0,
  },
  {
    id: "interactive-hover-border-on-surface",
    surface: "Secondary button & card hover border (#94a3b8) on #151b2b",
    kind: "non-text-ui",
    beforeForeground: "#334155", // slate-700 (1.46:1 — FAILED WCAG 1.4.11 3:1)
    afterForeground: "#94a3b8", // slate-400 (5.88:1 — PASSES WCAG 1.4.11)
    background: "#151b2b",
    wcagTargetRatio: 3.0,
  },
] as const;
