import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CI workflow configuration (#392)", () => {
  const workflowPath = resolve(process.cwd(), "../../.github/workflows/ci.yml");
  const workflow = readFileSync(workflowPath, "utf8");

  it("runs automatically on push and pull_request to main", () => {
    expect(workflow).toMatch(/on:\s+push:\s+branches:\s*\[main\]\s+pull_request:\s+branches:\s*\[main\]/m);
    expect(workflow).toContain("workflow_dispatch:");
  });

  it("installs prebuilt stellar-cli binary without dbus-dependent cargo install", () => {
    expect(workflow).not.toContain("cargo install --locked stellar-cli");
    expect(workflow).toContain("https://github.com/stellar/stellar-cli/releases/download/");
    expect(workflow).toContain("stellar contract build");
  });

  it("enforces contracts and frontend jobs without continue-on-error", () => {
    const contractsSection = workflow.split("frontend:")[0] ?? "";
    const frontendSection = (workflow.split("frontend:")[1] ?? "").split("e2e:")[0] ?? "";
    expect(contractsSection).not.toContain("continue-on-error: true");
    expect(frontendSection).not.toContain("continue-on-error: true");
  });
});
