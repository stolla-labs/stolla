import Image from "next/image";
import { LinkButton } from "@/components/ui/Button";
import { LANDING_IMAGES } from "@/lib/landingImages";

const SHOWCASE_ITEMS = [
  {
    title: "Treasury allocation Q1",
    category: "Finance",
    detail: "12 votes · Active",
    image: LANDING_IMAGES.showcase.treasury,
    imageAlt: "Treasury budget coins and pie chart",
  },
  {
    title: "Brand guidelines update",
    category: "Community",
    detail: "24 votes · Passed",
    image: LANDING_IMAGES.showcase.brand,
    imageAlt: "Brand color swatches and logo sketches",
  },
  {
    title: "Membership badge refresh",
    category: "NFT",
    detail: "8 votes · Closed",
    image: LANDING_IMAGES.showcase.badge,
    imageAlt: "Membership NFT badge artwork",
  },
] as const;

export function ShowcaseSection() {
  return (
    <section id="showcase" className="landing-section landing-section-alt">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="landing-eyebrow">Showcase</p>
            <h2 className="landing-section-title">
              What communities are voting on
            </h2>
            <p className="mt-4 text-[var(--lp-text-muted)]">
              From treasury decisions to membership updates. Every proposal is
              an on-chain vote with transparent outcomes.
            </p>
          </div>
          <LinkButton href="/proposals" variant="ghost">
            View all proposals
          </LinkButton>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {SHOWCASE_ITEMS.map((item) => (
            <article
              key={item.title}
              className="landing-showcase-card lp-card overflow-hidden"
            >
              <figure className="landing-showcase-image overflow-hidden">
                <Image
                  src={item.image}
                  alt={item.imageAlt}
                  width={480}
                  height={360}
                  className="h-full w-full object-cover"
                />
              </figure>
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--lp-accent)]">
                  {item.category}
                </p>
                <h3 className="mt-2 text-xl">{item.title}</h3>
                <p className="mt-2 text-sm text-[var(--lp-text-muted)]">
                  {item.detail}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
