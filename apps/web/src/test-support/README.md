# Test support

Reusable test doubles for the web workspace. Nothing in this folder performs a
network request, and nothing here requires a wallet extension.

## Stellar RPC and contract mocks

`stellar/` is the canonical API for network, wallet, community registry,
Governor/NFT, RPC event, and transaction fixtures. Its default URLs use the
reserved `.test` suffix, and Vitest rejects unmocked `fetch` calls.

```ts
import {
  createGovernorClientMock,
  createNftClientMock,
  delayed,
  rejected,
  resetAllStellarMocks,
  resolved,
  MOCK_ACCOUNT_ALICE,
  MOCK_PROPOSAL_ID,
} from "@/test-support/stellar";
import { ProposalState } from "@/lib/bindings/community-governor/src";

const nft = createNftClientMock();
const governor = createGovernorClientMock();

// Reads
nft.set("balance", resolved(4));
nft.set("get_votes", resolved(BigInt(9)));
nft.set("get_total_supply", delayed(BigInt(12), 50)); // loading states
nft.set("owner_of", rejected("rpc unavailable")); // RPC failure

// Governance state, per proposal and per account
governor.setProposalState(MOCK_PROPOSAL_ID, ProposalState.Succeeded);
governor.setHasVoted(MOCK_PROPOSAL_ID, MOCK_ACCOUNT_ALICE, true);

// Assert what the component sent to the contract
const args = governor.cast_vote.lastArgs();

// Restore every mock between tests
resetAllStellarMocks();
```

### Network, wallet, registry, and events

```ts
const network = createNetworkFixture({ governorStartLedger: 1_500_000 });
const wallet = createWalletMock({ address: MOCK_ACCOUNT_ALICE });
const registry = createCommunityRegistry(atlasCommunity, beaconCommunity);

const eventsRpc = createEventsRpcMock(
  createEventPage([
    createVoteEvent({
      proposalId: MOCK_PROPOSAL_ID,
      voteType: 1,
      weight: BigInt(5),
    }),
  ]),
);
```

Community component tests use `createGovernorReaderFactory` for per-contract
proposal state. Deployment workflow tests use
`createCommunityDeploymentFixture`, which records deployment arguments, stages,
wallet submission, and stored hashes.

### Transaction outcomes

```ts
governor.setTransactionOptions({ onSign: (req) => recorded.push(req.xdr) });
const tx = await governor.propose(input);
await tx.simulate();
const outcome = await tx.signAndSend(); // { status: "SUCCESS", hash, result }

governor.setTransactionOptions({ outcome: "failure" });
// -> { status: "FAILED", hash, error }
// setTransactionOptions({ outcome: "failure", rejectOnSubmit: true }) throws instead
```

## Why the helpers do not use `vi.fn()`

The mocks use a small internal call recorder (`callRecorder.ts`) instead of
coupling their API to Vitest spies. This keeps the helpers reusable from any
runner while still allowing tests to inspect call counts and arguments.

`stellar/examples.ts` holds executable example scenarios with plain assertions;
`stellar/examples.test.ts` registers them as a normal Vitest suite.

## Typing

Value types mirror the generated bindings (`u32` → `number`, `u128` →
`bigint`, `Option<T>` → `T | undefined`, proposal ids → 32-byte `Buffer`), and
`proposal_state` uses the real `ProposalState` enum. A binding regeneration that
changes a return type surfaces as a compile error here rather than a silently
wrong fixture.

Note: `BigInt(1)` is used rather than `1n` because the workspace targets
ES2017.
