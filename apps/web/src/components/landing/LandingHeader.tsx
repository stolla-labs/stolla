"use client";

import Link from "next/link";
import { scrollToSection } from "@/lib/scroll";

const SECTION_LINKS = [
  { id: "features", label: "Features" },
  { id: "showcase", label: "Showcase" },
  { id: "how-it-works", label: "How it works" },
  { id: "technology", label: "Technology" },
  { id: "faq", label: "FAQ" },
] as const;

export function LandingHeader() {
  return (
    <header className="landing-header">
      <div className="landing-header-inner mx-auto max-w-6xl px-4 py-4">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="landing-header-brand text-left transition-opacity hover:opacity-80"
          aria-label="Scroll to top"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--lp-accent)]">
            Stolla
          </p>
          <p className="font-[family-name:var(--lp-font-display)] text-xl sm:text-2xl">
            Community Governance
          </p>
        </button>

        <nav className="landing-header-nav" aria-label="Landing sections">
          {SECTION_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              className="landing-nav-link"
              onClick={() => scrollToSection(link.id)}
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="landing-header-actions">
          <Link href="/community" className="lp-btn w-full px-5 py-3 min-h-11 sm:w-auto">
            Enter app
          </Link>
        </div>
      </div>
    </header>
  );
}
