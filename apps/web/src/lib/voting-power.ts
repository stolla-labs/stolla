/**
 * Voting-power composition model.
 *
 * Breaks down a member's total voting power into:
 * - Own tokens: NFTs held by the member that they delegated to themselves.
 * - Received delegation: Voting power delegated to the member by other accounts.
 * - Delegated out: NFTs held by the member whose voting power was delegated to a third party.
 * - Undelegated: NFTs held by the member that have never been delegated (these do not count).
 */

export type VotingPowerComposition = {
  totalVotes: bigint;
  selfVotes: bigint;
  delegatedIn: bigint;
  delegatedOut: bigint;
  undelegated: bigint;
  delegateAddress: string | null;
  isSelfDelegated: boolean;
};

export type CalculateVotingPowerInput = {
  account: string;
  balance: number | bigint | null | undefined;
  totalVotes: number | bigint | string | null | undefined;
  delegate: string | null | undefined;
};

export function parseBigIntSafe(val: number | bigint | string | null | undefined): bigint {
  if (val === null || val === undefined) return 0n;
  if (typeof val === "bigint") return val;
  if (typeof val === "number") {
    if (isNaN(val) || !isFinite(val)) return 0n;
    return BigInt(Math.max(0, Math.floor(val)));
  }
  const clean = val.trim();
  if (clean === "" || clean === "—") return 0n;
  try {
    return BigInt(clean);
  } catch {
    const num = Number(clean);
    return isNaN(num) ? 0n : BigInt(Math.max(0, Math.floor(num)));
  }
}

export function calculateVotingPowerComposition({
  account,
  balance,
  totalVotes,
  delegate,
}: CalculateVotingPowerInput): VotingPowerComposition {
  const b = parseBigIntSafe(balance);
  const total = parseBigIntSafe(totalVotes);

  const cleanAccount = account.trim().toLowerCase();
  const cleanDelegate = delegate ? delegate.trim() : null;
  const isSelf = cleanDelegate !== null && cleanDelegate.toLowerCase() === cleanAccount;
  const isDelegatedOut = cleanDelegate !== null && !isSelf;

  // Self votes can only come from own balance when self-delegated, capped at totalVotes
  const selfVotes = isSelf ? (b <= total ? b : total) : 0n;

  // Any remaining voting power in totalVotes comes from other accounts delegating in
  const delegatedIn = total > selfVotes ? total - selfVotes : 0n;

  // If delegated to someone else, own balance is delegated out
  const delegatedOut = isDelegatedOut ? b : 0n;

  // If never delegated (delegate is null), own balance is undelegated
  const undelegated = cleanDelegate === null ? b : 0n;

  return {
    totalVotes: total,
    selfVotes,
    delegatedIn,
    delegatedOut,
    undelegated,
    delegateAddress: cleanDelegate,
    isSelfDelegated: isSelf,
  };
}
