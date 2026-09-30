export interface CollectionData {
  name: string;
  symbol: string;
  balance: number | null;
  votes: string | null;
  delegate: string | null;
}

interface Result<T> {
  result?: T;
}

export interface CollectionClient {
  name(): Promise<Result<string>>;
  symbol(): Promise<Result<string>>;
}

export interface CommunityUserClient {
  balance(input: { account: string }): Promise<Result<unknown>>;
  get_votes(input: { account: string }): Promise<Result<unknown>>;
  get_delegate?(input: { account: string }): Promise<Result<unknown>>;
}

interface LoadCommunityDataOptions {
  address: string | null;
  collectionClient: CollectionClient;
  userClient: CommunityUserClient | null;
}

interface CommunityRefreshCallbacks {
  onStart(): void;
  onSuccess(data: CollectionData): void;
  onError(message: string): void;
}

export function loadCommunityData(
  options: LoadCommunityDataOptions,
): Promise<CollectionData>;

export function communityDataErrorMessage(error: unknown): string;

export function runCommunityRefresh(
  load: () => Promise<CollectionData>,
  callbacks: CommunityRefreshCallbacks,
): Promise<boolean>;
