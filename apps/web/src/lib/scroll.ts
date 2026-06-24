const LANDING_HEADER_OFFSET = 72;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (!el) return;

  const top =
    el.getBoundingClientRect().top + window.scrollY - LANDING_HEADER_OFFSET;

  window.scrollTo({
    top,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });

  history.replaceState(null, "", `#${id}`);
}

export function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: prefersReducedMotion() ? "auto" : "smooth",
  });
  history.replaceState(null, "", window.location.pathname);
}

export function getScrollProgress() {
  const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
  const max = scrollHeight - clientHeight;
  if (max <= 0) return 0;
  return Math.min(1, scrollTop / max);
}
