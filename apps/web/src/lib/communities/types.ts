export type CommunityRecord = {
  id: string;
  name: string;
  symbol: string;
  governorContractId: string;
  nftContractId: string;
  metadataUri?: string;
};

export type CommunityMetadata = {
  description: string;
  logoUri?: string;
};
