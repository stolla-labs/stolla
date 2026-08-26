"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ProposalDetailPage from "@/app/(app)/proposals/[id]/page";
import { AppLinkButton } from "@/components/ui/AppLinkButton";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { getCommunity } from "@/lib/community/registry";
import type { CommunityView } from "@/lib/community/types";
import { parseProposalId } from "@/lib/proposals";

function isContractId(value: string) {
  return /^C[A-Z2-7]{55}$/.test(value);
}

export default function CommunityProposalDetailPage() {
  const { id = "", proposalId = "" } = useParams<{
    id: string;
    proposalId: string;
  }>();
  const [community, setCommunity] = useState<CommunityView | null>(null);
  const [status, setStatus] = useState<
    "loading" | "community-not-found" | "invalid-contracts" | "error"
  >("loading");

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      setCommunity(null);
      setStatus("loading");
      void getCommunity(id)
        .then((result) => {
          if (!active) return;
          if (result.status !== "found") {
            setStatus("community-not-found");
            return;
          }
          if (
            !isContractId(result.community.record.governorContract) ||
            !isContractId(result.community.record.nftContract)
          ) {
            setStatus("invalid-contracts");
            return;
          }
          setCommunity(result.community);
        })
        .catch(() => {
          if (active) setStatus("error");
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [id]);

  if (community) {
    return (
      <ProposalDetailPage proposalId={proposalId} community={community} />
    );
  }

  const invalidProposal = parseProposalId(proposalId) === null;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10">
      {status === "loading" ? (
        <LiveStatus>Loading community proposal…</LiveStatus>
      ) : (
        <section
          role={
            status === "error" || status === "invalid-contracts"
              ? "alert"
              : undefined
          }
          className="rounded-xl border border-slate-800 bg-[#151b2b] p-6"
        >
          <h1 className="text-xl font-semibold text-slate-100">
            {status === "community-not-found"
              ? "Community not found"
              : status === "invalid-contracts"
                ? "Community contracts are invalid"
                : "Community proposal unavailable"}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {status === "community-not-found"
              ? "The route community is malformed or is not registered."
              : status === "invalid-contracts"
                ? "The registry record does not contain valid NFT and Governor contract addresses."
                : invalidProposal
                  ? "The proposal identifier is malformed."
                  : "The canonical community record could not be loaded."}
          </p>
          <AppLinkButton
            href={
              status === "community-not-found"
                ? "/communities"
                : `/communities/${id}/proposals`
            }
            tone="primary"
            className="mt-4"
          >
            {status === "community-not-found"
              ? "Browse communities"
              : "Back to community proposals"}
          </AppLinkButton>
        </section>
      )}
    </div>
  );
}
