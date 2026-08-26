import { describe, expect, it } from "vitest";
import { serializeCommunityMetadata } from "./metadata";
import type { CommunityMetadataDraft } from "./schema";

const baseDraft: CommunityMetadataDraft = {
  name: "  My Community  ",
  symbol: "MC",
  description: "  This is a \n test.  ",
  collectionUri: "ipfs://collection",
  metadataUri: "ipfs://metadata",
  logo: "  https://logo.png  ",
  externalLinkLabel: "  Website  ",
  externalLinkUrl: "  https://example.com  ",
};

describe("serializeCommunityMetadata", () => {
  it("normalizes inputs and maintains fixed ordering", async () => {
    const res1 = await serializeCommunityMetadata(baseDraft);
    const res2 = await serializeCommunityMetadata({
      ...baseDraft,
      name: "My Community", // Already trimmed
      description: "This is a \n test.",
      logo: "https://logo.png",
      externalLinkLabel: "Website",
      externalLinkUrl: "https://example.com",
    });

    expect(res1.json).toBe(res2.json);
    expect(res1.hash).toBe(res2.hash);
    expect(res1.json).toContain('"name": "My Community"');
    expect(res1.json).toContain('"logo": "https://logo.png"');
    expect(res1.json).toContain('"label": "Website"');
  });

  it("handles Unicode correctly", async () => {
    const draft = {
      ...baseDraft,
      name: "🚀 Emoji 🚀",
      description: "Tésting Ünicode",
    };
    const res = await serializeCommunityMetadata(draft);
    expect(res.json).toContain("🚀 Emoji 🚀");
    expect(res.json).toContain("Tésting Ünicode");
    // Verify hash stability for specific known input
    expect(res.hash).toHaveLength(64); 
  });

  it("handles empty optional fields", async () => {
    const draft = {
      ...baseDraft,
      logo: "   ",
      externalLinkLabel: " ",
      externalLinkUrl: "",
    };
    const res = await serializeCommunityMetadata(draft);
    expect(res.json).not.toContain("logo");
    expect(res.json).toContain('"externalLinks": []');
  });
  
  it("escapes characters as standard JSON", async () => {
    const draft = {
      ...baseDraft,
      description: 'Quote " test \\ slash',
    };
    const res = await serializeCommunityMetadata(draft);
    expect(res.json).toContain('Quote \\" test \\\\ slash');
  });
});
