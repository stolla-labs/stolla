import { describe, it, expect } from "vitest";
import { Address, Contract, xdr } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import {
  decodeProposalEvent,
  type ProposalEventInput,
} from "./decode";

const GOVERNOR_ID = "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGGA5SOAOPIFY6YQGAXE";
const PROPOSAL_HEX =
  "9d9e6d4b3a3c6c8f6e4b8c0d9a7f2e1b4c6d8e0f1a2b3c4d5e6f7a8b9c0d1e2f";
const PROPOSER = "GBLIWZOPZIH66UMWRJ6VBOBMODXQUUZ4VSLADLKYQRVUSPJBISYWOPKQ";
const VOTER = "GAZSOBEW6H374SOMTQIRC432JXTA4VPSG6P3ADA35TRQIYT3WTVQWFE5";

function symbol(value: string): xdr.ScVal {
  return xdr.ScVal.scvSymbol(value);
}

function stringVal(value: string): xdr.ScVal {
  return xdr.ScVal.scvString(value);
}

function u32(value: number): xdr.ScVal {
  return xdr.ScVal.scvU32(value);
}

function u128(value: bigint): xdr.ScVal {
  return xdr.ScVal.scvU128(
    new xdr.UInt128Parts({
      hi: new xdr.Uint64(value >> BigInt(64)),
      lo: new xdr.Uint64(value & BigInt("0xffffffffffffffff")),
    }),
  );
}

function bytes(value: string): xdr.ScVal {
  return xdr.ScVal.scvBytes(Buffer.from(value, "hex"));
}

function address(value: string): xdr.ScVal {
  return Address.fromString(value).toScVal();
}

function vec(values: xdr.ScVal[]): xdr.ScVal {
  return xdr.ScVal.scvVec(values);
}

function contractEvent(
  overrides: Partial<ProposalEventInput> & {
    contractId?: string;
    type?: string;
  },
): ProposalEventInput {
  return {
    contractId: GOVERNOR_ID,
    type: "contract",
    topic: [],
    value: xdr.ScVal.scvVoid(),
    ...overrides,
  };
}

function proposalCreatedEvent(): ProposalEventInput {
  return contractEvent({
    topic: [symbol("proposal_created"), bytes(PROPOSAL_HEX), address(PROPOSER)],
    value: vec([
      vec([address(PROPOSER)]),
      vec([symbol("noop")]),
      vec([vec([])]),
      u32(50),
      u32(100),
      stringVal("Add community treasurer"),
    ]),
  });
}

function voteCastEvent(): ProposalEventInput {
  return contractEvent({
    topic: [symbol("vote_cast"), address(VOTER), bytes(PROPOSAL_HEX)],
    value: vec([u32(1), u128(BigInt(250)), stringVal("Supporting this")]),
  });
}

describe("decodeProposalEvent", () => {
  describe("valid proposal events", () => {
    it("decodes a proposal_created event into the typed model", () => {
      const result = decodeProposalEvent(proposalCreatedEvent());

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.event.kind).toBe("proposal_created");
      if (result.event.kind !== "proposal_created") return;
      expect(result.event.proposalId).toBe(PROPOSAL_HEX);
      expect(result.event.proposer).toBe(PROPOSER);
      expect(result.event.targets).toEqual([PROPOSER]);
      expect(result.event.functions).toEqual(["noop"]);
      expect(result.event.args).toEqual([[]]);
      expect(result.event.voteSnapshot).toBe(50);
      expect(result.event.voteEnd).toBe(100);
      expect(result.event.description).toBe("Add community treasurer");
      expect(result.event.contractId).toBe(GOVERNOR_ID);
    });

    it("decodes a vote_cast event into the typed model", () => {
      const result = decodeProposalEvent(voteCastEvent());

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.event.kind).toBe("vote_cast");
      if (result.event.kind !== "vote_cast") return;
      expect(result.event.proposalId).toBe(PROPOSAL_HEX);
      expect(result.event.voter).toBe(VOTER);
      expect(result.event.voteType).toBe(1);
      expect(result.event.weight).toBe(BigInt(250));
      expect(result.event.reason).toBe("Supporting this");
    });

    it("decodes a proposal_queued event", () => {
      const event = contractEvent({
        topic: [symbol("proposal_queued"), bytes(PROPOSAL_HEX)],
        value: vec([u32(120)]),
      });

      const result = decodeProposalEvent(event);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.event).toEqual({
        kind: "proposal_queued",
        proposalId: PROPOSAL_HEX,
        eta: 120,
        contractId: GOVERNOR_ID,
      });
    });

    it("decodes a proposal_executed event", () => {
      const event = contractEvent({
        topic: [symbol("proposal_executed"), bytes(PROPOSAL_HEX)],
        value: vec([]),
      });

      const result = decodeProposalEvent(event);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.event).toEqual({
        kind: "proposal_executed",
        proposalId: PROPOSAL_HEX,
        contractId: GOVERNOR_ID,
      });
    });

    it("decodes a proposal_cancelled event", () => {
      const event = contractEvent({
        topic: [symbol("proposal_cancelled"), bytes(PROPOSAL_HEX)],
        value: vec([]),
      });

      const result = decodeProposalEvent(event);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.event).toEqual({
        kind: "proposal_cancelled",
        proposalId: PROPOSAL_HEX,
        contractId: GOVERNOR_ID,
      });
    });

    it("accepts the SDK Contract instance as contractId", () => {
      const event = proposalCreatedEvent();
      const withContractInstance: ProposalEventInput = {
        ...event,
        contractId: new Contract(GOVERNOR_ID),
      };

      const result = decodeProposalEvent(withContractInstance);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.event.contractId).toBe(GOVERNOR_ID);
    });
  });

  describe("proposal id canonical representation", () => {
    it("always produces lowercase 64-character hex without a 0x prefix", () => {
      const result = decodeProposalEvent(proposalCreatedEvent());

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.event.proposalId).toMatch(/^[0-9a-f]{64}$/);
      expect(result.event.proposalId).not.toMatch(/^0x/);
    });

    it("rejects a proposal id topic that is not exactly 32 bytes", () => {
      const event = contractEvent({
        topic: [symbol("proposal_created"), bytes("abcd"), address(PROPOSER)],
        value: vec([
          vec([address(PROPOSER)]),
          vec([symbol("noop")]),
          vec([vec([])]),
          u32(50),
          u32(100),
          stringVal("Add community treasurer"),
        ]),
      });

      const result = decodeProposalEvent(event);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("malformed-topics");
    });
  });

  describe("malformed topics", () => {
    it("fails when topic[0] is not the event name symbol", () => {
      const event = contractEvent({
        topic: [u32(1), bytes(PROPOSAL_HEX), address(PROPOSER)],
        value: vec([]),
      });

      const result = decodeProposalEvent(event);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("malformed-topics");
    });

    it("fails when proposal_created has the wrong number of topics", () => {
      const event = contractEvent({
        topic: [symbol("proposal_created"), bytes(PROPOSAL_HEX)],
        value: vec([
          vec([address(PROPOSER)]),
          vec([symbol("noop")]),
          vec([vec([])]),
          u32(50),
          u32(100),
          stringVal("Add community treasurer"),
        ]),
      });

      const result = decodeProposalEvent(event);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("malformed-topics");
    });

    it("fails when the proposer topic is not an address", () => {
      const event = contractEvent({
        topic: [symbol("proposal_created"), bytes(PROPOSAL_HEX), stringVal("not-an-address")],
        value: vec([
          vec([address(PROPOSER)]),
          vec([symbol("noop")]),
          vec([vec([])]),
          u32(50),
          u32(100),
          stringVal("Add community treasurer"),
        ]),
      });

      const result = decodeProposalEvent(event);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("malformed-topics");
    });
  });

  describe("malformed values", () => {
    it("fails when the event value is not a vec", () => {
      const event = contractEvent({
        topic: [symbol("proposal_created"), bytes(PROPOSAL_HEX), address(PROPOSER)],
        value: stringVal("not-a-vec"),
      });

      const result = decodeProposalEvent(event);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("malformed-value");
    });

    it("fails when the proposal_created data vec is too short", () => {
      const event = contractEvent({
        topic: [symbol("proposal_created"), bytes(PROPOSAL_HEX), address(PROPOSER)],
        value: vec([u32(50)]),
      });

      const result = decodeProposalEvent(event);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("malformed-value");
    });

    it("fails when a data field has the wrong type", () => {
      const event = contractEvent({
        topic: [symbol("proposal_created"), bytes(PROPOSAL_HEX), address(PROPOSER)],
        value: vec([
          vec([address(PROPOSER)]),
          vec([symbol("noop")]),
          vec([vec([])]),
          u32(50),
          u32(100),
          u32(99),
        ]),
      });

      const result = decodeProposalEvent(event);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("malformed-value");
    });

    it("fails when vote_cast weight is not a u128", () => {
      const event = contractEvent({
        topic: [symbol("vote_cast"), address(VOTER), bytes(PROPOSAL_HEX)],
        value: vec([u32(1), u32(250), stringVal("Supporting this")]),
      });

      const result = decodeProposalEvent(event);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("malformed-value");
    });
  });

  describe("contract id handling", () => {
    it("fails predictably when the contract id is missing", () => {
      const event = proposalCreatedEvent();
      const withoutContractId: ProposalEventInput = {
        ...event,
        contractId: undefined,
      };

      const result = decodeProposalEvent(withoutContractId);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("missing-contract-id");
    });

    it("fails when the event contract id does not match the expected governor", () => {
      const otherContract = "CCGGXPQH4CVPV2XQK2Q2ZQ7ZQ7ZQ7ZQ7ZQ7ZQ7ZQ7ZQ7ZQ7ZQ7ZQ7ZQ7";
      const event = contractEvent({
        contractId: otherContract,
        topic: [symbol("proposal_created"), bytes(PROPOSAL_HEX), address(PROPOSER)],
        value: vec([
          vec([address(PROPOSER)]),
          vec([symbol("noop")]),
          vec([vec([])]),
          u32(50),
          u32(100),
          stringVal("Add community treasurer"),
        ]),
      });

      const result = decodeProposalEvent(event, { expectedContractId: GOVERNOR_ID });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("contract-id-mismatch");
    });

    it("matches the contract id when it matches the expected governor", () => {
      const result = decodeProposalEvent(proposalCreatedEvent(), {
        expectedContractId: GOVERNOR_ID,
      });

      expect(result.ok).toBe(true);
    });
  });

  describe("unrelated and unsupported events", () => {
    it("rejects system events without crashing", () => {
      const event = contractEvent({
        type: "system",
        topic: [symbol("some_system_event")],
        value: vec([]),
      });

      const result = decodeProposalEvent(event);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("not-a-contract-event");
    });

    it("rejects an unrelated event type as unknown", () => {
      const event = contractEvent({
        topic: [symbol("transfer"), bytes(PROPOSAL_HEX), address(VOTER)],
        value: vec([u128(BigInt(100))]),
      });

      const result = decodeProposalEvent(event);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("unknown-event-type");
    });

    it("rejects an event with no topics", () => {
      const event = contractEvent({ topic: [] });

      const result = decodeProposalEvent(event);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.reason).toBe("malformed-topics");
    });
  });
});
