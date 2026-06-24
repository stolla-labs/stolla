import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";

const FEATURES = [
  {
    title: "NFT-gated voting",
    description:
      "One membership NFT equals one vote. Voting power follows ownership with checkpoint-based snapshots.",
  },
  {
    title: "OpenZeppelin Governor",
    description:
      "Proposal lifecycle, voting windows, and tallying run on a composed Soroban Governor contract.",
  },
  {
    title: "Wallet-native",
    description:
      "Connect Freighter, sign mint, delegate, and vote transactions yourself. Full custody at all times.",
  },
  {
    title: "Full transparency",
    description:
      "Every mint, delegation, and vote is verifiable on Stellar testnet. No off-chain trust required.",
  },
  {
    title: "IPFS metadata",
    description:
      "SEP-0050 compatible per-token URIs for rich membership badges and community identity.",
  },
  {
    title: "Flash-loan safe",
    description:
      "Checkpoint voting power prevents last-minute manipulation. Delegation required before votes count.",
  },
] as const;

export function FeaturesSection() {
  return (
    <section id="features" className="landing-section">
      <div className="landing-container">
        <LandingSectionHeader
          eyebrow="Features"
          title="Built for transparent community governance"
          description="Battle-tested contracts with a fast web experience on Stellar&apos;s low-fee ledger."
        />

        <div className="landing-features-grid">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="landing-feature-card lp-card">
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
