export type SeasonDraft = {
  name: string;
  startDate: string; // ISO date, e.g. "2026-11-01"
  endDate: string; // ISO date, inclusive
};

export type SeasonOverlay = SeasonDraft & {
  createdAt: string;
  /** Set when the season has ended and was moved into the archive history. */
  archivedAt?: string;
};

export type SeasonVisibility = "before" | "active" | "ended";

/** A season window is inclusive on both ends and resolves against the current date. */
export function seasonVisibility(
  season: Pick<SeasonDraft, "startDate" | "endDate">,
  now: Date = new Date(),
): SeasonVisibility {
  const start = parseDateOnly(season.startDate);
  const end = parseDateOnly(season.endDate);
  const today = toDateOnly(now);

  if (start === null || end === null) return "before";
  if (end < start) return "before";
  if (today < start) return "before";
  if (today > end) return "ended";
  return "active";
}

/** Progress through the season in [0, 1]; clamped and NaN-safe. */
export function seasonProgress(
  season: Pick<SeasonDraft, "startDate" | "endDate">,
  now: Date = new Date(),
): number {
  const start = parseDateOnly(season.startDate);
  const end = parseDateOnly(season.endDate);
  const today = toDateOnly(now);
  if (start === null || end === null || end < start) return 0;

  const total = end - start;
  if (total <= 0) return 1;
  const elapsed = today - start;
  const ratio = elapsed / total;
  if (ratio <= 0) return 0;
  if (ratio >= 1) return 1;
  return ratio;
}

export function isSeasonActive(
  season: Pick<SeasonDraft, "startDate" | "endDate">,
  now: Date = new Date(),
): boolean {
  return seasonVisibility(season, now) === "active";
}

/** Banner is guest-visible only inside the window; owners also preview it. */
export function shouldShowSeasonBanner(
  season: Pick<SeasonDraft, "startDate" | "endDate">,
  isOwner: boolean,
  now: Date = new Date(),
): boolean {
  return isSeasonActive(season, now) || (isOwner && seasonVisibility(season, now) === "before");
}

export function seasonStorageKey(communityId: string): string {
  return `stolla.community-season.${communityId}`;
}

export function readSeasonOverlay(communityId: string): SeasonOverlay | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(seasonStorageKey(communityId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SeasonOverlay;
    if (!parsed.name || !parsed.startDate || !parsed.endDate) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSeasonOverlay(communityId: string, overlay: SeasonOverlay): void {
  window.sessionStorage.setItem(seasonStorageKey(communityId), JSON.stringify(overlay));
}

/** Archive an ended season to the history list (most recent first). */
export function archiveSeason(history: SeasonOverlay[], ended: SeasonOverlay): SeasonOverlay[] {
  const next = history.filter(
    (entry) => entry.name !== ended.name || entry.startDate !== ended.startDate,
  );
  return [{ ...ended, archivedAt: new Date().toISOString() }, ...next];
}

/** Resolve a draft's YYYY-MM-DD into a UTC midnight timestamp (or null when malformed). */
export function parseDateOnly(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ts = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(ts) ? null : ts;
}

/** Normalize a Date to a UTC-midnight timestamp for inclusive day comparison. */
export function toDateOnly(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
