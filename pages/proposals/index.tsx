import { ProposalList } from '@/components/ProposalList/ProposalList';
import { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async () => {
  const proposals = [
    { id: '1', state: 'active' as const },
    { id: '2', state: 'succeeded' as const },
    { id: '3', state: 'failed' as const },
  ];

  return {
    props: {
      proposals,
    },
  };
};

export default function ProposalsPage({ proposals }: { proposals: Array<{ id: string; state: string }> }) {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Proposals</h1>
      <ProposalList proposals={proposals} />
    </div>
  );
}