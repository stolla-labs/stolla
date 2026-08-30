/**
 * Unit tests for mapProposalCreatedEvent.
 *
 * Fixtures are constructed to mirror what the typed decoder (issue #39)
 * would produce when parsing a real ProposalCreated Soroban event:
 *
 *   topics: ["proposal_created", proposal_id: BytesN<32>]
 *   data:   { proposer, targets, functions, args,
 *              vote_snapshot, vote_end, description }
 *
 * Tests cover:
 *   1. Complete event data — all fields present.
 *   2. Partial event — proposer absent (null).
 *   3. Partial event — cursor absent (null).
 *   4. proposalId normalisation — uppercase hex input → lowercase output.
 *   5. Governor contract ID is preserved exactly.
 *   6. Model is compatible with a future indexer adapter shape (no React,
 *      no localStorage, no browser-only globals required to construct).
 */

import { describe, expect, it } from "vitest";
import { mapProposalCreatedEvent } from "./map";
import type {
  ProposalCreatedEventData,
  ProposalEventRpcMetadata,
} from "./types";
import { VERSIONED_PROPOSAL_DESCRIPTION } from "@/lib/proposal-metadata/fixtures";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

/** 32-byte proposal ID as a lowercase hex string (as the decoder produces). */
const PROPOSAL_ID_HEX =
  "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";

const GOVERNOR_CONTRACT_ID =
  "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

const PROPOSER_ADDRESS = "GBSAMPLEPROPOSERADDRESS000000000000000000000000000000000";

/** A fixture that represents a fully decoded ProposalCreated event. */
const completeEventData: ProposalCreatedEventData = {
  proposalId: PROPOSAL_ID_HEX,
  proposer: PROPOSER_ADDRESS,
  targets: ["CCCONTRACTAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABE"],
  functions: ["noop"],
  args: [[]],
  voteSnapshot: 1_000_100,
  voteEnd: 1_010_100,
  description: "Fund the community marketing initiative Q3 2026",
};

/** RPC metadata accompanying the transaction that emitted the event. */
const completeRpcMeta: ProposalEventRpcMetadata = {
  ledger: 1_000_000,
  txHash:
    "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
  cursor: "0000000007154000-1",
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("mapProposalCreatedEvent", () => {
  // 1. Complete event — all fields present
  it("maps a complete event with all fields present", () => {
    const summary = mapProposalCreatedEvent(
      GOVERNOR_CONTRACT_ID,
      completeEventData,
      completeRpcMeta,
    );

    expect(summary.proposalId).toBe(PROPOSAL_ID_HEX);
    expect(summary.governorContractId).toBe(GOVERNOR_CONTRACT_ID);
    expect(summary.proposer).toBe(PROPOSER_ADDRESS);
    expect(summary.creationLedger).toBe(1_000_000);
    expect(summary.txHash).toBe(completeRpcMeta.txHash);
    expect(summary.cursor).toBe("0000000007154000-1");
    expect(summary.voteSnapshot).toBe(1_000_100);
    expect(summary.voteEnd).toBe(1_010_100);
    expect(summary.description).toBe(
      "Fund the community marketing initiative Q3 2026",
    );
  });

  // 2. Partial event — proposer is null (not emitted by contract)
  it("maps a partial event where proposer is null", () => {
    const partialEvent: ProposalCreatedEventData = {
      ...completeEventData,
      proposer: null,
    };

    const summary = mapProposalCreatedEvent(
      GOVERNOR_CONTRACT_ID,
      partialEvent,
      completeRpcMeta,
    );

    expect(summary.proposer).toBeNull();
    // All other fields should still be mapped correctly
    expect(summary.proposalId).toBe(PROPOSAL_ID_HEX);
    expect(summary.creationLedger).toBe(1_000_000);
    expect(summary.description).toBe(completeEventData.description);
  });

  // 3. Partial event — cursor is null (synthesised without a cursor)
  it("maps a partial event where cursor is null", () => {
    const metaWithoutCursor: ProposalEventRpcMetadata = {
      ...completeRpcMeta,
      cursor: null,
    };

    const summary = mapProposalCreatedEvent(
      GOVERNOR_CONTRACT_ID,
      completeEventData,
      metaWithoutCursor,
    );

    expect(summary.cursor).toBeNull();
    expect(summary.proposer).toBe(PROPOSER_ADDRESS);
  });

  // 4. proposalId normalisation — uppercase input yields lowercase output
  it("normalises proposalId to lowercase", () => {
    const uppercaseId = PROPOSAL_ID_HEX.toUpperCase();
    const eventWithUppercase: ProposalCreatedEventData = {
      ...completeEventData,
      proposalId: uppercaseId,
    };

    const summary = mapProposalCreatedEvent(
      GOVERNOR_CONTRACT_ID,
      eventWithUppercase,
      completeRpcMeta,
    );

    expect(summary.proposalId).toBe(PROPOSAL_ID_HEX);
    expect(summary.proposalId).not.toContain(uppercaseId);
  });

  // 5. Governor contract ID is preserved exactly
  it("preserves governorContractId exactly as provided", () => {
    const altGovernorId =
      "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

    const summary = mapProposalCreatedEvent(
      altGovernorId,
      completeEventData,
      completeRpcMeta,
    );

    expect(summary.governorContractId).toBe(altGovernorId);
  });

  // 6. No field is lost — event data survives round-trip through the model
  it("maps without data loss for a signaling-only proposal", () => {
    const signalingEvent: ProposalCreatedEventData = {
      proposalId: PROPOSAL_ID_HEX,
      proposer: PROPOSER_ADDRESS,
      targets: [],
      functions: [],
      args: [],
      voteSnapshot: 500_000,
      voteEnd: 510_000,
      description: "Signal: adopt the new community code of conduct",
    };

    const summary = mapProposalCreatedEvent(
      GOVERNOR_CONTRACT_ID,
      signalingEvent,
      completeRpcMeta,
    );

    expect(summary.voteSnapshot).toBe(500_000);
    expect(summary.voteEnd).toBe(510_000);
    expect(summary.description).toBe(
      "Signal: adopt the new community code of conduct",
    );
    expect(summary.proposalId).toBe(PROPOSAL_ID_HEX);
  });

  // 7. Both optional fields null simultaneously
  it("maps when both proposer and cursor are null", () => {
    const partialEvent: ProposalCreatedEventData = {
      ...completeEventData,
      proposer: null,
    };
    const partialMeta: ProposalEventRpcMetadata = {
      ...completeRpcMeta,
      cursor: null,
    };

    const summary = mapProposalCreatedEvent(
      GOVERNOR_CONTRACT_ID,
      partialEvent,
      partialMeta,
    );

    expect(summary.proposer).toBeNull();
    expect(summary.cursor).toBeNull();
    // Required fields should still be present
    expect(summary.proposalId).toBe(PROPOSAL_ID_HEX);
    expect(summary.creationLedger).toBe(1_000_000);
    expect(summary.txHash).toBe(completeRpcMeta.txHash);
  });

  // 8. Indexer adapter shape — the type can be constructed without browser APIs
  it("can be constructed from an indexer adapter without browser globals", () => {
    // Simulate what a future server-side indexer adapter would produce:
    // it has all the same fields but sourced from an HTTP response, not RPC.
    const indexerEvent: ProposalCreatedEventData = {
      proposalId:
        "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
      proposer: null, // indexer may not include proposer in v1
      targets: [],
      functions: [],
      args: [],
      voteSnapshot: 9_000_000,
      voteEnd: 9_010_000,
      description: "Indexer-sourced proposal",
    };

    const indexerMeta: ProposalEventRpcMetadata = {
      ledger: 8_999_999,
      txHash:
        "cafecafecafecafecafecafecafecafecafecafecafecafecafecafecafecafe",
      cursor: "0000000055000000-1",
    };

    // This must work in a Node/Worker context — no `window`, no `localStorage`
    const summary = mapProposalCreatedEvent(
      GOVERNOR_CONTRACT_ID,
      indexerEvent,
      indexerMeta,
    );

    expect(summary.proposalId).toBe(
      "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    );
    expect(summary.governorContractId).toBe(GOVERNOR_CONTRACT_ID);
    expect(summary.proposer).toBeNull();
    expect(summary.creationLedger).toBe(8_999_999);
    expect(summary.cursor).toBe("0000000055000000-1");
  });

  it("maps valid v1 metadata while preserving the original description", () => {
    const summary = mapProposalCreatedEvent(
      GOVERNOR_CONTRACT_ID,
      { ...completeEventData, description: VERSIONED_PROPOSAL_DESCRIPTION },
      completeRpcMeta,
    );
    expect(summary.description).toBe(VERSIONED_PROPOSAL_DESCRIPTION);
    expect(summary.metadata?.title).toBe("Fund Unicode governance tooling 🚀");
  });
});
