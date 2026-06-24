# Stolla Web App — Agent Guide

## Landing page (read first)

Before editing `/`, read **`docs/landing-page.md`**.

The landing page uses a **professional light** enterprise SaaS design. It is separate from the app dashboard. Key rules:

- Section order: Hero → Features → Showcase → How it works → Technology → FAQ → CTA
- Landing header has section anchor nav + "Enter app", not app tabs
- Use `landing.css` tokens (`.lp-*`, `.landing-*`) under `.landing-root`. Restrained, no decorative gradients or animated marquees.
- No em dashes in landing copy.

## App routes

| Route | Purpose |
|-------|---------|
| `/` | Marketing landing (route group `(landing)`) |
| `/community` | NFT collection, mint form |
| `/proposals` | Proposal list and voting |

## Stack

- Next.js App Router, TypeScript, Tailwind CSS v4
- `@stellar/stellar-sdk` + `@creit.tech/stellar-wallets-kit`
- Contract IDs in `NEXT_PUBLIC_*` env vars — see `lib/stellar.ts`

## Next.js note

This project may use a newer Next.js than your training data. Check `node_modules/next/dist/docs/` for API changes if builds fail.
