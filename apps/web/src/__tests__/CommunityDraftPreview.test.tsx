/** Covers issue #532: a watermarked, unindexed, device-local draft preview. */
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ searchParams: new URLSearchParams() }));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mocks.searchParams,
}));

import { DraftPreviewRoute } from "@/app/(app)/communities/draft/preview/draft-preview-route";
import DraftPreviewPage, {
  metadata,
} from "@/app/(app)/communities/draft/preview/page";
import {
  communityWizardStorageKey,
  emptyCommunityWizardDraft,
  type CommunityWizardDraft,
} from "@/lib/community/wizard";
import { mintDraftPreviewToken } from "@/lib/community/draft-preview";

const NETWORK = "testnet";

function storeDraft(overrides: Partial<CommunityWizardDraft["metadata"]> = {}) {
  const draft = emptyCommunityWizardDraft(NETWORK);
  localStorage.setItem(
    communityWizardStorageKey(NETWORK),
    JSON.stringify({
      ...draft,
      step: 3,
      metadata: {
        ...draft.metadata,
        name: "Civic Fund",
        symbol: "CIVIC",
        description: "Funds public goods on Stellar.",
        externalLinkLabel: "Forum",
        externalLinkUrl: "https://forum.example.test",
        ...overrides,
      },
    }),
  );
}

function renderWithToken(token: string | null) {
  mocks.searchParams = new URLSearchParams(token === null ? "" : `token=${token}`);
  return render(<DraftPreviewRoute />);
}

beforeEach(() => {
  localStorage.clear();
});

describe("the preview route", () => {
  it("is never indexed", async () => {
    // A draft is not meant to be discoverable, and a crawler that reached the
    // URL some other way must not list it.
    expect(metadata.robots).toEqual({ index: false, follow: false, nocache: true });
    expect(typeof DraftPreviewPage).toBe("function");
  });

  it("shows the draft to the wizard that opened it", async () => {
    storeDraft();
    const token = mintDraftPreviewToken(NETWORK);

    renderWithToken(token);

    await waitFor(() => expect(screen.getByText("Civic Fund")).toBeInTheDocument());
    expect(screen.getByText("CIVIC")).toBeInTheDocument();
    expect(screen.getByText("Funds public goods on Stellar.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Forum/ })).toHaveAttribute(
      "href",
      "https://forum.example.test",
    );
  });

  it("marks the page as a draft in two independent ways", async () => {
    storeDraft();
    renderWithToken(mintDraftPreviewToken(NETWORK));

    await waitFor(() => expect(screen.getByTestId("draft-watermark")).toBeInTheDocument());
    // The watermark is decorative — repeated text a screen reader would
    // announce for no information — so the sentence has to be a real element.
    expect(screen.getByTestId("draft-watermark")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByTestId("draft-preview-banner").textContent).toContain(
      "This is an unpublished draft.",
    );
  });

  it("stays visible and uninteractive at any width", async () => {
    storeDraft();
    renderWithToken(mintDraftPreviewToken(NETWORK));

    const watermark = await screen.findByTestId("draft-watermark");
    // Viewport-relative type rather than a breakpoint deciding who gets a
    // warning, and no click interception on the page it covers.
    expect(watermark.className).toContain("fixed");
    expect(watermark.className).toContain("pointer-events-none");
    expect(watermark.querySelector("span")?.className).toMatch(/text-\[\d+vw\]/);
  });

  it("invents no contract addresses", async () => {
    storeDraft();
    renderWithToken(mintDraftPreviewToken(NETWORK));

    // A plausible-looking id is the one lie a preview must not tell: a creator
    // checking the page would have no way to know it was invented.
    const contracts = await screen.findByTestId("draft-preview-contracts");
    expect(contracts.textContent).toContain("Not deployed");
  });

  it("refuses a link with no token", async () => {
    storeDraft();
    mintDraftPreviewToken(NETWORK);

    renderWithToken(null);

    await waitFor(() =>
      expect(screen.getByTestId("draft-preview-no-token")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Civic Fund")).toBeNull();
  });

  it("refuses a token this browser did not issue, holding a draft of its own", async () => {
    // The case the token exists for: a pasted link opening the recipient's own
    // half-written community as though the sender had shared it.
    storeDraft({ name: "Somebody else's draft" });
    mintDraftPreviewToken(NETWORK);

    renderWithToken("f".repeat(32));

    await waitFor(() =>
      expect(screen.getByTestId("draft-preview-token-mismatch")).toBeInTheDocument(),
    );
    expect(screen.queryByText("Somebody else's draft")).toBeNull();
  });

  it("says there is nothing to preview when the draft is untouched", async () => {
    localStorage.setItem(
      communityWizardStorageKey(NETWORK),
      JSON.stringify(emptyCommunityWizardDraft(NETWORK)),
    );

    renderWithToken(mintDraftPreviewToken(NETWORK));

    await waitFor(() =>
      expect(screen.getByTestId("draft-preview-empty-draft")).toBeInTheDocument(),
    );
  });

  it("says so when the browser holds no draft at all", async () => {
    renderWithToken(mintDraftPreviewToken(NETWORK));

    await waitFor(() =>
      expect(screen.getByTestId("draft-preview-no-draft")).toBeInTheDocument(),
    );
  });
});
