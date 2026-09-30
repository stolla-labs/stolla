/**
 * Proposal History Serializers & Exporters (CSV & JSON)
 *
 * Provides RFC 4180-compliant CSV serialization and structured JSON
 * export for community and global governance proposal sets.
 *
 * ## Documented JSON Schema (v1):
 * ```json
 * {
 *   "$schema": "https://stolla.io/schemas/proposals-export-v1.json",
 *   "version": 1,
 *   "communityId": "string (optional)",
 *   "communityName": "string (optional)",
 *   "exportedAt": "ISO-8601 timestamp string",
 *   "totalCount": "number of proposals in export",
 *   "proposals": [
 *     {
 *       "id": "string (proposal hex id)",
 *       "title": "string | null",
 *       "summary": "string | null",
 *       "state": "string (Active | Defeated | Succeeded | etc. | Unavailable)",
 *       "proposer": "string | null",
 *       "voteSnapshot": "number | null",
 *       "voteEnd": "number | null",
 *       "totalVotes": "string | number | null",
 *       "discoveryStatus": "ready | error"
 *     }
 *   ]
 * }
 * ```
 */

export type ExportableProposal = {
  id: string;
  title?: string | null;
  summary?: string | null;
  state: string;
  proposer?: string | null;
  voteSnapshot?: number | null;
  voteEnd?: number | null;
  totalVotes?: string | number | null;
  discoveryStatus?: "ready" | "error";
};

export type ProposalsExportMetadata = {
  communityId?: string;
  communityName?: string;
  exportedAt?: string;
};

export type ProposalsExportJsonPayload = {
  $schema: string;
  version: 1;
  communityId?: string;
  communityName?: string;
  exportedAt: string;
  totalCount: number;
  proposals: Array<{
    id: string;
    title: string | null;
    summary: string | null;
    state: string;
    proposer: string | null;
    voteSnapshot: number | null;
    voteEnd: number | null;
    totalVotes: string | number | null;
    discoveryStatus: "ready" | "error";
  }>;
};

const CSV_HEADERS = [
  "id",
  "title",
  "summary",
  "state",
  "proposer",
  "voteSnapshot",
  "voteEnd",
  "totalVotes",
  "discoveryStatus",
] as const;

/**
 * Escapes a scalar value for RFC 4180 CSV compliance:
 * - Null/undefined become empty string
 * - Strings containing commas, quotes, or newlines are quoted and inner quotes escaped
 */
export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const text = String(value);
  if (text.includes(",") || text.includes('"') || text.includes("\n") || text.includes("\r")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Serializes a list of proposals into standard RFC 4180 CSV with headers.
 */
export function serializeProposalsToCsv(proposals: ExportableProposal[]): string {
  const headerLine = CSV_HEADERS.join(",");
  if (proposals.length === 0) {
    return `${headerLine}\r\n`;
  }

  const rows = proposals.map((p) => {
    return [
      escapeCsvField(p.id),
      escapeCsvField(p.title ?? ""),
      escapeCsvField(p.summary ?? ""),
      escapeCsvField(p.state),
      escapeCsvField(p.proposer ?? ""),
      escapeCsvField(p.voteSnapshot ?? ""),
      escapeCsvField(p.voteEnd ?? ""),
      escapeCsvField(p.totalVotes ?? ""),
      escapeCsvField(p.discoveryStatus ?? "ready"),
    ].join(",");
  });

  return `${headerLine}\r\n${rows.join("\r\n")}\r\n`;
}

/**
 * Serializes a list of proposals into structured JSON matching the v1 schema.
 */
export function serializeProposalsToJson(
  proposals: ExportableProposal[],
  metadata?: ProposalsExportMetadata,
): string {
  const payload: ProposalsExportJsonPayload = {
    $schema: "https://stolla.io/schemas/proposals-export-v1.json",
    version: 1,
    ...(metadata?.communityId ? { communityId: metadata.communityId } : {}),
    ...(metadata?.communityName ? { communityName: metadata.communityName } : {}),
    exportedAt: metadata?.exportedAt ?? new Date().toISOString(),
    totalCount: proposals.length,
    proposals: proposals.map((p) => ({
      id: p.id,
      title: p.title ?? null,
      summary: p.summary ?? null,
      state: p.state,
      proposer: p.proposer ?? null,
      voteSnapshot: p.voteSnapshot ?? null,
      voteEnd: p.voteEnd ?? null,
      totalVotes: p.totalVotes ?? null,
      discoveryStatus: p.discoveryStatus ?? "ready",
    })),
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Triggers a browser file download from an in-memory string.
 */
export function downloadFile(
  content: string,
  filename: string,
  contentType: string,
): void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  const blob = new Blob([content], { type: `${contentType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
