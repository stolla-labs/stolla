import Image from "next/image";
import { LandingSectionHeader } from "@/components/landing/LandingSectionHeader";
import { LANDING_IMAGES } from "@/lib/landingImages";

const STEPS = [
  {
    step: "1",
    title: "Launch collection",
    description:
      "Create a community NFT collection with its own name, symbol, and membership metadata.",
    image: LANDING_IMAGES.steps.deploy,
    imageAlt: "Rocket launching from a smart contract cube",
  },
  {
    step: "2",
    title: "Mint members",
    description:
      "Issue membership NFTs with per-token IPFS metadata URIs. Each token is a governance identity.",
    image: LANDING_IMAGES.steps.mint,
    imageAlt: "Membership NFT badge being minted",
  },
  {
    step: "3",
    title: "Delegate power",
    description:
      "Holders activate voting rights by delegating to themselves on-chain. One NFT, one vote.",
    image: LANDING_IMAGES.steps.delegate,
    imageAlt: "Delegating voting power to a wallet",
  },
  {
    step: "4",
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
      <div className="landing-container">
        <LandingSectionHeader
          eyebrow="How it works"
          title="Four steps from deploy to first vote"
          description="No accounts, no passwords. Just your Stellar wallet and a few signed transactions."
        />

        <ol className="landing-steps-grid">
          {STEPS.map((item) => (
            <li key={item.step} className="landing-step-card lp-card">
              <figure className="landing-step-image">
                <Image
                  src={item.image}
                  alt={item.imageAlt}
                  width={400}
                  height={250}
                  className="h-full w-full object-cover"
                />
              </figure>
              <div className="landing-step-body">
                <span className="landing-step-number">{item.step}</span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
