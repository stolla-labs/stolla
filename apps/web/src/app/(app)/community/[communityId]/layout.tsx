import {
  CommunityRouteProvider,
  type CommunityRouteState,
} from "@/context/CommunityRouteContext";
import { getCommunityById } from "@/lib/communities/registry";
import { stellarNetwork } from "@/lib/stellar";

export default function CommunityDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { communityId: string };
}) {
  const community = getCommunityById(params.communityId);

  const state: CommunityRouteState = community
    ? {
        status: "ready",
        registryId: community.id,
        nftContractId: community.nftContractId,
        governorContractId: community.governorContractId,
        name: community.name,
        metadataState: community.metadataUri ? "loading" : "unavailable",
        network: stellarNetwork,
      }
    : { status: "unavailable" };

  return <CommunityRouteProvider state={state}>{children}</CommunityRouteProvider>;
}
