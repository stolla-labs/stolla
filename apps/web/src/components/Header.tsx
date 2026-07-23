"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/context/WalletProvider";

const navItems = [
  { href: "/community", label: "Community" },
  { href: "/proposals", label: "Proposals" },
];

export function Header() {
  const pathname = usePathname();
  const { address, connect, disconnect, isConnecting } = useWallet();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#0b0f19]/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap sm:py-4">
        <div className="flex min-w-0 max-w-full items-center gap-3 overflow-x-auto sm:gap-8">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2 text-lg font-semibold text-slate-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/stolla-logo.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 rounded-lg object-cover"
              aria-hidden="true"
            />
            Stolla
          </Link>
          <nav className="flex shrink-0 gap-1 sm:gap-2">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-2.5 py-1.5 text-sm transition-colors sm:px-3 ${
                    isActive
                      ? "bg-indigo-950 font-medium text-indigo-300"
                      : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-100"
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
              <span className="hidden truncate text-xs text-slate-500 sm:inline sm:max-w-[180px]">
                {address}
              </span>
              <button
                type="button"
                onClick={disconnect}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={connect}
              disabled={isConnecting}
              className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-400 disabled:opacity-50 sm:px-4"
            >
              {isConnecting ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
