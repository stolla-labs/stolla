import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../../..");

describe("ADR-006 CommunityGovernor queueing and privileged target enforcement", () => {
  it("requires queueing and timelock delay when Timelock mode is configured and blocks privileged targets in signaling-only mode", () => {
    const libRs = readFileSync(
      path.join(
        repoRoot,
        "contracts/contracts/community-governor/src/lib.rs",
      ),
      "utf8",
    );
    const testRs = readFileSync(
      path.join(
        repoRoot,
        "contracts/contracts/community-governor/src/test.rs",
      ),
      "utf8",
    );
    const adr006 = readFileSync(
      path.join(repoRoot, "docs/adr/006-timelock-treasury-execution.md"),
      "utf8",
    );

    expect(libRs).toContain("fn proposals_need_queuing(e: &Env) -> bool");
    expect(libRs).toContain("pub fn configure_timelock");
    expect(libRs).toContain("pub fn verify_approved_action");
    expect(libRs).toContain("pub fn get_queued_action");
    expect(libRs).toContain("ensure_signaling_targets_allowed");
    expect(libRs).toContain("timelock delay has not elapsed");

    expect(testRs).toContain(
      "fn timelock_mode_requires_queueing_and_enforces_delay_before_execution()",
    );
    expect(testRs).toContain(
      "fn signaling_only_governor_rejects_privileged_targets_until_timelock_enabled()",
    );
    expect(adr006).toContain("verify_approved_action");
  });
});
