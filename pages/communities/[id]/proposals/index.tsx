import { CommunityProposalList } from '@/components/CommunityProposalList/CommunityProposalList';
import { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';

export const getServerSideProps: GetServerSideProps = async (context) => {
  const communityId = context.params?.id as string;
  const proposals = [
    { id: '1', state: 'active' as const },
    { id: '2', state: 'pending' as const },
  ];

  return {
    props: {
      communityId,
      proposals,
    },
  };
};

export default function CommunityProposalsPage({
  communityId,
  proposals,
}: {
  communityId: string;
  proposals: Array<{ id: string; state: string }>;
}) {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Community Proposals</h1>
      <CommunityProposalList communityId={communityId} proposals={proposals} />
    </div>
  );
}