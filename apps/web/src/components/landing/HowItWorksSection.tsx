import Image from "next/image";
import { LANDING_IMAGES } from "@/lib/landingImages";

const STEPS = [
  {
    step: "01",
    title: "Launch collection",
    description:
      "Deploy a community NFT contract with name, symbol, and metadata on Stellar testnet via Soroban.",
    image: LANDING_IMAGES.steps.deploy,
    imageAlt: "Rocket launching from a smart contract cube",
  },
  {
    step: "02",
    title: "Mint members",
    description:
      "Issue membership NFTs with per-token IPFS metadata URIs. Each token is a governance identity.",
    image: LANDING_IMAGES.steps.mint,
    imageAlt: "Membership NFT badge being minted",
  },
  {
    step: "03",
    title: "Delegate power",
    description:
      "Holders activate voting rights by delegating to themselves on-chain. One NFT, one vote.",
    image: LANDING_IMAGES.steps.delegate,
    imageAlt: "Delegating voting power to a wallet",
  },
  {
    step: "04",
    title: "Govern together",
    description:
      "Create proposals, cast votes, and track outcomes transparently. Signaling votes enforced by the Governor.",
    image: LANDING_IMAGES.steps.vote,
    imageAlt: "Community members casting votes",
  },
] as const;

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="landing-section">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-12 max-w-2xl">
          <p className="landing-eyebrow">How it works</p>
          <h2 className="landing-section-title">
            Four steps from deploy to first vote
          </h2>
          <p className="mt-4 text-[var(--lp-text-muted)]">
            No accounts, no passwords. Just your Stellar wallet and a few
            signed transactions.
          </p>
        </div>

        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((item) => (
            <li key={item.step} className="landing-step-card lp-card overflow-hidden">
              <figure className="landing-step-image">
                <Image
                  src={item.image}
                  alt={item.imageAlt}
                  width={400}
                  height={280}
                  className="h-full w-full object-cover"
                />
              </figure>
              <div className="p-5">
                <span className="landing-step-number">{item.step}</span>
                <h3 className="mt-4 text-lg">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--lp-text-muted)]">
                  {item.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
