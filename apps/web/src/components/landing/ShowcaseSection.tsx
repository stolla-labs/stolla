import Image from "next/image";
import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";
import { LANDING_IMAGES } from "@/lib/landingImages";
import { activityHref, landingActivity } from "@/lib/landing-activity";

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

export function ShowcaseSection({
  live = null,
  error = false,
}: {
  live?: { id: string; community: string; title: string }[] | null;
  error?: boolean;
}) {
  const activity = landingActivity({ live, error });
  return (
    <section id="showcase" className="landing-section landing-section-alt">
      <div className="landing-container">
        <div className="landing-section-header-row">
          <LandingSectionHeader
            eyebrow="Showcase · Illustrative demo"
            title="What communities are voting on"
            description="Example proposals stay labeled Demo. Registry rows are the only ones linked to a community proposal."
          />
          <LinkButton href="/proposals" variant="ghost" className="shrink-0">
            View all
          </LinkButton>
        </div>

        <p className="text-xs uppercase tracking-wide">{activity.label}</p>
        <div className="landing-showcase-grid">
          {SHOWCASE_ITEMS.map((item, index) => {
            const row = activity.rows[index] ?? activity.rows[0];
            const href = row ? activityHref(row, activity.mode) : "/proposals";
            return (
            <Link
              key={item.title}
              href={href}
              className="landing-showcase-card lp-card min-w-0"
              aria-label={`${item.title}. ${activity.label}.`}
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
            );
          })}
        </div>
      </div>
    </section>
  );
}
