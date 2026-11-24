"use client";

import {
  seasonProgress,
  seasonVisibility,
  shouldShowSeasonBanner,
  type SeasonDraft,
} from "@/lib/community/season";

export type SeasonBannerProps = {
  season: SeasonDraft;
  isOwner: boolean;
  /** Link target for season-tagged proposals when categories exist. */
  proposalsHref?: string;
  now?: Date;
};

function formatDate(value: string): string {
  const ts = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(ts)) return value;
  return new Date(ts).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Owner-defined season banner shown on community pages. Guests see it only
 * inside the configured window; owners get a preview before it starts. The
 * progress bar tracks the current date through the season.
 */
export function SeasonBanner({ season, isOwner, proposalsHref, now }: SeasonBannerProps) {
  const current = now ?? new Date();
  if (!shouldShowSeasonBanner(season, isOwner, current)) return null;

  const visibility = seasonVisibility(season, current);
  const progress = seasonProgress(season, current);
  const percent = Math.round(progress * 100);
  const isPreview = visibility === "before" && isOwner;

  return (
    <div
      role="status"
      aria-label={`Season: ${season.name}`}
      className="mt-6 rounded-xl border border-indigo-800/60 bg-indigo-950/40 p-4 text-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-indigo-100">{season.name}</span>
          {isPreview ? (
            <span className="rounded-full border border-indigo-700/60 px-2 py-0.5 text-xs text-indigo-300">
              Preview · starts {formatDate(season.startDate)}
            </span>
          ) : null}
        </div>
        <span className="text-xs text-slate-400">
          {formatDate(season.startDate)} – {formatDate(season.endDate)}
        </span>
      </div>

      {visibility === "active" ? (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-indigo-950">
            <div
              className="h-full rounded-full bg-indigo-400"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            {percent}% through the season
            {proposalsHref ? (
              <>
                {" · "}
                <a
                  href={proposalsHref}
                  className="text-indigo-300 underline underline-offset-2 hover:text-indigo-100"
                >
                  View season proposals
                </a>
              </>
            ) : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}
