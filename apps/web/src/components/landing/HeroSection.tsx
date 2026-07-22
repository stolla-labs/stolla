import Image from "next/image";
import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { LANDING_IMAGES } from "@/lib/landingImages";

const TRUST_ITEMS = [
  "Stellar",
  "SEP-0050",
  "OpenZeppelin Governor",
  "Soroban",
] as const;

const PREVIEW_ITEMS = [
  {
    title: "Treasury allocation Q1",
    votes: "12 For",
    status: "Active",
    statusClass: "landing-status-active",
    image: LANDING_IMAGES.thumbs.treasury,
    active: true,
  },
  {
    title: "Brand guidelines update",
    votes: "24 For",
    status: "Passed",
    statusClass: "landing-status-passed",
    image: LANDING_IMAGES.thumbs.brand,
  },
  {
    title: "Community grant program",
    votes: "3 For",
    status: "Pending",
    statusClass: "landing-status-pending",
    image: LANDING_IMAGES.thumbs.badge,
  },
] as const;

export function HeroSection() {
  return (
    <section className="landing-hero">
      <div className="landing-container landing-hero-grid">
        <div className="landing-hero-copy">
          <p className="landing-hero-badge">Community governance on Stellar</p>
          <h1 className="landing-hero-title">
            Launch your community.
            <span className="landing-hero-accent"> Govern on-chain.</span>
          </h1>
          <p className="landing-hero-desc">
            NFT membership collections and transparent DAO voting for Stellar
            projects. Deploy contracts, mint members, delegate power, and vote
            from one dashboard.
          </p>
          <div className="landing-hero-actions">
            <LinkButton href="/community">Get started</LinkButton>
            <LinkButton href="/proposals" variant="ghost">
              Browse proposals
            </LinkButton>
          </div>
          <dl className="landing-stats-row">
            <div className="landing-stat">
              <dt className="landing-stat-label">Membership</dt>
              <dd className="landing-stat-value">NFT-gated</dd>
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

        <div className="landing-hero-product lp-card">
          <figure className="landing-hero-product-image">
            <Image
              src={LANDING_IMAGES.hero}
              alt="Community members gathered for on-chain governance under a starry sky"
              width={800}
              height={520}
              className="h-full w-full object-cover"
              priority
            />
          </figure>
          <div className="landing-preview-panel">
            <div className="landing-preview-header">
              <p className="landing-preview-header-title">Governance activity</p>
              <span className="landing-live-dot" aria-hidden="true" />
              <p className="landing-preview-header-meta">Product preview</p>
            </div>
            <div className="landing-preview-body">
              {PREVIEW_ITEMS.map((item) => (
                <PreviewRow key={item.title} {...item} />
              ))}
            </div>
            <Link
              href="/proposals"
              className="landing-preview-footer landing-preview-footer-link"
            >
              View all proposals
            </Link>
          </div>
        </div>
      </div>

      <div className="landing-trust-strip">
        <ul className="landing-trust-list landing-container">
          {TRUST_ITEMS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function PreviewRow({
  title,
  votes,
  status,
  statusClass,
  image,
  active = false,
}: {
  title: string;
  votes: string;
  status: string;
  statusClass: string;
  image: string;
  active?: boolean;
}) {
  return (
    <Link
      href="/proposals"
      className={`landing-preview-row landing-preview-row-link ${active ? "landing-preview-row-active" : ""}`}
      aria-label={`${title}, ${votes}, ${status}`}
    >
      <Image
        src={image}
        alt=""
        width={40}
        height={40}
        className="landing-preview-thumb"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs text-[var(--lp-text-muted)]">{votes}</p>
      </div>
      <span className={`landing-status-badge ${statusClass}`}>{status}</span>
    </Link>
  );
}
