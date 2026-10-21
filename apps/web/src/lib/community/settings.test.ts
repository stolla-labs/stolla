import { beforeEach, describe, expect, it } from "vitest";
import {
  canEditCommunitySettings,
  readMetadataOverlay,
  retainSettingsDraft,
  writeMetadataOverlay,
} from "./settings";

const OWNER = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const OTHER = "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2";

describe("community settings gate", () => {
  it("allows only the community owner", () => {
    expect(canEditCommunitySettings(OWNER, OWNER)).toBe(true);
    expect(canEditCommunitySettings(OTHER, OWNER)).toBe(false);
    expect(canEditCommunitySettings(null, OWNER)).toBe(false);
  });

  it("keeps the draft when a pin fails", () => {
    const draft = { name: "Alpha", description: "Launch copy" };
    expect(retainSettingsDraft(draft)).toBe(draft);
  });

  it("stores a successful metadata update for the detail page", () => {
    const store = new Map<string, string>();
    viSession(store);
    writeMetadataOverlay("community-1", {
      name: "Alpha",
      description: "Updated",
      metadataUri: "ipfs://bafy-updated",
      metadataHash: "ab".repeat(32),
    });
    expect(readMetadataOverlay("community-1")).toMatchObject({
      metadataUri: "ipfs://bafy-updated",
      name: "Alpha",
    });
  });
});

function viSession(store: Map<string, string>) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => store.set(key, value),
      },
    },
  });
}

beforeEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: undefined,
  });
});
