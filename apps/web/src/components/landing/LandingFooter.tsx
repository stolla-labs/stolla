"use client";

import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { scrollToSection } from "@/lib/scroll";

const PRODUCT_LINKS = [
  { href: "/community", label: "Community" },
  { href: "/proposals", label: "Proposals" },
  { section: "features", label: "Features" },
  { section: "showcase", label: "Showcase" },
  { section: "how-it-works", label: "How it works" },
  { section: "faq", label: "FAQ" },
] as const;

const RESOURCE_LINKS = [
  { href: "https://stellar.org", label: "Stellar" },
  { href: "https://developers.stellar.org", label: "Developers" },
  {
    href: "https://developers.stellar.org/docs/build/smart-contracts",
    label: "Soroban docs",
  },
  {
    href: "https://docs.openzeppelin.com/stellar-contracts",
    label: "OpenZeppelin Stellar",
  },
] as const;

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="landing-footer">
      <div className="landing-container py-14 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="landing-logo-mark" aria-hidden="true">
                S
              </span>
              <span>
                <p className="text-sm font-semibold">Stolla</p>
                <p className="text-xs text-[var(--lp-text-muted)]">
                  Community Governance
                </p>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--lp-text-muted)]">
              NFT-gated DAO voting for Stellar projects. Deploy membership
              collections, delegate voting power, and govern transparently on
              testnet.
            </p>
            <div className="mt-5">
              <LinkButton href="/community">Launch app</LinkButton>
            </div>
          </div>

          <div className="lg:col-span-3">
            <h3 className="landing-footer-heading">Product</h3>
            <ul className="landing-footer-list">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.label}>
                  {"href" in link ? (
                    <Link href={link.href} className="landing-footer-link">
                      {link.label}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="landing-footer-link"
                      onClick={() => scrollToSection(link.section)}
                    >
                      {link.label}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-5">
            <h3 className="landing-footer-heading">Resources</h3>
            <ul className="landing-footer-list">
              {RESOURCE_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="landing-footer-link"
                  >
                    {link.label} ↗
                  </a>
                </li>
              ))}
            </ul>
            <div className="landing-footer-notice">
              <p className="font-medium text-[var(--lp-text)]">Stellar Testnet</p>
              <p className="mt-0.5">
                Test XLM only. Signaling votes only. No mainnet funds.
              </p>
            </div>
          </div>
        </div>

        <div className="landing-footer-bottom mt-10 flex flex-col gap-3 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--lp-text-muted)]">
            © {year} Stolla. Open source under MIT.
          </p>
          <p className="text-sm text-[var(--lp-text-muted)]">
            Built with Soroban · OpenZeppelin · Next.js
          </p>
        </div>
      </div>
    </footer>
  );
}
