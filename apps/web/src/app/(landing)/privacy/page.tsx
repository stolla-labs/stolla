export default function PrivacyPage() {
  return <article className="landing-container max-w-3xl py-28">
    <p className="landing-eyebrow">Privacy</p>
    <h1 className="landing-section-title">Privacy-safe product analytics</h1>
    <div className="mt-6 space-y-4 text-sm leading-7 text-[var(--lp-text-muted)]">
      <p>Product analytics are disabled by default. When an operator explicitly enables them, Stolla records page paths and a small set of funnel actions: landing CTA, community creation, membership claim, and first confirmed vote.</p>
      <p>Stolla does not collect seed phrases, private keys, raw wallet addresses, transaction contents, session replay, or typed proposal content. Wallet correlation, if a deployment opts into it later, must use the one-way anonymization helper.</p>
      <p>Events use a pluggable sink so self-hosted deployments can keep operational data under their own control. No analytics data is sold.</p>
    </div>
  </article>;
}

