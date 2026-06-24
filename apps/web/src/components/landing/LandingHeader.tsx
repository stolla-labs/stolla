"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLandingHeader } from "@/hooks/useLandingHeader";
import { scrollToSection } from "@/lib/scroll";

const SECTION_LINKS = [
  { id: "features", label: "Features" },
  { id: "showcase", label: "Showcase" },
  { id: "how-it-works", label: "How it works" },
  { id: "technology", label: "Technology" },
  { id: "faq", label: "FAQ" },
] as const;

const SECTION_IDS = SECTION_LINKS.map((link) => link.id);

export function LandingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrolled, activeSection } = useLandingHeader(SECTION_IDS);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  function handleNavClick(id: string) {
    scrollToSection(id);
    setMenuOpen(false);
  }

  return (
    <header
      className={`landing-header ${scrolled ? "landing-header-scrolled" : ""}`}
    >
      <div className="landing-header-inner">
        <button
          type="button"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" });
            setMenuOpen(false);
          }}
          className="landing-header-brand"
          aria-label="Scroll to top"
        >
          <span className="landing-logo-mark" aria-hidden="true">
            S
          </span>
          <span>
            <p className="text-sm font-semibold leading-tight">Stolla</p>
            <p className="text-xs text-[var(--lp-text-muted)]">
              Community Governance
            </p>
          </span>
        </button>

        <button
          type="button"
          className="landing-menu-toggle lg:hidden"
          aria-expanded={menuOpen}
          aria-controls="landing-nav"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path
                d="M4 4L14 14M14 4L4 14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path
                d="M3 5H15M3 9H15M3 13H15"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>

        {menuOpen ? (
          <button
            type="button"
            className="landing-menu-backdrop lg:hidden"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
        ) : null}

        <nav
          id="landing-nav"
          className={`landing-header-nav ${menuOpen ? "landing-header-nav-open" : ""}`}
          aria-label="Landing sections"
        >
          {SECTION_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              className={`landing-nav-link ${activeSection === link.id ? "landing-nav-link-active" : ""}`}
              aria-current={activeSection === link.id ? "location" : undefined}
              onClick={() => handleNavClick(link.id)}
            >
              {link.label}
            </button>
          ))}
          <Link
            href="/community"
            className="landing-nav-mobile-cta lp-btn"
            onClick={() => setMenuOpen(false)}
          >
            Enter app
          </Link>
        </nav>

        <Link href="/community" className="lp-btn hidden lg:inline-flex">
          Enter app
        </Link>
      </div>
    </header>
  );
}
