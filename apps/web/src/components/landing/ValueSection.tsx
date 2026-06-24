const values = [
  {
    stat: "0",
    suffix: " lines",
    title: "Custom governance code",
    body: "OpenZeppelin NonFungibleVotes and Governor modules are composed and deployed for you.",
  },
  {
    stat: "100%",
    suffix: "",
    title: "On-chain transparency",
    body: "Every mint, delegation, and vote is verifiable on Stellar testnet via Soroban RPC.",
  },
  {
    stat: "1",
    suffix: " click",
    title: "Wallet connection",
    body: "Connect Freighter from the browser and interact with contracts without leaving the app.",
  },
];

export function ValueSection() {
  return (
    <section className="border-b border-zinc-200 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-10 sm:grid-cols-3 sm:gap-8">
          {values.map((item) => (
            <div key={item.title} className="text-center sm:text-left">
              <p className="font-mono text-3xl font-bold text-indigo-600 sm:text-4xl">
                {item.stat}
                <span className="text-lg font-semibold text-indigo-400">
                  {item.suffix}
                </span>
              </p>
              <h3 className="mt-3 font-semibold text-zinc-900">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
