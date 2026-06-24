const features = [
  {
    title: "NFT-gated voting",
    body: "One membership NFT equals one voting unit. Power follows ownership, not capital.",
    span: "lg:col-span-2",
    accent: "from-indigo-600/10 to-indigo-600/5",
  },
  {
    title: "On-chain proposals",
    body: "Governor contract manages proposal lifecycle with snapshot-based vote counting.",
    span: "",
    accent: "from-zinc-100 to-white",
  },
  {
    title: "IPFS metadata",
    body: "SEP-0050 compatible token URIs for rich membership badges.",
    span: "",
    accent: "from-zinc-100 to-white",
  },
  {
    title: "Flash-loan safe",
    body: "Checkpoint voting power prevents last-minute manipulation.",
    span: "",
    accent: "from-zinc-100 to-white",
  },
  {
    title: "Wallet native",
    body: "Connect Freighter and interact with contracts from the browser.",
    span: "",
    accent: "from-zinc-100 to-white",
  },
  {
    title: "OpenZeppelin core",
    body: "Battle-tested NonFungibleVotes and Governor modules composed for Stolla.",
    span: "lg:col-span-2",
    accent: "from-indigo-600/10 to-indigo-600/5",
  },
];

export function BentoGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((feature) => (
        <article
          key={feature.title}
          className={`rounded-2xl border border-zinc-200 bg-gradient-to-br p-6 ${feature.span} ${feature.accent}`}
        >
          <h3 className="font-semibold text-zinc-900">{feature.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-zinc-600">
            {feature.body}
          </p>
        </article>
      ))}
    </div>
  );
}
