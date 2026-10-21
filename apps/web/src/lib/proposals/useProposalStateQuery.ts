"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import {
  parseProposalStateQuery,
  serializeProposalStateQuery,
  type ProposalStateFilter,
} from "@/lib/proposals/state-filter";

export function useProposalStateQuery() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const filter = useMemo(
    () => parseProposalStateQuery(params.get("state")),
    [params],
  );

  const setFilter = useCallback(
    (next: ProposalStateFilter) => {
      const query = new URLSearchParams(params.toString());
      const serialized = serializeProposalStateQuery(next);
      if (!serialized) query.delete("state");
      else query.set("state", serialized);
      const search = query.toString();
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  return [filter, setFilter] as const;
}
