import type { ProposalSummary } from "./types";

export type ProposalDiscoveryIdentityFields = Pick<
  ProposalSummary,
  | "governorContractId"
  | "proposalId"
  | "creationLedger"
  | "txHash"
  | "cursor"
>;

/**
 * Stable event identity for proposal discovery deduplication (ADR-004).
 *
 * Composed from the Governor contract id, canonical proposal id, and any
 * available RPC metadata (tx hash, creation ledger, opaque event cursor).
 *
 * Fallback when optional metadata is missing:
 * - With tx hash: `contract|proposalId|tx:…|ledger:…`
 * - Else with cursor: `contract|proposalId|cursor:…`
 * - Else: `contract|proposalId` (proposal-level identity only)
 */
export function stableEventIdentity(
  fields: ProposalDiscoveryIdentityFields,
): string {
  const contract = fields.governorContractId;
  const proposalId = fields.proposalId.toLowerCase();
  const parts = [contract, proposalId];

  if (fields.txHash) {
    parts.push(`tx:${fields.txHash}`);
    parts.push(`ledger:${fields.creationLedger}`);
    return parts.join("|");
  }

  if (fields.cursor) {
    parts.push(`cursor:${fields.cursor}`);
    return parts.join("|");
  }

  return parts.join("|");
}

/** Proposal-row identity: one public history row per Governor + proposal id. */
export function proposalRowIdentity(
  fields: Pick<ProposalSummary, "governorContractId" | "proposalId">,
): string {
  return `${fields.governorContractId}|${fields.proposalId.toLowerCase()}`;
}

function completenessScore(summary: ProposalSummary): number {
  let score = 0;
  if (summary.proposer) score += 1;
  if (summary.cursor) score += 1;
  if (summary.txHash) score += 1;
  if (summary.description) score += 1;
  if (summary.creationLedger > 0) score += 1;
  return score;
}

/**
 * Deduplicate proposal discovery results across a single page or concatenated
 * pages.
 *
 * - Identical events (same {@link stableEventIdentity}) collapse to one entry.
 * - The same proposal across overlapping pages collapses to one row.
 * - Distinct proposal IDs are never merged.
 * - Ordering follows first-seen order; retries therefore stay stable.
 * - When duplicates differ in completeness, the first complete representation
 *   wins (later, richer rows may replace an earlier incomplete one without
 *   moving its position).
 */
export function dedupeProposalSummaries(
  items: readonly ProposalSummary[],
): ProposalSummary[] {
  const byEvent = new Map<string, ProposalSummary>();
  const eventOrder: string[] = [];

  for (const item of items) {
    const eventKey = stableEventIdentity(item);
    const existingEvent = byEvent.get(eventKey);
    if (!existingEvent) {
      byEvent.set(eventKey, item);
      eventOrder.push(eventKey);
      continue;
    }
    if (completenessScore(item) > completenessScore(existingEvent)) {
      byEvent.set(eventKey, item);
    }
  }

  const byProposal = new Map<
    string,
    { order: number; summary: ProposalSummary }
  >();
  let order = 0;

  for (const eventKey of eventOrder) {
    const summary = byEvent.get(eventKey)!;
    const rowKey = proposalRowIdentity(summary);
    const existing = byProposal.get(rowKey);
    if (!existing) {
      byProposal.set(rowKey, { order, summary });
      order += 1;
      continue;
    }
    if (completenessScore(summary) > completenessScore(existing.summary)) {
      byProposal.set(rowKey, { order: existing.order, summary });
    }
  }

  return [...byProposal.values()]
    .sort((a, b) => a.order - b.order)
    .map((entry) => entry.summary);
}
