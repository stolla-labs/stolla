import { describe, expect, it, vi } from "vitest";
import {
  buildCommunityDocuments,
  buildMemberDocument,
  isCanonicalMetadata,
  metadataSha256,
  pinMetadata,
} from "./publish";
import type { CommunityMetadataDraft } from "@/lib/community/schema";

const draft: CommunityMetadataDraft = {
  name: "Builders Guild",
  symbol: "BUILD",
  description: "Public goods builders",
  collectionUri: "",
  metadataUri: "",
  logo: "ipfs://logo",
  externalLinkLabel: "Forum",
  externalLinkUrl: "https://example.org/forum",
};
const cid = "bafkreid7qoywk77r7rj3slobqfekdvs57qwuwh5d2z3sqsw52iabe3mqne";

describe("metadata serialization and pinning", () => {
  it("builds canonical community and collection documents without pasted URIs", async () => {
    const [community, collection] = buildCommunityDocuments(draft);
    expect(community.json).toBe(JSON.stringify({
      schemaVersion: 1, name: draft.name, description: draft.description,
      logo: draft.logo, externalLinks: [{ label: "Forum", url: draft.externalLinkUrl }],
    }));
    expect(isCanonicalMetadata("community", community.json)).toBe(true);
    expect(isCanonicalMetadata("collection", collection.json)).toBe(true);
    expect(await metadataSha256(community.json)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects invalid external links and oversized member metadata", () => {
    expect(() => buildCommunityDocuments({ ...draft, externalLinkUrl: "http://example.org" })).toThrow();
    expect(() => buildMemberDocument({ name: "Member", description: "x".repeat(2_001), image: "" })).toThrow();
    expect(isCanonicalMetadata("member", '{"name":"A","description":"B","attributes":[],"secret":1}')).toBe(false);
  });

  it("compares the response digest with the exact previewed bytes", async () => {
    const document = buildMemberDocument({ name: "Member #1", description: "A vote", image: "" });
    const sha256 = await metadataSha256(document.json);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ uri: `ipfs://${cid}`, sha256 }), { status: 200 }),
    );
    await expect(pinMetadata(document)).resolves.toBe(`ipfs://${cid}`);
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual(document);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ uri: `ipfs://${cid}`, sha256: "0".repeat(64) }), { status: 200 }));
    await expect(pinMetadata(document)).rejects.toThrow(/did not match/);
    fetchMock.mockRestore();
  });
});
