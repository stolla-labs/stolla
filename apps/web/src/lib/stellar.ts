import { Networks } from "@stellar/stellar-sdk";

const network = process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet";

export const stellarConfig = {
  testnet: {
    rpcUrl:
      process.env.NEXT_PUBLIC_STELLAR_RPC_URL ??
      "https://soroban-testnet.stellar.org",
    horizonUrl: "https://horizon-testnet.stellar.org",
    networkPassphrase: Networks.TESTNET,
    friendbotUrl: "https://friendbot.stellar.org",
  },
  mainnet: {
    rpcUrl: process.env.NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL ?? "",
    horizonUrl: "https://horizon.stellar.org",
    networkPassphrase: Networks.PUBLIC,
    friendbotUrl: null,
  },
} as const;

export const config =
  network === "mainnet" ? stellarConfig.mainnet : stellarConfig.testnet;

export const contractIds = {
  nft: process.env.NEXT_PUBLIC_NFT_CONTRACT_ID ?? "",
  governor: process.env.NEXT_PUBLIC_GOVERNOR_CONTRACT_ID ?? "",
};

export function requireContractIds(): { nft: string; governor: string } {
  if (!contractIds.nft || !contractIds.governor) {
    throw new Error(
      "Contract IDs are not configured. Set NEXT_PUBLIC_NFT_CONTRACT_ID and NEXT_PUBLIC_GOVERNOR_CONTRACT_ID.",
    );
  }
  return { nft: contractIds.nft, governor: contractIds.governor };
}
