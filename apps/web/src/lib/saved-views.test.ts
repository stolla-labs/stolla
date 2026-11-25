import { beforeEach, describe, expect, it } from "vitest";
import {
  applyViewToSearch,
  deleteView,
  GLOBAL_SCOPE,
  isViewApplied,
  MAX_NAME_LENGTH,
  MAX_VIEWS,
  readSavedViews,
  saveView,
  viewParamsFrom,
  writeSavedViews,
  type SavedView,
} from "./saved-views";

const WALLET_A = "GWALLETA";
const WALLET_B = "GWALLETB";
const COMMUNITY_X = "CCOMMUNITYX";
const COMMUNITY_Y = "CCOMMUNITYY";

const ACTIVE_TREASURY: SavedView = {
  id: "view-active-treasury",
  name: "Active treasury",
  params: { state: "active", category: "treasury" },
  savedAt: "2026-11-21T10:00:00.000Z",
};

beforeEach(() => {
  localStorage.clear();
});

describe("saveView", () => {
  it("saves the current filters under a name", () => {
    const result = saveView([], {
      name: "  Active treasury  ",
      params: { state: "active", category: "treasury" },
      savedAt: ACTIVE_TREASURY.savedAt,
    });

    expect("views" in result).toBe(true);
    if (!("views" in result)) return;
    expect(result.views).toHaveLength(1);
    expect(result.views[0].name).toBe("Active treasury");
    expect(result.views[0].params).toEqual({ state: "active", category: "treasury" });
  });

  it("refuses a view with no filters in it", () => {
    // A view that applies nothing is an entry somebody deletes and then
    // wonders whether they lost something.
    expect(saveView([], { name: "Everything", params: {} })).toEqual({ problem: "no-filters" });
  });

  it("refuses an empty name and one too long for a button", () => {
    expect(saveView([], { name: "   ", params: { state: "active" } })).toEqual({
      problem: "empty-name",
    });
    expect(
      saveView([], { name: "x".repeat(MAX_NAME_LENGTH + 1), params: { state: "active" } }),
    ).toEqual({ problem: "name-too-long" });
  });

  it("replaces a view of the same name rather than adding a twin", () => {
    const result = saveView([ACTIVE_TREASURY], {
      name: "active TREASURY",
      params: { state: "active", q: "budget" },
    });

    expect("views" in result).toBe(true);
    if (!("views" in result)) return;
    expect(result.views).toHaveLength(1);
    expect(result.views[0].id).toBe(ACTIVE_TREASURY.id);
    expect(result.views[0].params).toEqual({ state: "active", q: "budget" });
  });

  it("stops at the documented number of views", () => {
    const full = Array.from({ length: MAX_VIEWS }, (_, index) => ({
      ...ACTIVE_TREASURY,
      id: `view-${index}`,
      name: `View ${index}`,
    }));

    expect(saveView(full, { name: "One more", params: { state: "active" } })).toEqual({
      problem: "too-many",
    });
    // Replacing one of the existing names still works at the cap, because it
    // adds nothing.
    expect(saveView(full, { name: "View 3", params: { state: "defeated" } })).toHaveProperty("views");
  });
});

describe("deleteView", () => {
  it("removes one view and leaves the rest", () => {
    const views = [ACTIVE_TREASURY, { ...ACTIVE_TREASURY, id: "view-two", name: "Two" }];

    expect(deleteView(views, "view-two").map((view) => view.id)).toEqual([ACTIVE_TREASURY.id]);
  });

  it("is the same list when nothing matched", () => {
    const views = [ACTIVE_TREASURY];

    expect(deleteView(views, "nothing")).toBe(views);
  });
});

describe("storage", () => {
  it("round trips through the device", () => {
    writeSavedViews(WALLET_A, COMMUNITY_X, [ACTIVE_TREASURY]);

    expect(readSavedViews(WALLET_A, COMMUNITY_X)).toEqual([ACTIVE_TREASURY]);
  });

  it("keeps one community's views out of another's", () => {
    writeSavedViews(WALLET_A, COMMUNITY_X, [ACTIVE_TREASURY]);

    expect(readSavedViews(WALLET_A, COMMUNITY_Y)).toEqual([]);
    expect(readSavedViews(WALLET_A, GLOBAL_SCOPE)).toEqual([]);
  });

  it("keeps one wallet's views out of another's", () => {
    writeSavedViews(WALLET_A, COMMUNITY_X, [ACTIVE_TREASURY]);

    expect(readSavedViews(WALLET_B, COMMUNITY_X)).toEqual([]);
  });

  it("gives a guest with no wallet their own device-local set", () => {
    writeSavedViews("", COMMUNITY_X, [ACTIVE_TREASURY]);

    expect(readSavedViews("", COMMUNITY_X)).toEqual([ACTIVE_TREASURY]);
    expect(readSavedViews(WALLET_A, COMMUNITY_X)).toEqual([]);
  });

  it("reads nothing from a file another version wrote", () => {
    localStorage.setItem(
      `stolla:saved-views:v1:${WALLET_A}:${COMMUNITY_X}`,
      JSON.stringify({ version: 2, views: [ACTIVE_TREASURY] }),
    );

    expect(readSavedViews(WALLET_A, COMMUNITY_X)).toEqual([]);
  });

  it("drops a view carrying a parameter this version does not apply", () => {
    localStorage.setItem(
      `stolla:saved-views:v1:${WALLET_A}:${COMMUNITY_X}`,
      JSON.stringify({
        version: 1,
        views: [ACTIVE_TREASURY, { ...ACTIVE_TREASURY, id: "odd", params: { sortBy: "whatever" } }],
      }),
    );

    // Applying such a view would do less than its name promises, so it is not
    // offered at all.
    expect(readSavedViews(WALLET_A, COMMUNITY_X).map((view) => view.id)).toEqual([
      ACTIVE_TREASURY.id,
    ]);
  });

  it("survives storage holding something that is not JSON", () => {
    localStorage.setItem(`stolla:saved-views:v1:${WALLET_A}:${COMMUNITY_X}`, "{not json");

    expect(readSavedViews(WALLET_A, COMMUNITY_X)).toEqual([]);
  });
});

describe("viewParamsFrom", () => {
  it("takes the filter parameters and nothing else from the URL", () => {
    const search = new URLSearchParams("state=active&q=budget&category=treasury&page=3&ref=email");

    expect(viewParamsFrom(search)).toEqual({ state: "active", q: "budget", category: "treasury" });
  });

  it("ignores a filter that is present but empty", () => {
    expect(viewParamsFrom(new URLSearchParams("state=&q=%20"))).toEqual({});
  });
});

describe("applyViewToSearch", () => {
  it("restores the view's filters", () => {
    const applied = applyViewToSearch(new URLSearchParams(""), ACTIVE_TREASURY);

    expect(new URLSearchParams(applied).get("state")).toBe("active");
    expect(new URLSearchParams(applied).get("category")).toBe("treasury");
  });

  it("clears a filter the view does not name", () => {
    // Otherwise a search term from the previous view survives into a view that
    // never mentioned one, and the list shows fewer proposals than the name says.
    const applied = applyViewToSearch(new URLSearchParams("q=old&state=defeated"), ACTIVE_TREASURY);
    const next = new URLSearchParams(applied);

    expect(next.get("q")).toBeNull();
    expect(next.get("state")).toBe("active");
  });

  it("keeps everything in the URL that is not a filter", () => {
    const applied = applyViewToSearch(new URLSearchParams("ref=email&page=2"), ACTIVE_TREASURY);
    const next = new URLSearchParams(applied);

    expect(next.get("ref")).toBe("email");
    expect(next.get("page")).toBe("2");
  });
});

describe("isViewApplied", () => {
  it("is true only when every filter matches, extras included", () => {
    expect(isViewApplied(new URLSearchParams("state=active&category=treasury"), ACTIVE_TREASURY)).toBe(true);
    expect(
      isViewApplied(new URLSearchParams("state=active&category=treasury&ref=email"), ACTIVE_TREASURY),
    ).toBe(true);
    expect(isViewApplied(new URLSearchParams("state=active"), ACTIVE_TREASURY)).toBe(false);
    expect(
      isViewApplied(new URLSearchParams("state=active&category=treasury&q=budget"), ACTIVE_TREASURY),
    ).toBe(false);
  });
});
