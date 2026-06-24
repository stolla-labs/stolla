const STACK = [
  {
    label: "Blockchain",
    value: "Stellar Testnet",
    detail: "Fast finality, low fees, ideal for iterative governance testing.",
  },
  {
    label: "Smart contracts",
    value: "Soroban (Rust)",
    detail: "NFT minting, delegation, and Governor logic run on-chain.",
  },
  {
    label: "Contracts",
    value: "OpenZeppelin",
    detail: "NonFungibleVotes and Governor modules composed for Stolla.",
  },
  {
    label: "Wallet",
    value: "Freighter",
    detail: "Sign mint, delegate, propose, and vote transactions from the browser.",
  },
] as const;

export function TechnologySection() {
  return (
    <section id="technology" className="landing-section landing-section-alt">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-start">
          <div>
            <p className="landing-eyebrow">Technology</p>
            <h2 className="landing-section-title">
              Powered by the Stellar stack
            </h2>
            <p className="mt-4 text-[var(--lp-text-muted)]">
              Stolla is a decentralized application. The UI is a window into
              Soroban contract state. Nothing critical happens off-chain.
            </p>
            <div className="landing-accent-card mt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--lp-accent)]">
                Why Stellar?
              </p>
              <p className="mt-3 text-sm leading-relaxed text-[var(--lp-text-muted)]">
                Sub-second confirmation, predictable fees, and a mature wallet
                ecosystem make Stellar a strong fit for community governance and
                NFT membership flows.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {STACK.map((item) => (
              <article key={item.label} className="landing-tech-card lp-card p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--lp-text-muted)]">
                  {item.label}
                </p>
                <p className="mt-2 text-lg">{item.value}</p>
                <p className="mt-2 text-sm leading-relaxed text-[var(--lp-text-muted)]">
                  {item.detail}
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
