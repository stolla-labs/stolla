# ADR-001: NFT Voting Model

## Status

Accepted

## Context

Stolla communities gate DAO voting by NFT ownership. We need a model that is simple, resistant to flash-loan manipulation, and compatible with Soroban governance libraries.

## Decision

- **1 NFT = 1 voting unit** via OpenZeppelin `NonFungibleVotes`
- Holders must call `delegate(self)` before votes count (OZ Votes requirement)
- Voting power is read at proposal snapshot ledger (Governor default)
- MVP uses a single community: one NFT contract linked to one Governor contract

## Consequences

- Transfers move voting units to the recipient's delegate
- Members who forget to delegate cannot vote until they delegate
- Factory-based multi-community support is deferred to a later iteration

## Membership Token Revocation and Burn Policy (#402)

### Contract Audit Decision

`CommunityNft` (`contracts/contracts/community-nft/src/lib.rs`) implements SEP-0050 `NonFungibleToken` (`ContractType = NonFungibleVotes`), `Votes`, and `Ownable`. It intentionally **does not** implement `NonFungibleBurnable` or an owner-authorized `revoke` / forced-burn entry point:

1. **Governance integrity:** Allowing a single owner key to unilaterally burn or revoke member NFTs could manipulate quorum or defeat active governance proposals mid-vote (even with snapshot checkpoints, forced revocation changes future proposal threshold eligibility).
2. **UI stance (documented won't-fix for owner revoke button):** Because `community-nft` does not expose an owner-authorized `burn` or `revoke` method, the web app intentionally omits any revoke/burn button on `/community` so users never encounter a silent no-op or misleading control.

### Operational Workarounds for Compromised Member Keys

- **Cooperating member (key rotation):** The member (or an operator they previously approved via SEP-0050 `approve` / `approve_for_all`) can call `transfer_from` to move the NFT to their new Stellar address, which atomically moves future voting units once delegated.
- **Unrecoverable or hostile compromised key:** Because v1 NFTs cannot be forcibly revoked by the collection owner, communities requiring membership exclusion must either dilute weight by minting replacement membership tokens (if governance rules permit) or deploy a fresh community instance via `CommunityFactory` and re-mint the active roster.
