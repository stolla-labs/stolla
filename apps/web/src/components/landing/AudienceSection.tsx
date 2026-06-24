import Image from "next/image";
import Link from "next/link";

const audiences = [
  {
    title: "For project creators",
    description:
      "Deploy an NFT membership collection and Governor contract on Stellar testnet. Mint members, create proposals, and grow a governed community without building governance from scratch.",
    bullets: [
      "Owner-controlled minting with IPFS metadata",
      "OpenZeppelin Governor out of the box",
      "Full proposal lifecycle in the dashboard",
    ],
    cta: { href: "/community", label: "Launch community" },
    image: "/images/workspace.jpg",
    imageAlt: "Developer workspace for building on Stellar",
  },
  {
    title: "For community members",
    description:
      "Receive a membership NFT, delegate your voting power, and participate in transparent on-chain decisions. Your voice is tied to your token — one NFT, one vote.",
    bullets: [
      "Delegate voting power in one transaction",
      "Cast votes on active proposals",
      "Track outcomes on-chain in real time",
    ],
    cta: { href: "/proposals", label: "View proposals" },
    image: "/images/community.jpg",
    imageAlt: "Community members collaborating",
  },
];

export function AudienceSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            Who it&apos;s for
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Built for builders and their communities
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-zinc-600">
            Whether you&apos;re launching a Stellar project or joining one,
            Stolla gives you the tools to govern together.
          </p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-2">
          {audiences.map((item) => (
            <article
              key={item.title}
              className="group overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm transition-shadow hover:shadow-lg"
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <Image
                  src={item.image}
                  alt={item.imageAlt}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-zinc-900/50 via-transparent to-transparent" />
              </div>
              <div className="p-6 sm:p-8">
                <h3 className="text-xl font-bold text-zinc-900">{item.title}</h3>
                <p className="mt-3 leading-relaxed text-zinc-600">
                  {item.description}
                </p>
                <ul className="mt-5 space-y-2">
                  {item.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-2 text-sm text-zinc-700"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-600" />
                      {bullet}
                    </li>
                  ))}
                </ul>
                <Link
                  href={item.cta.href}
                  className="mt-6 inline-flex items-center rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
                >
                  {item.cta.label}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
