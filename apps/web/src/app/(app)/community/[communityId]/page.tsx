"use client";

import { useParams } from "next/navigation";
import { CommunityDetailView } from "@/components/community/CommunityDetailView";
import { ParticipationReadinessChecklist } from "@/components/community/ParticipationReadinessChecklist";
import { useCommunityRouteContext } from "@/context/CommunityRouteContext";

export default function CommunityDetailPage() {
  const params = useParams<{ communityId: string }>();
  const routeContext = useCommunityRouteContext();
  return (
    <>
      <CommunityDetailView communityId={params.communityId} />
      {routeContext.status === "ready" && (
        <ParticipationReadinessChecklist
          nftContractId={routeContext.nftContractId}
        />
      )}
    </>
  );
}
