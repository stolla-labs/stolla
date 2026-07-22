# Stolla Landing Page

## Purpose

The `/` route is a **marketing landing page**, not the app dashboard. It explains the product and drives users to `/community` or `/proposals`.

## Design system

**Professional light**: clean enterprise SaaS aesthetic. White surfaces, slate typography, restrained indigo accent. Trustworthy and readable. No decorative gradients, glass blur, animated marquees, or bold stylistic gimmicks.

| Token | Value | Usage |
|-------|-------|-------|
| `--lp-bg` | `#ffffff` | Page background |
| `--lp-bg-subtle` | `#f8fafc` | Section alternates, hero gradient base |
| `--lp-text` | `#0f172a` | Headings, primary text |
| `--lp-text-muted` | `#64748b` | Body secondary |
| `--lp-accent` | `#4f46e5` | CTAs, eyebrows, logo mark |
| `--lp-accent-subtle` | `#eef2ff` | Badges, icon backgrounds |
| `--lp-border` | `#e2e8f0` | Card and section dividers |
| `--lp-radius-lg` | `0.75rem` | Cards, panels |

Typography: **Inter** (single family for headings and body). Scoped under `.landing-root`.

Utility classes: `.lp-card`, `.lp-btn`, `.lp-btn-ghost`, `.landing-section`, `.landing-eyebrow`, etc. See `apps/web/src/app/landing.css`.

### Visual principles

- Light background with subtle slate section alternates. No dark mode on landing.
- Solid indigo CTAs with modest border-radius. No gradient fills or glow shadows.
- Cards: 1px border + light shadow. No glassmorphism on content cards.
- Status badges use semantic colors (blue/green/amber) for governance preview rows.
- Hero preview panel styled as a product widget (header bar + footer note).
- Logo mark: indigo square with "S", consistent in header and footer.
- Hover: border/shadow refinement only. No image zoom or lift animations.
- **Copy:** Do not use em dashes in landing text. Use periods, commas, or separate sentences.

### UX requirements

- Sticky header with scroll shadow and active section highlight in nav
- Mobile: icon menu toggle, backdrop dismiss, Escape to close, body scroll lock
- Scroll progress bar and back-to-top button after scrolling past hero
- `scroll-padding-top` and header offset when jumping to section anchors; update URL hash
- Skip to content link for keyboard users
- Preview rows, showcase cards, and preview footer link to `/proposals` with clear affordances
- FAQ: button accordion with keyboard navigation (Arrow Up/Down, Home/End)
- Section reveal on scroll (respects `prefers-reduced-motion`)
- Secondary text links between sections (hero to how-it-works, timeline to FAQ, FAQ to technology)
- Footer section links use smooth scroll with offset
- Static trust strip below hero (no animated marquee)

## Required sections (in order)

1. **Hero**: headline, subcopy, primary CTA (`/community`), secondary CTA (`/proposals`), stats row, hero image + live governance preview panel, trust strip
2. **Features**: 6 feature cards in bento grid (`#features`)
3. **Showcase**: editorial proposal layout (`#showcase`)
4. **How it works**: zigzag timeline with images (`#how-it-works`)
5. **Technology**: stacked tech bands (`#technology`)
6. **FAQ**: accordion (`#faq`)
7. **CTA**: split card with quick facts
8. **Footer**: product links, resources, governance value statement

## Header (landing only)

- Sticky header with section anchor nav: Features, Showcase, How it works, Technology, FAQ
- **Enter app** button goes to `/community`
- Do **not** show app nav (Community / Proposals tabs) on the landing page

## App pages (`/community`, `/proposals`)

Use the standard `Header` + `Footer` with wallet connect. Syne + IBM Plex Sans. No landing tokens or `.landing-root` wrapper.

## Images

Place assets in `apps/web/public/images/`. Register paths in `apps/web/src/lib/landingImages.ts`.

**Important:** Landing images are supporting editorial assets, not app screenshots or full-page mockups. The page layout and UI are built in React; images illustrate concepts and proposal subjects.

| Asset | Role | Example |
|-------|------|---------|
| `hero-governance.jpg` | Atmospheric scene beside hero copy | Community gathered under stars |
| `step-*.jpg` | Step card header (16:10) | Deploy rocket, mint badge, delegate, vote |
| `showcase-*.jpg` | Proposal *subject* (4:3) | Treasury coins, brand swatches, NFT badge |
| `thumb-*.jpg` | Square preview row icon (40px) | Cropped from showcase subjects |

Do **not** use dashboard screenshots or landing-page layouts as images. That duplicates the page itself.

## Agent instructions

When building or updating the landing page:

1. Follow the section order above
2. Reuse `.lp-*` and `.landing-*` classes scoped under `.landing-root`. Keep the professional light tone.
3. Keep copy focused on the product: NFT membership, transparent proposals, and Governor voting. Do not foreground deployment environments on the marketing page.
4. Preserve information density and the governance preview panel in the hero (widget-style, clickable rows)
5. Do not use em dashes in user-facing landing copy
