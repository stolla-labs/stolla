"use client";

import { useParams } from "next/navigation";
import { CommunityProposalDetailView } from "@/components/community/CommunityProposalDetailView";

export default function CommunityProposalDetailPage() {
  const params = useParams<${ communityId: string; proposalId: string }>();
  return (
    <CommunityProposalDetailView
      communityId={params.communityId}
      proposalId={params.proposalId}
    />
  );
}
