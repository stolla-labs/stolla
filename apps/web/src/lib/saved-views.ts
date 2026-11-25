/**
 * Named filter presets for the proposal lists, stored on the device.
 *
 * A delegate doing weekly governance applies the same three filters every
 * time (Active, a category, ending soon). A saved view is that combination
 * under a name, applied in one click, and it lives in browser storage for the
 * same reason the watchlist does: there is no server-side preference store, and
 * a filter preset is not worth inventing one for.
 *
 * Two scopes that must never mix. A view saved while reading one community's
 * proposals belongs to that community; a view saved on the global list belongs
 * to the inbox. The storage key carries both the wallet and the scope, so
 * switching wallets or communities never shows somebody else's presets — and a
 * guest with no wallet connected gets their own device-local set rather than
 * nothing.
 */

/** The filter parameters a view is allowed to carry, and the only ones it restores. */
export const VIEW_PARAMS = ["state", "q", "category"] as const;

export type ViewParam = (typeof VIEW_PARAMS)[number];

export type SavedView = {
  /** Stable id, so renaming a view does not orphan the one in the URL. */
  id: string;
  name: string;
  params: Partial<Record<ViewParam, string>>;
  savedAt: string;
};

export type SavedViewsFile = {
  version: 1;
  views: SavedView[];
};

/** The scope a view belongs to: one community, or the global proposal inbox. */
export const GLOBAL_SCOPE = "global" as const;

export const MAX_VIEWS = 12;
export const MAX_NAME_LENGTH = 40;
/** What a guest's views are keyed under, so a device keeps them without a wallet. */
export const GUEST_WALLET = "guest" as const;

function storageKey(walletAddress: string, scope: string): string {
  const wallet = walletAddress.trim() || GUEST_WALLET;
  return `stolla:saved-views:v1:${wallet}:${scope.trim() || GLOBAL_SCOPE}`;
}

function isView(value: unknown): value is SavedView {
  if (!value || typeof value !== "object") return false;
  const view = value as SavedView;
  if (
    typeof view.id !== "string" ||
    typeof view.name !== "string" ||
    typeof view.savedAt !== "string" ||
    !view.params ||
    typeof view.params !== "object"
  ) {
    return false;
  }
  // A view carrying a parameter this version does not apply would be a view
  // that silently does less than its name promises, so it is rejected whole.
  return Object.keys(view.params).every((key) =>
    (VIEW_PARAMS as readonly string[]).includes(key),
  );
}

export function readSavedViews(walletAddress: string, scope: string): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(walletAddress, scope));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return [];
    const file = parsed as SavedViewsFile;
    if (file.version !== 1 || !Array.isArray(file.views)) return [];
    return file.views.filter(isView).slice(0, MAX_VIEWS);
  } catch {
    // Storage can be disabled, full, or hold something another version wrote.
    // A reader of a proposal list should get the list, not an error about a
    // preference.
    return [];
  }
}

export function writeSavedViews(
  walletAddress: string,
  scope: string,
  views: SavedView[],
): void {
  if (typeof window === "undefined") return;
  try {
    const file: SavedViewsFile = { version: 1, views: views.slice(0, MAX_VIEWS) };
    localStorage.setItem(storageKey(walletAddress, scope), JSON.stringify(file));
  } catch {
    // Nothing to do and nothing worth saying: the filters still apply, and what
    // is lost is the page remembering them next visit.
  }
}

/** The filter parameters currently in the URL, and nothing else from it. */
export function viewParamsFrom(search: URLSearchParams): Partial<Record<ViewParam, string>> {
  const params: Partial<Record<ViewParam, string>> = {};
  for (const name of VIEW_PARAMS) {
    const value = search.get(name)?.trim();
    if (value) params[name] = value;
  }
  return params;
}

/**
 * The search string that applies a view, keeping anything else already in the
 * URL.
 *
 * A proposal list carries more than filters — a scroll anchor, a referrer — and
 * applying a view should not throw those away. What it does clear is any filter
 * the view does not name: a view called "Active treasury" must not leave an
 * unrelated search term from the previous view in place.
 */
export function applyViewToSearch(
  search: URLSearchParams,
  view: Pick<SavedView, "params">,
): string {
  const next = new URLSearchParams(search.toString());
  for (const name of VIEW_PARAMS) {
    const value = view.params[name];
    if (value) next.set(name, value);
    else next.delete(name);
  }
  return next.toString();
}

export type SaveProblem = "empty-name" | "name-too-long" | "no-filters" | "too-many";

/**
 * Adds a view, or says why it cannot be added.
 *
 * Saving the current filters when there are none would create a view that does
 * nothing, which is the kind of entry somebody deletes and then wonders whether
 * they lost something.
 */
export function saveView(
  views: SavedView[],
  input: { name: string; params: Partial<Record<ViewParam, string>>; id?: string; savedAt?: string },
): { views: SavedView[] } | { problem: SaveProblem } {
  const name = input.name.trim();
  if (!name) return { problem: "empty-name" };
  if (name.length > MAX_NAME_LENGTH) return { problem: "name-too-long" };
  if (Object.keys(input.params).length === 0) return { problem: "no-filters" };

  const existing = views.find(
    (view) => view.name.toLowerCase() === name.toLowerCase(),
  );
  if (!existing && views.length >= MAX_VIEWS) return { problem: "too-many" };

  const view: SavedView = {
    id: existing?.id ?? input.id ?? `view-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${views.length}`,
    name,
    params: input.params,
    savedAt: input.savedAt ?? new Date().toISOString(),
  };

  // Saving over a name replaces it rather than adding a second view with the
  // same label, which nobody could tell apart in a row of buttons.
  return {
    views: existing
      ? views.map((held) => (held.id === existing.id ? view : held))
      : [...views, view],
  };
}

export function deleteView(views: SavedView[], id: string): SavedView[] {
  const next = views.filter((view) => view.id !== id);
  return next.length === views.length ? views : next;
}

/** Whether a view's filters are the ones currently applied. */
export function isViewApplied(
  search: URLSearchParams,
  view: Pick<SavedView, "params">,
): boolean {
  return VIEW_PARAMS.every((name) => (search.get(name)?.trim() ?? "") === (view.params[name] ?? ""));
}
