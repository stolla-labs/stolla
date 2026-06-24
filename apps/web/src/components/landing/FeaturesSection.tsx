const FEATURES = [
  {
    icon: "01",
    title: "NFT-gated voting",
    description:
      "One membership NFT equals one vote. Voting power follows ownership with checkpoint-based snapshots.",
  },
  {
    icon: "02",
    title: "OpenZeppelin Governor",
    description:
      "Proposal lifecycle, voting windows, and tallying run on a composed Soroban Governor contract.",
  },
  {
    icon: "03",
    title: "Wallet-native",
    description:
      "Connect Freighter, sign mint, delegate, and vote transactions yourself. Full custody at all times.",
  },
  {
    icon: "04",
    title: "Full transparency",
    description:
      "Every mint, delegation, and vote is verifiable on Stellar testnet. No off-chain trust required.",
  },
  {
    icon: "05",
    title: "IPFS metadata",
    description:
      "SEP-0050 compatible per-token URIs for rich membership badges and community identity.",
  },
  {
    icon: "06",
    title: "Flash-loan safe",
    description:
      "Checkpoint voting power prevents last-minute manipulation. Delegation required before votes count.",
  },
] as const;

export function FeaturesSection() {
  return (
    <section id="features" className="landing-section">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-12 max-w-2xl">
          <p className="landing-eyebrow">Features</p>
          <h2 className="landing-section-title">
            Built for transparent community governance
          </h2>
          <p className="mt-4 text-[var(--lp-text-muted)]">
            Stolla combines battle-tested contracts with a fast web experience on
            Stellar&apos;s low-fee ledger.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article
              key={feature.title}
              className="landing-feature-card lp-card p-6"
            >
              <span className="landing-feature-icon" aria-hidden="true">
                {feature.icon}
              </span>
              <h3 className="mt-5 text-xl">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--lp-text-muted)]">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
