import {
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import type {
  CommunityDraft,
  CommunityRegistryEntry,
  CommunitySimulation,
} from "./community-creation";
import { NetworkMismatchError, type StellarNetwork } from "./network";

const CREATE_COMMUNITY_FUNCTION = "create_community";
const GET_COMMUNITY_FUNCTION = "get_community";
const TRANSACTION_TIMEOUT_SECONDS = 60;
const CONFIRMATION_ATTEMPTS = 12;
const CONFIRMATION_DELAY_MS = 500;

export class FactoryNotConfiguredError extends Error {
  constructor() {
    super(
      "CommunityFactory address is not configured. Set NEXT_PUBLIC_COMMUNITY_FACTORY_CONTRACT_ID.",
    );
    this.name = "FactoryNotConfiguredError";
  }
}

export type SimulateDeploymentParams = {
  network: StellarNetwork;
  rpcUrl: string;
  factoryAddress: string;
  admin: string;
  draft: CommunityDraft;
};

function toArguments(admin: string, draft: CommunityDraft) {
  return [
    new Address(admin).toScVal(),
    nativeToScVal(draft.name.trim(), { type: "string" }),
    nativeToScVal(draft.symbol.trim(), { type: "string" }),
    nativeToScVal(draft.metadataUri.trim(), { type: "string" }),
    nativeToScVal(Number(draft.votingDelay), { type: "u32" }),
    nativeToScVal(Number(draft.votingPeriod), { type: "u32" }),
    nativeToScVal(BigInt(draft.proposalThreshold), { type: "i128" }),
    nativeToScVal(BigInt(draft.quorum), { type: "i128" }),
  ];
}

export async function simulateCommunityDeployment({
  network,
  rpcUrl,
  factoryAddress,
  admin,
  draft,
}: SimulateDeploymentParams): Promise<CommunitySimulation> {
  if (!factoryAddress) throw new FactoryNotConfiguredError();

  const server = new rpc.Server(rpcUrl);
  const source = await server.getAccount(admin);
  const operation = new Contract(factoryAddress).call(
    CREATE_COMMUNITY_FUNCTION,
    ...toArguments(admin, draft),
  );

  const transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: network.passphrase,
  })
    .addOperation(operation)
    .setTimeout(TRANSACTION_TIMEOUT_SECONDS)
    .build();

  const simulation = await server.simulateTransaction(transaction);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(simulation.error);
  }

  return {
    networkPassphrase: network.passphrase,
    factoryAddress,
    transactionXdr: rpc
      .assembleTransaction(transaction, simulation)
      .build()
      .toXDR(),
    minResourceFee: simulation.minResourceFee,
  };
}

export type SubmitDeploymentParams = {
  simulation: CommunitySimulation;
  network: StellarNetwork;
  rpcUrl: string;
  signTransaction: (xdr: string) => Promise<{ signedTxXdr: string }>;
};

export async function submitCommunityDeployment({
  simulation,
  network,
  rpcUrl,
  signTransaction,
}: SubmitDeploymentParams): Promise<string> {
  /**
   * The simulation carries the network it was built on. Refusing to parse it
   * under any other passphrase keeps a transaction from a previous network out
   * of the signing path entirely.
   */
  if (simulation.networkPassphrase !== network.passphrase) {
    throw new NetworkMismatchError(network, null);
  }

  const { signedTxXdr } = await signTransaction(simulation.transactionXdr);
  const signed = TransactionBuilder.fromXDR(signedTxXdr, network.passphrase);
  const response = await new rpc.Server(rpcUrl).sendTransaction(signed);

  if (response.status === "ERROR" || response.status === "DUPLICATE") {
    throw new Error(`Submission failed with status ${response.status}.`);
  }
  return response.hash;
}

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function confirmCommunityDeployment(
  rpcUrl: string,
  transactionHash: string,
): Promise<void> {
  const server = new rpc.Server(rpcUrl);

  for (let attempt = 0; attempt < CONFIRMATION_ATTEMPTS; attempt += 1) {
    const response = await server.getTransaction(transactionHash);

    if (response.status === rpc.Api.GetTransactionStatus.SUCCESS) return;
    if (response.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error("The deployment transaction failed on chain.");
    }
    await sleep(CONFIRMATION_DELAY_MS);
  }

  throw new Error("Timed out waiting for the deployment to confirm.");
}

export type VerifyRegistryParams = {
  network: StellarNetwork;
  rpcUrl: string;
  factoryAddress: string;
  admin: string;
};

/**
 * Reads the pair back out of the factory rather than trusting the submission
 * result, so success is only declared once the registry agrees.
 */
export async function verifyCommunityRegistry({
  network,
  rpcUrl,
  factoryAddress,
  admin,
}: VerifyRegistryParams): Promise<CommunityRegistryEntry> {
  if (!factoryAddress) throw new FactoryNotConfiguredError();

  const server = new rpc.Server(rpcUrl);
  const source = await server.getAccount(admin);
  const transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: network.passphrase,
  })
    .addOperation(
      new Contract(factoryAddress).call(
        GET_COMMUNITY_FUNCTION,
        new Address(admin).toScVal(),
      ),
    )
    .setTimeout(TRANSACTION_TIMEOUT_SECONDS)
    .build();

  const simulation = await server.simulateTransaction(transaction);
  if (rpc.Api.isSimulationError(simulation)) {
    throw new Error(simulation.error);
  }

  const value = simulation.result?.retval;
  const entry = value ? scValToNative(value) : null;
  const nftContractId = entry?.nft;
  const governorContractId = entry?.governor;
  const communityIdBytes = entry?.community_id;

  if (!nftContractId || !governorContractId || !(communityIdBytes instanceof Uint8Array)) {
    throw new Error("The community is not visible in the factory registry yet.");
  }

  const id = Array.from(communityIdBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return { id, nftContractId, governorContractId };
}
