import Image from "next/image";

const params = [
  { name: "Voting delay", value: "1 ledger" },
  { name: "Voting period", value: "10,000 ledgers" },
  { name: "Proposal threshold", value: "1 vote" },
  { name: "Quorum", value: "1 vote" },
];

export function GovernanceSection() {
  return (
    <section className="border-y border-zinc-200 bg-zinc-50 py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
            On-chain governance
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
            Proposals, votes, and outcomes — all transparent
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-zinc-600">
            The OpenZeppelin Governor contract handles proposal creation,
            voting windows, and tallying. Members see exactly where each
            proposal stands before casting their vote.
          </p>

          <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <div className="border-b border-zinc-100 px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Testnet defaults
              </p>
            </div>
            <dl className="divide-y divide-zinc-100">
              {params.map((param) => (
                <div
                  key={param.name}
                  className="flex items-center justify-between px-5 py-3.5"
                >
                  <dt className="text-sm text-zinc-600">{param.name}</dt>
                  <dd className="font-mono text-sm font-medium text-zinc-900">
                    {param.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="relative">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl shadow-xl shadow-indigo-900/10 ring-1 ring-zinc-900/5">
            <Image
              src="/images/governance.jpg"
              alt="On-chain governance network visualization"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div className="pointer-events-none absolute -left-8 -top-8 h-40 w-40 rounded-full bg-indigo-200/40 blur-3xl" />
        </div>
      </div>
    </section>
  );
}
