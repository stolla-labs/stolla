import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrKey } from "@stellar/stellar-sdk";
import {
  clearRecentDelegates,
  loadRecentDelegates,
  saveRecentDelegate,
  validateDelegateeAddress,
} from "@/lib/community/delegationUx";
import { ThirdPartyDelegationPanel } from "../ThirdPartyDelegationPanel";

const SELF_ADDR = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(1));
const OTHER_ADDR_1 = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(2));
const OTHER_ADDR_2 = StrKey.encodeEd25519PublicKey(new Uint8Array(32).fill(3));
const CONTRACT_ID = "CCOMMUNITYNFTCONTRACT1234567890";

describe("ThirdPartyDelegationPanel & delegationUx (#388)", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("validates invalid, empty, same-as-self, and already-delegated addresses", () => {
    expect(validateDelegateeAddress("", SELF_ADDR, null)).toMatchObject({
      ok: false,
      reason: "empty",
    });
    expect(
      validateDelegateeAddress("not-a-stellar-key", SELF_ADDR, null),
    ).toMatchObject({
      ok: false,
      reason: "invalid_address",
    });
    expect(
      validateDelegateeAddress(SELF_ADDR, SELF_ADDR, null),
    ).toMatchObject({
      ok: false,
      reason: "same_as_self",
    });
    expect(
      validateDelegateeAddress(OTHER_ADDR_1, SELF_ADDR, OTHER_ADDR_1),
    ).toMatchObject({
      ok: false,
      reason: "already_delegated",
    });
    expect(
      validateDelegateeAddress(`  ${OTHER_ADDR_1}  `, SELF_ADDR, SELF_ADDR),
    ).toEqual({
      ok: true,
      address: OTHER_ADDR_1,
    });
  });

  it("never calls onDelegateToAddress for invalid or same-as-self addresses", () => {
    const onDelegate = vi.fn().mockResolvedValue(true);
    render(
      <ThirdPartyDelegationPanel
        account={SELF_ADDR}
        currentDelegate={SELF_ADDR}
        nftContractId={CONTRACT_ID}
        onDelegateToAddress={onDelegate}
      />,
    );

    expect(screen.getByTestId("current-delegate-status")).toHaveTextContent(
      /Current delegate:\s*Self/i,
    );

    const input = screen.getByLabelText(/Delegatee Stellar address/i);
    const submitButton = screen.getByRole("button", {
      name: /Delegate to address/i,
    });

    // Invalid G... address
    fireEvent.change(input, { target: { value: "GINVALID123" } });
    fireEvent.click(submitButton);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /Invalid Stellar address/i,
    );
    expect(onDelegate).not.toHaveBeenCalled();

    // Same-as-self address
    fireEvent.change(input, { target: { value: SELF_ADDR } });
    fireEvent.click(submitButton);
    expect(screen.getByRole("alert")).toHaveTextContent(
      /That is your own wallet address/i,
    );
    expect(onDelegate).not.toHaveBeenCalled();
  });

  it("shows confirmation summary before change, records recent delegates on success, and supports clearing", async () => {
    saveRecentDelegate(CONTRACT_ID, OTHER_ADDR_2);
    expect(loadRecentDelegates(CONTRACT_ID)).toEqual([OTHER_ADDR_2]);

    const onDelegate = vi.fn().mockResolvedValue(true);
    render(
      <ThirdPartyDelegationPanel
        account={SELF_ADDR}
        currentDelegate={null}
        nftContractId={CONTRACT_ID}
        onDelegateToAddress={onDelegate}
      />,
    );

    expect(screen.getByTestId("current-delegate-status")).toHaveTextContent(
      /None \(undelegated\)/i,
    );
    expect(screen.getByTestId("recent-delegates-section")).toBeInTheDocument();

    const input = screen.getByLabelText(/Delegatee Stellar address/i);
    fireEvent.change(input, { target: { value: OTHER_ADDR_1 } });

    // Confirm summary appears before submitting
    expect(
      screen.getByTestId("delegation-confirm-summary"),
    ).toHaveTextContent(/Confirm delegation change/i);

    fireEvent.click(
      screen.getByRole("button", { name: /Delegate to address/i }),
    );

    await waitFor(() => {
      expect(onDelegate).toHaveBeenCalledWith(OTHER_ADDR_1);
    });

    expect(loadRecentDelegates(CONTRACT_ID)).toEqual([
      OTHER_ADDR_1,
      OTHER_ADDR_2,
    ]);

    // Clear recent delegates list
    fireEvent.click(screen.getByRole("button", { name: /Clear recent/i }));
    expect(loadRecentDelegates(CONTRACT_ID)).toEqual([]);
    expect(
      screen.queryByTestId("recent-delegates-section"),
    ).not.toBeInTheDocument();

    clearRecentDelegates(CONTRACT_ID);
  });
});
