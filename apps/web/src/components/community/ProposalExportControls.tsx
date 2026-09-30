"use client";

import { useState } from "react";
import {
  downloadFile,
  serializeProposalsToCsv,
  serializeProposalsToJson,
  type ExportableProposal,
} from "@/lib/proposal-export";

export type ProposalExportControlsProps = {
  communityId: string;
  communityName?: string;
  proposals: ExportableProposal[];
  isLoading: boolean;
};

export function ProposalExportControls({
  communityId,
  communityName,
  proposals,
  isLoading,
}: ProposalExportControlsProps) {
  const [lastExported, setLastExported] = useState<string | null>(null);

  const cleanId = communityId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const dateStamp = new Date().toISOString().split("T")[0];

  const handleExportCsv = () => {
    if (isLoading) return;
    const csvContent = serializeProposalsToCsv(proposals);
    const filename = `proposals-${cleanId}-${dateStamp}.csv`;
    downloadFile(csvContent, filename, "text/csv");
    setLastExported("CSV");
  };

  const handleExportJson = () => {
    if (isLoading) return;
    const jsonContent = serializeProposalsToJson(proposals, {
      communityId,
      communityName,
    });
    const filename = `proposals-${cleanId}-${dateStamp}.json`;
    downloadFile(jsonContent, filename, "application/json");
    setLastExported("JSON");
  };

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={isLoading}
          onClick={handleExportCsv}
          aria-label={
            isLoading
              ? "Export CSV (unavailable while proposals are loading)"
              : "Export proposals as CSV"
          }
          title={
            isLoading
              ? "Export unavailable while proposals are loading"
              : "Download proposal history as CSV"
          }
          className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-700/80 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/50 disabled:text-slate-500"
        >
          Export CSV
        </button>

        <button
          type="button"
          disabled={isLoading}
          onClick={handleExportJson}
          aria-label={
            isLoading
              ? "Export JSON (unavailable while proposals are loading)"
              : "Export proposals as JSON"
          }
          title={
            isLoading
              ? "Export unavailable while proposals are loading"
              : "Download proposal history as JSON"
          }
          className="inline-flex items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-700/80 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900/50 disabled:text-slate-500"
        >
          Export JSON
        </button>
      </div>

      {isLoading ? (
        <span className="text-[11px] text-slate-500" role="status">
          Export unavailable while proposals are loading
        </span>
      ) : (
        lastExported && (
          <span className="text-[11px] text-emerald-400" role="status">
            Downloaded {lastExported}
          </span>
        )
      )}
    </div>
  );
}
