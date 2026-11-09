import { parseProposalDescription } from "../proposal-metadata/parse";

export const PROPOSAL_SEARCH_PARAM = "q";

export type SearchableProposalItem = {
  id: string;
  description?: string | null;
  title?: string | null;
  summary?: string | null;
};

export type ProposalSearchText = {
  id: string;
  title: string | null;
  summary: string | null;
  raw: string;
};

function toUrlSearchParams(
  input:
    | URLSearchParams
    | { get(name: string): string | null }
    | string
    | null
    | undefined,
): URLSearchParams | { get(name: string): string | null } | null {
  if (!input) return null;
  if (typeof input === "string") {
    const normalized = input.startsWith("?") ? input.slice(1) : input;
    return new URLSearchParams(normalized);
  }
  return input;
}

export function normalizeProposalSearchQuery(query: string | null | undefined): string {
  if (typeof query !== "string") return "";
  return query.trim().replace(/\s+/g, " ");
}

export function parseProposalSearchQuery(
  searchParams:
    | URLSearchParams
    | { get(name: string): string | null }
    | string
    | null
    | undefined,
): string {
  const params = toUrlSearchParams(searchParams);
  if (!params) return "";
  const raw = params.get(PROPOSAL_SEARCH_PARAM);
  return typeof raw === "string" ? raw : "";
}

export function updateProposalSearchUrlParams(
  currentSearch: string | URLSearchParams,
  nextQuery: string,
): string {
  const rawSearch =
    typeof currentSearch === "string"
      ? currentSearch.startsWith("?")
        ? currentSearch.slice(1)
        : currentSearch
      : currentSearch.toString();
  const params = new URLSearchParams(rawSearch);
  const normalized = normalizeProposalSearchQuery(nextQuery);

  if (normalized.length > 0) {
    params.set(PROPOSAL_SEARCH_PARAM, normalized);
  } else {
    params.delete(PROPOSAL_SEARCH_PARAM);
  }

  return params.toString();
}

export function buildProposalSearchHref(
  pathname: string,
  currentSearch: string | URLSearchParams,
  nextQuery: string,
): string {
  const nextParams = updateProposalSearchUrlParams(currentSearch, nextQuery);
  return nextParams.length > 0 ? `${pathname}?${nextParams}` : pathname;
}

export function extractProposalSearchText(
  item: SearchableProposalItem,
  descriptionsById?: Record<string, string>,
): ProposalSearchText {
  const rawDescription =
    typeof item.description === "string"
      ? item.description
      : typeof descriptionsById?.[item.id] === "string"
        ? descriptionsById[item.id]
        : "";

  if (rawDescription.length > 0) {
    const parsed = parseProposalDescription(rawDescription);
    if (parsed.kind === "versioned") {
      return {
        id: item.id,
        title: parsed.metadata.title,
        summary: parsed.metadata.summary,
        raw: rawDescription,
      };
    }
    return {
      id: item.id,
      title: item.title ?? null,
      summary: item.summary ?? rawDescription.trim(),
      raw: rawDescription,
    };
  }

  return {
    id: item.id,
    title: item.title ?? null,
    summary: item.summary ?? null,
    raw: "",
  };
}

export function matchesProposalSearch(
  item: SearchableProposalItem,
  query: string,
  descriptionsById?: Record<string, string>,
): boolean {
  const normalizedQuery = normalizeProposalSearchQuery(query).toLowerCase();
  if (!normalizedQuery) return true;

  const extracted = extractProposalSearchText(item, descriptionsById);
  const haystacks = [
    extracted.title,
    extracted.summary,
    extracted.id,
    `#${extracted.id}`,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  return haystacks.some((field) => field.toLowerCase().includes(normalizedQuery));
}

export function filterProposalsBySearch<T extends SearchableProposalItem>(
  items: readonly T[],
  query: string,
  descriptionsById?: Record<string, string>,
): T[] {
  const normalizedQuery = normalizeProposalSearchQuery(query);
  if (!normalizedQuery) return [...items];
  return items.filter((item) =>
    matchesProposalSearch(item, normalizedQuery, descriptionsById),
  );
}
