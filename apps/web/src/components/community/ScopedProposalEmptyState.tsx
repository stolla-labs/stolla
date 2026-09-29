"use client";

import { useCallback, useEffect, useState } from "react";
import { Buffer } from "buffer";
import type { Community } from "@/lib/community/types";
import { useWallet } from "@/context/WalletProvider";
import { createGovernorClient, createNftClient, createReadOnlyNftClient, storeProposalIdFor } from "@/lib/contracts";
import { useOperationLifecycle } from "@/hooks/useOperationLifecycle";
import { validateProposalMetadataDraft, hasProposalMetadataErrors, serializeProposalMetadata, type ProposalMetadataDraft, type ProposalMetadataErrors, type ProposalMetadataField } from "@/lib/proposal-metadata";
import { ProposalMetadataFields } from "@/components/proposal/ProposalMetadataFields";
import { TransactionLifecycleStatus } from "@/components/TransactionLifecycleStatus";
import { AppButton } from "@/components/ui/AppButton";
import { AppLinkButton } from "@/components/ui/AppLinkButton";
import { EmptyState } from "@/components/ui/EmptyState";

const emptyDraft: ProposalMetadataDraft = {
  title: "",
  summary: "",
  body: "",
  discussionUrl: null,
};

type Readiness = { address: string; status: "loading" | "ready" | "unavailable"; votes?: bigint };

export function ScopedProposalEmptyState({
  community,
  refresh,
}: {
  community: Community;
  refresh: () => Promise<boolean>;
}) {
  const { address, connect, isConnecting, signTransaction } = useWallet();
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<ProposalMetadataDraft>(emptyDraft);
  const [errors, setErrors] = useState<ProposalMetadataErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const delegation = useOperationLifecycle();
  const creation = useOperationLifecycle();

  const checkReadiness = useCallback(async (walletAddress: string) => {
    setReadiness({ address: walletAddress, status: "loading" });
    try {
      const client = createReadOnlyNftClient(community.record.nftContract);
      const transaction = await client.get_votes({ account: walletAddress });
      setReadiness({ address: walletAddress, status: "ready", votes: transaction.result ?? 0n });
    } catch {
      setReadiness({ address: walletAddress, status: "unavailable" });
    }
  }, [community.record.nftContract]);

  useEffect(() => {
    if (!address) return;
    const timeout = window.setTimeout(() => void checkReadiness(address), 0);
    return () => window.clearTimeout(timeout);
  }, [address, checkReadiness]);

  const threshold = community.governance.proposalThreshold;
  const walletReadiness = readiness?.address === address ? readiness : null;
  const canPropose = Boolean(
    address && walletReadiness?.status === "ready" && threshold !== null &&
    walletReadiness.votes !== undefined && walletReadiness.votes >= BigInt(threshold),
  );

  async function delegate() {
    if (!address || delegation.isInFlight) return;
    delegation.reset();
    const result = await delegation.execute(() => createNftClient({
      publicKey: address,
      signTransaction,
      contractId: community.record.nftContract,
    }).delegate({ account: address, delegatee: address }));
    if (result.ok) await checkReadiness(address);
  }

  function updateDraft(field: ProposalMetadataField, value: string) {
    setDraft((current) => ({ ...current, [field]: field === "discussionUrl" ? value || null : value }));
    setErrors((current) => ({ ...current, [field]: undefined, envelope: undefined }));
  }

  async function createProposal() {
    if (!address || !canPropose || creation.isInFlight) return;
    const nextErrors = validateProposalMetadataDraft(draft);
    if (hasProposalMetadataErrors(nextErrors)) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    setMessage(null);
    creation.reset();
    const description = serializeProposalMetadata(draft);
    const result = await creation.execute(() => createGovernorClient({
      publicKey: address,
      signTransaction,
      contractId: community.record.governorContract,
    }).propose({
      targets: [address],
      functions: ["noop"],
      args: [[]],
      description,
      proposer: address,
    }));
    if (!result.ok) return;
    const id = result.result;
    const idHex = id instanceof Uint8Array || Buffer.isBuffer(id)
      ? Buffer.from(id).toString("hex")
      : typeof id === "string" ? id : null;
    if (idHex) storeProposalIdFor(community.record.governorContract, idHex);
    setDraft(emptyDraft);
    setMessage("Proposal created. Public history may take a moment to update.");
    await refresh();
  }

  return (
    <EmptyState
      className="mt-3"
      title="No proposals yet"
      action={
        !address ? (
          <AppButton tone="primary" onClick={() => void connect()} disabled={isConnecting}>
            {isConnecting ? "Connecting…" : "Connect wallet to propose"}
          </AppButton>
        ) : canPropose ? (
          !formOpen && <AppButton tone="primary" onClick={() => setFormOpen(true)}>Create first proposal</AppButton>
        ) : threshold === null ? (
          <AppLinkButton href={`/communities/${community.record.id}`} tone="primary">
            Review proposal readiness
          </AppLinkButton>
        ) : walletReadiness?.status === "ready" && threshold !== null ? (
          <AppButton tone="primary" onClick={() => void delegate()} disabled={delegation.isInFlight}>
            {delegation.isInFlight ? "Delegating…" : "Delegate voting power"}
          </AppButton>
        ) : walletReadiness?.status === "unavailable" ? (
          <AppButton tone="primary" onClick={() => void checkReadiness(address)}>Retry voting power check</AppButton>
        ) : null
      }
    >
      <p>This community has no public proposals yet. Members with enough delegated voting power can create the first one.</p>
      {address && walletReadiness?.status === "loading" && <p>Checking voting power…</p>}
      {address && walletReadiness?.status === "ready" && !canPropose && threshold !== null && (
        <p>Delegate this community&apos;s membership NFT voting power to meet the proposal threshold.</p>
      )}
      {address && threshold === null && <p>The proposal threshold is unavailable. Check this community&apos;s governance settings.</p>}
      {formOpen && canPropose && (
        <div className="mt-4 border-t border-slate-700 pt-4">
          <h3 className="font-semibold text-slate-200">Create proposal</h3>
          <ProposalMetadataFields value={draft} errors={errors} onChange={updateDraft} />
          <AppButton tone="primary" className="mt-3" onClick={() => void createProposal()} disabled={creation.isInFlight}>
            {creation.isInFlight ? "Creating proposal…" : "Create proposal"}
          </AppButton>
          <TransactionLifecycleStatus stage={creation.stage} operationLabel="Propose" error={creation.error} />
        </div>
      )}
      <TransactionLifecycleStatus stage={delegation.stage} operationLabel="Delegate" error={delegation.error} />
      {message && <p role="status" className="mt-3 text-emerald-300">{message}</p>}
    </EmptyState>
  );
}
