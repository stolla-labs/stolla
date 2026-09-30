"use client";

import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useWallet } from "@/context/WalletProvider";
import { getE2EBridge } from "@/lib/e2eMock";
import { formatBytes, IPFS_UPLOAD_LIMITS } from "@/lib/ipfs/limits";
import {
  createIpfsPinClient,
  IpfsPinError,
  validateImageFile,
} from "@/lib/ipfs/pin";
import {
  publishTokenMetadata,
  type PublishedTokenMetadata,
  type TokenPublishStep,
} from "@/lib/nft/publishTokenMetadata";
import {
  TOKEN_METADATA_LIMITS,
  validateTokenMetadataDraft,
  type TokenMetadataDraftErrors,
} from "@/lib/nft/tokenMetadata";
import {
  createNftClient,
  createReadOnlyNftClient,
} from "@/lib/contracts";
import { useCommunityRegistry } from "@/lib/community/CommunityRegistryProvider";
import type { Community } from "@/lib/community/types";
import { contractIds } from "@/lib/stellar";
import { Skeleton } from "@/components/ui/Skeleton";
import { AppButton } from "@/components/ui/AppButton";
import { LiveStatus } from "@/components/ui/LiveStatus";
import { TransactionLifecycleStatus } from "@/components/TransactionLifecycleStatus";
import { useOperationLifecycle } from "@/hooks/useOperationLifecycle";
import { validateMintTokenUri } from "@/lib/community/mint-token-uri";
import { SelfDelegateCallout } from "@/components/community/SelfDelegateCallout";
import { VotingPowerCompositionDisplay } from "@/components/community/VotingPowerCompositionDisplay";
import {
  loadCommunityData,
  runCommunityRefresh,
} from "./community-data.mjs";

type ActionStatus = {
  message: string;
  tone: "routine" | "error";
};

/**
 * Mint authoring is upload-first: the member metadata is typed as fields and
 * pinned by Stolla. `token_uri` exists only as generated state after a
 * successful pin and is cleared by any later edit.
 */
type PinState =
  | { kind: "idle" }
  | { kind: "pinning"; step: TokenPublishStep }
  | { kind: "error"; message: string; retryable: boolean };

const IMAGE_ACCEPT = IPFS_UPLOAD_LIMITS.imageTypes.join(",");

function describePinError(error: unknown): { message: string; retryable: boolean } {
  if (error instanceof IpfsPinError) {
    return {
      message:
        error.kind === "config"
          ? `${error.message} Retrying will not help until the server is configured.`
          : error.message,
      retryable: error.retryable,
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return { message: message || "Pinning failed.", retryable: true };
}

export default function CommunityPage() {
  const { address, signTransaction } = useWallet();
  const registry = useCommunityRegistry();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [votes, setVotes] = useState<string | null>(null);
  const [delegate, setDelegate] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenDescription, setTokenDescription] = useState("");
  const [tokenImage, setTokenImage] = useState<File | null>(null);
  const [tokenImageError, setTokenImageError] = useState<string | null>(null);
  const [tokenErrors, setTokenErrors] = useState<TokenMetadataDraftErrors>({});
  const [pinState, setPinState] = useState<PinState>({ kind: "idle" });
  const [publishedToken, setPublishedToken] =
    useState<PublishedTokenMetadata | null>(null);
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const pin = useMemo(() => getE2EBridge()?.pin ?? createIpfsPinClient(), []);
  const pinInFlight = useRef(false);
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
      setTokenName("");
      setTokenDescription("");
      setTokenImage(null);
      setTokenImageError(null);
      setTokenErrors({});
      setPinState({ kind: "idle" });
      setPublishedToken(null);
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
          setDelegate(data.delegate ?? null);
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

  const tokenDraft = { name: tokenName, description: tokenDescription };
  const tokenDraftValid =
    Object.keys(validateTokenMetadataDraft(tokenDraft)).length === 0 &&
    !tokenImageError;

  /** Any edit to the authoring fields drops the generated token_uri. */
  function editTokenField(update: () => void) {
    update();
    setPublishedToken(null);
    if (pinState.kind === "error") setPinState({ kind: "idle" });
  }

  function updateTokenImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    editTokenField(() => {
      if (!file) {
        setTokenImage(null);
        setTokenImageError(null);
        return;
      }
      const rejection = validateImageFile(file);
      if (rejection) {
        setTokenImage(null);
        setTokenImageError(rejection);
        event.target.value = "";
        return;
      }
      setTokenImage(file);
      setTokenImageError(null);
    });
  }

  /**
   * Pins image → token.json and returns the generated token_uri, or null on
   * failure (the inline error is retryable and the draft is kept).
   */
  async function pinTokenMetadata(): Promise<PublishedTokenMetadata | null> {
    if (publishedToken) return publishedToken;
    if (pinInFlight.current) return null;
    pinInFlight.current = true;
    setPinState({ kind: "pinning", step: tokenImage ? "image" : "document" });
    try {
      const result = await publishTokenMetadata(
        tokenDraft,
        tokenImage,
        pin,
        (step) => setPinState({ kind: "pinning", step }),
      );
      setPublishedToken(result);
      setPinState({ kind: "idle" });
      return result;
    } catch (error) {
      setPinState({ kind: "error", ...describePinError(error) });
      return null;
    } finally {
      pinInFlight.current = false;
    }
  }

  async function handleMint() {
    if (!address) {
      setStatus({ message: "Connect your wallet first.", tone: "error" });
      return;
    }
    const nextTokenErrors = validateTokenMetadataDraft(tokenDraft);
    setTokenErrors(nextTokenErrors);
    setRecipientError(!recipient ? "Recipient address is required." : null);
    if (!recipient || Object.keys(nextTokenErrors).length > 0 || tokenImageError) {
      setStatus(null);
      return;
    }
    if (mintLifecycle.isInFlight || pinState.kind === "pinning") return;

    setStatus(null);
    mintLifecycle.reset();

    const published = await pinTokenMetadata();
    if (!published) return;

    // Guard the generated token_uri before wallet/simulation work (SEP-0050).
    const uriError = validateMintTokenUri(published.tokenUri);
    if (uriError) {
      setPinState({ kind: "error", message: uriError, retryable: true });
      return;
    }

    const result = await mintLifecycle.execute(async () => {
      const client = createNftClient({
        publicKey: address,
        signTransaction,
        contractId: activeNftContract,
      });
      return client.mint({ to: recipient, token_uri: published.tokenUri });
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
              <AppButton
                tone="danger"
                onClick={() => void refresh()}
                disabled={refreshing}
                className="mt-4"
              >
                {refreshing ? "Retrying..." : "Retry loading community data"}
              </AppButton>
            </section>
          )}

          {refreshing && !initialLoading && (
            <LiveStatus className="text-sm text-slate-400">
              Loading community data…
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
              <SelfDelegateCallout
                balance={balance}
                votes={votes}
                nftContractId={activeNftContract}
                onDelegate={() => void handleDelegate()}
                isDelegating={delegationLifecycle.isInFlight}
                className="mt-3"
              />
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
              <VotingPowerCompositionDisplay
                account={address}
                balance={balance}
                totalVotes={votes}
                delegate={delegate}
              />
              <AppButton
                tone="secondary"
                onClick={() => void handleDelegate()}
                disabled={
                  !address ||
                  mintLifecycle.isInFlight ||
                  delegationLifecycle.isInFlight
                }
                className="mt-4"
              >
                {delegationLifecycle.isInFlight
                  ? "Delegation in progress…"
                  : "Delegate to self"}
              </AppButton>
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
                  htmlFor="token-name"
                  className="block break-words text-sm text-slate-400"
                >
                  Display name{" "}
                  <span className="text-slate-500">(required)</span>
                </label>
                <input
                  id="token-name"
                  value={tokenName}
                  onChange={(e) =>
                    editTokenField(() => {
                      setTokenName(e.target.value);
                      setTokenErrors((current) => ({ ...current, name: undefined }));
                    })
                  }
                  type="text"
                  required
                  aria-describedby={`token-name-help${
                    tokenErrors.name ? " token-name-error" : ""
                  }`}
                  aria-invalid={Boolean(tokenErrors.name)}
                  className="mt-1 block min-h-11 w-full min-w-0 rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
                  placeholder="Stolla Member #1"
                />
                <p id="token-name-help" className="mt-1 text-xs text-slate-500">
                  Stored as the SEP-0050 <code className="font-mono">name</code>.
                  Maximum {TOKEN_METADATA_LIMITS.nameBytes} UTF-8 bytes.
                </p>
                {tokenErrors.name && (
                  <p id="token-name-error" role="alert" className="mt-1 text-xs text-rose-300">
                    {tokenErrors.name}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="token-description"
                  className="block break-words text-sm text-slate-400"
                >
                  Description{" "}
                  <span className="text-slate-500">(required)</span>
                </label>
                <textarea
                  id="token-description"
                  value={tokenDescription}
                  onChange={(e) =>
                    editTokenField(() => {
                      setTokenDescription(e.target.value);
                      setTokenErrors((current) => ({
                        ...current,
                        description: undefined,
                      }));
                    })
                  }
                  required
                  rows={3}
                  aria-describedby={`token-description-help${
                    tokenErrors.description ? " token-description-error" : ""
                  }`}
                  aria-invalid={Boolean(tokenErrors.description)}
                  className="mt-1 block w-full min-w-0 resize-y rounded-lg border border-slate-700 bg-[#0b0f19] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600"
                  placeholder="Community membership NFT"
                />
                <p id="token-description-help" className="mt-1 text-xs text-slate-500">
                  Maximum {TOKEN_METADATA_LIMITS.descriptionBytes} UTF-8 bytes.
                </p>
                {tokenErrors.description && (
                  <p
                    id="token-description-error"
                    role="alert"
                    className="mt-1 text-xs text-rose-300"
                  >
                    {tokenErrors.description}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="token-image"
                  className="block break-words text-sm text-slate-400"
                >
                  Image <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  id="token-image"
                  type="file"
                  accept={IMAGE_ACCEPT}
                  onChange={updateTokenImage}
                  aria-describedby={`token-image-help${
                    tokenImageError ? " token-image-error" : ""
                  }`}
                  aria-invalid={Boolean(tokenImageError)}
                  className="mt-1 block w-full min-w-0 text-sm text-slate-300 file:mr-3 file:min-h-11 file:rounded-lg file:border file:border-slate-700 file:bg-[#0b0f19] file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-200"
                />
                <p id="token-image-help" className="mt-1 text-xs text-slate-500">
                  {tokenImage
                    ? `Selected ${tokenImage.name} (${formatBytes(tokenImage.size)}).`
                    : `PNG, JPEG, WebP, GIF, or SVG up to ${formatBytes(IPFS_UPLOAD_LIMITS.imageMaxBytes)}.`}{" "}
                  Stolla pins the image and the metadata document to IPFS; you
                  do not need to host anything or paste a URI.
                </p>
                {tokenImageError && (
                  <p id="token-image-error" role="alert" className="mt-1 text-xs text-rose-300">
                    {tokenImageError}
                  </p>
                )}
              </div>
              {pinState.kind === "pinning" && (
                <LiveStatus className="rounded-lg border border-slate-700 bg-[#0b0f19] p-3 text-sm text-slate-300">
                  {pinState.step === "image"
                    ? "Uploading the image to IPFS…"
                    : "Pinning the membership metadata to IPFS…"}
                </LiveStatus>
              )}
              {pinState.kind === "error" && (
                <LiveStatus
                  tone="error"
                  className="rounded-lg border border-rose-800/70 bg-rose-950/30 p-3 text-sm text-rose-200"
                >
                  Metadata upload failed: {pinState.message} Your fields are
                  preserved.
                  {pinState.retryable && (
                    <AppButton
                      tone="danger"
                      size="sm"
                      onClick={() => void pinTokenMetadata()}
                      className="mt-2 block"
                    >
                      Retry upload
                    </AppButton>
                  )}
                </LiveStatus>
              )}
              {publishedToken && (
                <LiveStatus className="break-all rounded-lg border border-emerald-800/70 bg-emerald-950/30 p-3 font-mono text-xs text-emerald-200 [overflow-wrap:anywhere]">
                  Metadata pinned. token_uri: {publishedToken.tokenUri}
                </LiveStatus>
              )}
              <AppButton
                tone="primary"
                onClick={() => void handleMint()}
                disabled={
                  !address ||
                  !tokenDraftValid ||
                  pinState.kind === "pinning" ||
                  pinState.kind === "error" ||
                  mintLifecycle.isInFlight ||
                  delegationLifecycle.isInFlight
                }
                className="w-full sm:w-auto"
              >
                {pinState.kind === "pinning"
                  ? "Uploading metadata…"
                  : mintLifecycle.isInFlight
                    ? "Mint in progress…"
                    : "Mint NFT"}
              </AppButton>
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
