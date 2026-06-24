const FAQ = [
  {
    question: "Do I need an account to use Stolla?",
    answer:
      "No. You only need a Stellar wallet like Freighter connected to testnet. Your wallet address is your identity on the platform.",
  },
  {
    question: "Is this mainnet or testnet?",
    answer:
      "Stolla currently runs on Stellar testnet. Use testnet XLM from a faucet. Do not send real funds expecting mainnet value.",
  },
  {
    question: "How does voting power work?",
    answer:
      "Each membership NFT grants one vote after you delegate to yourself. The Governor uses checkpoint snapshots so voting power cannot be manipulated at proposal time.",
  },
  {
    question: "What can proposals do in the MVP?",
    answer:
      "MVP proposals are signaling votes with empty on-chain targets. They record community decisions transparently; timelock and treasury execution are planned for later.",
  },
  {
    question: "How is NFT metadata stored?",
    answer:
      "Each token stores an IPFS metadata URI on-chain (SEP-0050 compatible). In the MVP you paste the URI when minting; an upload helper may come later.",
  },
] as const;

export function FaqSection() {
  return (
    <section id="faq" className="landing-section">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-12 max-w-2xl">
          <p className="landing-eyebrow">FAQ</p>
          <h2 className="landing-section-title">Common questions</h2>
          <p className="mt-4 text-[var(--lp-text-muted)]">
            Quick answers before you jump into the app.
          </p>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {FAQ.map((item) => (
            <details key={item.question} className="landing-faq-item lp-card group">
              <summary className="cursor-pointer list-none p-5 font-medium marker:content-none">
                <span className="flex items-start justify-between gap-3">
                  {item.question}
                  <span className="landing-faq-chevron" aria-hidden="true">
                    +
                  </span>
                </span>
              </summary>
              <p className="border-t border-[var(--lp-border)] px-5 pb-5 pt-4 text-sm leading-relaxed text-[var(--lp-text-muted)]">
                {item.answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
