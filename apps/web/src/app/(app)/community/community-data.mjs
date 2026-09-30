export async function loadCommunityData({
  address,
  collectionClient,
  userClient,
}) {
  const [collectionName, collectionSymbol] = await Promise.all([
    collectionClient.name(),
    collectionClient.symbol(),
  ]);

  if (!address || !userClient) {
    return {
      name: collectionName.result ?? "",
      symbol: collectionSymbol.result ?? "",
      balance: null,
      votes: null,
      delegate: null,
    };
  }

  const [balance, votes, delegate] = await Promise.all([
    userClient.balance({ account: address }),
    userClient.get_votes({ account: address }),
    typeof userClient.get_delegate === "function"
      ? userClient.get_delegate({ account: address }).catch(() => ({ result: null }))
      : Promise.resolve({ result: null }),
  ]);

  return {
    name: collectionName.result ?? "",
    symbol: collectionSymbol.result ?? "",
    balance: Number(balance.result ?? 0),
    votes: String(votes.result ?? 0),
    delegate: delegate?.result ?? null,
  };
}

export function communityDataErrorMessage(error) {
  return error instanceof Error ? error.message : "Failed to load NFT data";
}

export async function runCommunityRefresh(load, callbacks) {
  callbacks.onStart();

  try {
    callbacks.onSuccess(await load());
    return true;
  } catch (error) {
    callbacks.onError(communityDataErrorMessage(error));
    return false;
  }
}
