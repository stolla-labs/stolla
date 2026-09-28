import {
  COMMUNITY_SCHEMA_VERSION,
  isResourceUri,
  parseCommunityMetadata,
  utf8Length,
  validateCommunityMetadataDraft,
  type CommunityMetadataDraft,
} from "@/lib/community/schema";

export const MAX_METADATA_BYTES = 16_384;
export type MetadataKind = "community" | "collection" | "member";
export type MetadataDocument = { kind: MetadataKind; json: string };

// Pinata is asked for CIDv1, which is encoded as lowercase base32.
export function isIpfsCid(value: string): boolean {
  return /^b[a-z2-7]{50,100}$/.test(value);
}

function serialize(kind: MetadataKind, value: Record<string, unknown>): MetadataDocument {
  const json = JSON.stringify(value);
  if (utf8Length(json) > MAX_METADATA_BYTES) {
    throw new Error("Metadata exceeds the 16 KiB upload limit.");
  }
  if (!isCanonicalMetadata(kind, json)) {
    throw new Error("Metadata does not match the required schema.");
  }
  return { kind, json };
}

export function buildCommunityDocuments(draft: CommunityMetadataDraft): MetadataDocument[] {
  const errors = validateCommunityMetadataDraft({
    ...draft,
    collectionUri: "ipfs://pending",
    metadataUri: "ipfs://pending",
  });
  if (Object.keys(errors).length) {
    throw new Error(Object.values(errors)[0]);
  }
  const community = serialize("community", {
    schemaVersion: COMMUNITY_SCHEMA_VERSION,
    name: draft.name,
    description: draft.description,
    ...(draft.logo ? { logo: draft.logo } : {}),
    externalLinks: draft.externalLinkLabel
      ? [{ label: draft.externalLinkLabel, url: draft.externalLinkUrl }]
      : [],
  });
  const collection = serialize("collection", {
    name: draft.name,
    symbol: draft.symbol,
    description: draft.description,
    ...(draft.logo ? { image: draft.logo } : {}),
  });
  return [community, collection];
}

export function buildMemberDocument(input: {
  name: string;
  description: string;
  image: string;
}): MetadataDocument {
  return serialize("member", {
    name: input.name.trim(),
    description: input.description.trim(),
    ...(input.image.trim() ? { image: input.image.trim() } : {}),
    attributes: [],
  });
}

function plainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function keysAre(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

export function isCanonicalMetadata(kind: MetadataKind, json: string): boolean {
  if (utf8Length(json) > MAX_METADATA_BYTES) return false;
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return false;
  }
  if (!plainObject(value)) return false;
  if (kind === "community") {
    const parsed = parseCommunityMetadata(value);
    return parsed !== null && JSON.stringify(parsed) === json;
  }
  if (kind === "collection") {
    if (!keysAre(value, ["name", "symbol", "description", "image"]) ||
      typeof value.name !== "string" || !value.name.trim() || utf8Length(value.name) > 64 ||
      typeof value.symbol !== "string" || !/^[A-Z0-9]{1,12}$/.test(value.symbol) ||
      typeof value.description !== "string" || !value.description.trim() || utf8Length(value.description) > 2_000 ||
      (value.image !== undefined && (typeof value.image !== "string" || !isResourceUri(value.image)))) return false;
    return JSON.stringify({ name: value.name, symbol: value.symbol, description: value.description,
      ...(value.image ? { image: value.image } : {}) }) === json;
  }
  if (kind === "member") {
    if (!keysAre(value, ["name", "description", "image", "attributes"]) ||
      typeof value.name !== "string" || !value.name.trim() || utf8Length(value.name) > 64 ||
      typeof value.description !== "string" || !value.description.trim() || utf8Length(value.description) > 2_000 ||
      (value.image !== undefined && (typeof value.image !== "string" || !isResourceUri(value.image))) ||
      !Array.isArray(value.attributes) || value.attributes.length !== 0) return false;
    return JSON.stringify({ name: value.name, description: value.description,
      ...(value.image ? { image: value.image } : {}), attributes: [] }) === json;
  }
  return false;
}

export async function metadataSha256(json: string): Promise<string> {
  const bytes = new TextEncoder().encode(json);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function pinMetadata(document: MetadataDocument): Promise<string> {
  const hash = await metadataSha256(document.json);
  const response = await fetch("/api/metadata/pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(document),
  });
  const result: unknown = await response.json();
  if (!response.ok) {
    throw new Error(plainObject(result) && typeof result.error === "string" ? result.error : "Metadata upload failed.");
  }
  if (!plainObject(result) || typeof result.uri !== "string" ||
    !result.uri.startsWith("ipfs://") || !isIpfsCid(result.uri.slice(7)) || result.sha256 !== hash) {
    throw new Error("Pin response did not match the previewed metadata bytes.");
  }
  return result.uri;
}
