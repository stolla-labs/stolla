# Stolla Landing Page

## Purpose

The `/` route is a **marketing landing page**, not the app dashboard. It explains the product and drives users to `/community` or `/proposals`.

## Design system

**Cosmic editorial** — dark glass aesthetic inspired by Stellar's night-sky identity. Soft aurora gradients, frosted surfaces, and serif headlines. Intentionally distinct from neo-brutalist or generic light SaaS layouts.

| Token | Value | Usage |
|-------|-------|-------|
| `--lp-bg` | `#06060e` | Page background |
| `--lp-text` | `#f2f2f7` | Primary text |
| `--lp-text-muted` | `rgba(242,242,247,0.58)` | Body secondary |
| `--lp-accent` | `#a5b4fc` | Eyebrows, highlights |
| `--lp-accent-deep` | `#6366f1` | CTA gradient |
| `--lp-surface` | `rgba(255,255,255,0.04)` | Glass cards |
| `--lp-border` | `rgba(255,255,255,0.08)` | Hairline borders |
| `--lp-radius-lg` | `1.25rem` | Card corners |

Typography: **Instrument Serif** (display/headings), **DM Sans** (body). Scoped under `.landing-root`.

Utility classes: `.lp-card`, `.lp-btn`, `.lp-btn-ghost`, `.landing-section`, `.landing-eyebrow`, etc. — see `apps/web/src/app/landing.css`.

### Visual principles

- Rounded corners and soft glows — no hard offset shadows or 2px black borders
- Glass cards with `backdrop-filter` and low-opacity borders
- Hero aurora gradients via radial overlays (`.landing-hero::before`)
- Pill-shaped CTAs with indigo gradient fill
- Hover: subtle lift (`translateY`) — not brutalist press-in

## Required sections (in order)

1. **Hero** — headline, subcopy, primary CTA (`/community`), secondary CTA (`/proposals`), stats row, hero image + live governance preview panel
2. **Features** — 6 feature cards (`#features`)
3. **Showcase** — 3 example proposal cards (`#showcase`)
4. **How it works** — 4 steps with images (`#how-it-works`)
5. **Technology** — Stellar stack cards (`#technology`)
6. **FAQ** — accordion (`#faq`)
7. **CTA** — final call to action
8. **Footer** — product links, resources, testnet notice

## Header (landing only)

- Sticky frosted header with section anchor nav: Features, Showcase, How it works, Technology, FAQ
- **Enter app** button → `/community`
- Do **not** show app nav (Community / Proposals tabs) on the landing page

## App pages (`/community`, `/proposals`)

Use the standard `Header` + `Footer` with wallet connect. Light theme, Syne + IBM Plex Sans. No landing tokens or `.landing-root` wrapper.

## Images

Place assets in `apps/web/public/images/`. Register paths in `apps/web/src/lib/landingImages.ts`.

**Important:** Landing images are supporting editorial assets — not app screenshots or full-page mockups. The page layout and UI are built in React; images illustrate concepts and proposal subjects.

| Asset | Role | Example |
|-------|------|---------|
| `hero-governance.jpg` | Atmospheric scene beside hero copy | Community gathered under stars |
| `step-*.jpg` | Step card header (16:10) | Deploy rocket, mint badge, delegate, vote |
| `showcase-*.jpg` | Proposal *subject* (4:3) | Treasury coins, brand swatches, NFT badge |
| `thumb-*.jpg` | Square preview row icon (48px) | Cropped from showcase subjects |

Do **not** use dashboard screenshots or landing-page layouts as images — that duplicates the page itself.

## Agent instructions

When building or updating the landing page:

1. Follow the section order above — do not invent a generic light-hero SaaS layout
2. Reuse `.lp-*` and `.landing-*` classes scoped under `.landing-root`; do not mix app-page styles or neo-brutalist patterns
3. Keep copy aligned with `docs/prd.md` (NFT membership + Governor voting on testnet)
4. Preserve information density and the interactive governance preview panel in the hero
