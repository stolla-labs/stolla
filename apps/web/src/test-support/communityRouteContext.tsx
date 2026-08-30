import {
  CommunityRouteProvider,
  type CommunityRouteState,
} from "@/context/CommunityRouteContext";

export const TEST_COMMUNITY = {
  registryId: "community-test-1",
  nftContractId: "CNFTTESTCOMMUNITY00000000000000000000000000000",
  governorContractId: "CGOVTESTCOMMUNITY0000000000000000000000000000",
  name: "Test Community",
} as const;

/** Build a "ready" community route state for tests and fixtures. */
export function makeReadyCommunityRouteState(
  overrides: Partial<Extract<CommunityRouteState, { status: "ready" }>> = {},
): Extract<CommunityRouteState, { status: "ready" }> {
  return {
    status: "ready",
    registryId: TEST_COMMUNITY.registryId,
    nftContractId: TEST_COMMUNITY.nftContractId,
    governorContractId: TEST_COMMUNITY.governorContractId,
    name: TEST_COMMUNITY.name,
    metadataState: "ready",
    network: "testnet",
    ...overrides,
  };
}

/** Shared test provider that supplies a ready community route context. */
export function CommunityRouteTestProvider({
  state,
  children,
}: {
  state?: CommunityRouteState;
  children: React.ReactNode;
}) {
  return (
    <CommunityRouteProvider
      state={state ?? makeReadyCommunityRouteState()}
    >
      {children}
    </CommunityRouteProvider>
  );
}
