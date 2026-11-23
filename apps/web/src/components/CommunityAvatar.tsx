"use client";

import { useState } from "react";
import { communityLogoUrls } from "@/lib/community/ipfsGateways";

const FALLBACK_STYLES = [
  "border-indigo-700 bg-indigo-950 text-indigo-300",
  "border-cyan-700 bg-cyan-950 text-cyan-300",
  "border-emerald-700 bg-emerald-950 text-emerald-300",
  "border-violet-700 bg-violet-950 text-violet-300",
  "border-amber-700 bg-amber-950 text-amber-300",
] as const;

function fallbackStyle(id: string) {
  let hash = 0;
  for (const character of id) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return FALLBACK_STYLES[hash % FALLBACK_STYLES.length];
}

export function CommunityAvatar({
  communityId,
  name,
  logo,
  size = "card",
}: {
  communityId: string;
  name: string;
  logo?: string;
  size?: "card" | "detail";
}) {
  const urls = communityLogoUrls(logo);
  const [attempt, setAttempt] = useState(0);
  const [attemptLogo, setAttemptLogo] = useState(logo);
  const index = attemptLogo === logo ? attempt : 0;
  const source = urls[index];

  const sizeClass =
    size === "detail"
      ? "h-16 w-16 text-2xl sm:h-20 sm:w-20"
      : "h-12 w-12 text-lg";
  const sharedClass = `${sizeClass} shrink-0 rounded-xl border`;

  if (source) {
    return (
      // The adjacent heading already provides the community name.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={source}
        alt=""
        width={size === "detail" ? 80 : 48}
        height={size === "detail" ? 80 : 48}
        onError={() => {
          setAttemptLogo(logo);
          setAttempt(index + 1);
        }}
        className={`${sharedClass} bg-slate-900 object-cover`}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${sharedClass} flex items-center justify-center font-semibold ${fallbackStyle(
        communityId,
      )}`}
    >
      {name.trim().charAt(0).toUpperCase() || "C"}
    </div>
  );
}
