/**
 * Proposal Discovery Migration
 *
 * Preserves locally created proposal IDs during the transition from
 * browser-local storage to public event discovery (#45).
 *
 * When public event discovery replaces localStorage as the primary
 * proposal source, recently created or legacy locally stored proposals
 * may temporarily be absent because of RPC ingestion delay or
 * start-ledger limits.  They should not disappear abruptly during
 * migration.
 *
 * This module provides a **temporary** compatibility path that:
 *   - Reads legacy localStorage proposal IDs.
 *   - Merges them with public proposal summaries using canonical hex IDs.
 *   - Deduplicates IDs found in both sources (public source wins).
 *   - Marks local-only entries while their public event is unavailable.
 *   - Silently ignores malformed stored values.
 *
 * --- Removal Criteria ---
 *
 * This compatibility path can be removed when **all** of the following
 * conditions are met:
 *
 *  1. Public event discovery (#45) has been the primary production
 *     proposal source for at least one full proposal lifecycle on every
 *     active community.
 *
 *  2. No local-only entries remain that were created before the
 *     migration cut-off date.  Tracked by: the
 *     ``PROPOSAL_STORAGE_KEY`` ("stolla:proposal-ids") localStorage
 *     explicitly cleared by the migration clean-up.
 *
 *  3. All governance contracts deployed after the migration adopt
 *     public discovery from genesis and never write to
 *     ``localStorage``.
 *
 * **Suggested removal window:** T+90 days after #45 ships to
 * production.
 *
 * @module discovery
 */

import { getStoredProposalIds } from "../contracts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A public proposal summary returned by event discovery (#45). */
export interface PublicProposalSummary {
  /** Canonical hex-encoded proposal ID (case-insensitive). */
  id: string;
  /** Optional human-readable on-chain state label. */
  state?: string;
}

/** Which data source a discovered proposal originated from. */
export type ProposalSource = "public" | "local-only";

/** A single proposal entry after merging public and legacy-local sources. */
export interface DiscoveredProposal {
  /** Canonical hex-encoded proposal ID (lowercase). */
  id: string;
  /** Primary data source for this proposal. */
  source: ProposalSource;
  /** On-chain state label (undefined for local-only entries). */
  state?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validate that a value is a well-formed hex proposal ID.
 *
 * Non-hex characters, empty strings, and excessively long values are
 * rejected.  Casing is *not* normalised here — callers are expected to
 * down-case for canonical comparison.
 */
function isValidHexId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  // Soroban proposal IDs are 32 bytes → 64 hex chars.  We accept any
  // reasonable-length hex string so we don't break on future format
  // changes.
  if (value.length === 0 || value.length > 128) return false;
  return /^[0-9a-fA-F]+$/.test(value);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Read legacy locally stored proposal IDs.
 *
 * This is the **temporary compatibility source** described in #54.
 * Once the removal criteria are satisfied this function (and the
 * underlying localStorage key) can be retired.
 *
 * Malformed stored values are silently dropped — only valid hex IDs
 * are returned.
 *
 * @returns Array of canonical (lowercase) hex proposal IDs.
 */
export function getLegacyLocalProposalIds(): string[] {
  let raw: unknown;
  try {
    raw = getStoredProposalIds();
  } catch {
    return [];
  }
  // getStoredProposalIds may return a non-array (e.g. null, {}) when
  // localStorage contains valid JSON that isn't an array.  Guard
  // against this so we never call .filter on a non-array value.
  if (!Array.isArray(raw)) return [];
  return raw.filter(isValidHexId).map((id) => id.toLowerCase());
}

/**
 * Merge public proposal summaries with legacy locally stored IDs.
 *
 * Rules (matching the acceptance criteria in #54):
 *
 *  1. Publicly discovered proposals remain the **primary source**.
 *  2. A valid legacy local ID missing from the public response appears
 *     **once** as a ``"local-only"`` entry.
 *  3. IDs found in both sources are **deduplicated** (public source
 *     wins, including its ``state``).
 *  4. Malformed stored values are **ignored safely**.
 *  5. Local-only entries are **not presented as fully indexed public
 *     records** — their ``state`` is always ``undefined``.
 *
 * Canonical ID comparison is case-insensitive: ``"0a1B"`` and
 * ``"0a1b"`` are treated as the same proposal.
 *
 * @param publicProposals  Proposals discovered from public events
 *                         (empty array until #45 is implemented).
 * @param legacyLocalIds   Hex IDs from localStorage (use
 *                         {@link getLegacyLocalProposalIds}).
 * @returns Merged, deduplicated list of proposals.
 */
export function discoverProposals(
  publicProposals: PublicProposalSummary[],
  legacyLocalIds: string[],
): DiscoveredProposal[] {
  // Normalise public IDs to lowercase for canonical comparison.
  const publicById = new Map<string, PublicProposalSummary>();
  for (const p of publicProposals) {
    if (isValidHexId(p.id)) {
      const canonical = p.id.toLowerCase();
      // First occurrence wins (public discovery should not have dupes,
      // but be defensive).
      if (!publicById.has(canonical)) {
        publicById.set(canonical, p);
      }
    }
  }

  const result: DiscoveredProposal[] = [];
  const seen = new Set<string>();

  // 1. Public proposals first — they are the primary source.
  for (const [canonical, summary] of publicById) {
    result.push({
      id: canonical,
      source: "public",
      state: summary.state,
    });
    seen.add(canonical);
  }

  // 2. Legacy local IDs not already provided by public discovery.
  for (const rawId of legacyLocalIds) {
    if (!isValidHexId(rawId)) continue;
    const canonical = rawId.toLowerCase();
    if (seen.has(canonical)) continue; // dedup
    seen.add(canonical);
    result.push({
      id: canonical,
      source: "local-only",
      state: undefined, // not a fully indexed public record
    });
  }

  return result;
}
