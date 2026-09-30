import { NextResponse } from "next/server";
import {
  describeUploadRejection,
  type IpfsUploadKind,
} from "@/lib/ipfs/limits";

/**
 * Server-side pinning adapter. The browser posts a single file (an image or a
 * generated JSON document) and this route forwards the exact bytes to Pinata
 * using the server-only `PINATA_JWT`. The CID is returned as an `ipfs://` URI
 * so callers never construct URIs by hand.
 *
 * Pinning the JSON as a file (rather than Pinata's JSON endpoint) is
 * deliberate: the on-chain `metadata_hash` commits to the exact bytes the
 * client hashed, and a JSON re-serialization on the provider side would break
 * that commitment.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_PINATA_API_URL = "https://api.pinata.cloud";

type PinErrorKind = "config" | "validation" | "network" | "provider";

/** Stable machine-readable codes, one per `PinErrorKind`, for callers that key off a code rather than the human message. */
const PIN_ERROR_CODES: Record<PinErrorKind, string> = {
  config: "pin_config_missing",
  validation: "pin_payload_invalid",
  network: "pin_retryable_error",
  provider: "pin_provider_error",
};

function errorResponse(status: number, kind: PinErrorKind, message: string) {
  return NextResponse.json(
    { error: { kind, code: PIN_ERROR_CODES[kind], message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * `instanceof Blob` is unreliable across realms (jsdom vs. undici), so the
 * part is duck-typed on the members the route actually uses.
 */
function isBlobLike(value: unknown): value is Blob {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === "function" &&
    typeof (value as Blob).size === "number" &&
    typeof (value as Blob).type === "string"
  );
}

function uploadKind(value: FormDataEntryValue | null): IpfsUploadKind | null {
  return value === "image" || value === "json" ? value : null;
}

function safeName(value: FormDataEntryValue | null, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().replace(/[^\w.-]+/g, "-").slice(0, 120);
  return trimmed || fallback;
}

export async function POST(request: Request) {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    return errorResponse(
      400,
      "config",
      "IPFS pinning is not configured on this server. Set PINATA_JWT before creating communities or minting.",
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse(400, "validation", "Send the upload as multipart form data.");
  }

  const kind = uploadKind(form.get("kind"));
  const file = form.get("file");
  if (!kind || !isBlobLike(file)) {
    return errorResponse(
      400,
      "validation",
      "Provide an upload kind (image or json) and a file part.",
    );
  }

  const rejection = describeUploadRejection(kind, file.type, file.size);
  if (rejection) {
    return errorResponse(400, "validation", rejection);
  }

  const name = safeName(form.get("name"), kind === "json" ? "metadata.json" : "image");
  const upstream = new FormData();
  upstream.set("file", file, name);
  upstream.set("pinataMetadata", JSON.stringify({ name }));
  upstream.set("pinataOptions", JSON.stringify({ cidVersion: 1 }));

  const apiUrl = (process.env.PINATA_API_URL ?? DEFAULT_PINATA_API_URL).replace(
    /\/$/,
    "",
  );

  let response: Response;
  try {
    response = await fetch(`${apiUrl}/pinning/pinFileToIPFS`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jwt}` },
      body: upstream,
    });
  } catch {
    return errorResponse(
      502,
      "network",
      "The pinning provider could not be reached. Retry the upload.",
    );
  }

  type PinataResponse = { IpfsHash?: unknown; PinSize?: unknown };
  let payload: PinataResponse | null = null;
  try {
    payload = (await response.json()) as PinataResponse;
  } catch {
    payload = null;
  }

  if (!response.ok || typeof payload?.IpfsHash !== "string" || !payload.IpfsHash) {
    return errorResponse(
      502,
      "provider",
      `The pinning provider rejected the upload (HTTP ${response.status}). Retry the upload.`,
    );
  }

  return NextResponse.json(
    {
      cid: payload.IpfsHash,
      uri: `ipfs://${payload.IpfsHash}`,
      size: typeof payload.PinSize === "number" ? payload.PinSize : file.size,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
