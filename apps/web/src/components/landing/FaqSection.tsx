"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";

const FAQ = [
  {
    question: "Do I need an account to use Stolla?",
    answer:
      "No. Connect a Stellar wallet such as Freighter. Your wallet address is your identity in the community.",
  },
  {
    question: "Who can create proposals?",
    answer:
      "Members with enough delegated voting power can create proposals. Each community defines the threshold through its Governor settings.",
  },
  {
    question: "How does voting power work?",
    answer:
      "Each membership NFT grants one vote after you delegate to yourself. The Governor uses checkpoint snapshots so voting power cannot be manipulated at proposal time.",
  },
  {
    question: "What can proposals do in the MVP?",
    answer:
      "MVP proposals are signaling votes with empty on-chain targets. They record community decisions transparently. Timelock and treasury execution are planned for later.",
  },
  {
    question: "How is NFT metadata stored?",
    answer:
      "Each token stores an IPFS metadata URI on-chain (SEP-0050 compatible). In the MVP you paste the URI when minting. An upload helper may come later.",
  },
] as const;

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const triggerRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      triggerRefs.current[index + 1]?.focus();
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      triggerRefs.current[index - 1]?.focus();
    }
  }

  return (
    <section id="faq" className="landing-section">
      <div className="landing-container landing-container-narrow">
        <LandingSectionHeader
          eyebrow="FAQ"
          title="Common questions"
          description="Quick answers before you jump into the app."
          align="center"
        />

        <div className="landing-faq-list">
          {FAQ.map((item, index) => {
            const isOpen = openIndex === index;
            const panelId = `faq-panel-${index}`;
            const buttonId = `faq-button-${index}`;

            return (
              <article
                key={item.question}
                className={`landing-faq-item lp-card ${isOpen ? "landing-faq-item-open" : ""}`}
              >
                <h3>
                  <button
                    id={buttonId}
                    ref={(el) => {
                      triggerRefs.current[index] = el;
                    }}
                    type="button"
                    className="landing-faq-trigger"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    onKeyDown={(event) => handleKeyDown(event, index)}
                  >
                    <span>{item.question}</span>
                    <span className="landing-faq-chevron" aria-hidden="true">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2.5 4.5L6 8L9.5 4.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  hidden={!isOpen}
                  className="landing-faq-panel"
                >
                  <p>{item.answer}</p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
