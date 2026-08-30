/**
 * Reusable Stellar RPC and contract test mocks for the web workspace.
 *
 * Import from `@/test-support/stellar` (or a relative path) in component and
 * hook tests. Nothing here touches the network or a wallet extension, and
 * nothing here imports a test runner.
 */
export {
  DEFAULT_FAILED_TX_HASH,
  DEFAULT_TX_HASH,
  MockRpcError,
  MockTransactionFailedError,
} from "./errors";
export { delayed, rejected, resolved, sequence, type Responder } from "./responses";
export { createRecorder, type CallRecorder } from "./callRecorder";
export {
  createTransactionFixture,
  type MockAssembledTransaction,
  type SignRequest,
  type SubmitOutcome,
  type TransactionFixtureOptions,
} from "./transactions";
export {
  clearStellarMockRegistry,
  registerMock,
  registeredMockCount,
  resetAllStellarMocks,
  type Resettable,
} from "./registry";
export {
  MOCK_ACCOUNT_ALICE,
  MOCK_ACCOUNT_BOB,
  MOCK_ACCOUNT_CAROL,
  MOCK_COLLECTION_NAME,
  MOCK_COLLECTION_SYMBOL,
  MOCK_GOVERNOR_CONTRACT_ID,
  MOCK_NFT_CONTRACT_ID,
  MOCK_PROPOSAL_ID,
  MOCK_PROPOSAL_INPUT,
  MOCK_SECOND_PROPOSAL_ID,
  MOCK_TOKEN_URI,
  proposalKey,
} from "./fixtures";
export {
  createNftClientMock,
  defaultNftResponses,
  type NftAccountArgs,
  type NftClientMock,
  type NftDelegateArgs,
  type NftMintArgs,
  type NftResponses,
  type NftTokenArgs,
} from "./nft";
export {
  createGovernorClientMock,
  defaultGovernorResponses,
  type CastVoteArgs,
  type GovernorClientMock,
  type GovernorResponses,
  type HasVotedArgs,
  type ProposalArgs,
  type ProposalIdArgs,
  type ProposeArgs,
  type QuorumArgs,
} from "./governor";
export {
  createNetworkFixture,
  type NetworkFixture,
  type NetworkFixtureOptions,
} from "./network";
export {
  createWalletMock,
  type WalletMock,
  type WalletMockOptions,
} from "./wallet";
export {
  createEventPage,
  createEventsRpcMock,
  createVoteEvent,
  type EventPageOutcome,
  type EventsRpcMock,
  type VoteEventOptions,
} from "./events";
export {
  atlasCommunity,
  atlasMetadata,
  beaconCommunity,
  beaconMetadata,
  createCommunityRecord,
  createCommunityRegistry,
  createFetchMetadata,
  createGovernorReaderFactory,
  driftwoodCommunity,
  multiCommunityRegistry,
  type GovernorFixture,
  type GovernorReaderFactoryMock,
} from "./communities";
export {
  createCommunityDeploymentFixture,
  type CommunityDeploymentFixture,
  type CommunityDeploymentFixtureOptions,
} from "./communityFactory";
export { stellarMockExamples } from "./examples";
