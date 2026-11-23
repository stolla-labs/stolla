export type CommunityActivity = "active" | "paused" | "archived";

/** Soroban may return the enum as a name, a numeric discriminant, or `{ tag }`. */
export function parseCommunityActivity(value: unknown): CommunityActivity {
  const raw =
    value && typeof value === "object" && "tag" in value
      ? (value as { tag: unknown }).tag
      : value;
  const text = String(raw ?? "").toLowerCase();
  if (text === "1" || text.includes("paused")) return "paused";
  if (text === "2" || text.includes("archived")) return "archived";
  return "active";
}

export function communityActivityLabel(
  activity: CommunityActivity | undefined,
): string | null {
  if (activity === "paused") return "Paused";
  if (activity === "archived") return "Archived";
  return null;
}

/** Why minting and new proposals are unavailable. `null` means writes are open. */
export function communityWriteBlockReason(
  activity: CommunityActivity | undefined,
): string | null {
  if (activity === "paused") {
    return "This community is paused. Minting and new proposals are disabled until an owner resumes it.";
  }
  if (activity === "archived") {
    return "This community is archived. Minting and new proposals stay disabled.";
  }
  return null;
}
