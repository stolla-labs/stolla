import type {
  CommunityDeploymentClient,
  CommunityDeploymentTransaction,
  DeployCommunityDependencies,
  DeploymentStage,
  SignAndSendResult,
} from "../../lib/communityFactory/deployment";
import type {
  CommunityDeploymentResult,
  CommunityFactoryCreateArgs,
} from "../../lib/communityFactory/types";
import { createRecorder, type CallRecorder } from "./callRecorder";
import { MOCK_ACCOUNT_ALICE } from "./fixtures";

export type CommunityDeploymentFixtureOptions = {
  address?: string | null;
  expectedNetworkPassphrase?: string;
  walletNetworkPassphrase?: string | null;
  simulationError?: Error;
  submissionError?: Error;
  response?: SignAndSendResult<CommunityDeploymentResult>;
};

export type CommunityDeploymentFixture = {
  client: CommunityDeploymentClient;
  dependencies: DeployCommunityDependencies;
  deployCommunity: CallRecorder<
    CommunityFactoryCreateArgs,
    Promise<CommunityDeploymentTransaction>
  >;
  signAndSend: CallRecorder<
    void,
    Promise<SignAndSendResult<CommunityDeploymentResult>>
  >;
  stages: DeploymentStage[];
  hashes: string[];
};

/** Builds the dependency boundary used by the community deployment workflow. */
export function createCommunityDeploymentFixture(
  options: CommunityDeploymentFixtureOptions = {},
): CommunityDeploymentFixture {
  const stages: DeploymentStage[] = [];
  const hashes: string[] = [];
  const signAndSend = createRecorder<
    void,
    Promise<SignAndSendResult<CommunityDeploymentResult>>
  >(async () => {
    if (options.submissionError) throw options.submissionError;
    return options.response ?? { hash: "abc123" };
  });
  const deployCommunity = createRecorder<
    CommunityFactoryCreateArgs,
    Promise<CommunityDeploymentTransaction>
  >(async () => {
    if (options.simulationError) throw options.simulationError;
    return { signAndSend };
  });
  const client = { deploy_community: deployCommunity };
  const expectedNetworkPassphrase =
    options.expectedNetworkPassphrase ??
    "Test SDF Network ; September 2015";

  return {
    client,
    deployCommunity,
    signAndSend,
    stages,
    hashes,
    dependencies: {
      address:
        options.address === undefined ? MOCK_ACCOUNT_ALICE : options.address,
      expectedNetworkPassphrase,
      walletNetworkPassphrase:
        options.walletNetworkPassphrase === undefined
          ? expectedNetworkPassphrase
          : options.walletNetworkPassphrase,
      createClient: () => client,
      storeHash: (hash) => hashes.push(hash),
      onStage: (stage) => stages.push(stage),
    },
  };
}
