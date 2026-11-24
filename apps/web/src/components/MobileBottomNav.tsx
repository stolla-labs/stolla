"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useWallet } from "@/context/WalletProvider";

type NavItem = {
  key: "explore" | "inbox" | "activity";
  href: string;
  label: string;
  paths: string[];
};

export const mobileNavItems: NavItem[] = [
  { key: "explore", href: "/communities", label: "Explore", paths: ["/communities", "/community", "/proposals"] },
  { key: "inbox", href: "/activity?view=inbox", label: "Inbox", paths: [] },
  { key: "activity", href: "/activity", label: "Activity", paths: ["/activity"] },
];

export function isMobileNavItemActive(pathname: string, item: NavItem, view?: string | null): boolean {
  if (item.key === "inbox") return pathname === "/activity" && view === "inbox";
  if (item.key === "activity" && (view === "inbox" || view === "account")) return false;
  return item.paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function NavIcon({ kind }: { kind: NavItem["key"] | "account" }) {
  const path = {
    explore: "M4 6h16M4 12h10M4 18h7",
    inbox: "M4 5h16v13H4zM4 13h4l2 2h4l2-2h4",
    activity: "M4 13h3l2-6 4 10 2-5h5",
    account: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0",
  }[kind];
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d={path} strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/** Visible below Tailwind's md breakpoint (768px). */
export function MobileBottomNav() {
  const pathname = usePathname();
  const view = useSearchParams().get("view");
  const { address, connect, isConnecting } = useWallet();

  const itemClass = (active: boolean) =>
    `flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[11px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${active ? "bg-indigo-500/15 text-indigo-300" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"}`;

  return (
    <nav
      aria-label="Member shortcuts"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-700/90 bg-[#0b0f19]/95 px-2 pt-2 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-md gap-1">
        {mobileNavItems.map((item) => (
          <Link key={item.key} href={item.href} aria-current={isMobileNavItemActive(pathname, item, view) ? "page" : undefined} className={itemClass(isMobileNavItemActive(pathname, item, view))}>
            <NavIcon kind={item.key} />
            <span>{item.label}</span>
          </Link>
        ))}
        {address ? (
          <Link href="/activity?view=account" aria-current={pathname === "/activity" && view === "account" ? "page" : undefined} className={itemClass(pathname === "/activity" && view === "account")}>
            <NavIcon kind="account" />
            <span>Account</span>
          </Link>
        ) : (
          <button type="button" onClick={() => void connect()} disabled={isConnecting} className={itemClass(false)}>
            <NavIcon kind="account" />
            <span>{isConnecting ? "Connecting" : "Connect"}</span>
          </button>
        )}
      </div>
    </nav>
  );
}

