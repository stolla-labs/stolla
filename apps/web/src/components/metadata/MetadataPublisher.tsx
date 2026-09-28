"use client";

import { useEffect, useRef, useState } from "react";
import { metadataSha256, pinMetadata, type MetadataDocument } from "@/lib/metadata/publish";

type Preview = { documents: MetadataDocument[]; hashes: string[] };

export function MetadataPublisher({
  build,
  onUploaded,
  label,
}: {
  build: () => MetadataDocument[];
  onUploaded: (uris: string[]) => void;
  label: string;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  async function prepare() {
    try {
      const documents = build();
      const hashes = await Promise.all(documents.map((document) => metadataSha256(document.json)));
      if (!mounted.current) return;
      setPreview({ documents, hashes });
      setError("");
      setStatus("");
    } catch (cause) {
      if (!mounted.current) return;
      setPreview(null);
      setError(cause instanceof Error ? cause.message : "Could not prepare metadata.");
    }
  }

  async function upload() {
    if (!preview || busy) return;
    try {
      const current = build();
      if (JSON.stringify(current) !== JSON.stringify(preview.documents)) {
        setError("Fields changed since preview. Preview the updated metadata before uploading.");
        return;
      }
      setBusy(true);
      setError("");
      const uris: string[] = [];
      for (const document of preview.documents) {
        if (!mounted.current) return;
        uris.push(await pinMetadata(document));
      }
      if (!mounted.current) return;
      onUploaded(uris);
      setStatus(`Metadata pinned: ${uris.join(", ")}`);
    } catch (cause) {
      if (mounted.current) {
        setError(cause instanceof Error ? cause.message : "Metadata upload failed. Try again.");
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-indigo-800/70 bg-indigo-950/30 p-4 text-sm text-slate-200">
      <p className="font-semibold">{label}</p>
      <p className="mt-1 text-slate-400">Preview and pin the JSON, or paste an existing URI below.</p>
      <button type="button" onClick={() => void prepare()} disabled={busy}
        className="mt-3 rounded-lg border border-indigo-500 px-3 py-2 text-indigo-200 disabled:opacity-50">
        Preview metadata
      </button>
      {preview && (
        <div className="mt-3 space-y-3">
          {preview.documents.map((document, index) => (
            <div key={document.kind}>
              <p className="font-medium capitalize">{document.kind} JSON · {new TextEncoder().encode(document.json).length} bytes</p>
              <p className="break-all font-mono text-xs">SHA-256: {preview.hashes[index]}</p>
              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-950 p-2 text-xs">{document.json}</pre>
            </div>
          ))}
          <button type="button" onClick={() => void upload()} disabled={busy}
            className="rounded-lg bg-indigo-500 px-3 py-2 font-medium text-white disabled:opacity-50">
            {busy ? "Pinning metadata…" : "Pin preview to IPFS"}
          </button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-rose-300">{error}</p>}
      {status && <p role="status" className="mt-2 text-emerald-300">{status}</p>}
    </div>
  );
}
