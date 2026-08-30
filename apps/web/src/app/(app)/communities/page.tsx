"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CommunityCard } from "@/components/CommunityCard";
import { AsyncState } from "@/components/ui/AsyncState";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FreshnessNotice } from "@/components/ui/FreshnessNotice";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCommunityRegistry } from "@/lib/community/CommunityRegistryProvider";
import type { Community } from "@/lib/community/types";

const PAGE_SIZE = 9;
const MAX_QUERY_LENGTH = 100;
const MAX_PAGE = 100;

type ListUrlState = { query: string; page: number };

function readListUrlState(): ListUrlState {
  const parameters = new URLSearchParams(window.location.search);
  const query = (parameters.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);
  const rawPage = parameters.get("page");
  const parsedPage = rawPage && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const page =
    Number.isSafeInteger(parsedPage) && parsedPage >= 1 && parsedPage <= MAX_PAGE
      ? parsedPage
      : 1;
  return { query, page };
}

function writeListUrlState(
  { query, page }: ListUrlState,
  mode: "push" | "replace",
) {
  const parameters = new URLSearchParams();
  const normalizedQuery = query.trim().slice(0, MAX_QUERY_LENGTH);
  if (normalizedQuery) parameters.set("q", normalizedQuery);
  if (page > 1) parameters.set("page", String(page));
  const search = parameters.toString();
  const url = `${window.location.pathname}${search ? `?${search}` : ""}`;
  window.history[mode === "push" ? "pushState" : "replaceState"]({}, "", url);
}

export default function CommunitiesPage() {
  const registry = useCommunityRegistry();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skippedRecords, setSkippedRecords] = useState(0);
  const [query, setQuery] = useState("");
  const [loadedPages, setLoadedPages] = useState(0);
  const requestSequence = useRef(0);
  const seenIds = useRef(new Set<string>());
  const nextCursorRef = useRef<number | null>(null);
  const loadedPagesRef = useRef(0);

  const loadPage = useCallback(
    async (replace: boolean, updateUrl = true) => {
      const sequence = ++requestSequence.current;
      const cursor = replace ? null : nextCursorRef.current;
      setLoading(true);
      setError(null);

      try {
        const page = await registry.list(cursor, PAGE_SIZE);
        if (sequence !== requestSequence.current) return;
        if (page.nextCursor !== null && page.nextCursor === cursor) {
          throw new Error(
            "The registry returned the same cursor. Pagination stopped to prevent duplicate records.",
          );
        }

        if (replace) seenIds.current.clear();
        const unique = page.communities.filter((community) => {
          if (seenIds.current.has(community.record.id)) return false;
          seenIds.current.add(community.record.id);
          return true;
        });
        const duplicateCount = page.communities.length - unique.length;
        setSkippedRecords(
          (count) =>
            (replace ? 0 : count) +
            page.malformedRecords +
            duplicateCount,
        );
        setCommunities((current) =>
          replace ? unique : [...current, ...unique],
        );
        nextCursorRef.current = page.nextCursor;
        setNextCursor(page.nextCursor);
        setHasLoaded(true);
        const nextPageCount = replace ? 1 : loadedPagesRef.current + 1;
        loadedPagesRef.current = nextPageCount;
        setLoadedPages(nextPageCount);
        if (updateUrl) {
          writeListUrlState(
            { query: readListUrlState().query, page: nextPageCount },
            "push",
          );
        }
        return true;
      } catch (cause) {
        if (sequence !== requestSequence.current) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "The community registry could not be loaded.",
        );
        return false;
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    },
    [registry],
  );

  useEffect(() => {
    let active = true;
    const restore = async (mode: "replace" | "pop") => {
      const state = readListUrlState();
      setQuery(state.query);
      if (mode === "replace") writeListUrlState(state, "replace");
      const firstLoaded = await loadPage(true, false);
      if (!active || !firstLoaded) return;
      for (
        let page = 2;
        page <= state.page && nextCursorRef.current !== null;
        page += 1
      ) {
        const loaded = await loadPage(false, false);
        if (!active || !loaded) break;
      }
      if (loadedPagesRef.current !== state.page) {
        writeListUrlState(
          { query: state.query, page: loadedPagesRef.current || 1 },
          "replace",
        );
      }
    };
    const timeout = window.setTimeout(() => void restore("replace"), 0);
    const onPopState = () => {
      requestSequence.current += 1;
      seenIds.current.clear();
      nextCursorRef.current = null;
      loadedPagesRef.current = 0;
      setCommunities([]);
      setHasLoaded(false);
      void restore("pop");
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      active = false;
      window.clearTimeout(timeout);
      window.removeEventListener("popstate", onPopState);
    };
  }, [loadPage]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleCommunities = useMemo(
    () =>
      normalizedQuery
        ? communities.filter((community) =>
            (community.metadata?.name ?? "")
              .toLocaleLowerCase()
              .includes(normalizedQuery),
          )
        : communities,
    [communities, normalizedQuery],
  );

  function updateQuery(value: string) {
    const nextQuery = value.slice(0, MAX_QUERY_LENGTH);
    setQuery(nextQuery);
    writeListUrlState(
      { query: nextQuery, page: loadedPages || 1 },
      "push",
    );
  }

  const metadataFailureCount = communities.filter(
    (community) => community.metadataError,
  ).length;
  const governanceFailureCount = communities.filter(
    (community) => community.governance.unavailableFields.length > 0,
  ).length;
  const hasPartialData =
    skippedRecords > 0 ||
    metadataFailureCount > 0 ||
    governanceFailureCount > 0;

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-100">Communities</h1>
          <p className="mt-2 max-w-2xl text-slate-400">
            Discover public governance communities registered on Stellar. No
            wallet connection is required.
          </p>
        </div>
        <Link
          href="/communities/create"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
        >
          Create a community
        </Link>
      </div>

      <div className="mt-6 max-w-xl">
        <label htmlFor="community-search" className="text-sm font-medium text-slate-300">
          Search communities by name
        </label>
        <div className="mt-2 flex min-w-0 gap-2">
          <input
            id="community-search"
            type="search"
            value={query}
            maxLength={MAX_QUERY_LENGTH}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Search community names"
            className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => updateQuery("")}
              className="min-h-11 shrink-0 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {hasPartialData && (
        <FreshnessNotice className="mt-6">
          Some registry data is unavailable. Valid communities remain listed.
          {skippedRecords > 0
            ? ` ${skippedRecords} malformed or duplicate ${skippedRecords === 1 ? "record was" : "records were"} skipped.`
            : ""}
          {metadataFailureCount > 0
            ? ` Metadata failed for ${metadataFailureCount}.`
            : ""}
          {governanceFailureCount > 0
            ? ` Governance settings failed for ${governanceFailureCount}.`
            : ""}
        </FreshnessNotice>
      )}

      {loading && communities.length === 0 && (
        <>
          <AsyncState className="sr-only">
            Loading registered communities…
          </AsyncState>
          <ul
            className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            aria-hidden="true"
          >
            {Array.from({ length: 3 }, (_, index) => (
              <li
                key={index}
                className="rounded-xl border border-slate-800 bg-[#151b2b] p-5"
              >
                <div className="flex gap-3">
                  <Skeleton className="h-12 w-12" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="mt-2 h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="mt-5 h-16 w-full" />
                <Skeleton className="mt-5 h-20 w-full" />
              </li>
            ))}
          </ul>
        </>
      )}

      {error && (
        <ErrorState
          className="mt-6"
          title="Community registry is temporarily unavailable"
          onRetry={() => void loadPage(communities.length === 0)}
          retryLabel="Retry registry request"
          retrying={loading}
        >
          {error}
        </ErrorState>
      )}

      {!loading &&
        !error &&
        hasLoaded &&
        communities.length === 0 &&
        nextCursor === null && (
          <EmptyState className="mt-6 p-6 text-center">
            No communities are registered yet. You can prepare the first
            community without connecting a wallet.
          </EmptyState>
        )}

      {!loading &&
        !error &&
        communities.length > 0 &&
        visibleCommunities.length === 0 && (
          <EmptyState className="mt-6 p-6 text-center">
            No communities match “{query.trim()}”.
            <button
              type="button"
              onClick={() => updateQuery("")}
              className="ml-2 min-h-11 rounded-lg px-3 py-2 text-indigo-300 hover:bg-slate-800"
            >
              Clear search
            </button>
          </EmptyState>
        )}

      {visibleCommunities.length > 0 && (
        <ul className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visibleCommunities.map((community) => (
            <li key={community.record.id} className="min-w-0">
              <CommunityCard community={community} />
            </li>
          ))}
        </ul>
      )}

      {nextCursor !== null && !error && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => void loadPage(false)}
            disabled={loading}
            className="min-h-11 w-full rounded-lg border border-slate-700 bg-[#151b2b] px-5 py-2 text-sm font-medium text-slate-100 hover:bg-slate-800/80 disabled:opacity-50 sm:w-auto"
          >
            {loading ? "Loading more…" : "Load more communities"}
          </button>
        </div>
      )}
    </div>
  );
}
