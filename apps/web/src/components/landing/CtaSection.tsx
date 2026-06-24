import { LinkButton } from "@/components/ui/Button";

export function CtaSection() {
  return (
    <section className="landing-section">
      <div className="mx-auto max-w-6xl px-4">
        <div className="landing-cta">
          <div className="landing-cta-inner mx-auto max-w-2xl text-center">
            <p className="landing-eyebrow">Get started</p>
            <h2 className="landing-section-title">
              Ready to launch your community?
            </h2>
            <p className="mt-4 text-[var(--lp-text-muted)]">
              Connect Freighter and run your first governance vote on Stellar
              testnet today.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <LinkButton href="/community">Get started</LinkButton>
              <LinkButton href="/proposals" variant="ghost">
                Browse proposals
              </LinkButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
