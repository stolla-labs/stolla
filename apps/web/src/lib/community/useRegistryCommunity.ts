"use client";

import { useEffect, useState } from "react";
import { useCommunityRegistry } from "./CommunityRegistryProvider";
import type {
  CommunityDetailResult,
  CommunityRegistry,
} from "./types";

export type RegistryCommunityState =
  | { status: "loading" }
  | { status: "resolved"; result: CommunityDetailResult }
  | { status: "error"; error: string };

export function useRegistryCommunity(
  communityId: string,
  injectedRegistry?: CommunityRegistry,
): RegistryCommunityState {
  const productionRegistry = useCommunityRegistry();
  const registry = injectedRegistry ?? productionRegistry;
  const [resolution, setResolution] = useState<{
    communityId: string;
    registry: CommunityRegistry;
    state: RegistryCommunityState;
  }>({ communityId, registry, state: { status: "loading" } });

  useEffect(() => {
    let active = true;
    void registry
      .get(communityId)
      .then((result) => {
        if (active) {
          setResolution({
            communityId,
            registry,
            state: { status: "resolved", result },
          });
        }
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setResolution({
          communityId,
          registry,
          state: {
            status: "error",
            error:
              cause instanceof Error
                ? cause.message
                : "The community registry could not be loaded.",
          },
        });
      });
    return () => {
      active = false;
    };
  }, [communityId, registry]);

  return resolution.communityId === communityId && resolution.registry === registry
    ? resolution.state
    : { status: "loading" };
}
