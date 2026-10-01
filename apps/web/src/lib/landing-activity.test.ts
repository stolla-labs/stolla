import { describe, expect, it } from "vitest";
import { activityHref, landingActivity } from "./landing-activity";

describe("landing activity", () => {
  it("links live rows to community proposal routes", () => {
    const activity = landingActivity({
      live: [{ id: "12", community: "alpha", title: "Pay the grant" }],
      error: false,
    });
    expect(activity.label).not.toMatch(/Live from RPC/);
    expect(activityHref(activity.rows[0], activity.mode)).toBe("/communities/alpha/proposals/12");
  });

  it("labels fallback rows Demo", () => {
    const demo = landingActivity({ live: null, error: false });
    const failed = landingActivity({ live: null, error: true });
    expect(demo.label).toBe("Demo");
    expect(failed.label).toBe("Demo");
    expect(demo.label).not.toMatch(/Live/);
    expect(activityHref(demo.rows[0], demo.mode)).toBe("/proposals");
  });
});
