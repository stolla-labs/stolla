export interface LandingActivityRow {
  id: string;
  community: string;
  title: string;
}

const DEMO_ROWS: LandingActivityRow[] = [
  { id: "demo-treasury", community: "demo", title: "Treasury allocation Q1" },
  { id: "demo-brand", community: "demo", title: "Brand guidelines update" },
  { id: "demo-badge", community: "demo", title: "Membership badge refresh" },
];

export function landingActivity(input: { live: LandingActivityRow[] | null; error: boolean }) {
  if (input.live && input.live.length > 0) {
    return { mode: "live" as const, label: "Registry", rows: input.live.slice(0, 3) };
  }
  return { mode: input.error ? ("error" as const) : ("demo" as const), label: "Demo", rows: DEMO_ROWS };
}

export function activityHref(row: LandingActivityRow, mode: "live" | "demo" | "error"): string {
  if (mode !== "live") return "/proposals";
  return `/communities/${row.community}/proposals/${row.id}`;
}
