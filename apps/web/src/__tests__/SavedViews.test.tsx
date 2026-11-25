import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  useWallet: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/communities/alpha/proposals",
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

vi.mock("@/context/WalletProvider", () => ({ useWallet: mocks.useWallet }));

import { SavedViews } from "@/components/proposals/SavedViews";
import { GLOBAL_SCOPE, readSavedViews } from "@/lib/saved-views";

const WALLET = "GWALLETA";
const COMMUNITY = "alpha";

function withSearch(search: string) {
  window.history.replaceState({}, "", `/communities/alpha/proposals${search}`);
}

function saveCurrentFiltersAs(name: string) {
  fireEvent.click(screen.getByTestId("save-current-view"));
  fireEvent.change(screen.getByTestId("saved-view-name"), { target: { value: name } });
  fireEvent.click(screen.getByTestId("confirm-save-view"));
}

beforeEach(() => {
  localStorage.clear();
  mocks.replace.mockClear();
  mocks.useWallet.mockReturnValue({ address: WALLET });
  withSearch("");
});

describe("SavedViews", () => {
  it("saves the filters in the URL under a name", () => {
    withSearch("?state=active&q=budget");
    render(<SavedViews scope={COMMUNITY} />);

    saveCurrentFiltersAs("Active treasury");

    expect(screen.getByText("Active treasury")).toBeTruthy();
    expect(readSavedViews(WALLET, COMMUNITY)[0].params).toEqual({
      state: "active",
      q: "budget",
    });
  });

  it("puts the view's filters back in the URL when applied", () => {
    withSearch("?state=active&q=budget");
    render(<SavedViews scope={COMMUNITY} />);
    saveCurrentFiltersAs("Active treasury");

    // The filters are the URL's, so applying a view is a navigation and not a
    // piece of component state the next reader cannot see.
    fireEvent.click(screen.getByText("Active treasury"));

    const [target] = mocks.replace.mock.calls.at(-1) ?? [];
    const applied = new URLSearchParams(String(target).split("?")[1]);
    expect(applied.get("state")).toBe("active");
    expect(applied.get("q")).toBe("budget");
  });

  it("marks the view whose filters are the ones showing", () => {
    withSearch("?state=active");
    const { unmount } = render(<SavedViews scope={COMMUNITY} />);
    saveCurrentFiltersAs("Active");
    expect(screen.getByTestId("saved-view-view-active-0").getAttribute("aria-pressed")).toBe("true");
    unmount();

    withSearch("?state=defeated");
    render(<SavedViews scope={COMMUNITY} />);
    expect(screen.getByTestId("saved-view-view-active-0").getAttribute("aria-pressed")).toBe("false");
  });

  it("refuses to save when nothing is filtered", () => {
    render(<SavedViews scope={COMMUNITY} />);

    // Saving the unfiltered list would make a button that does nothing.
    expect(screen.getByTestId("save-current-view").hasAttribute("disabled")).toBe(true);
    expect(screen.getByTestId("saved-views-empty")).toBeTruthy();
  });

  it("says why a save did not happen", () => {
    withSearch("?state=active");
    render(<SavedViews scope={COMMUNITY} />);

    saveCurrentFiltersAs("   ");

    expect(screen.getByTestId("saved-view-problem").textContent).toContain("Give the view a name");
    expect(readSavedViews(WALLET, COMMUNITY)).toEqual([]);
  });

  it("deletes a view and forgets it on the device", () => {
    withSearch("?state=active");
    render(<SavedViews scope={COMMUNITY} />);
    saveCurrentFiltersAs("Active");

    fireEvent.click(screen.getByLabelText("Delete saved view Active"));

    expect(screen.queryByText("Active")).toBeNull();
    expect(readSavedViews(WALLET, COMMUNITY)).toEqual([]);
  });

  it("does not offer one community's views on another's list", () => {
    withSearch("?state=active");
    const { unmount } = render(<SavedViews scope={COMMUNITY} />);
    saveCurrentFiltersAs("Active");
    unmount();

    render(<SavedViews scope="beta" />);

    expect(screen.queryByText("Active")).toBeNull();
    expect(screen.getByTestId("saved-views-empty")).toBeTruthy();
  });

  it("does not offer a community's views on the global inbox", () => {
    withSearch("?state=active");
    const { unmount } = render(<SavedViews scope={COMMUNITY} />);
    saveCurrentFiltersAs("Active");
    unmount();

    render(<SavedViews scope={GLOBAL_SCOPE} />);

    expect(screen.queryByText("Active")).toBeNull();
  });

  it("does not offer another wallet's views", () => {
    withSearch("?state=active");
    const { unmount } = render(<SavedViews scope={COMMUNITY} />);
    saveCurrentFiltersAs("Active");
    unmount();

    mocks.useWallet.mockReturnValue({ address: "GWALLETB" });
    render(<SavedViews scope={COMMUNITY} />);

    expect(screen.queryByText("Active")).toBeNull();
  });

  it("works for a guest with no wallet connected", () => {
    mocks.useWallet.mockReturnValue({ address: null });
    withSearch("?state=active");
    const { unmount } = render(<SavedViews scope={COMMUNITY} />);

    saveCurrentFiltersAs("Active");
    expect(readSavedViews("", COMMUNITY)[0].name).toBe("Active");
    unmount();

    // Still theirs on the next visit, and not the connected wallet's.
    render(<SavedViews scope={COMMUNITY} />);
    expect(screen.getByText("Active")).toBeTruthy();
    expect(readSavedViews(WALLET, COMMUNITY)).toEqual([]);
  });
});
