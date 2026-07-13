import Link from "next/link";

const footerLinks = {
  product: [
    { href: "/community", label: "Community" },
    { href: "/proposals", label: "Proposals" },
  ],
  resources: [
    {
      href: "https://developers.stellar.org/docs/build/smart-contracts",
      label: "Soroban Docs",
      external: true,
    },
    {
      href: "https://docs.openzeppelin.com/stellar-contracts",
      label: "OpenZeppelin Stellar",
      external: true,
    },
    {
      href: "https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0050.md",
      label: "SEP-0050 NFT",
      external: true,
    },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-[#0b0f19]">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-slate-100">
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
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
              NFT-gated community governance for Stellar projects. Launch
              membership collections and run transparent on-chain votes.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-100">Product</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-400 transition-colors hover:text-indigo-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-100">Resources</h3>
            <ul className="mt-4 space-y-2">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-400 transition-colors hover:text-indigo-300"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-100">Network</h3>
            <p className="mt-4 text-sm text-slate-400">
              Currently deployed on{" "}
              <span className="font-medium text-indigo-300">Stellar Testnet</span>
              . Mainnet support planned after audit.
            </p>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-8 sm:flex-row">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} Stolla. Open source under MIT.
          </p>
          <p className="text-xs text-slate-600">
            Built with Soroban · OpenZeppelin · Next.js
          </p>
        </div>
      </div>
    </footer>
  );
}
