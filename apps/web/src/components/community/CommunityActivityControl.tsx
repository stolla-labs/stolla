"use client";

import { useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { CommunityActivityBadge, CommunityWriteBlockedNotice } from "@/components/community/CommunityActivityBadge";
import type { CommunityActivity } from "@/lib/community/communityActivity";
import type { Community } from "@/lib/community/types";
import { createCommunityFactoryClient } from "@/lib/contracts";
import { useWallet } from "@/context/WalletProvider";

/**
 * Community owner control. The factory owner can call the same contract
 * method; that address is not on the registry record, so this form submits
 * as the community owner. Either role may pause, archive, or resume.
 */
export function CommunityActivityControl({ community }: { community: Community }) {
  const { address, signTransaction } = useWallet();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isOwner = Boolean(address && address === community.record.communityOwner);

  async function update(activity: CommunityActivity) {
    if (!address || !isOwner || pending) return;
    setPending(true);
    setMessage(null);
    try {
      const client = createCommunityFactoryClient({
        publicKey: address,
        signTransaction,
      });
      const tx = await client.set_community_activity({
        communityId: community.record.id,
        activity,
        operator: address,
      });
      await tx.signAndSend();
      setMessage(
        activity === "active"
          ? "Community resumed. Refresh the page to restore minting and proposals."
          : "Activity updated. Refresh the page to see the new status.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The activity update failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-slate-800 bg-[#151b2b] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold text-slate-100">Community status</h2>
        <CommunityActivityBadge activity={community.activity} />
      </div>
      <CommunityWriteBlockedNotice activity={community.activity} />
      <p className="mt-2 text-sm text-slate-400">
        The community owner or the factory owner can pause or archive this community.
        History stays in the registry. Resume restores minting and new proposals.
      </p>
      {isOwner ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <AppButton tone="secondary" disabled={pending} onClick={() => void update("paused")}>
            Pause
          </AppButton>
          <AppButton tone="secondary" disabled={pending} onClick={() => void update("archived")}>
            Archive
          </AppButton>
          <AppButton tone="primary" disabled={pending} onClick={() => void update("active")}>
            Resume
          </AppButton>
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-500">
          Connect the community owner wallet to pause, archive, or resume.
        </p>
      )}
      {message ? (
        <p role="status" className="mt-3 text-sm text-slate-200">
          {message}
        </p>
      ) : null}
    </section>
  );
}
