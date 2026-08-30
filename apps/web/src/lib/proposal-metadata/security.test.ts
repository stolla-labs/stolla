import { describe, expect, it } from "vitest";
import { isSafeDiscussionUrl, validateProposalMetadataDraft } from "./validation";

describe("proposal metadata URL policy", () => {
  it.each([
    "http://example.org/topic",
    "javascript:alert(1)",
    "data:text/html,bad",
    "https://user:secret@example.org/topic",
    "//example.org/topic",
  ])("rejects unsafe discussion link %s", (url) => {
    expect(isSafeDiscussionUrl(url)).toBe(false);
    expect(
      validateProposalMetadataDraft({
        title: "Title",
        summary: "Summary",
        body: "Body",
        discussionUrl: url,
      }).discussionUrl,
    ).toMatch(/HTTPS URL/);
  });

  it("accepts absolute HTTPS links", () => {
    expect(isSafeDiscussionUrl("https://forum.example.org/t/1?view=all#vote")).toBe(true);
  });
});
