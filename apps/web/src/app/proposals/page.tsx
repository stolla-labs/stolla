"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Buffer } from "buffer";
import { useWallet } from "@/context/WalletProvider";
import {
  createGovernorClient,
  getStoredProposalIds,
  storeProposalId,
} from "@/lib/contracts";
import { ProposalState } from "@/lib/bindings/community-governor/src";
import { contractIds } from "@/lib/stellar";

const stateLabels: Record<ProposalState, string> = {
  [ProposalState.Pending]: "Pending",
  [ProposalState.Active]: "Active",
  [ProposalState.Defeated]: "Defeated",
  [ProposalState.Canceled]: "Canceled",
  [ProposalState.Succeeded]: "Succeeded",
  [ProposalState.Queued]: "Queued",
  [ProposalState.Expired]: "Expired",
  [ProposalState.Executed]: "Executed",
};

export default function ProposalsPage() {
  const { address, signTransaction } = useWallet();
  const [description, setDescription] = useState("");
  const [proposalIds, setProposalIds] = useState<string[]>([]);
  const [states, setStates] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const contractsConfigured = Boolean(contractIds.governor);

  const loadProposals = useCallback(async () => {
    const ids = getStoredProposalIds();
    setProposalIds(ids);
    if (!contractsConfigured || ids.length === 0) return;

    const client = createGovernorClient({
      publicKey: address ?? "",
      signTransaction,
    });

    const nextStates: Record<string, string> = {};
    for (const idHex of ids) {
      try {
        const tx = await client.proposal_state({
          proposal_id: Buffer.from(idHex, "hex"),
        });
        nextStates[idHex] = stateLabels[tx.result ?? ProposalState.Pending];
      } catch {
        nextStates[idHex] = "Unknown";
      }
    }
    setStates(nextStates);
  }, [address, contractsConfigured, signTransaction]);

  useEffect(() => {
    loadProposals().catch(() => undefined);
  }, [loadProposals]);

  async function handleCreateProposal() {
    if (!address) {
      setStatus("Connect your wallet first.");
      return;
    }
    if (!description.trim()) {
      setStatus("Description is required.");
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const client = createGovernorClient({ publicKey: address, signTransaction });
      const target = address;
      const tx = await client.propose({
        targets: [target],
        functions: ["noop"],
        args: [[]],
        description: description.trim(),
        proposer: address,
      });
      const result = await tx.signAndSend();
      const idHex = Buffer.from(result.result).toString("hex");
      storeProposalId(idHex);
      setDescription("");
      setStatus(`Proposal created: ${idHex.slice(0, 12)}...`);
      await loadProposals();
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Proposal failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Proposals</h1>
      <p className="mt-2 text-zinc-600">
        Create and track DAO proposals. Voting power requires delegated NFTs.
      </p>

      {!contractsConfigured && (
        <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Set <code className="font-mono">NEXT_PUBLIC_GOVERNOR_CONTRACT_ID</code>{" "}
          in <code className="font-mono">.env.local</code> after deployment.
        </p>
      )}

      {contractsConfigured && (
        <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="font-semibold">Create proposal</h2>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            placeholder="Describe the community decision..."
          />
          <button
            type="button"
            onClick={handleCreateProposal}
            disabled={!address || loading}
            className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? "Submitting..." : "Create proposal"}
          </button>
        </section>
      )}

      <section className="mt-6">
        <h2 className="font-semibold">Your proposals</h2>
        {proposalIds.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No proposals yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {proposalIds.map((id) => (
              <li key={id}>
                <Link
                  href={`/proposals/${id}`}
                  className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3 text-sm hover:bg-zinc-50"
                >
                  <span className="truncate font-mono">{id}</span>
                  <span className="ml-3 text-zinc-500">{states[id] ?? "..."}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {status && (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 text-sm">
          {status}
        </p>
      )}
    </div>
  );
}
