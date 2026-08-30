import { Address, Contract, xdr } from "@stellar/stellar-sdk";

export type { ProposalEventKind } from "./kinds";
export { PROPOSAL_EVENT_KINDS } from "./kinds";

export interface ProposalEventInput {
  contractId?: unknown;
  type: string;
  topic: xdr.ScVal[];
  value: xdr.ScVal;
}

export interface ProposalCreatedEvent {
  kind: "proposal_created";
  proposalId: string;
  proposer: string;
  targets: string[];
  functions: string[];
  args: xdr.ScVal[][];
  voteSnapshot: number;
  voteEnd: number;
  description: string;
  contractId: string;
}

export interface VoteCastEvent {
  kind: "vote_cast";
  proposalId: string;
  voter: string;
  voteType: number;
  weight: bigint;
  reason: string;
  contractId: string;
}

export interface ProposalQueuedEvent {
  kind: "proposal_queued";
  proposalId: string;
  eta: number;
  contractId: string;
}

export interface ProposalExecutedEvent {
  kind: "proposal_executed";
  proposalId: string;
  contractId: string;
}

export interface ProposalCancelledEvent {
  kind: "proposal_cancelled";
  proposalId: string;
  contractId: string;
}

export type ProposalEvent =
  | ProposalCreatedEvent
  | VoteCastEvent
  | ProposalQueuedEvent
  | ProposalExecutedEvent
  | ProposalCancelledEvent;

export type DecodeFailureReason =
  | "not-a-contract-event"
  | "missing-contract-id"
  | "contract-id-mismatch"
  | "unknown-event-type"
  | "malformed-topics"
  | "malformed-value";

export type ProposalEventResult =
  | { ok: true; event: ProposalEvent }
  | { ok: false; reason: DecodeFailureReason; message: string };

export interface DecodeProposalEventOptions {
  expectedContractId?: string;
}

function isBytesType(val: xdr.ScVal): boolean {
  return val.switch() === xdr.ScValType.scvBytes();
}

function isAddressType(val: xdr.ScVal): boolean {
  return val.switch() === xdr.ScValType.scvAddress();
}

function isSymbolType(val: xdr.ScVal): boolean {
  return val.switch() === xdr.ScValType.scvSymbol();
}

function isStringType(val: xdr.ScVal): boolean {
  return val.switch() === xdr.ScValType.scvString();
}

function isVecType(val: xdr.ScVal): boolean {
  return val.switch() === xdr.ScValType.scvVec();
}

function isU32Type(val: xdr.ScVal): boolean {
  return val.switch() === xdr.ScValType.scvU32();
}

function isU128Type(val: xdr.ScVal): boolean {
  return val.switch() === xdr.ScValType.scvU128();
}

function u128ToBigInt(parts: xdr.UInt128Parts): bigint {
  return (parts.hi().toBigInt() << BigInt(64)) | parts.lo().toBigInt();
}

function normalizeProposalId(bytes: Buffer): string {
  return bytes.toString("hex");
}

function extractContractId(contractId: unknown): string | null {
  if (typeof contractId === "string") return contractId;
  if (!contractId) return null;
  if (contractId instanceof Contract) return contractId.contractId();
  if (typeof contractId === "object") {
    const candidate = contractId as { contractId?: () => unknown };
    if (typeof candidate.contractId === "function") {
      const result = candidate.contractId();
      if (typeof result === "string") return result;
    }
    const toStringCandidate = contractId as { toString?: () => string };
    if (typeof toStringCandidate.toString === "function") {
      const result = toStringCandidate.toString();
      if (result && result !== "[object Object]") return result;
    }
  }
  return null;
}

function readProposalIdTopic(
  topic: xdr.ScVal[],
  index: number,
): { proposalId: string } | { error: string } {
  const val = topic[index];
  if (!val || !isBytesType(val)) {
    return { error: `topic[${index}] is not a bytes value` };
  }
  const bytes = val.bytes();
  if (bytes.length !== 32) {
    return { error: `topic[${index}] proposal id must be 32 bytes` };
  }
  return { proposalId: normalizeProposalId(bytes) };
}

function readAddressTopic(topic: xdr.ScVal[], index: number): { address: string } | { error: string } {
  const val = topic[index];
  if (!val || !isAddressType(val)) {
    return { error: `topic[${index}] is not an address value` };
  }
  try {
    return { address: Address.fromScVal(val).toString() };
  } catch {
    return { error: `topic[${index}] is not a valid address` };
  }
}

function requireVecFields(value: xdr.ScVal, minFields: number): { fields: xdr.ScVal[] } | { error: string } {
  if (!isVecType(value)) {
    return { error: "event data is not a vec" };
  }
  const fields = value.vec();
  if (!fields || fields.length < minFields) {
    return { error: `event data vec has ${fields?.length ?? 0} fields, expected at least ${minFields}` };
  }
  return { fields };
}

function readU32(fields: xdr.ScVal[], index: number): { value: number } | { error: string } {
  const field = fields[index];
  if (!field || !isU32Type(field)) {
    return { error: `data[${index}] is not a u32` };
  }
  return { value: field.u32() };
}

function readU128(fields: xdr.ScVal[], index: number): { value: bigint } | { error: string } {
  const field = fields[index];
  if (!field || !isU128Type(field)) {
    return { error: `data[${index}] is not a u128` };
  }
  return { value: u128ToBigInt(field.u128()) };
}

function readString(fields: xdr.ScVal[], index: number): { value: string } | { error: string } {
  const field = fields[index];
  if (!field || !isStringType(field)) {
    return { error: `data[${index}] is not a string` };
  }
  return { value: field.str() as string };
}

function readAddressVec(fields: xdr.ScVal[], index: number): { value: string[] } | { error: string } {
  const field = fields[index];
  if (!field || !isVecType(field)) {
    return { error: `data[${index}] is not a vec` };
  }
  const items = field.vec();
  if (!items) return { value: [] };
  const addresses: string[] = [];
  for (const item of items) {
    if (!isAddressType(item)) {
      return { error: `data[${index}] contains a non-address item` };
    }
    try {
      addresses.push(Address.fromScVal(item).toString());
    } catch {
      return { error: `data[${index}] contains an invalid address` };
    }
  }
  return { value: addresses };
}

function readSymbolVec(fields: xdr.ScVal[], index: number): { value: string[] } | { error: string } {
  const field = fields[index];
  if (!field || !isVecType(field)) {
    return { error: `data[${index}] is not a vec` };
  }
  const items = field.vec();
  if (!items) return { value: [] };
  const symbols: string[] = [];
  for (const item of items) {
    if (!isSymbolType(item)) {
      return { error: `data[${index}] contains a non-symbol item` };
    }
    symbols.push(item.sym() as string);
  }
  return { value: symbols };
}

function readArgsVec(fields: xdr.ScVal[], index: number): { value: xdr.ScVal[][] } | { error: string } {
  const field = fields[index];
  if (!field || !isVecType(field)) {
    return { error: `data[${index}] is not a vec` };
  }
  const items = field.vec();
  if (!items) return { value: [] };
  const args: xdr.ScVal[][] = [];
  for (const item of items) {
    if (!isVecType(item)) {
      return { error: `data[${index}] contains a non-vec arg` };
    }
    args.push(item.vec() ?? []);
  }
  return { value: args };
}

function decodeProposalCreated(
  topic: xdr.ScVal[],
  value: xdr.ScVal,
  contractId: string,
): ProposalEventResult {
  if (topic.length !== 3) {
    return { ok: false, reason: "malformed-topics", message: `proposal_created expects 3 topics, got ${topic.length}` };
  }
  const proposalId = readProposalIdTopic(topic, 1);
  if ("error" in proposalId) return { ok: false, reason: "malformed-topics", message: proposalId.error };
  const proposer = readAddressTopic(topic, 2);
  if ("error" in proposer) return { ok: false, reason: "malformed-topics", message: proposer.error };

  const fields = requireVecFields(value, 6);
  if ("error" in fields) return { ok: false, reason: "malformed-value", message: fields.error };
  const targets = readAddressVec(fields.fields, 0);
  if ("error" in targets) return { ok: false, reason: "malformed-value", message: targets.error };
  const functions = readSymbolVec(fields.fields, 1);
  if ("error" in functions) return { ok: false, reason: "malformed-value", message: functions.error };
  const args = readArgsVec(fields.fields, 2);
  if ("error" in args) return { ok: false, reason: "malformed-value", message: args.error };
  const voteSnapshot = readU32(fields.fields, 3);
  if ("error" in voteSnapshot) return { ok: false, reason: "malformed-value", message: voteSnapshot.error };
  const voteEnd = readU32(fields.fields, 4);
  if ("error" in voteEnd) return { ok: false, reason: "malformed-value", message: voteEnd.error };
  const description = readString(fields.fields, 5);
  if ("error" in description) return { ok: false, reason: "malformed-value", message: description.error };

  return {
    ok: true,
    event: {
      kind: "proposal_created",
      proposalId: proposalId.proposalId,
      proposer: proposer.address,
      targets: targets.value,
      functions: functions.value,
      args: args.value,
      voteSnapshot: voteSnapshot.value,
      voteEnd: voteEnd.value,
      description: description.value,
      contractId,
    },
  };
}

function decodeVoteCast(
  topic: xdr.ScVal[],
  value: xdr.ScVal,
  contractId: string,
): ProposalEventResult {
  if (topic.length !== 3) {
    return { ok: false, reason: "malformed-topics", message: `vote_cast expects 3 topics, got ${topic.length}` };
  }
  const voter = readAddressTopic(topic, 1);
  if ("error" in voter) return { ok: false, reason: "malformed-topics", message: voter.error };
  const proposalId = readProposalIdTopic(topic, 2);
  if ("error" in proposalId) return { ok: false, reason: "malformed-topics", message: proposalId.error };

  const fields = requireVecFields(value, 3);
  if ("error" in fields) return { ok: false, reason: "malformed-value", message: fields.error };
  const voteType = readU32(fields.fields, 0);
  if ("error" in voteType) return { ok: false, reason: "malformed-value", message: voteType.error };
  const weight = readU128(fields.fields, 1);
  if ("error" in weight) return { ok: false, reason: "malformed-value", message: weight.error };
  const reason = readString(fields.fields, 2);
  if ("error" in reason) return { ok: false, reason: "malformed-value", message: reason.error };

  return {
    ok: true,
    event: {
      kind: "vote_cast",
      proposalId: proposalId.proposalId,
      voter: voter.address,
      voteType: voteType.value,
      weight: weight.value,
      reason: reason.value,
      contractId,
    },
  };
}

function decodeProposalQueued(
  topic: xdr.ScVal[],
  value: xdr.ScVal,
  contractId: string,
): ProposalEventResult {
  if (topic.length !== 2) {
    return { ok: false, reason: "malformed-topics", message: `proposal_queued expects 2 topics, got ${topic.length}` };
  }
  const proposalId = readProposalIdTopic(topic, 1);
  if ("error" in proposalId) return { ok: false, reason: "malformed-topics", message: proposalId.error };

  const fields = requireVecFields(value, 1);
  if ("error" in fields) return { ok: false, reason: "malformed-value", message: fields.error };
  const eta = readU32(fields.fields, 0);
  if ("error" in eta) return { ok: false, reason: "malformed-value", message: eta.error };

  return {
    ok: true,
    event: {
      kind: "proposal_queued",
      proposalId: proposalId.proposalId,
      eta: eta.value,
      contractId,
    },
  };
}

function decodeSimpleProposalEvent(
  kind: "proposal_executed" | "proposal_cancelled",
  topic: xdr.ScVal[],
  value: xdr.ScVal,
  contractId: string,
): ProposalEventResult {
  if (topic.length !== 2) {
    return { ok: false, reason: "malformed-topics", message: `${kind} expects 2 topics, got ${topic.length}` };
  }
  const proposalId = readProposalIdTopic(topic, 1);
  if ("error" in proposalId) return { ok: false, reason: "malformed-topics", message: proposalId.error };

  const fields = requireVecFields(value, 0);
  if ("error" in fields) return { ok: false, reason: "malformed-value", message: fields.error };

  return {
    ok: true,
    event: {
      kind,
      proposalId: proposalId.proposalId,
      contractId,
    },
  };
}

export function decodeProposalEvent(
  event: ProposalEventInput,
  options: DecodeProposalEventOptions = {},
): ProposalEventResult {
  if (event.type !== "contract") {
    return {
      ok: false,
      reason: "not-a-contract-event",
      message: `expected a contract event, got type "${event.type}"`,
    };
  }

  const contractId = extractContractId(event.contractId);
  if (!contractId) {
    return { ok: false, reason: "missing-contract-id", message: "event has no contract id" };
  }
  if (options.expectedContractId && contractId !== options.expectedContractId) {
    return {
      ok: false,
      reason: "contract-id-mismatch",
      message: `event contract id ${contractId} does not match expected ${options.expectedContractId}`,
    };
  }

  const nameVal = event.topic[0];
  if (!nameVal || !isSymbolType(nameVal)) {
    return { ok: false, reason: "malformed-topics", message: "topic[0] is not the event name symbol" };
  }
  const name = nameVal.sym() as string;

  switch (name) {
    case "proposal_created":
      return decodeProposalCreated(event.topic, event.value, contractId);
    case "vote_cast":
      return decodeVoteCast(event.topic, event.value, contractId);
    case "proposal_queued":
      return decodeProposalQueued(event.topic, event.value, contractId);
    case "proposal_executed":
      return decodeSimpleProposalEvent("proposal_executed", event.topic, event.value, contractId);
    case "proposal_cancelled":
      return decodeSimpleProposalEvent("proposal_cancelled", event.topic, event.value, contractId);
    default:
      return {
        ok: false,
        reason: "unknown-event-type",
        message: `unrecognized governor event type "${name}"`,
      };
  }
}
