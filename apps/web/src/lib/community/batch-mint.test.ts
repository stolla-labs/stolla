import { describe, expect, it } from "vitest";
import { parseRecipientList, runSequentialMints } from "./batch-mint";

const first = "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
const second = "GDHU6WRG4IEQXM5NZ4BMPKOXHW76MZM4Y2IEMFDVXBSDP6SJY4ITNPP2";
const third = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNKNLXLTCV";

describe("parseRecipientList", () => {
  it("splits commas and newlines and drops empty rows", () => {
    const parsed = parseRecipientList(`\n${first}, \n${second}\n`);
    expect(parsed).toEqual({ ok: true, addresses: [first, second] });
  });

  it("rejects an empty list", () => {
    expect(parseRecipientList(" \n , ")).toEqual({
      ok: false,
      message: "Add at least one recipient address.",
    });
  });

  it("rejects an invalid address before any mint starts", () => {
    const parsed = parseRecipientList(`${first}\nnot-an-address`);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.message).toContain("not-an-address");
  });
});

describe("runSequentialMints", () => {
  it("stops on the first hard failure and keeps a resume summary", async () => {
    const progress = await runSequentialMints([first, second, third], async (address) => {
      if (address === second) throw new Error("simulation failed");
    });

    expect(progress).toEqual({
      succeeded: [first],
      pending: [second, third],
      failed: second,
      stopped: true,
    });
  });
});
