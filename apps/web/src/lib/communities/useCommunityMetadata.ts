"use client";

import { useEffect, useRef, useState } from "react";
import type { CommunityMetadata } from "./types";

export type MetadataState =
  | { status: "loading" }
  | { status: "ready"; data: CommunityMetadata }
  | { status: "error"; error: string };

async function fetchJsonMetadata(uri: string): Promise<CommunityMetadata> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Metadata request failed (${response.status})`);
  }
  return (await response.json()) as CommunityMetadata;
}

export function useCommunityMetadata(
  metadataUri: string | undefined,
  fetchMetadata: (uri: string) => Promise<CommunityMetadata> = fetchJsonMetadata,
): MetadataState {
  const deriveState = (uri: string | undefined): MetadataState =>
    uri
      ? { status: "loading" }
      : { status: "error", error: "No metadata configured for this community." };

  const [state, setState] = useState<MetadataState>(() => deriveState(metadataUri));
  const [trackedUri, setTrackedUri] = useState(metadataUri);

  // Reset synchronously during render (not in an effect) so a metadataUri
  // change never briefly shows the previous community's stale metadata.
  if (trackedUri !== metadataUri) {
    setTrackedUri(metadataUri);
    setState(deriveState(metadataUri));
  }

  const fetchIdRef = useRef(0);

  useEffect(() => {
    if (!metadataUri) return;

    const fetchId = ++fetchIdRef.current;
    let cancelled = false;

    fetchMetadata(metadataUri)
      .then((data) => {
        if (cancelled || fetchIdRef.current !== fetchId) return;
        setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (cancelled || fetchIdRef.current !== fetchId) return;
        setState({
          status: "error",
          error: error instanceof Error ? error.message : "Failed to load metadata",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [metadataUri, fetchMetadata]);

  return state;
}
