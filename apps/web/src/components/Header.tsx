"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/context/WalletProvider";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/community", label: "Community" },
  { href: "/proposals", label: "Proposals" },
];

export function Header() {
  const pathname = usePathname();
  const { address, connect, disconnect, isConnecting } = useWallet();
  const isHome = pathname === "/";

  return (
    <header
      className={
        isHome
          ? "absolute inset-x-0 top-0 z-50 border-b border-white/10 bg-zinc-950/30 backdrop-blur-md"
          : "sticky top-0 z-50 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md"
      }
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:py-4">
        <div className="flex min-w-0 items-center gap-5 sm:gap-8">
          <Link
            href="/"
            className={`shrink-0 text-lg font-semibold ${isHome ? "text-white" : "text-zinc-900"}`}
          >
            Stolla
          </Link>
          <nav className="flex gap-1 sm:gap-2">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-2.5 py-1.5 text-sm transition-colors sm:px-3 ${
                    isActive
                      ? isHome
                        ? "bg-white/15 font-medium text-white"
                        : "bg-indigo-50 font-medium text-indigo-700"
                      : isHome
                        ? "text-zinc-300 hover:bg-white/10 hover:text-white"
                        : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {address ? (
            <>
              <span
                className={`hidden truncate text-xs sm:inline sm:max-w-[180px] ${isHome ? "text-zinc-400" : "text-zinc-500"}`}
              >
                {address}
              </span>
              <button
                type="button"
                onClick={disconnect}
                className={
                  isHome
                    ? "rounded-lg border border-white/20 px-3 py-1.5 text-sm text-zinc-200 transition hover:bg-white/10"
                    : "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition hover:bg-zinc-50"
                }
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={connect}
              disabled={isConnecting}
              className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50 sm:px-4"
            >
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
