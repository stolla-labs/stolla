import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';

export type ProposalStateFilter = 'all' | 'active' | 'succeeded' | 'failed' | 'pending';

const VALID_FILTERS: ProposalStateFilter[] = ['all', 'active', 'succeeded', 'failed', 'pending'];
const DEFAULT_FILTER: ProposalStateFilter = 'all';

export function useProposalStateFilter() {
  const router = useRouter();
  const { query, isReady } = router;

  const getFilterFromQuery = useCallback((query: Record<string, string | string[] | undefined>): ProposalStateFilter => {
    const filterParam = query.filter;
    if (!filterParam) return DEFAULT_FILTER;

    const filter = Array.isArray(filterParam) ? filterParam[0] : filterParam;
    if (typeof filter !== 'string') return DEFAULT_FILTER;

    const lowerCaseFilter = filter.toLowerCase();
    return VALID_FILTERS.includes(lowerCaseFilter as ProposalStateFilter)
      ? (lowerCaseFilter as ProposalStateFilter)
      : DEFAULT_FILTER;
  }, []);

  const [filter, setFilter] = useState<ProposalStateFilter>(DEFAULT_FILTER);

  useEffect(() => {
    if (!isReady) return;
    const currentFilter = getFilterFromQuery(query);
    setFilter(currentFilter);
  }, [isReady, query, getFilterFromQuery]);

  const updateFilter = useCallback((newFilter: ProposalStateFilter) => {
    const newQuery = { ...query, filter: newFilter === 'all' ? undefined : newFilter };
    router.push(
      {
        pathname: router.pathname,
        query: newQuery,
      },
      undefined,
      { shallow: true }
    );
  }, [query, router]);

  return { filter, updateFilter, isReady };
}