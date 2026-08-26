import { COMMUNITY_SCHEMA_VERSION, type CommunityMetadataDraft } from "./schema";

export type SerializedMetadata = {
  bytes: Uint8Array;
  json: string;
  hash: string;
};

export async function serializeCommunityMetadata(draft: CommunityMetadataDraft): Promise<SerializedMetadata> {
  const metadata = {
    schemaVersion: COMMUNITY_SCHEMA_VERSION,
    name: draft.name.trim(),
    description: draft.description.trim(),
  } as Record<string, unknown>;

  if (draft.logo.trim()) {
    metadata.logo = draft.logo.trim();
  }

  const linkLabel = draft.externalLinkLabel.trim();
  const linkUrl = draft.externalLinkUrl.trim();
  
  if (linkLabel && linkUrl) {
    metadata.externalLinks = [{ label: linkLabel, url: linkUrl }];
  } else {
    metadata.externalLinks = [];
  }

  // To ensure the same normalized inputs always produce identical JSON bytes,
  // we must insert the keys in a consistent order.
  const orderedMetadata = {
    schemaVersion: metadata.schemaVersion,
    name: metadata.name,
    description: metadata.description,
    ...(metadata.logo ? { logo: metadata.logo } : {}),
    externalLinks: metadata.externalLinks,
  };

  const json = JSON.stringify(orderedMetadata, null, 2);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(json);
  
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

  return { bytes, json, hash };
}
