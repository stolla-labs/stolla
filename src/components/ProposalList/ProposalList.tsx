import { useProposalStateFilter } from '@/hooks/useProposalStateFilter';
import { ProposalCard } from './ProposalCard';
import { ProposalStateFilter } from '@/hooks/useProposalStateFilter';

const FILTER_OPTIONS: { value: ProposalStateFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'pending', label: 'Pending' },
];

export function ProposalList({ proposals }: { proposals: Array<{ id: string; state: ProposalStateFilter }> }) {
  const { filter, updateFilter, isReady } = useProposalStateFilter();

  const filteredProposals = proposals.filter((proposal) => {
    if (filter === 'all') return true;
    return proposal.state === filter;
  });

  if (!isReady) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => updateFilter(option.value)}
            className={`px-3 py-1 rounded ${filter === option.value ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {filteredProposals.length > 0 ? (
          filteredProposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} />)
        ) : (
          <div>No proposals match the current filter</div>
        )}
      </div>
    </div>
  );
}