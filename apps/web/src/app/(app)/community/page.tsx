"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@/context/WalletProvider";
import {
  createNftClient,
  createReadOnlyNftClient,
} from "@/lib/contracts";
import { useCommunityRegistry } from "@/lib/community/CommunityRegistryProvider";
import type { Community } from "@/lib/community/types";
import { contractIds } from "@/lib/stellar";
import { Skeleton } from "@/components/ui/Skeleton";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { TransactionLifecycleStatus } from "@/components/TransactionLifecycleStatus";
import { useOperationLifecycle } from "@/hooks/useOperationLifecycle";
import {
  loadCommunityData,
  runCommunityRefresh,
} from "./community-data.mjs";

type ActionStatus = {
  message: string;
  tone: "routine" | "error";
};

export default function CommunityPage() {
  const { address, signTransaction } = useWallet();
  const registry = useCommunityRegistry();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [votes, setVotes] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [tokenUri, setTokenUri] = useState("ipfs://");
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [tokenUriError, setTokenUriError] = useState<string | null>(null);
  const [status, setStatus] = useState<ActionStatus | null>(null);
  const [dataLoadError, setDataLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string | null>(
    null,
  );
  const [activeCommunity, setActiveCommunity] = useState<Community | null>(
    null,
  );
  const [routeResolved, setRouteResolved] = useState(false);
  const [communitySelectionError, setCommunitySelectionError] = useState("");
  const refreshSeq = useRef(0);
  const delegationLifecycle = useOperationLifecycle();
  const mintLifecycle = useOperationLifecycle();
  const resetDelegationLifecycle = delegationLifecycle.reset;
  const resetMintLifecycle = mintLifecycle.reset;

  const activeNftContract =
    activeCommunity?.record.nftContract ??
    (!selectedCommunityId ? contractIds.nft : "");
  const contractsConfigured = routeResolved && Boolean(activeNftContract);

  useEffect(() => {
    let active = true;
    const timeout = window.setTimeout(() => {
      const communityId = new URLSearchParams(window.location.search).get(
        "community",
      );
      setSelectedCommunityId(communityId);
      setRouteResolved(false);
      setCommunitySelectionError("");
      setActiveCommunity(null);
      setName("");
      setSymbol("");
      setBalance(null);
      setVotes(null);
      setStatus(null);
      setDataLoadError(null);
      setRecipient("");
      setTokenUri("ipfs://");
      resetDelegationLifecycle();
      resetMintLifecycle();

      if (!communityId) {
        setInitialLoading(Boolean(contractIds.nft));
        setRouteResolved(true);
        return;
      }

      setInitialLoading(true);
      void registry.get(communityId)
        .then((result) => {
          if (!active) return;
          if (
            result.status !== "found" ||
            !/^C[A-Z2-7]{55}$/.test(result.community.record.nftContract)
          ) {
            setCommunitySelectionError(
              "The selected community or its NFT contract is invalid. Choose a registered community before continuing.",
            );
            setInitialLoading(false);
            return;
          }
          setActiveCommunity(result.community);
        })
        .catch(() => {
          if (active) {
            setCommunitySelectionError(
              "The selected community could not be resolved from the registry.",
            );
            setInitialLoading(false);
          }
        })
        .finally(() => {
          if (active) setRouteResolved(true);
        });
    }, 0);
    return () => {
      window.clearTimeout(timeout);
      active = false;
    };
  }, [registry, resetDelegationLifecycle, resetMintLifecycle]);

  const refresh = useCallback(async () => {
    if (!contractsConfigured) return false;

    const seq = ++refreshSeq.current;

    return runCommunityRefresh(
      () =>
        loadCommunityData({
          address,
          collectionClient: createReadOnlyNftClient(activeNftContract),
          userClient: address
            ? createNftClient({
                publicKey: address,
                signTransaction,
                contractId: activeNftContract,
              })
            : null,
        }),
      {
        onStart() {
          if (seq !== refreshSeq.current) return;
          setRefreshing(true);
          setDataLoadError(null);
        },
        onSuccess(data) {
          if (seq !== refreshSeq.current) return;
          setName(data.name);
          setSymbol(data.symbol);
          setBalance(data.balance);
          setVotes(data.votes);
          setInitialLoading(false);
          setRefreshing(false);
        },
        onError(message) {
          if (seq !== refreshSeq.current) return;
          setDataLoadError(message);
          setInitialLoading(false);
          setRefreshing(false);
        },
      },
    );
  }, [activeNftContract, address, contractsConfigured, signTransaction]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleMint() {
    if (!address) {
      setStatus({ message: "Connect your wallet first.", tone: "error" });
      return;
    }
    if (!recipient || !tokenUri) {
      setRecipientError(!recipient ? "Recipient address is required." : null);
      setTokenUriError(!tokenUri ? "IPFS metadata URI is required." : null);
      setStatus(null);
      return;
    }
    if (mintLifecycle.isInFlight) return;

    setRecipientError(null);
    setTokenUriError(null);
    setStatus(null);
    mintLifecycle.reset();

    const result = await mintLifecycle.execute(async () => {
      const client = createNftClient({
        publicKey: address,
        signTransaction,
        contractId: activeNftContract,
      });
      return client.mint({ to: recipient, token_uri: tokenUri });
    });

    if (result.ok) {
      setStatus({
        message:
          result.result !== undefined && result.result !== null
            ? `Minted token #${result.result} successfully.`
            : "Minted NFT successfully.",
        tone: "routine",
      });
      await refresh();
    }
  }

  async function handleDelegate() {
    if (!address) {
      setStatus({ message: "Connect your wallet first.", tone: "error" });
      return;
    }
    if (delegationLifecycle.isInFlight) return;

    setStatus(null);
    delegationLifecycle.reset();

    const result = await delegationLifecycle.execute(async () => {
      const client = createNftClient({
        publicKey: address,
        signTransaction,
        contractId: activeNftContract,
      });
      return client.delegate({
        account: address,
        delegatee: address,
      });
    });

    if (result.ok) {
      setStatus({
        message: "Delegated voting power to yourself.",
        tone: "routine",
      });
      await refresh();
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-100">Community NFT</h1>
      <p className="mt-2 text-slate-400">
        Mint membership NFTs and delegate voting power on testnet.
      </p>

      {activeCommunity && (
        <section className="mt-6 min-w-0 rounded-xl border border-indigo-800/70 bg-indigo-950/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">
            Active community
          </p>
          <h2 className="mt-1 break-words font-semibold text-slate-100">
            {activeCommunity.metadata?.name ?? "Registered community"}
          </h2>
          <p className="mt-2 break-all font-mono text-xs text-slate-400">
            NFT contract: {activeCommunity.record.nftContract}
          </p>
          <p className="mt-2 text-xs text-indigo-200">
            Mint, ownership, delegation, and voting-power requests on this page
            use this registered contract.
          </p>
        </section>
      )}

      {communitySelectionError && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-rose-800/70 bg-rose-950/40 p-4 text-sm text-rose-200"
        >
          {communitySelectionError}
        </p>
      )}

      {routeResolved && !contractsConfigured && !communitySelectionError && (
        <p className="mt-6 break-words rounded-lg border border-amber-800/60 bg-amber-950/50 p-4 text-sm text-amber-200 [overflow-wrap:anywhere]">
          Contract IDs are not set. Deploy contracts and configure{" "}
          <code className="font-mono">NEXT_PUBLIC_NFT_CONTRACT_ID</code> in{" "}
          <code className="font-mono">.env.local</code>.
        </p>
      )}

      {(contractsConfigured || !routeResolved) && (
        <div className="mt-6 space-y-6">
          {dataLoadError && (
            <section
              aria-labelledby="community-data-error-title"
              className="rounded-xl border border-rose-800/70 bg-rose-950/40 p-5"
              role="alert"
            >
              <h2
                className="font-semibold text-rose-100"
                id="community-data-error-title"
              >
                Community data could not be loaded
              </h2>
              <p className="mt-2 text-sm text-rose-200">{dataLoadError}</p>
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={refreshing}
                className="mt-4 rounded-lg border border-rose-700 px-4 py-2 text-sm font-medium text-rose-100 hover:bg-rose-900/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 disabled:opacity-50"
              >
                {refreshing ? "Retrying..." : "Retry loading community data"}
              </button>
            </section>
          )}

          {refreshing && (
            <LiveStatus className="text-sm text-slate-400">
              Loading community data...
            </LiveStatus>
          )}

          {initialLoading ? (
            <section className="rounded-xl border border-slate-800 bg-[#151b2b] p-5">
              <LiveStatus className="sr-only">
                Loading community data…
              </LiveStatus>
              <h2 className="font-semibold text-slate-100">Collection</h2>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Name</dt>
                  <dd><Skeleton className="mt-0.5 h-5 w-32" /></dd>
                </div>
                <div>
                  <dt className="text-slate-500">Symbol</dt>
                  <dd><Skeleton className="mt-0.5 h-5 w-20" /></dd>
                </div>
                <div>
                  <dt className="text-slate-500">Your balance</dt>
                  <dd><Skeleton className="mt-0.5 h-5 w-16" /></dd>
                </div>
                <div>
                  <dt className="text-slate-500">Your votes</dt>
                  <dd><Skeleton className="mt-0.5 h-5 w-24" /></dd>
                </div>
              </dl>
              <Skeleton className="mt-4 h-9 w-36 rounded-lg" />
            </section>
          ) : (
            <section className="rounded-xl border border-slate-800 bg-[#151b2b] p-5">
              <h2 className="font-semibold text-slate-100">Collection</h2>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500">Name</dt>
                  <dd>{name || "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Symbol</dt>
                  <dd>{symbol || "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Your balance</dt>
                  <dd>{balance ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Your votes</dt>
                  <dd>{votes ?? "—"}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={() => void handleDelegate()}
                disabled={
                  !address ||
                  mintLifecycle.isInFlight ||
                  delegationLifecycle.isInFlight
                }
                className="mt-4 rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
              >
                {delegationLifecycle.isInFlight
                  ? "Delegation in progress…"
                  : "Delegate to self"}
              </button>
              <TransactionLifecycleStatus
                stage={delegationLifecycle.stage}
                operationLabel="Delegate"
                error={delegationLifecycle.error}
                metadata={{
                  transactionHash: delegationLifecycle.transactionHash,
                  details: delegationLifecycle.outcomeKind
                    ? [
                        {
                          label: "Outcome",
                          value:
                            delegationLifecycle.outcomeKind ===
                            "wallet_rejected"
                              ? "Wallet rejected"
                              : delegationLifecycle.outcomeKind ===
                                  "still_pending"
                                ? "Still pending"
                                : delegationLifecycle.outcomeKind ===
                                    "simulation_failed"
                                  ? "Simulation failed"
                                  : "Send failed",
                        },
                      ]
                    : undefined,
                }}
              />
            </section>
          )}

          <section className="min-w-0 rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-5">
            <h2 className="font-semibold text-slate-100">Mint NFT (owner only)</h2>
            <div className="mt-4 min-w-0 space-y-4">
              <div>
                <label
                  htmlFor="recipient-address"
                  className="block break-words text-sm text-slate-400"
                >
                  Recipient address{" "}
                  <span className="text-slate-500">(required)</span>
                </label>
                <input
                  id="recipient-address"
                  value={recipient}
                  onChange={(e) => {
                    setRecipient(e.target.value);
                    setRecipientError(null);
                  }}
                  type="text"
                  required
                  aria-describedby={`recipient-address-help${
                    recipientError ? " recipient-address-error" : ""
                  }`}
                  aria-invalid={Boolean(recipientError)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="mt-1 block min-h-11 w-full min-w-0 max-w-full overflow-x-auto rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600"
                  placeholder="G..."
                />
                <p
                  id="recipient-address-help"
                  className="mt-1 text-xs text-slate-500"
                >
                  Enter the recipient&apos;s Stellar public key, beginning with
                  G. Long addresses scroll within the field.
                </p>
                {recipientError && (
                  <p
                    id="recipient-address-error"
                    role="alert"
                    className="mt-1 text-xs text-rose-300"
                  >
                    {recipientError}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="token-uri"
                  className="block break-words text-sm text-slate-400"
                >
                  IPFS metadata URI{" "}
                  <span className="text-slate-500">(required)</span>
                </label>
                <input
                  id="token-uri"
                  value={tokenUri}
                  onChange={(e) => {
                    setTokenUri(e.target.value);
                    setTokenUriError(null);
                  }}
                  type="text"
                  required
                  aria-describedby={`token-uri-help${
                    tokenUriError ? " token-uri-error" : ""
                  }`}
                  aria-invalid={Boolean(tokenUriError)}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="mt-1 block min-h-11 w-full min-w-0 max-w-full overflow-x-auto rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 font-mono text-sm text-slate-100 placeholder:text-slate-600"
                />
                <p id="token-uri-help" className="mt-1 text-xs text-slate-500">
                  Use an IPFS URI such as ipfs://collection/member.json. Long
                  URIs scroll within the field.
                </p>
                {tokenUriError && (
                  <p
                    id="token-uri-error"
                    role="alert"
                    className="mt-1 text-xs text-rose-300"
                  >
                    {tokenUriError}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleMint()}
                disabled={
                  !address ||
                  mintLifecycle.isInFlight ||
                  delegationLifecycle.isInFlight
                }
                className="min-h-11 w-full touch-manipulation rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50 sm:w-auto"
              >
                {mintLifecycle.isInFlight ? "Mint in progress…" : "Mint NFT"}
              </button>
              <TransactionLifecycleStatus
                stage={mintLifecycle.stage}
                operationLabel="Mint"
                error={mintLifecycle.error}
                metadata={{
                  transactionHash: mintLifecycle.transactionHash,
                  details: mintLifecycle.outcomeKind
                    ? [
                        {
                          label: "Outcome",
                          value:
                            mintLifecycle.outcomeKind === "wallet_rejected"
                              ? "Wallet rejected"
                              : mintLifecycle.outcomeKind === "still_pending"
                                ? "Still pending"
                                : mintLifecycle.outcomeKind ===
                                    "simulation_failed"
                                  ? "Simulation failed"
                                  : "Send failed",
                        },
                      ]
                    : undefined,
                }}
              />
            </div>
          </section>
        </div>
      )}

      {status && (
        <LiveStatus
          tone={status.tone}
          className={`mt-4 break-words rounded-lg border bg-[#151b2b] p-3 text-sm [overflow-wrap:anywhere] ${
            status.tone === "error"
              ? "border-rose-800/70 text-rose-200"
              : "border-slate-800 text-slate-200"
          }`}
        >
          {status.message}
        </LiveStatus>
      )}
    </div>
  );
}
