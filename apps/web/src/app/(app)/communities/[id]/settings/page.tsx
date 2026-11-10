"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppButton } from "@/components/ui/AppButton";
import { CommunityInviteLinkBuilder } from "@/components/community/CommunityInviteLinkBuilder";
import { useWallet } from "@/context/WalletProvider";
import { useCommunityRegistry } from "@/lib/community/CommunityRegistryProvider";
import { previewCommunityMetadata, publishCommunityMetadata } from "@/lib/community/publishMetadata";
import type { CommunityMetadataDraft } from "@/lib/community/schema";
import {
  canEditCommunitySettings,
  COMMUNITY_PAUSED_REASON,
  isCommunityPaused,
  retainSettingsDraft,
  writeMetadataOverlay,
  writePauseOverlay,
} from "@/lib/community/settings";
import type { Community } from "@/lib/community/types";
import { createIpfsPinClient } from "@/lib/ipfs/pin";

function draftFrom(name: string, description: string, symbol: string): CommunityMetadataDraft {
  return {
    name,
    symbol: symbol || "COMM",
    description,
    externalLinkLabel: "",
    externalLinkUrl: "",
  };
}

export default function CommunitySettingsPage() {
  const params = useParams<{ id: string }>();
  const registry = useCommunityRegistry();
  const { address } = useWallet();
  const [community, setCommunity] = useState<Community | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hashPreview, setHashPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pinning, setPinning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pauseNotice, setPauseNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const result = await registry.get(params.id);
    if (result.status !== "found") return;
    setCommunity(result.community);
    setName(result.community.metadata?.name ?? "");
    setDescription(result.community.metadata?.description ?? "");
    setPaused(isCommunityPaused(result.community.record));
  }, [params.id, registry]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timeout);
  }, [load]);

  const owner = community?.record.communityOwner ?? null;
  const allowed = canEditCommunitySettings(address, owner);

  function togglePauseState() {
    if (!community || !allowed) return;
    const nextPaused = !paused;
    writePauseOverlay(community.record.id, nextPaused);
    setPaused(nextPaused);
    setPauseNotice(
      nextPaused
        ? COMMUNITY_PAUSED_REASON
        : "Community unpaused. Minting and proposal creation are restored for authorized roles.",
    );
  }

  async function refreshPreview(nextName: string, nextDescription: string) {
    const preview = await previewCommunityMetadata(
      draftFrom(nextName, nextDescription, community?.metadata?.name?.slice(0, 4) ?? "COMM"),
    );
    setHashPreview(preview.metadataHash);
  }

  async function save() {
    if (!community || !allowed) return;
    const draft = retainSettingsDraft({ name, description });
    setPinning(true);
    setError(null);
    setSaved(false);
    try {
      const published = await publishCommunityMetadata(
        draftFrom(draft.name, draft.description, "COMM"),
        null,
        createIpfsPinClient(),
      );
      writeMetadataOverlay(community.record.id, {
        name: draft.name,
        description: draft.description,
        metadataUri: published.payload.metadataUri,
        metadataHash: published.payload.metadataHash,
      });
      setHashPreview(published.payload.metadataHash);
      setSaved(true);
    } catch (cause) {
      retainSettingsDraft(draft);
      setName(draft.name);
      setDescription(draft.description);
      setError(cause instanceof Error ? cause.message : "Pin failed. Your draft is still here.");
    } finally {
      setPinning(false);
    }
  }

  // The (app) route group's layout already renders the page's single
  // <main id="main-content">, so every branch below returns a <div>, not a
  // second <main> — see #405.

  if (!community) {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-slate-400">Loading settings…</div>;
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-slate-100">Community settings</h1>
        <p role="alert" className="mt-3 text-sm text-amber-200">
          Only the community owner can update metadata.
        </p>
        <Link href={`/communities/${community.record.id}`} className="mt-4 inline-block text-sm text-indigo-300">
          Back to community
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold text-slate-100">Community settings</h1>
      <p className="mt-2 text-sm text-slate-400">
        Pin updated metadata and review the hash. The factory does not expose a post-launch URI writer yet, so this page stores the prepared URI and hash for the community detail view without redeploying WASM.
      </p>
      <label className="mt-6 block text-sm text-slate-300" htmlFor="settings-name">
        Name
      </label>
      <input
        id="settings-name"
        value={name}
        onChange={(event) => {
          setName(event.target.value);
          void refreshPreview(event.target.value, description);
        }}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 text-slate-100"
      />
      <label className="mt-4 block text-sm text-slate-300" htmlFor="settings-description">
        Description
      </label>
      <textarea
        id="settings-description"
        value={description}
        onChange={(event) => {
          setDescription(event.target.value);
          void refreshPreview(name, event.target.value);
        }}
        rows={4}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 text-slate-100"
      />
      {hashPreview ? (
        <p className="mt-3 break-all font-mono text-xs text-slate-400">Hash preview: {hashPreview}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-rose-300">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="mt-3 text-sm text-emerald-300">Metadata updated for this session. Open the community page to see it.</p>
      ) : null}
      <AppButton type="button" className="mt-4" disabled={pinning} onClick={() => void save()}>
        {pinning ? "Pinning…" : "Update metadata"}
      </AppButton>

      <section
        aria-labelledby="community-pause-settings-title"
        className="mt-6 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="community-pause-settings-title" className="font-semibold text-slate-100">
            Registry lifecycle status
          </h2>
          <span
            data-testid="community-status-badge"
            className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium ${
              paused
                ? "border-amber-700/80 bg-amber-950/60 text-amber-200"
                : "border-emerald-800/80 bg-emerald-950/50 text-emerald-200"
            }`}
          >
            {paused ? "Paused" : "Active"}
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-400">
          Pausing marks this community as non-active in the registry and disables mint and proposal creation CTAs while keeping historical governance and membership records readable.
        </p>
        {pauseNotice && (
          <p role="status" className="mt-3 text-sm text-amber-200">
            {pauseNotice}
          </p>
        )}
        <AppButton
          type="button"
          tone={paused ? "primary" : "secondary"}
          className="mt-4"
          onClick={togglePauseState}
        >
          {paused ? "Unpause community" : "Pause community"}
        </AppButton>
      </section>

      <div className="mt-6">
        <CommunityInviteLinkBuilder communityId={community.record.id} />
      </div>
    </div>
  );
}
