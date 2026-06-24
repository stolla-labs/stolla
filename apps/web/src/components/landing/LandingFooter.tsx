import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";

const PRODUCT_LINKS = [
  { href: "/community", label: "Community" },
  { href: "/proposals", label: "Proposals" },
  { section: "features", label: "Features" },
  { section: "showcase", label: "Showcase" },
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
      <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Link href="/" className="block text-left transition-opacity hover:opacity-85">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--lp-accent)]">
                Stolla
              </p>
              <p className="mt-1 font-[family-name:var(--lp-font-display)] text-2xl">
                Community Governance
              </p>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-[var(--lp-text-muted)]">
              NFT-gated DAO voting for Stellar projects. Deploy membership
              collections, delegate voting power, and govern transparently on
              testnet.
            </p>
            <div className="mt-6">
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
                    <a href={`/#${link.section}`} className="landing-footer-link">
                      {link.label}
                    </a>
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
              <p className="mt-1">Test XLM only. Signaling votes — no mainnet funds.</p>
            </div>
          </div>
        </div>

        <div className="landing-footer-bottom mt-12 flex flex-col gap-4 pt-8 sm:flex-row sm:items-center sm:justify-between">
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
