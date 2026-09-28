import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { isCanonicalMetadata, isIpfsCid, MAX_METADATA_BYTES, type MetadataKind } from "@/lib/metadata/publish";

export const runtime = "nodejs";

async function readLimitedBody(request: NextRequest): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_METADATA_BYTES + 256) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Cross-origin uploads are not allowed." }, { status: 403 });
  }
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return NextResponse.json({ error: "Metadata pinning is not configured. Paste an existing URI instead." }, { status: 503 });
  }
  if (Number(request.headers.get("content-length")) > MAX_METADATA_BYTES + 256) {
    return NextResponse.json({ error: "Metadata exceeds the 16 KiB upload limit." }, { status: 413 });
  }
  let input: unknown;
  try {
    const body = await readLimitedBody(request);
    if (body === null) {
      return NextResponse.json({ error: "Metadata exceeds the 16 KiB upload limit." }, { status: 413 });
    }
    input = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid metadata request." }, { status: 400 });
  }
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return NextResponse.json({ error: "Invalid metadata request." }, { status: 400 });
  }
  const { kind, json } = input as { kind?: unknown; json?: unknown };
  if ((kind !== "community" && kind !== "collection" && kind !== "member") ||
      typeof json !== "string" || !isCanonicalMetadata(kind as MetadataKind, json)) {
    return NextResponse.json({ error: "Metadata does not match the required schema." }, { status: 400 });
  }
  const bytes = new TextEncoder().encode(json);
  const form = new FormData();
  form.set("network", "public");
  form.set("file", new File([bytes], `${kind}.json`, { type: "application/json" }));
  form.set("cid_version", "v1");
  try {
    const response = await fetch("https://uploads.pinata.cloud/v3/files", {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Pinata could not pin the metadata. Try again." }, { status: 502 });
    }
    const result: unknown = await response.json();
    const data = result && typeof result === "object" && "data" in result &&
      result.data && typeof result.data === "object" ? result.data : null;
    const cid = data && "cid" in data ? data.cid : null;
    const size = data && "size" in data ? data.size : null;
    if (typeof cid !== "string" || !isIpfsCid(cid) || size !== bytes.byteLength) {
      return NextResponse.json({ error: "Pinata did not confirm the uploaded bytes. Try again." }, { status: 502 });
    }
    return NextResponse.json({ uri: `ipfs://${cid}`, sha256: createHash("sha256").update(bytes).digest("hex") });
  } catch {
    return NextResponse.json({ error: "Pinata is unavailable. Try again." }, { status: 502 });
  }
}
