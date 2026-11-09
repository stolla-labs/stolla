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
- **No unilateral owner revoke or burn (`wont-fix` for owner revoke UI in v1):**
  `CommunityNft` (`contracts/contracts/community-nft/src/lib.rs`) implements
  `NonFungibleToken` (`ContractType = NonFungibleVotes`), `Votes`, and `Ownable`,
  and intentionally omits both `NonFungibleBurnable` and any `#[only_owner]`
  `revoke` / `force_burn` entry point. Allowing `CommunityOwner` to unilaterally
  burn a member's token without holder authorization (`from.require_auth()`)
  would let a single admin key censor voters before a proposal snapshot or
  manipulate quorum. Consequently, the web app does not expose a revoke/burn
  button on the mint or community management pages.

## Workaround for compromised or departing members

1. **Voluntary holder transfer or delegation:** An uncompromised departing member
   can redelegate their voting units (`delegate`) or transfer the token (`transfer`)
   to a replacement wallet or an unmonitored burn sink address.
2. **Compromised member key:** If a member wallet is compromised and the
   community must exclude that key from governance, the community must deploy a
   new `CommunityNft` + `CommunityGovernor` pair (or execute a Timelocked
   contract upgrade once `BootstrapOwner` has been transferred to `CommunityTimelock`
   per ADR-006) and reissue membership tokens to verified active members.

## Consequences

- Transfers move voting units to the recipient's delegate
- Members who forget to delegate cannot vote until they delegate
- Community owners cannot arbitrarily strip a member's voting power once minted
- Factory-based multi-community support is deferred to a later iteration
