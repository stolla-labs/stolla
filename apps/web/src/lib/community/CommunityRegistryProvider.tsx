"use client";

import { createContext, type ReactNode, useContext } from "react";
import { communityRegistry } from "./registry";
import type { CommunityRegistry } from "./types";

const CommunityRegistryContext = createContext<CommunityRegistry>(communityRegistry);

export function CommunityRegistryProvider({
  registry,
  children,
}: {
  registry: CommunityRegistry;
  children: ReactNode;
}) {
  return (
    <CommunityRegistryContext.Provider value={registry}>
      {children}
    </CommunityRegistryContext.Provider>
  );
}

export function useCommunityRegistry(): CommunityRegistry {
  return useContext(CommunityRegistryContext);
}
