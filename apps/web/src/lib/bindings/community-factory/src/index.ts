import { Buffer } from "buffer";
import { Contract, nativeToScVal, scValToNative } from "@stellar/stellar-sdk";
import { AssembledTransaction } from "@stellar/stellar-sdk/contract";
import type {
  ClientOptions as ContractClientOptions,
  MethodOptions,
} from "@stellar/stellar-sdk/contract";
import type {
  CommunityDeploymentResult,
  CommunityFactoryGovernance,
  CommunityFactoryMetadata,
} from "@/lib/communityFactory/types";

export type {
  CommunityDeploymentResult,
  CommunityFactoryGovernance,
  CommunityFactoryMetadata,
};

export type SetCommunityActivityArgs = {
  communityId: string;
  activity: "active" | "paused" | "archived";
  operator: string;
};
export type DeployCommunityArgs = {
  creator: string;
  metadata: CommunityFactoryMetadata;
  governance: CommunityFactoryGovernance;
};

export interface CommunityFactoryClient {
  deploy_community: (
    args: DeployCommunityArgs,
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<CommunityDeploymentResult>>;
  set_community_activity: (
    args: SetCommunityActivityArgs,
    options?: MethodOptions,
  ) => Promise<AssembledTransaction<null>>;
}

export class Client implements CommunityFactoryClient {
  constructor(public readonly options: ContractClientOptions) {}

  deploy_community(
    { creator, metadata, governance }: DeployCommunityArgs,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<CommunityDeploymentResult>> {
    const contract = new Contract(this.options.contractId);
    const operation = contract.call(
      "deploy_community",
      nativeToScVal(creator, { type: "address" }),
      nativeToScVal(metadata, {
        type: {
          name: ["symbol", "string"],
          symbol: ["symbol", "string"],
          base_uri: ["symbol", "string"],
          description: ["symbol", "string"],
          external_url: ["symbol", "string"],
        },
      }),
      nativeToScVal(governance, {
        type: {
          voting_delay: ["symbol", "u32"],
          voting_period: ["symbol", "u32"],
          proposal_threshold: ["symbol", "u128"],
          quorum: ["symbol", "u128"],
        },
      }),
    );

    return AssembledTransaction.buildWithOp(operation, {
      ...this.options,
      ...options,
      method: "deploy_community",
      args: [creator, metadata, governance],
      parseResultXdr: (value) =>
        scValToNative(value) as CommunityDeploymentResult,
    });
  }

  set_community_activity(
    { communityId, activity, operator }: SetCommunityActivityArgs,
    options?: MethodOptions,
  ): Promise<AssembledTransaction<null>> {
    const activityValue = activity === "paused" ? 1 : activity === "archived" ? 2 : 0;
    const contract = new Contract(this.options.contractId);
    const operation = contract.call(
      "set_community_activity",
      nativeToScVal(Buffer.from(communityId, "hex")),
      nativeToScVal(activityValue, { type: "u32" }),
      nativeToScVal(operator, { type: "address" }),
    );
    return AssembledTransaction.buildWithOp(operation, {
      ...this.options,
      ...options,
      method: "set_community_activity",
      args: [communityId, activity, operator],
      parseResultXdr: () => null,
    });
  }

}
