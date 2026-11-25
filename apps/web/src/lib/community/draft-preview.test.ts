import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDraftPreviewToken,
  draftPreviewHref,
  draftPreviewName,
  DRAFT_PREVIEW_PATH,
  DRAFT_PREVIEW_TOKEN_TTL_MS,
  draftPreviewTokenKey,
  mintDraftPreviewToken,
  resolveDraftPreview,
} from "./draft-preview";
import {
  communityWizardStorageKey,
  emptyCommunityWizardDraft,
  type CommunityWizardDraft,
} from "./wizard";

const NETWORK = "testnet";
const NOW = Date.parse("2026-11-25T10:00:00.000Z");

function storeDraft(overrides: Partial<CommunityWizardDraft["metadata"]> = {}) {
  const draft = emptyCommunityWizardDraft(NETWORK);
  const stored: CommunityWizardDraft = {
    ...draft,
    metadata: { ...draft.metadata, name: "Civic Fund", symbol: "CIVIC", ...overrides },
  };
  localStorage.setItem(communityWizardStorageKey(NETWORK), JSON.stringify(stored));
  return stored;
}

beforeEach(() => {
  localStorage.clear();
});

describe("mintDraftPreviewToken", () => {
  it("issues a token this device can present", () => {
    const token = mintDraftPreviewToken(NETWORK, NOW);

    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(localStorage.getItem(draftPreviewTokenKey(NETWORK))).toContain(token ?? "");
  });

  it("replaces the previous token", () => {
    const first = mintDraftPreviewToken(NETWORK, NOW);
    const second = mintDraftPreviewToken(NETWORK, NOW);

    expect(second).not.toBe(first);
    storeDraft();
    expect(resolveDraftPreview({ network: NETWORK, token: first, now: NOW }).status).toBe(
      "token-mismatch",
    );
  });

  it("returns nothing rather than a token it could not store", () => {
    // Without a stored token the preview refuses, which beats a preview that
    // opens for anybody holding the link.
    const setItem = vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("storage disabled");
    });

    expect(mintDraftPreviewToken(NETWORK, NOW)).toBeNull();
    setItem.mockRestore();
  });
});

describe("resolveDraftPreview", () => {
  it("shows the draft to the wizard that minted the token", () => {
    const stored = storeDraft();
    const token = mintDraftPreviewToken(NETWORK, NOW);

    expect(resolveDraftPreview({ network: NETWORK, token, now: NOW })).toEqual({
      status: "granted",
      draft: stored,
    });
  });

  it("refuses a link with no token on it", () => {
    storeDraft();
    mintDraftPreviewToken(NETWORK, NOW);

    expect(resolveDraftPreview({ network: NETWORK, token: null, now: NOW }).status).toBe(
      "no-token",
    );
    expect(resolveDraftPreview({ network: NETWORK, token: "", now: NOW }).status).toBe(
      "no-token",
    );
  });

  it("refuses a token this device never issued", () => {
    // The case the token exists for: a link pasted into a chat, opened by
    // somebody who has a half-written draft of their own.
    storeDraft({ name: "Somebody else's draft" });

    expect(
      resolveDraftPreview({ network: NETWORK, token: "f".repeat(32), now: NOW }).status,
    ).toBe("no-token");

    mintDraftPreviewToken(NETWORK, NOW);
    expect(
      resolveDraftPreview({ network: NETWORK, token: "f".repeat(32), now: NOW }).status,
    ).toBe("token-mismatch");
  });

  it("stops honouring a token after it expires", () => {
    storeDraft();
    const token = mintDraftPreviewToken(NETWORK, NOW);

    expect(
      resolveDraftPreview({
        network: NETWORK,
        token,
        now: NOW + DRAFT_PREVIEW_TOKEN_TTL_MS - 1,
      }).status,
    ).toBe("granted");
    expect(
      resolveDraftPreview({
        network: NETWORK,
        token,
        now: NOW + DRAFT_PREVIEW_TOKEN_TTL_MS + 1,
      }).status,
    ).toBe("expired");
  });

  it("treats a token from the future as expired", () => {
    // A clock that moved is not a grant, because the interval cannot be measured.
    storeDraft();
    const token = mintDraftPreviewToken(NETWORK, NOW);

    expect(resolveDraftPreview({ network: NETWORK, token, now: NOW - 60_000 }).status).toBe(
      "expired",
    );
  });

  it("separates a missing draft from an untouched one", () => {
    const token = mintDraftPreviewToken(NETWORK, NOW);
    expect(resolveDraftPreview({ network: NETWORK, token, now: NOW }).status).toBe("no-draft");

    localStorage.setItem(
      communityWizardStorageKey(NETWORK),
      JSON.stringify(emptyCommunityWizardDraft(NETWORK)),
    );
    expect(resolveDraftPreview({ network: NETWORK, token, now: NOW }).status).toBe(
      "empty-draft",
    );
  });

  it("does not show a mainnet draft to a testnet preview", () => {
    storeDraft();
    const token = mintDraftPreviewToken(NETWORK, NOW);

    expect(resolveDraftPreview({ network: "mainnet", token, now: NOW }).status).toBe(
      "no-token",
    );
  });

  it("refuses once the token is cleared", () => {
    storeDraft();
    const token = mintDraftPreviewToken(NETWORK, NOW);
    clearDraftPreviewToken(NETWORK);

    expect(resolveDraftPreview({ network: NETWORK, token, now: NOW }).status).toBe("no-token");
  });

  it("refuses when storage holds something that is not a token", () => {
    localStorage.setItem(draftPreviewTokenKey(NETWORK), "{not json");
    expect(resolveDraftPreview({ network: NETWORK, token: "abc", now: NOW }).status).toBe(
      "no-token",
    );

    localStorage.setItem(draftPreviewTokenKey(NETWORK), JSON.stringify({ token: 7 }));
    expect(resolveDraftPreview({ network: NETWORK, token: "abc", now: NOW }).status).toBe(
      "no-token",
    );
  });
});

describe("links and naming", () => {
  it("builds a preview link carrying the token", () => {
    expect(draftPreviewHref("abc def")).toBe(`${DRAFT_PREVIEW_PATH}?token=abc%20def`);
  });

  it("names an unnamed draft rather than rendering an empty heading", () => {
    const draft = emptyCommunityWizardDraft(NETWORK);

    expect(draftPreviewName(draft)).toBe("Untitled community");
    expect(draftPreviewName({ ...draft, metadata: { ...draft.metadata, name: " Civic " } })).toBe(
      "Civic",
    );
  });
});
