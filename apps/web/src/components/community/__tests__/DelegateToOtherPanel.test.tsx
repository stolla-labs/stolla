import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DelegateToOtherPanel } from "../DelegateToOtherPanel";
import {
  RECENT_DELEGATES_STORAGE_KEY,
  loadRecentDelegates,
} from "@/lib/community/recent-delegates";

const SELF = "GDXYOPJQBJZD67ZREH2ALO55L4DTY6XXPZLSZI72V4CJQM5LRRS3D2M3";
const OTHER = "GAWDU43EJGJQY6JTUJVLENDMEAFWCCKWJFC4562RVWH6ZH2YM6ZYUUIB";
const CURRENT = "GCAT6V5EPSVLRV2SRWW6XR4FMVYGNP57ZNGVWOTQUZKASW6QQ6QW62FR";

function setup(onDelegate = vi.fn().mockResolvedValue(true), currentDelegate = CURRENT) {
  render(
    <DelegateToOtherPanel
      account={SELF}
      currentDelegate={currentDelegate}
      balance={3}
      onDelegate={onDelegate}
    />,
  );
  return onDelegate;
}

function enter(value: string) {
  fireEvent.change(screen.getByLabelText("Delegate address"), {
    target: { value },
  });
  fireEvent.click(screen.getByRole("button", { name: "Review delegation" }));
}

describe("DelegateToOtherPanel", () => {
  beforeEach(() => window.localStorage.clear());

  it("shows the current delegate before any change", () => {
    setup();
    expect(screen.getByTestId("current-delegate")).toHaveTextContent(CURRENT);
  });

  it("never reaches the wallet for an invalid address", () => {
    const onDelegate = setup();
    enter("GINVALID");
    expect(screen.getByRole("alert")).toHaveTextContent(/valid Stellar G address/);
    expect(screen.queryByRole("group", { name: "Delegation summary" })).toBeNull();
    expect(onDelegate).not.toHaveBeenCalled();
  });

  it("rejects the connected account as a third-party delegate", () => {
    const onDelegate = setup();
    enter(SELF);
    expect(screen.getByRole("alert")).toHaveTextContent(/Delegate to self/);
    expect(onDelegate).not.toHaveBeenCalled();
  });

  it("rejects the address that is already the current delegate", () => {
    const onDelegate = setup();
    enter(CURRENT);
    expect(screen.getByRole("alert")).toHaveTextContent(/already delegated/);
    expect(onDelegate).not.toHaveBeenCalled();
  });

  it("requires confirmation, then delegates and remembers the address", async () => {
    const onDelegate = setup();
    enter(OTHER);

    const summary = screen.getByRole("group", { name: "Delegation summary" });
    expect(summary).toHaveTextContent(OTHER);
    expect(summary).toHaveTextContent(CURRENT);
    expect(onDelegate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Confirm delegation" }));

    await waitFor(() => expect(onDelegate).toHaveBeenCalledWith(OTHER));
    await waitFor(() => expect(loadRecentDelegates()).toEqual([OTHER]));
    expect(screen.getByLabelText("Delegate address")).toHaveValue("");
  });

  it("does not remember the address when delegation fails", async () => {
    const onDelegate = setup(vi.fn().mockResolvedValue(false));
    enter(OTHER);
    fireEvent.click(screen.getByRole("button", { name: "Confirm delegation" }));

    await waitFor(() => expect(onDelegate).toHaveBeenCalledTimes(1));
    expect(window.localStorage.getItem(RECENT_DELEGATES_STORAGE_KEY)).toBeNull();
  });

  it("lists recent delegates, fills the input on click, and clears them", () => {
    window.localStorage.setItem(
      RECENT_DELEGATES_STORAGE_KEY,
      JSON.stringify([OTHER]),
    );
    setup();

    fireEvent.click(screen.getByRole("button", { name: OTHER }));
    expect(screen.getByLabelText("Delegate address")).toHaveValue(OTHER);

    fireEvent.click(
      screen.getByRole("button", { name: "Clear recent delegates" }),
    );
    expect(screen.queryByLabelText("Recent delegates")).toBeNull();
    expect(loadRecentDelegates()).toEqual([]);
  });
});
