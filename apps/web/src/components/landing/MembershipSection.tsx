import Image from "next/image";
import Link from "next/link";

const highlights = [
  {
    label: "SEP-0050",
    title: "Standard-compliant NFTs",
    body: "Membership tokens follow the Stellar NFT standard with per-token IPFS metadata URIs.",
  },
  {
    label: "1:1",
    title: "One token, one vote",
    body: "Voting power is checkpointed at proposal snapshot — no flash-loan exploits.",
  },
  {
    label: "On-chain",
    title: "Verifiable ownership",
    body: "Every mint, delegation, and vote is recorded on Soroban for full transparency.",
  },
];

export function MembershipSection() {
  return (
    <section className="overflow-hidden bg-zinc-950 py-20 text-white sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-2 lg:gap-16">
        <div className="relative order-2 lg:order-1">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl ring-1 ring-white/10">
            <Image
              src="/images/nft-membership.jpg"
              alt="Digital membership NFT collection"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="pointer-events-none absolute -bottom-6 -right-6 hidden h-32 w-32 rounded-full bg-indigo-600/30 blur-3xl lg:block" />
        </div>

        <div className="order-1 lg:order-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">
            Membership model
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            NFTs that carry real governance weight
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-zinc-400">
            Stolla ties community identity to voting rights. Hold a membership
            NFT, delegate to yourself, and your voice counts in every proposal.
          </p>

          <dl className="mt-10 space-y-6">
            {highlights.map((item) => (
              <div key={item.label} className="flex gap-4">
                <dt className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-indigo-600/20 font-mono text-xs font-bold text-indigo-300">
                  {item.label}
                </dt>
                <dd>
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                    {item.body}
                  </p>
                </dd>
              </div>
            ))}
          </dl>

          <Link
            href="/community"
            className="mt-10 inline-flex items-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
          >
            Explore membership
          </Link>
        </div>
      </div>
    </section>
  );
}
