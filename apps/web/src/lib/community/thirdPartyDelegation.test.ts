import { describe, expect, it, vi } from "vitest";
import { Keypair } from "@stellar/stellar-sdk";
import {
  clearRecentDelegates,
  describeCurrentDelegatee,
  executeThirdPartyDelegation,
  isValidStellarAccountAddress,
  readRecentDelegates,
  rememberRecentDelegate,
  validateThirdPartyDelegatee,
} from "./thirdPartyDelegation";

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, val: string) => {
      map.set(key, val);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

describe("third-party delegation UX validation & recent delegates (#388)", () => {
  const selfAddress = Keypair.random().publicKey();
  const thirdPartyA = Keypair.random().publicKey();
  const thirdPartyB = Keypair.random().publicKey();

  it("rejects empty, malformed, and invalid-checksum G... addresses so wallet never opens", async () => {
    expect(isValidStellarAccountAddress("")).toBe(false);
    expect(isValidStellarAccountAddress("C" + thirdPartyA.slice(1))).toBe(false);
    // Flip last character to corrupt CRC16 checksum
    const badChecksum =
      thirdPartyA.slice(0, -1) + (thirdPartyA.endsWith("A") ? "B" : "A");
    expect(isValidStellarAccountAddress(badChecksum)).toBe(false);

    const submitDelegation = vi.fn();
    const onRefresh = vi.fn();

    const invalidAttempt = await executeThirdPartyDelegation({
      input: badChecksum,
      connectedAccount: selfAddress,
      currentDelegatee: null,
      submitDelegation,
      onRefresh,
    });
    expect(invalidAttempt.ok).toBe(false);
    if (!invalidAttempt.ok) {
      expect(invalidAttempt.code).toBe("invalid-address");
    }
    expect(submitDelegation).not.toHaveBeenCalled();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("rejects same-as-self and unchanged delegatee addresses before wallet invocation", async () => {
    const submitDelegation = vi.fn();
    const onRefresh = vi.fn();

    const selfAttempt = await executeThirdPartyDelegation({
      input: selfAddress,
      connectedAccount: selfAddress,
      currentDelegatee: null,
      submitDelegation,
      onRefresh,
    });
    expect(selfAttempt.ok).toBe(false);
    if (!selfAttempt.ok) {
      expect(selfAttempt.code).toBe("same-as-self");
      expect(selfAttempt.error).toContain("Delegate to self");
    }

    const unchangedAttempt = validateThirdPartyDelegatee({
      input: thirdPartyA,
      connectedAccount: selfAddress,
      currentDelegatee: thirdPartyA,
    });
    expect(unchangedAttempt.valid).toBe(false);
    if (!unchangedAttempt.valid) {
      expect(unchangedAttempt.code).toBe("unchanged");
    }
    expect(submitDelegation).not.toHaveBeenCalled();
  });

  it("describes current delegatee visibly before change and refreshes after confirmed delegation", async () => {
    expect(describeCurrentDelegatee(selfAddress, null)).toBe("None (undelegated)");
    expect(describeCurrentDelegatee(selfAddress, selfAddress)).toBe(
      `Self (${selfAddress})`,
    );
    expect(describeCurrentDelegatee(selfAddress, thirdPartyA)).toBe(thirdPartyA);

    const storage = createMemoryStorage();
    const submitDelegation = vi.fn().mockResolvedValue(undefined);
    const onRefresh = vi.fn().mockResolvedValue(true);

    const outcome = await executeThirdPartyDelegation({
      input: `  ${thirdPartyA}  `,
      connectedAccount: selfAddress,
      currentDelegatee: selfAddress,
      rememberLocally: true,
      storage,
      submitDelegation,
      onRefresh,
    });

    expect(outcome).toEqual({
      ok: true,
      delegatee: thirdPartyA,
      recentDelegates: [thirdPartyA],
    });
    expect(submitDelegation).toHaveBeenCalledWith(thirdPartyA);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("stores recent delegates locally with deduplication and supports clearing", () => {
    const storage = createMemoryStorage();
    expect(readRecentDelegates(storage)).toEqual([]);

    rememberRecentDelegate(thirdPartyA, storage);
    rememberRecentDelegate(thirdPartyB, storage);
    rememberRecentDelegate(thirdPartyA, storage); // moves thirdPartyA to front without duplicating

    expect(readRecentDelegates(storage)).toEqual([thirdPartyA, thirdPartyB]);

    clearRecentDelegates(storage);
    expect(readRecentDelegates(storage)).toEqual([]);
  });
});
