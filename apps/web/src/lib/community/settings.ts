export type CommunitySettingsDraft = {
  name: string;
  description: string;
};

export type CommunityMetadataOverlay = CommunitySettingsDraft & {
  metadataUri: string;
  metadataHash: string;
};

export const COMMUNITY_PAUSED_REASON =
  "This community is paused in the registry. History remains readable, but minting and new proposals are disabled.";

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

export function pauseStorageKey(communityId: string): string {
  return `stolla.community-paused.${communityId}`;
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

export function readPauseOverlay(communityId: string): boolean | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(pauseStorageKey(communityId));
  if (raw === null) return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

export function writePauseOverlay(communityId: string, paused: boolean): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(pauseStorageKey(communityId), paused ? "true" : "false");
}

export function isCommunityPaused(
  record: { id: string; paused?: boolean } | null | undefined,
): boolean {
  if (!record) return false;
  const overlay = readPauseOverlay(record.id);
  if (overlay !== null) return overlay;
  return Boolean(record.paused);
}
