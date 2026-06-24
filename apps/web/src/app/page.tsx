import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <section className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm sm:p-12">
        <p className="text-sm font-medium uppercase tracking-wide text-indigo-600">
          Stellar Testnet
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Build communities with NFT-gated DAO voting
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-zinc-600">
          Stolla lets Stellar projects launch a membership NFT collection and
          run on-chain governance. NFT holders delegate voting power and vote on
          community proposals.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/community"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-3 text-sm font-medium text-white hover:bg-indigo-500"
          >
            Open Community
          </Link>
          <Link
            href="/proposals"
            className="inline-flex items-center justify-center rounded-lg border border-zinc-300 bg-white px-5 py-3 text-sm font-medium hover:bg-zinc-50"
          >
            View Proposals
          </Link>
        </div>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        {[
          {
            title: "Mint NFT",
            body: "Community owner mints membership NFTs with IPFS metadata URIs.",
          },
          {
            title: "Delegate",
            body: "Members delegate voting power to themselves before voting.",
          },
          {
            title: "Vote",
            body: "Create proposals and cast on-chain votes weighted by NFTs.",
          },
        ].map((card) => (
          <article
            key={card.title}
            className="rounded-xl border border-zinc-200 bg-white p-5"
          >
            <h2 className="font-semibold">{card.title}</h2>
            <p className="mt-2 text-sm text-zinc-600">{card.body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
