import Image from "next/image";
import { LinkButton } from "@/components/ui/Button";
import { LANDING_IMAGES } from "@/lib/landingImages";

const PREVIEW_ITEMS = [
  {
    title: "Treasury allocation Q1",
    votes: "12 For",
    status: "Active",
    image: LANDING_IMAGES.thumbs.treasury,
    active: true,
  },
  {
    title: "Brand guidelines update",
    votes: "24 For",
    status: "Passed",
    image: LANDING_IMAGES.thumbs.brand,
  },
  {
    title: "Community grant program",
    votes: "3 For",
    status: "Pending",
    image: LANDING_IMAGES.thumbs.badge,
  },
] as const;

export function HeroSection() {
  return (
    <section className="landing-hero">
      <div className="landing-hero-grid mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-12 lg:py-28">
        <div className="space-y-7">
          <p className="landing-hero-badge">
            <span className="landing-hero-badge-dot" aria-hidden="true" />
            Community governance on Stellar
          </p>
          <h1 className="landing-hero-title">
            Launch your community.
            <br />
            <em>Govern on-chain.</em>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-[var(--lp-text-muted)] sm:text-lg">
            Stolla gives Stellar projects NFT membership collections and
            transparent DAO voting. Deploy contracts, mint members, delegate
            power, and vote — all from one dashboard.
          </p>
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/community">Get started</LinkButton>
            <LinkButton href="/proposals" variant="ghost">
              Browse proposals
            </LinkButton>
          </div>
          <dl className="grid grid-cols-3 gap-3 pt-2 sm:gap-4">
            <div className="landing-stat">
              <dt className="landing-stat-label">Network</dt>
              <dd className="landing-stat-value">Testnet</dd>
            </div>
            <div className="landing-stat">
              <dt className="landing-stat-label">Voting</dt>
              <dd className="landing-stat-value">On-chain</dd>
            </div>
            <div className="landing-stat">
              <dt className="landing-stat-label">Standard</dt>
              <dd className="landing-stat-value">SEP-0050</dd>
            </div>
          </dl>
        </div>

        <div className="space-y-4">
          <figure className="landing-image-frame lp-card overflow-hidden">
            <Image
              src={LANDING_IMAGES.hero}
              alt="Community members gathered for on-chain governance under a starry sky"
              width={800}
              height={600}
              className="h-auto w-full object-cover"
              priority
            />
          </figure>

          <div className="landing-preview-panel p-4 sm:p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--lp-accent)]">
              Live governance preview
            </p>
            <div className="space-y-2">
              {PREVIEW_ITEMS.map((item) => (
                <PreviewRow key={item.title} {...item} />
              ))}
            </div>
            <p className="mt-4 border-t border-[var(--lp-border)] pt-4 text-xs text-[var(--lp-text-muted)]">
              Proposal state and vote counts are read from Soroban contracts via
              RPC.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function PreviewRow({
  title,
  votes,
  status,
  image,
  active = false,
}: {
  title: string;
  votes: string;
  status: string;
  image: string;
  active?: boolean;
}) {
  return (
    <div
      className={`landing-preview-row ${active ? "landing-preview-row-active" : ""}`}
    >
      <Image
        src={image}
        alt=""
        width={48}
        height={48}
        className="landing-preview-thumb"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs text-[var(--lp-text-muted)]">{votes}</p>
      </div>
      <span className="shrink-0 rounded-full border border-[var(--lp-border)] px-2 py-0.5 text-xs font-medium text-[var(--lp-accent)]">
        {status}
      </span>
    </div>
  );
}
