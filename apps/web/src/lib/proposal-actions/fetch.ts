import { rpc } from "@stellar/stellar-sdk";
import { decodeProposalEvent, fetchGovernorEvents } from "@/lib/proposal-events";
import { config, requireGovernorStartLedger } from "@/lib/stellar";
import type { ProposalActionRecord } from "./decode";

/**
 * Finds the `proposal_created` event for one proposal and returns its action
 * record, or null when the event is outside the retained history.
 */
export async function fetchProposalActionRecord(
  governorContractId: string,
  proposalIdHex: string,
): Promise<ProposalActionRecord | null> {
  const server = new rpc.Server(config.rpcUrl);
  const wanted = proposalIdHex.trim().replace(/^0x/, "").toLowerCase();

  for await (const page of fetchGovernorEvents({
    server,
    contractId: governorContractId,
    startLedger: requireGovernorStartLedger(),
  })) {
    for (const event of page.events) {
      const decoded = decodeProposalEvent(event, {
        expectedContractId: governorContractId,
      });
      if (
        decoded.ok &&
        decoded.event.kind === "proposal_created" &&
        decoded.event.proposalId.toLowerCase() === wanted
      ) {
        const { targets, functions, args } = decoded.event;
        return { targets, functions, args };
      }
    }
  }
  return null;
}
