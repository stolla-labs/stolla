import { LinkButton } from "@/components/ui/Button";

const HIGHLIGHTS = [
  { label: "Deploy", value: "Soroban" },
  { label: "Vote", value: "On-chain" },
  { label: "Cost", value: "Testnet" },
] as const;

export function CtaSection() {
  return (
    <section className="landing-section landing-section-cta">
      <div className="landing-container">
        <div className="landing-cta-split lp-card">
          <div className="landing-cta-main">
            <p className="landing-eyebrow">Get started</p>
            <h2 className="landing-section-title">
              Ready to launch your community?
            </h2>
            <p className="landing-cta-desc">
              Connect Freighter and run your first governance vote on Stellar
              testnet today.
            </p>
            <div className="landing-hero-actions">
              <LinkButton href="/community">Get started</LinkButton>
              <LinkButton href="/proposals" variant="ghost">
                Browse proposals
              </LinkButton>
            </div>
          </div>

          <div className="landing-cta-aside">
            <p className="landing-accent-card-label">Quick facts</p>
            <dl className="landing-cta-facts">
              {HIGHLIGHTS.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
