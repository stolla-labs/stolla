"use client";

/**
 * Shared community route context.
 *
 * Community-scoped pages, proposal pages, and contract actions (mint, delegate,
 * propose, vote) must resolve contract IDs from the *selected Community*, never
 * from global environment variables. This context carries the resolved
 * registry ID, NFT/Governor contract IDs, metadata state, and active network.
 *
 * A missing context yields an explicit `unavailable` state — consumers MUST NOT
 * fall back to global contract IDs.
 */

import { createContext, useContext } from "react";

export type CommunityMetadataState = "loading" | "ready" | "error" | "unavailable";

export type CommunityRouteState =
  | {
      status: "ready";
      /** Registry id of the selected Community. */
      registryId: string;
      /** NFT contract id for this Community (mint actions). */
      nftContractId: string;
      /** Governor contract id for this Community (propose/delegate/vote). */
      governorContractId: string;
      /** Community name, when known. */
      name?: string;
      /** Metadata fetch state for this Community. */
      metadataState: CommunityMetadataState;
      /** Active network ("testnet" | "mainnet"). */
      network: string;
    }
  | {
      status: "unavailable";
    };

const CommunityRouteContext = createContext<CommunityRouteState>({
  status: "unavailable",
});

export type CommunityRouteProviderProps = {
  state: CommunityRouteState;
  children: React.ReactNode;
};

export function CommunityRouteProvider({
  state,
  children,
}: CommunityRouteProviderProps) {
  return (
    <CommunityRouteContext.Provider value={state}>
      {children}
    </CommunityRouteContext.Provider>
  );
}

/** Read the community route state. Defaults to an explicit unavailable state. */
export function useCommunityRouteContext(): CommunityRouteState {
  return useContext(CommunityRouteContext);
}

export class CommunityRouteUnavailableError extends Error {
  constructor() {
    super(
      "Community route context is unavailable. Contract-scoped actions cannot resolve a Community and must not fall back to global contract IDs.",
    );
    this.name = "CommunityRouteUnavailableError";
  }
}

/**
 * Resolve the Community's contract IDs. Throws an explicit unavailable error
 * (never a global fallback) when the context is not ready.
 */
export function useCommunityContractIds(): {
  registryId: string;
  nftContractId: string;
  governorContractId: string;
} {
  const state = useCommunityRouteContext();
  if (state.status !== "ready") {
    throw new CommunityRouteUnavailableError();
  }
  return {
    registryId: state.registryId,
    nftContractId: state.nftContractId,
    governorContractId: state.governorContractId,
  };
}
