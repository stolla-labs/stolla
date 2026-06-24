"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/context/WalletProvider";
import {
  createNftClient,
  createReadOnlyNftClient,
} from "@/lib/contracts";
import { contractIds } from "@/lib/stellar";

export default function CommunityPage() {
  const { address, signTransaction } = useWallet();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [votes, setVotes] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [tokenUri, setTokenUri] = useState("ipfs://");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const contractsConfigured = Boolean(contractIds.nft);

  const refresh = useCallback(async () => {
    if (!contractsConfigured) return;
    const client = createReadOnlyNftClient();
    const [collectionName, collectionSymbol] = await Promise.all([
      client.name(),
      client.symbol(),
    ]);
    setName(collectionName.result ?? "");
    setSymbol(collectionSymbol.result ?? "");

    if (address) {
      const userClient = createNftClient({ publicKey: address, signTransaction });
      const [bal, votePower] = await Promise.all([
        userClient.balance({ account: address }),
        userClient.get_votes({ account: address }),
      ]);
      setBalance(Number(bal.result ?? 0));
      setVotes(String(votePower.result ?? 0));
    }
  }, [address, contractsConfigured, signTransaction]);

  useEffect(() => {
    refresh().catch((error: unknown) => {
      setStatus(error instanceof Error ? error.message : "Failed to load NFT data");
    });
  }, [refresh]);

  async function handleMint() {
    if (!address) {
      setStatus("Connect your wallet first.");
      return;
    }
    if (!recipient || !tokenUri) {
      setStatus("Recipient and IPFS URI are required.");
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const client = createNftClient({ publicKey: address, signTransaction });
      const tx = await client.mint({ to: recipient, token_uri: tokenUri });
      const result = await tx.signAndSend();
      setStatus(`Minted token #${result.result} successfully.`);
      await refresh();
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Mint failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelegate() {
    if (!address) {
      setStatus("Connect your wallet first.");
      return;
    }

    setLoading(true);
    setStatus(null);
    try {
      const client = createNftClient({ publicKey: address, signTransaction });
      const tx = await client.delegate({
        account: address,
        delegatee: address,
      });
      await tx.signAndSend();
      setStatus("Delegated voting power to yourself.");
      await refresh();
    } catch (error: unknown) {
      setStatus(error instanceof Error ? error.message : "Delegate failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Community NFT</h1>
      <p className="mt-2 text-zinc-600">
        Mint membership NFTs and delegate voting power on testnet.
      </p>

      {!contractsConfigured && (
        <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Contract IDs are not set. Deploy contracts and configure{" "}
          <code className="font-mono">NEXT_PUBLIC_NFT_CONTRACT_ID</code> in{" "}
          <code className="font-mono">.env.local</code>.
        </p>
      )}

      {contractsConfigured && (
        <div className="mt-6 space-y-6">
          <section className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="font-semibold">Collection</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-zinc-500">Name</dt>
                <dd>{name || "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Symbol</dt>
                <dd>{symbol || "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Your balance</dt>
                <dd>{balance ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Your votes</dt>
                <dd>{votes ?? "—"}</dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={handleDelegate}
              disabled={!address || loading}
              className="mt-4 rounded-lg border border-zinc-300 px-4 py-2 text-sm hover:bg-zinc-50 disabled:opacity-50"
            >
              Delegate to self
            </button>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="font-semibold">Mint NFT (owner only)</h2>
            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="text-zinc-600">Recipient address</span>
                <input
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm"
                  placeholder="G..."
                />
              </label>
              <label className="block text-sm">
                <span className="text-zinc-600">IPFS metadata URI</span>
                <input
                  value={tokenUri}
                  onChange={(e) => setTokenUri(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm"
                />
              </label>
              <button
                type="button"
                onClick={handleMint}
                disabled={!address || loading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Mint NFT"}
              </button>
            </div>
          </section>
        </div>
      )}

      {status && (
        <p className="mt-4 rounded-lg border border-zinc-200 bg-white p-3 text-sm">
          {status}
        </p>
      )}
    </div>
  );
}
