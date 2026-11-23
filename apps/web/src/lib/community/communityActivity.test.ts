import { describe, expect, it } from "vitest";
import {
  communityActivityLabel,
  communityWriteBlockReason,
  parseCommunityActivity,
} from "./communityActivity";

describe("community activity", () => {
  it("parses names, tags, and discriminants", () => {
    expect(parseCommunityActivity("Paused")).toBe("paused");
    expect(parseCommunityActivity({ tag: "Archived" })).toBe("archived");
    expect(parseCommunityActivity(0)).toBe("active");
    expect(parseCommunityActivity(undefined)).toBe("active");
  });

  it("labels paused and archived communities and blocks their write actions", () => {
    expect(communityActivityLabel("active")).toBeNull();
    expect(communityActivityLabel("paused")).toBe("Paused");
    expect(communityWriteBlockReason("active")).toBeNull();
    expect(communityWriteBlockReason(undefined)).toBeNull();
    expect(communityWriteBlockReason("paused")).toMatch(/paused/i);
    expect(communityWriteBlockReason("archived")).toMatch(/archived/i);
  });
});
