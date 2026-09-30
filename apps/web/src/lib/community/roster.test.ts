import { describe, expect, it, vi } from "vitest";
import { fetchMemberRoster } from "./roster";

describe("fetchMemberRoster", () => {
  it("returns empty roster when total supply is zero", async () => {
    const mockClient = {
      get_total_supply: vi.fn().mockResolvedValue({ result: 0n }),
    };

    const result = await fetchMemberRoster({
      nftContractId: "CNFT_TEST",
      client: mockClient,
    });

    expect(result.members).toHaveLength(0);
    expect(result.totalSupply).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it("returns empty roster when nftContractId is empty", async () => {
    const result = await fetchMemberRoster({
      nftContractId: "",
    });

    expect(result.members).toHaveLength(0);
    expect(result.totalSupply).toBe(0);
  });

  it("fetches single holder with multiple tokens", async () => {
    const mockClient = {
      get_total_supply: vi.fn().mockResolvedValue({ result: 2n }),
      owner_of: vi.fn().mockImplementation(({ token_id }: { token_id: number }) => {
        return Promise.resolve({ result: "G_ALICE" });
      }),
    };

    const result = await fetchMemberRoster({
      nftContractId: "CNFT_TEST",
      client: mockClient,
    });

    expect(result.totalSupply).toBe(2);
    expect(result.members).toHaveLength(1);
    expect(result.members[0]).toEqual({
      address: "G_ALICE",
      tokenIds: [0, 1],
      tokenCount: 2,
    });
  });

  it("groups tokens by owner and sorts by token count descending", async () => {
    const mockClient = {
      get_total_supply: vi.fn().mockResolvedValue({ result: 3n }),
      owner_of: vi.fn().mockImplementation(({ token_id }: { token_id: number }) => {
        if (token_id === 0) return Promise.resolve({ result: "G_BOB" });
        if (token_id === 1) return Promise.resolve({ result: "G_ALICE" });
        if (token_id === 2) return Promise.resolve({ result: "G_ALICE" });
        return Promise.reject(new Error("Unknown token"));
      }),
    };

    const result = await fetchMemberRoster({
      nftContractId: "CNFT_TEST",
      client: mockClient,
    });

    expect(result.totalSupply).toBe(3);
    expect(result.members).toHaveLength(2);
    // Alice has 2 tokens, Bob has 1
    expect(result.members[0].address).toBe("G_ALICE");
    expect(result.members[0].tokenCount).toBe(2);
    expect(result.members[0].tokenIds).toEqual([1, 2]);

    expect(result.members[1].address).toBe("G_BOB");
    expect(result.members[1].tokenCount).toBe(1);
    expect(result.members[1].tokenIds).toEqual([0]);
  });

  it("handles RPC errors on individual token queries gracefully", async () => {
    const mockClient = {
      get_total_supply: vi.fn().mockResolvedValue({ result: 2n }),
      owner_of: vi.fn().mockImplementation(({ token_id }: { token_id: number }) => {
        if (token_id === 0) return Promise.resolve({ result: "G_ALICE" });
        return Promise.reject(new Error("RPC timeout"));
      }),
    };

    const result = await fetchMemberRoster({
      nftContractId: "CNFT_TEST",
      client: mockClient,
    });

    expect(result.members).toHaveLength(1);
    expect(result.members[0].address).toBe("G_ALICE");
  });

  it("respects maxTokensToQuery limit and flags hasMore", async () => {
    const mockClient = {
      get_total_supply: vi.fn().mockResolvedValue({ result: 100n }),
      owner_of: vi.fn().mockResolvedValue({ result: "G_MEMBER" }),
    };

    const result = await fetchMemberRoster({
      nftContractId: "CNFT_TEST",
      client: mockClient,
      maxTokensToQuery: 10,
    });

    expect(result.totalSupply).toBe(100);
    expect(result.hasMore).toBe(true);
    expect(mockClient.owner_of).toHaveBeenCalledTimes(10);
  });
});
