import Image from "next/image";
import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";
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
      <div className="landing-container">
        <div className="landing-section-header-row">
          <LandingSectionHeader
            eyebrow="Showcase"
            title="What communities are voting on"
            description="From treasury decisions to membership updates. Every proposal is an on-chain vote with transparent outcomes."
          />
          <LinkButton href="/proposals" variant="ghost" className="shrink-0">
            View all
          </LinkButton>
        </div>

        <div className="landing-showcase-grid">
          {SHOWCASE_ITEMS.map((item) => (
            <Link
              key={item.title}
              href="/proposals"
              className="landing-showcase-card lp-card"
              aria-label={`${item.title}. View proposals.`}
            >
              <figure className="landing-showcase-image">
                <Image
                  src={item.image}
                  alt={item.imageAlt}
                  width={480}
                  height={360}
                  className="h-full w-full object-cover"
                />
              </figure>
              <div className="landing-showcase-body">
                <p className="landing-showcase-category">{item.category}</p>
                <h3>{item.title}</h3>
                <p className="landing-showcase-detail">{item.detail}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
