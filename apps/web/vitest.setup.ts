import "@testing-library/jest-dom/vitest";
import React from "react";
import { vi } from "vitest";

// Node 26 exposes an unconfigured global localStorage that shadows jsdom's
// implementation. Install a deterministic Storage implementation so tests do
// not depend on Node flags or the jsdom origin selected by a test runner.
function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
    getItem(key) {
      return entries.get(String(key)) ?? null;
    },
    key(index) {
      return Array.from(entries.keys())[index] ?? null;
    },
    removeItem(key) {
      entries.delete(String(key));
    },
    setItem(key, value) {
      entries.set(String(key), String(value));
    },
  };
}

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: createMemoryStorage(),
});

// next/link relies on the App Router's context (prefetch scheduler, etc.)
// which isn't present in a jsdom unit test. Component tests only need the
// resulting <a href> and its keyboard-activation semantics, so swap it for
// a plain anchor everywhere.
vi.mock("next/link", () => ({
  default: React.forwardRef<HTMLAnchorElement, React.ComponentProps<"a">>(
    function MockLink({ href, children, ...rest }, ref) {
      return React.createElement("a", { href, ref, ...rest }, children);
    },
  ),
}));

// Unit tests must opt into an explicit fetch double. This fails closed if a
// page or helper accidentally reaches Horizon, Soroban RPC, or metadata URLs.
vi.stubGlobal(
  "fetch",
  vi.fn(() =>
    Promise.reject(
      new Error("Unexpected network request in unit test; inject a test double."),
    ),
  ),
);
