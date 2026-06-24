"use client";

import Link from "next/link";
import { useWallet } from "@/context/WalletProvider";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/community", label: "Community" },
  { href: "/proposals", label: "Proposals" },
];

export function Header() {
  const { address, connect, disconnect, isConnecting } = useWallet();

  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold text-zinc-900">
            Stolla
          </Link>
          <nav className="flex gap-4 text-sm text-zinc-600">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="hover:text-zinc-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {address ? (
            <>
              <span className="truncate text-xs text-zinc-500 sm:max-w-[200px]">
                {address}
              </span>
              <button
                type="button"
                onClick={disconnect}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={connect}
              disabled={isConnecting}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
