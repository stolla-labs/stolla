export type CommunitySettingsDraft = {
  name: string;
  description: string;
};

export type CommunityMetadataOverlay = CommunitySettingsDraft & {
  metadataUri: string;
  metadataHash: string;
};

export function canEditCommunitySettings(
  viewer: string | null | undefined,
  owner: string | null | undefined,
): boolean {
  const viewerAddress = viewer?.trim();
  const ownerAddress = owner?.trim();
  if (!viewerAddress || !ownerAddress) return false;
  return viewerAddress === ownerAddress;
}

/** Pin failures must leave the in-progress draft untouched. */
export function retainSettingsDraft<T>(draft: T): T {
  return draft;
}

export function settingsStorageKey(communityId: string): string {
  return `stolla.community-metadata.${communityId}`;
}

export function readMetadataOverlay(communityId: string): CommunityMetadataOverlay | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(settingsStorageKey(communityId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CommunityMetadataOverlay;
    if (!parsed.metadataUri || !parsed.metadataHash || !parsed.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeMetadataOverlay(
  communityId: string,
  overlay: CommunityMetadataOverlay,
): void {
  window.sessionStorage.setItem(settingsStorageKey(communityId), JSON.stringify(overlay));
}
