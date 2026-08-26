import { useEffect, useState } from "react";
import { type CommunityMetadataDraft, validateCommunityMetadataDraft } from "@/lib/community/schema";
import { serializeCommunityMetadata, type SerializedMetadata } from "@/lib/community/metadata";

export function CommunityMetadataPreview({ draft }: { draft: CommunityMetadataDraft }) {
  const [serialized, setSerialized] = useState<SerializedMetadata | null>(null);

  useEffect(() => {
    let active = true;
    serializeCommunityMetadata(draft).then((res) => {
      if (active) setSerialized(res);
    });
    return () => {
      active = false;
    };
  }, [draft]);

  if (!serialized) {
    return <div className="text-sm text-slate-400">Building metadata...</div>;
  }

  const errors = validateCommunityMetadataDraft(draft);
  const isValid = Object.keys(errors).length === 0;

  function handleDownload() {
    if (!isValid || !serialized) return;
    const blob = new Blob([serialized.json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "community-metadata.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-[#0b0f19] p-4 font-mono text-xs text-slate-300">
        <pre className="overflow-x-auto">{serialized.json}</pre>
      </div>
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <span className="text-slate-500">SHA-256 Hash: </span>
          <span className="font-mono text-slate-100 break-all">{serialized.hash}</span>
        </div>
        <button
          type="button"
          disabled={!isValid}
          onClick={handleDownload}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
        >
          Download JSON
        </button>
      </div>
      {!isValid && (
        <p className="text-xs text-amber-200">
          Fix metadata errors before downloading.
        </p>
      )}
    </div>
  );
}
