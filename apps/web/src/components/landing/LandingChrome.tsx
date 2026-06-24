"use client";

import { useEffect, useState } from "react";
import {
  getScrollProgress,
  scrollToSection,
  scrollToTop,
} from "@/lib/scroll";

export function LandingChrome() {
  const [progress, setProgress] = useState(0);
  const [showBackTop, setShowBackTop] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      requestAnimationFrame(() => scrollToSection(hash));
    }

    const onScroll = () => {
      setProgress(getScrollProgress());
      setShowBackTop(window.scrollY > 480);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <div
        className="landing-scroll-progress"
        role="progressbar"
        aria-valuenow={Math.round(progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Page scroll progress"
      >
        <span
          className="landing-scroll-progress-bar"
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>

      <button
        type="button"
        className={`landing-back-top ${showBackTop ? "landing-back-top-visible" : ""}`}
        aria-label="Back to top"
        onClick={scrollToTop}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M8 4L4 8M8 4L12 8M8 4V13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </>
  );
}
