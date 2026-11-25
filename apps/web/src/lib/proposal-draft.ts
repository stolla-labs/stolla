import type { ProposalMetadataDraft } from "@/lib/proposal-metadata";

/**
 * Autosaved proposal drafts, scoped per Governor contract so a draft for
 * one community/governor can never clobber another's — the global create
 * form and any future community-scoped one each get their own key just
 * by passing their own `governorContractId`, the same scoping pattern
 * `lib/contracts.ts` already uses for stored proposal IDs.
 */
function draftStorageKey(governorContractId: string): string {
  return `stolla:proposal-draft:v1:${governorContractId}`;
}

function isBlank(value: string | null): boolean {
  return !value || value.trim() === "";
}

/** A draft with nothing meaningfully entered is treated as empty — never worth saving or restoring. */
export function isEmptyProposalDraft(draft: ProposalMetadataDraft): boolean {
  return (
    isBlank(draft.title) &&
    isBlank(draft.summary) &&
    isBlank(draft.body) &&
    isBlank(draft.discussionUrl) &&
    isBlank(draft.supersedes ?? null)
  );
}

function isValidDraftShape(value: unknown): value is ProposalMetadataDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as ProposalMetadataDraft;
  return (
    typeof draft.title === "string" &&
    typeof draft.summary === "string" &&
    typeof draft.body === "string" &&
    (draft.discussionUrl === null || typeof draft.discussionUrl === "string") &&
    /* Absent, not null, in every draft written before supersede links
       existed — those drafts must still restore. */
    (draft.supersedes === undefined ||
      draft.supersedes === null ||
      typeof draft.supersedes === "string")
  );
}

/** Reads the saved draft for one Governor contract, or `null` when there is none (or it fails to parse). */
export function readProposalDraft(
  governorContractId: string,
): ProposalMetadataDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(draftStorageKey(governorContractId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidDraftShape(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Saves the draft for one Governor contract. An empty draft is cleared
 * instead of written, so a field that was filled in and then erased by
 * hand does not leave a stale, pointless entry in storage.
 */
export function writeProposalDraft(
  governorContractId: string,
  draft: ProposalMetadataDraft,
): void {
  if (typeof window === "undefined") return;
  if (isEmptyProposalDraft(draft)) {
    clearProposalDraft(governorContractId);
    return;
  }
  localStorage.setItem(draftStorageKey(governorContractId), JSON.stringify(draft));
}

export function clearProposalDraft(governorContractId: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(draftStorageKey(governorContractId));
}
