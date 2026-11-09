"use client";

import { useEffect, useRef, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { LiveStatus } from "@/components/ui/LiveStatus";
import type { CommunityMetadataDraft } from "@/lib/community/schema";
import {
  previewCommunityMetadata,
  publishCommunityMetadata,
  type CommunityMetadataPreview,
  type PublishedCommunityMetadata,
  type PublishStep,
} from "@/lib/community/publishMetadata";
import { formatBytes } from "@/lib/ipfs/limits";
import { IpfsPinError, type IpfsPinClient } from "@/lib/ipfs/pin";
import { lookupTransactionErrorCatalog } from "@/lib/transactionErrors";

type Props = {
  draft: CommunityMetadataDraft;
  logoFile: File | null;
  pin: IpfsPinClient;
  published: PublishedCommunityMetadata | null;
  onPublished: (result: PublishedCommunityMetadata | null) => void;
  disabled?: boolean;
};

type PinStatus =
  | { kind: "idle" }
  | { kind: "pinning"; step: PublishStep }
  | { kind: "error"; message: string; retryable: boolean };

const STEP_LABELS: Record<PublishStep, string> = {
  logo: "Pinning the logo image…",
  community: "Pinning the community metadata document…",
  collection: "Pinning the NFT collection document…",
};

function fileSignature(file: File | null): string {
  return file ? `${file.name}:${file.size}:${file.lastModified}` : "";
}

function describePinError(error: unknown): { message: string; retryable: boolean } {
  if (error instanceof IpfsPinError) {
    if (error.kind === "config") {
      return {
        message: `${error.message} Retrying will not help until the server is configured.`,
        retryable: false,
      };
    }
    return { message: error.message, retryable: error.retryable };
  }
  const catalog = lookupTransactionErrorCatalog(error, "pin");
  return { message: catalog.body, retryable: catalog.retryable };
}

/**
 * Review-step section that turns the authoring draft into the generated
 * deployment payload. It shows the exact bytes that will be pinned and their
 * hash, runs the pin pipeline on demand, and invalidates the result whenever
 * the draft or logo changes so deployment can never use stale URIs.
 */
export function CommunityMetadataPublisher({
  draft,
  logoFile,
  pin,
  published,
  onPublished,
  disabled = false,
}: Props) {
  const [status, setStatus] = useState<PinStatus>({ kind: "idle" });
  const [preview, setPreview] = useState<CommunityMetadataPreview | null>(null);
  const signature = `${JSON.stringify(draft)}|${fileSignature(logoFile)}`;
  const latestSignature = useRef(signature);
  const inFlight = useRef(false);

  useEffect(() => {
    latestSignature.current = signature;
  }, [signature]);

  useEffect(() => {
    let cancelled = false;
    void previewCommunityMetadata(draft, published?.payload.logoUri).then(
      (next) => {
        if (!cancelled) setPreview(next);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [draft, published]);

  async function publish() {
    if (inFlight.current || disabled) return;
    inFlight.current = true;
    const startedFor = signature;
    setStatus({ kind: "pinning", step: logoFile ? "logo" : "community" });
    try {
      const result = await publishCommunityMetadata(draft, logoFile, pin, (step) =>
        setStatus({ kind: "pinning", step }),
      );
      if (startedFor !== latestSignature.current) return;
      setStatus({ kind: "idle" });
      onPublished(result);
    } catch (error) {
      if (startedFor !== latestSignature.current) return;
      setStatus({ kind: "error", ...describePinError(error) });
    } finally {
      inFlight.current = false;
    }
  }

  const pinning = status.kind === "pinning";
  const shown = published ?? preview;

  return (
    <section
      aria-labelledby="metadata-documents-title"
      className="border-t border-slate-800 pt-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="metadata-documents-title" className="font-semibold text-slate-100">
          Metadata documents
        </h2>
        {published && (
          <span className="rounded-full border border-emerald-700 bg-emerald-950/40 px-3 py-1 text-xs font-medium text-emerald-200">
            Pinned
          </span>
        )}
      </div>
      <p className="mt-2 text-sm text-slate-400">
        Stolla builds these documents from your answers, pins them to IPFS, and
        commits the SHA-256 of the community document on-chain. You never type
        a URI.
      </p>

      <dl className="mt-4 grid gap-4">
        <div className="min-w-0">
          <dt className="text-sm text-slate-500">Logo</dt>
          <dd className="mt-1 break-words text-sm text-slate-100 [overflow-wrap:anywhere]">
            {logoFile
              ? `${logoFile.name} (${formatBytes(logoFile.size)})`
              : "No logo selected. The documents omit the logo and image fields."}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-sm text-slate-500">Community metadata (community.json)</dt>
          <dd className="mt-1">
            <pre
              aria-label="Community metadata JSON preview"
              className="max-h-48 overflow-auto rounded-lg border border-slate-800 bg-[#0b0f19] p-3 font-mono text-xs leading-5 text-slate-200 [overflow-wrap:anywhere] whitespace-pre-wrap"
            >
              {shown?.communityJson ?? ""}
            </pre>
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-sm text-slate-500">Metadata hash (SHA-256)</dt>
          <dd
            data-testid="metadata-hash"
            className="mt-1 break-all font-mono text-xs text-slate-100"
          >
            {shown?.metadataHash ?? ""}
          </dd>
          {!published && logoFile && (
            <p className="mt-1 text-xs text-slate-500">
              The hash is final once the logo URI is known after pinning.
            </p>
          )}
        </div>
        <div className="min-w-0">
          <dt className="text-sm text-slate-500">NFT collection metadata (collection.json)</dt>
          <dd className="mt-1">
            <pre
              aria-label="Collection metadata JSON preview"
              className="max-h-32 overflow-auto rounded-lg border border-slate-800 bg-[#0b0f19] p-3 font-mono text-xs leading-5 text-slate-200 [overflow-wrap:anywhere] whitespace-pre-wrap"
            >
              {shown?.collectionJson ?? ""}
            </pre>
          </dd>
        </div>
        {published && (
          <div className="min-w-0 rounded-lg border border-emerald-800/70 bg-emerald-950/20 p-4">
            <dt className="text-sm text-slate-400">Generated URIs</dt>
            <dd className="mt-2 grid gap-2 font-mono text-xs text-emerald-100">
              <span className="break-all">
                metadata_uri: {published.payload.metadataUri}
              </span>
              <span className="break-all">
                collection_uri: {published.payload.collectionUri}
              </span>
              {published.payload.logoUri && (
                <span className="break-all">logo: {published.payload.logoUri}</span>
              )}
            </dd>
          </div>
        )}
      </dl>

      {pinning && (
        <LiveStatus
          tone="routine"
          className="mt-4 rounded-lg border border-slate-700 bg-[#0b0f19] p-4 text-sm text-slate-300"
        >
          {STEP_LABELS[status.step]}
        </LiveStatus>
      )}
      {status.kind === "error" && (
        <LiveStatus
          tone="error"
          className="mt-4 rounded-lg border border-rose-800/70 bg-rose-950/30 p-4 text-sm text-rose-200"
        >
          Pinning failed: {status.message} Your draft is preserved.
        </LiveStatus>
      )}
      {published && (
        <LiveStatus
          tone="routine"
          className="mt-4 rounded-lg border border-emerald-800/70 bg-emerald-950/30 p-4 text-sm text-emerald-200"
        >
          Metadata pinned to IPFS. Simulation can use the generated URIs and hash.
        </LiveStatus>
      )}

      {!published && (
        <AppButton
          tone="primary"
          onClick={() => void publish()}
          disabled={disabled || pinning}
          className="mt-4 w-full sm:w-auto"
        >
          {pinning
            ? "Pinning…"
            : status.kind === "error"
              ? "Retry pinning"
              : "Prepare metadata"}
        </AppButton>
      )}
    </section>
  );
}
