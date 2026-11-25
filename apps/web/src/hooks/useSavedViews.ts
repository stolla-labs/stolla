"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@/context/WalletProvider";
import {
  applyViewToSearch,
  deleteView,
  isViewApplied,
  readSavedViews,
  saveView,
  viewParamsFrom,
  writeSavedViews,
  type SaveProblem,
  type SavedView,
} from "@/lib/saved-views";

/**
 * The saved filter views for one proposal list.
 *
 * `scope` is the community whose proposals are being read, or `GLOBAL_SCOPE`
 * for the inbox: it is part of the storage key, so one community's presets are
 * never offered on another's list. A disconnected visitor still gets views —
 * unlike the watchlist, which asserts something about a wallet, a filter preset
 * is a device preference, and the issue asks for guests to keep theirs.
 *
 * The URL remains the one place the filters live. A view is applied by writing
 * its parameters into the query string with `router.replace`, exactly as the
 * state filter does, so the back button, a reload and a shared link all behave
 * the way they already do.
 */
export function useSavedViews(scope: string) {
  const { address } = useWallet();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const wallet = address ?? "";
  const [views, setViews] = useState<SavedView[]>([]);
  const [problem, setProblem] = useState<SaveProblem | null>(null);

  useEffect(() => {
    // Storage is external state keyed by wallet and scope; read it fresh
    // whenever either changes rather than carrying the previous list over.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setViews(readSavedViews(wallet, scope));
    setProblem(null);
  }, [scope, wallet]);

  const currentParams = useMemo(() => viewParamsFrom(params), [params]);

  const save = useCallback(
    (name: string) => {
      const result = saveView(views, { name, params: currentParams });
      if ("problem" in result) {
        setProblem(result.problem);
        return false;
      }
      setProblem(null);
      setViews(result.views);
      writeSavedViews(wallet, scope, result.views);
      return true;
    },
    [currentParams, scope, views, wallet],
  );

  const remove = useCallback(
    (id: string) => {
      const next = deleteView(views, id);
      if (next === views) return;
      setProblem(null);
      setViews(next);
      writeSavedViews(wallet, scope, next);
    },
    [scope, views, wallet],
  );

  const apply = useCallback(
    (view: SavedView) => {
      const search = applyViewToSearch(params, view);
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return {
    views,
    problem,
    /** Whether there is anything to save: a view with no filters does nothing. */
    hasFilters: Object.keys(currentParams).length > 0,
    isApplied: useCallback(
      (view: SavedView) => isViewApplied(params, view),
      [params],
    ),
    apply,
    save,
    remove,
    dismissProblem: useCallback(() => setProblem(null), []),
  };
}
