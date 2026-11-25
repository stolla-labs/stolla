import {
  communityWizardStorageKey,
  isCommunityWizardDirty,
  parseCommunityWizardDraft,
  type CommunityWizardDraft,
} from "./wizard";

/**
 * Previewing an unpublished community without it looking live.
 *
 * A creator wants to see the page a reader will see before paying for a
 * factory deployment. The draft only exists in this browser's storage, so the
 * preview is necessarily local — which is also the whole of its access
 * control: there is no server to ask, so there is nobody to ask on behalf of.
 *
 * That is not quite enough on its own. A URL is the one part of a local page a
 * creator can paste somewhere, and `/communities/draft/preview` would then
 * read whatever draft the *recipient* happens to have — a stranger's own
 * half-written community, rendered as though the sender had shared it. So the
 * route requires a token the wizard mints on this device and which expires:
 * a pasted link opens the refusal, not somebody else's draft, and not a stale
 * version of the sender's.
 *
 * Nothing here is a secret and nothing here is a permission. The draft is the
 * reader's own; the token only proves the request came from the wizard on this
 * device, recently.
 */

export const DRAFT_PREVIEW_PATH = "/communities/draft/preview";

/**
 * Long enough to read the preview and go back to the wizard, short enough that
 * a link pasted into a chat has stopped working by the time anybody opens it.
 */
export const DRAFT_PREVIEW_TOKEN_TTL_MS = 30 * 60 * 1000;

export type DraftPreviewNetwork = "testnet" | "mainnet";

export function draftPreviewTokenKey(network: DraftPreviewNetwork): string {
  return `stolla:community-draft-preview:v1:${network}`;
}

export function draftPreviewHref(token: string): string {
  return `${DRAFT_PREVIEW_PATH}?token=${encodeURIComponent(token)}`;
}

function randomToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Issues a preview token for this device, replacing any previous one. */
export function mintDraftPreviewToken(
  network: DraftPreviewNetwork,
  now: number = Date.now(),
): string | null {
  if (typeof window === "undefined") return null;
  const token = randomToken();
  try {
    localStorage.setItem(
      draftPreviewTokenKey(network),
      JSON.stringify({ token, issuedAt: now }),
    );
  } catch {
    // Storage can be disabled or full. Without a token the preview refuses,
    // which is the correct outcome: better than a preview that opens for
    // anybody holding the link.
    return null;
  }
  return token;
}

export function clearDraftPreviewToken(network: DraftPreviewNetwork): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(draftPreviewTokenKey(network));
  } catch {
    // Nothing to do: an unreadable store cannot have granted anything either.
  }
}

export type DraftPreviewResolution =
  | { status: "granted"; draft: CommunityWizardDraft }
  /** The link carried no token, or this device has never minted one. */
  | { status: "no-token" }
  /** A token from somewhere else, or from a draft since restarted. */
  | { status: "token-mismatch" }
  | { status: "expired" }
  /** The token is good but there is no draft on this device to show. */
  | { status: "no-draft" }
  /** A draft exists but nothing has been typed into it. */
  | { status: "empty-draft" };

/**
 * Whether this request may see this device's draft, and the draft if so.
 *
 * Every refusal is a distinct case because they tell a creator different
 * things: an expired link means "open the preview from the wizard again",
 * while an empty draft means "there is nothing to preview yet".
 */
export function resolveDraftPreview({
  network,
  token,
  now = Date.now(),
}: {
  network: DraftPreviewNetwork;
  token: string | null;
  now?: number;
}): DraftPreviewResolution {
  if (typeof window === "undefined") return { status: "no-token" };
  if (!token) return { status: "no-token" };

  let issued: { token?: unknown; issuedAt?: unknown } | null = null;
  try {
    const raw = localStorage.getItem(draftPreviewTokenKey(network));
    if (!raw) return { status: "no-token" };
    issued = JSON.parse(raw) as { token?: unknown; issuedAt?: unknown };
  } catch {
    return { status: "no-token" };
  }

  if (typeof issued?.token !== "string" || typeof issued.issuedAt !== "number") {
    return { status: "no-token" };
  }
  if (issued.token !== token) return { status: "token-mismatch" };
  if (now - issued.issuedAt > DRAFT_PREVIEW_TOKEN_TTL_MS || now < issued.issuedAt) {
    /* A token issued in the future is a clock that moved, not a grant: treat
       it as expired rather than trusting an interval nobody can measure. */
    return { status: "expired" };
  }

  let draft: CommunityWizardDraft | null = null;
  try {
    draft = parseCommunityWizardDraft(
      localStorage.getItem(communityWizardStorageKey(network)),
      network,
    );
  } catch {
    return { status: "no-draft" };
  }

  if (!draft) return { status: "no-draft" };
  if (!isCommunityWizardDirty(draft)) return { status: "empty-draft" };

  return { status: "granted", draft };
}

/**
 * What a draft is called in the preview.
 *
 * A community with no name yet gets a placeholder rather than an empty
 * heading — and never an invented one, because the point of the preview is to
 * show what a reader would see.
 */
export function draftPreviewName(draft: CommunityWizardDraft): string {
  return draft.metadata.name.trim() || "Untitled community";
}
