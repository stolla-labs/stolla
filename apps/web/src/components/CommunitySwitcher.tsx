"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCommunityRegistry } from "@/lib/community/CommunityRegistryProvider";
import type { Community } from "@/lib/community/types";
import { truncateMiddle } from "@/lib/truncate";

const COMMUNITY_ROUTE = /^\/communities\/([0-9a-fA-F]{64})(?:\/|$)/;

export function CommunitySwitcher() {
  const pathname = usePathname();
  const registry = useCommunityRegistry();
  const selectedId = pathname.match(COMMUNITY_ROUTE)?.[1]?.toLowerCase() ?? null;
  const [open, setOpen] = useState(false);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open || loaded) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const all: Community[] = [];
        let cursor: number | null = null;
        for (let pageNumber = 0; pageNumber < 20; pageNumber += 1) {
          const page = await registry.list(cursor, 50);
          if (!active) return;
          all.push(...page.communities);
          if (page.nextCursor === null) break;
          if (page.nextCursor === cursor) {
            throw new Error("The registry returned an invalid cursor.");
          }
          cursor = page.nextCursor;
        }
        const unique = Array.from(
          new Map(all.map((community) => [community.record.id, community])).values(),
        );
        setCommunities(unique);
        setLoaded(true);
      } catch {
        if (active) setError("Communities could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [loaded, open, registry]);

  const selected = communities.find(
    (community) => community.record.id === selectedId,
  );
  const selectedLabel = selected
    ? selected.metadata?.name ?? `Community ${truncateMiddle(selected.record.id)}`
    : selectedId
      ? loaded
        ? "Unknown community"
        : truncateMiddle(selectedId)
      : "Choose community";
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return communities;
    return communities.filter((community) =>
      (community.metadata?.name ?? community.record.id)
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [communities, query]);

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex min-h-10 max-w-48 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
      >
        <span className="truncate">{selectedLabel}</span>
        <span aria-hidden="true" className="text-xs text-slate-500">
          ▾
        </span>
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Choose a community"
          className="absolute left-0 top-full z-[70] mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl"
        >
          <label htmlFor="community-switcher-search" className="sr-only">
            Search communities
          </label>
          <input
            ref={searchRef}
            id="community-switcher-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search communities"
            className="min-h-11 w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 text-sm text-slate-100"
          />
          <div className="mt-2 max-h-72 overflow-y-auto">
            {loading && (
              <p role="status" className="p-3 text-sm text-slate-400">
                Loading communities…
              </p>
            )}
            {error && (
              <p role="alert" className="p-3 text-sm text-rose-300">
                {error}
              </p>
            )}
            {!loading && !error && loaded && matches.length === 0 && (
              <p className="p-3 text-sm text-slate-400">
                {communities.length === 0
                  ? "No communities are registered."
                  : "No communities match this search."}
              </p>
            )}
            {matches.map((community) => {
              const name =
                community.metadata?.name ??
                `Community ${truncateMiddle(community.record.id)}`;
              return (
                <Link
                  key={community.record.id}
                  href={`/communities/${community.record.id}`}
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                  }}
                  aria-current={
                    community.record.id === selectedId ? "page" : undefined
                  }
                  className="block min-h-11 rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-slate-800 aria-[current=page]:bg-indigo-950 aria-[current=page]:text-indigo-200"
                >
                  <span className="block truncate">{name}</span>
                  <span className="block truncate font-mono text-xs text-slate-500">
                    {truncateMiddle(community.record.id)}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
