import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { buildSupersedeGraph } from "@/lib/proposals/supersede";
import { SupersedeNotice } from "./SupersedeNotice";

const A = "a".repeat(64);
const B = "b".repeat(64);
const C = "c".repeat(64);

function node(proposalId: string, supersedes: string | null = null) {
  return { proposalId, supersedes };
}

function renderNotice(
  nodes: { proposalId: string; supersedes: string | null }[],
  proposalId: string,
  options: { historyIncomplete?: boolean } = {},
) {
  return render(
    <SupersedeNotice
      graph={buildSupersedeGraph(nodes)}
      proposalId={proposalId}
      hrefFor={(id) => `/proposals/${id}`}
      historyIncomplete={options.historyIncomplete}
    />,
  );
}

describe("SupersedeNotice", () => {
  it("says nothing about a proposal with no links either way", () => {
    renderNotice([node(A)], A);

    expect(screen.queryByTestId("supersede-notice")).toBeNull();
  });

  it("tells a reader of the old proposal where the current text is", () => {
    renderNotice([node(A), node(B, A)], A);

    const replaced = screen.getByTestId("supersede-replaced");
    expect(replaced.textContent).toContain("This is not the current text.");
    expect(replaced.querySelector("a")?.getAttribute("href")).toBe(`/proposals/${B}`);
    // Announced, because it changes whether the text below is worth reading.
    expect(replaced.getAttribute("role")).toBe("alert");
  });

  it("points past the middle of a chain to the end of it", () => {
    // C replaces B replaces A: a reader opening A needs C, not B.
    renderNotice([node(A), node(B, A), node(C, B)], A);

    const replaced = screen.getByTestId("supersede-replaced");
    expect(replaced.querySelector("a")?.getAttribute("href")).toBe(`/proposals/${C}`);
    expect(replaced.textContent).toContain("1 earlier revision");
  });

  it("says what the new proposal replaces", () => {
    renderNotice([node(A), node(B, A)], B);

    const replaces = screen.getByTestId("supersede-replaces");
    expect(replaces.textContent).toContain("This proposal replaces");
    expect(replaces.querySelector("a")?.getAttribute("href")).toBe(`/proposals/${A}`);
    expect(screen.queryByTestId("supersede-replaced")).toBeNull();
  });

  it("shows both notices on a proposal in the middle of a chain", () => {
    renderNotice([node(A), node(B, A), node(C, B)], B);

    expect(screen.getByTestId("supersede-replaces")).toBeTruthy();
    expect(screen.getByTestId("supersede-replaced")).toBeTruthy();
  });

  it("says a link points outside the history it was given", () => {
    // The replaced proposal was not discovered, so it cannot be rendered — and
    // claiming the link is broken would be wrong.
    renderNotice([node(B, A)], B);

    expect(screen.getByTestId("supersede-replaces").textContent).toContain(
      "this history does not include",
    );
  });

  it("reports a fork instead of naming a winner", () => {
    renderNotice([node(A), node(B, A), node(C, A)], A);

    const conflicted = screen.getByTestId("supersede-conflicted");
    expect(conflicted.textContent).toContain("2 later proposals");
    expect(conflicted.querySelectorAll("a")).toHaveLength(2);
    expect(screen.queryByTestId("supersede-replaced")).toBeNull();
  });

  it("reports a loop and offers no canonical pointer", () => {
    renderNotice([node(A, B), node(B, A)], A);

    expect(screen.getByTestId("supersede-cycle").textContent).toContain("in a loop");
    expect(screen.queryByTestId("supersede-replaced")).toBeNull();
  });

  it("admits a replacement may simply not have loaded", () => {
    // Only the forward link is stored, so "nothing replaces this" is only as
    // complete as the history behind it.
    renderNotice([node(A)], A, { historyIncomplete: true });

    expect(screen.getByTestId("supersede-partial")).toBeTruthy();
  });

  it("does not hedge when the history is complete", () => {
    renderNotice([node(A)], A);

    expect(screen.queryByTestId("supersede-partial")).toBeNull();
  });
});
