"use client";

import { useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { useSavedViews } from "@/hooks/useSavedViews";
import { MAX_NAME_LENGTH, MAX_VIEWS, type SavedView } from "@/lib/saved-views";

const PROBLEM_MESSAGES = {
  "empty-name": "Give the view a name.",
  "name-too-long": `Keep the name under ${MAX_NAME_LENGTH} characters.`,
  "no-filters": "Apply a filter first — an empty view would do nothing.",
  "too-many": `You already have ${MAX_VIEWS} saved views here. Delete one first.`,
} as const;

const PARAM_LABELS = { state: "state", q: "search", category: "category" } as const;

/** What a view applies, in words, so a name does not have to be self-explanatory. */
function describe(view: SavedView): string {
  const parts = Object.entries(view.params).map(
    ([name, value]) => `${PARAM_LABELS[name as keyof typeof PARAM_LABELS]}: ${value}`,
  );
  return parts.join(" · ");
}

/**
 * Saved filter presets for a proposal list.
 *
 * Views are device-local and scoped to one list — see `useSavedViews`. The
 * row is rendered even when it is empty, because the save control is how the
 * first one gets made, and hiding it until a view exists would leave no way in.
 */
export function SavedViews({
  scope,
  onApply,
}: {
  scope: string;
  /** Called after a view is applied, so a list can reset its "load more" page. */
  onApply?: () => void;
}) {
  const { views, problem, hasFilters, isApplied, apply, save, remove, dismissProblem } =
    useSavedViews(scope);
  const [name, setName] = useState("");
  const [naming, setNaming] = useState(false);

  function submit() {
    if (save(name)) {
      setName("");
      setNaming(false);
    }
  }

  return (
    <section aria-labelledby="saved-views-heading" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="saved-views-heading" className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Saved views
        </h3>
        {views.length === 0 ? (
          <span className="text-xs text-slate-500" data-testid="saved-views-empty">
            None yet — filter the list, then save it.
          </span>
        ) : null}
        {views.map((view) => {
          const applied = isApplied(view);
          return (
            <span key={view.id} className="inline-flex items-center gap-1">
              <AppButton
                tone={applied ? "primary" : "secondary"}
                size="sm"
                aria-pressed={applied}
                title={describe(view)}
                data-testid={`saved-view-${view.id}`}
                onClick={() => {
                  apply(view);
                  onApply?.();
                }}
              >
                {view.name}
              </AppButton>
              <button
                type="button"
                aria-label={`Delete saved view ${view.name}`}
                data-testid={`delete-saved-view-${view.id}`}
                className="rounded px-1 text-xs text-slate-500 hover:text-rose-300 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-rose-300"
                onClick={() => remove(view.id)}
              >
                ×
              </button>
            </span>
          );
        })}
        {naming ? null : (
          <AppButton
            tone="secondary"
            size="sm"
            data-testid="save-current-view"
            /* Disabled rather than hidden, with the reason in the title: a
               delegate looking for the control should find it where it will be
               once they have filtered something. */
            disabled={!hasFilters}
            title={hasFilters ? "Save the current filters as a view" : "Apply a filter first"}
            onClick={() => {
              dismissProblem();
              setNaming(true);
            }}
          >
            Save current filters
          </AppButton>
        )}
      </div>

      {naming ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="block">
            <span className="sr-only">Name for this view</span>
            <input
              type="text"
              autoFocus
              value={name}
              maxLength={MAX_NAME_LENGTH}
              placeholder="Active treasury"
              data-testid="saved-view-name"
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
                if (event.key === "Escape") setNaming(false);
              }}
              className="input-field w-56 rounded-lg border bg-[#0b0f19] px-3 py-1.5 text-sm text-slate-100"
            />
          </label>
          <AppButton size="sm" data-testid="confirm-save-view" onClick={submit}>
            Save view
          </AppButton>
          <AppButton
            tone="secondary"
            size="sm"
            data-testid="cancel-save-view"
            onClick={() => {
              setNaming(false);
              dismissProblem();
            }}
          >
            Cancel
          </AppButton>
        </div>
      ) : null}

      {problem ? (
        <p role="status" className="text-xs text-rose-300" data-testid="saved-view-problem">
          {PROBLEM_MESSAGES[problem]}
        </p>
      ) : null}
    </section>
  );
}
