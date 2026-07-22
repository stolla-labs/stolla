import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";

const STACK = [
  {
    label: "Blockchain",
    value: "Stellar",
    detail: "Fast settlement and predictable fees for community participation.",
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
      <div className="landing-container">
        <div className="landing-tech-layout">
          <LandingSectionHeader
            eyebrow="Technology"
            title="Powered by the Stellar stack"
            description="Stolla is a decentralized application. The UI is a window into Soroban contract state. Nothing critical happens off-chain."
          />

          <div className="landing-tech-grid">
            {STACK.map((item) => (
              <article key={item.label} className="landing-tech-card lp-card">
                <p className="landing-tech-label">{item.label}</p>
                <p className="landing-tech-value">{item.value}</p>
                <p className="landing-tech-detail">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="landing-accent-card">
          <p className="landing-accent-card-label">Why Stellar?</p>
          <p className="landing-accent-card-text">
            Sub-second confirmation, predictable fees, and a mature wallet
            ecosystem make Stellar a strong fit for community governance and NFT
            membership flows.
          </p>
        </div>
      </div>
    </section>
  );
}
