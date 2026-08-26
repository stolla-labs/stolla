import { Networks } from "@stellar/stellar-sdk";
import type { NetworkId, StellarNetwork } from "./network";

export type CapabilityAvailable<T> = { available: true } & T;
export type CapabilityUnavailable = { available: false; reason: string };
export type Capability<T> = CapabilityAvailable<T> | CapabilityUnavailable;

export type NetworkCapabilities = {
  activeNetwork: StellarNetwork;
  rpc: Capability<{ url: string; friendbotUrl: string | null }>;
  explorer: Capability<{ segment: string }>;
  communityFactory: Capability<{ contractId: string }>;
  legacyContracts: Capability<{ nft: string; governor: string }>;
  proposalDiscovery: Capability<{ startLedger: number }>;
};

export class CapabilityError extends Error {
  constructor(capabilityName: string, reason: string) {
    super(`Capability '${capabilityName}' is unavailable: ${reason}`);
    this.name = "CapabilityError";
  }
}
