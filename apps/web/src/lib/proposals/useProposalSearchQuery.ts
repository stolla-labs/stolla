"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildProposalSearchHref,
  normalizeProposalSearchQuery,
  parseProposalSearchQuery,
} from "./search-filter";

export type UseProposalSearchQueryResult = {
  query: string;
  normalizedQuery: string;
  hasActiveQuery: boolean;
  setQuery: (nextQuery: string) => void;
  clearQuery: () => void;
};

export function useProposalSearchQuery(
  initialQuery = "",
): UseProposalSearchQueryResult {
  const [query, setQueryState] = useState<string>(() => {
    if (typeof window === "undefined") return initialQuery;
    const fromUrl = parseProposalSearchQuery(window.location.search);
    return fromUrl.length > 0 ? fromUrl : initialQuery;
  });

  const syncUrl = useCallback((nextQuery: string) => {
    if (typeof window === "undefined") return;
    const nextHref = buildProposalSearchHref(
      window.location.pathname,
      window.location.search,
      nextQuery,
    );
    const currentHref = `${window.location.pathname}${window.location.search}`;
    if (nextHref !== currentHref) {
      window.history.replaceState(window.history.state, "", nextHref);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handlePopState = () => {
      setQueryState(parseProposalSearchQuery(window.location.search));
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const setQuery = useCallback(
    (nextQuery: string) => {
      setQueryState(nextQuery);
      syncUrl(nextQuery);
    },
    [syncUrl],
  );

  const clearQuery = useCallback(() => {
    setQueryState("");
    syncUrl("");
  }, [syncUrl]);

  const normalizedQuery = normalizeProposalSearchQuery(query);

  return {
    query,
    normalizedQuery,
    hasActiveQuery: normalizedQuery.length > 0,
    setQuery,
    clearQuery,
  };
}
