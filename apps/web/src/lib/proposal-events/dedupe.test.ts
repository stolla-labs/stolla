import { describe, expect, it } from "vitest";
import {
  dedupeProposalSummaries,
  proposalRowIdentity,
  stableEventIdentity,
} from "./dedupe";
import type { ProposalSummary } from "./types";

function summary(
  overrides: Partial<ProposalSummary> &
    Pick<ProposalSummary, "proposalId" | "governorContractId">,
): ProposalSummary {
  return {
    proposer: "GPROPOSER",
    creationLedger: 100,
    txHash: "aaa",
    cursor: "cursor-a",
    voteSnapshot: 10,
    voteEnd: 20,
    description: "desc",
    ...overrides,
  };
}

describe("stableEventIdentity", () => {
  it("prefers tx hash and ledger when present", () => {
    expect(
      stableEventIdentity({
        governorContractId: "CGOV",
        proposalId: "ABCD",
        creationLedger: 42,
        txHash: "deadbeef",
        cursor: "ignored-when-tx-present",
      }),
    ).toBe("CGOV|abcd|tx:deadbeef|ledger:42");
  });

  it("falls back to cursor when tx hash is missing", () => {
    expect(
      stableEventIdentity({
        governorContractId: "CGOV",
        proposalId: "ABCD",
        creationLedger: 42,
        txHash: "",
        cursor: "page-cursor-1",
      }),
    ).toBe("CGOV|abcd|cursor:page-cursor-1");
  });

  it("falls back to contract and proposal id when optional metadata is missing", () => {
    expect(
      stableEventIdentity({
        governorContractId: "CGOV",
        proposalId: "AbCd",
        creationLedger: 0,
        txHash: "",
        cursor: null,
      }),
    ).toBe("CGOV|abcd");
  });
});

describe("dedupeProposalSummaries", () => {
  it("collapses identical events within one page to one proposal result", () => {
    const a = summary({ proposalId: "aa", governorContractId: "CGOV" });
    const duplicate = summary({ proposalId: "aa", governorContractId: "CGOV" });

    const result = dedupeProposalSummaries([a, duplicate]);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(a);
  });

  it("collapses cross-page overlap to one proposal result", () => {
    const page1 = summary({
      proposalId: "aa",
      governorContractId: "CGOV",
      cursor: "c1",
    });
    const page2Overlap = summary({
      proposalId: "aa",
      governorContractId: "CGOV",
      cursor: "c1",
    });
    const page2New = summary({
      proposalId: "bb",
      governorContractId: "CGOV",
      txHash: "bbb",
      cursor: "c2",
    });

    const result = dedupeProposalSummaries([page1, page2Overlap, page2New]);

    expect(result.map((item) => item.proposalId)).toEqual(["aa", "bb"]);
  });

  it("never merges distinct proposals", () => {
    const first = summary({
      proposalId: "aa",
      governorContractId: "CGOV",
      txHash: "t1",
    });
    const second = summary({
      proposalId: "bb",
      governorContractId: "CGOV",
      txHash: "t2",
      cursor: "c2",
    });

    const result = dedupeProposalSummaries([first, second]);

    expect(result).toHaveLength(2);
    expect(proposalRowIdentity(result[0])).not.toBe(
      proposalRowIdentity(result[1]),
    );
  });

  it("keeps stable first-seen ordering across retries", () => {
    const first = summary({
      proposalId: "aa",
      governorContractId: "CGOV",
      txHash: "t1",
    });
    const second = summary({
      proposalId: "bb",
      governorContractId: "CGOV",
      txHash: "t2",
      cursor: "c2",
    });

    const firstPass = dedupeProposalSummaries([first, second]);
    const retried = dedupeProposalSummaries([first, second, first, second]);

    expect(retried.map((item) => item.proposalId)).toEqual(
      firstPass.map((item) => item.proposalId),
    );
    expect(retried.map((item) => item.proposalId)).toEqual(["aa", "bb"]);
  });

  it("keeps the first complete representation when duplicates differ", () => {
    const incomplete = summary({
      proposalId: "aa",
      governorContractId: "CGOV",
      proposer: null,
      description: "",
      cursor: null,
      txHash: "t1",
    });
    const complete = summary({
      proposalId: "aa",
      governorContractId: "CGOV",
      proposer: "GPROPOSER",
      description: "full",
      cursor: "c1",
      txHash: "t1",
    });

    const result = dedupeProposalSummaries([incomplete, complete]);

    expect(result).toHaveLength(1);
    expect(result[0].proposer).toBe("GPROPOSER");
    expect(result[0].description).toBe("full");
    expect(result[0].cursor).toBe("c1");
  });

  it("treats events with similar fields but different proposal ids as distinct", () => {
    const left = summary({
      proposalId: "aa",
      governorContractId: "CGOV",
      creationLedger: 50,
      txHash: "same-tx",
      cursor: "same-cursor",
    });
    const right = summary({
      proposalId: "bb",
      governorContractId: "CGOV",
      creationLedger: 50,
      txHash: "same-tx",
      cursor: "same-cursor",
    });

    const result = dedupeProposalSummaries([left, right]);

    expect(result).toHaveLength(2);
    expect(stableEventIdentity(left)).not.toBe(stableEventIdentity(right));
  });
});
