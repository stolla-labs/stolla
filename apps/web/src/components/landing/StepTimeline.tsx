import Link from "next/link";

const steps = [
  {
    step: "01",
    title: "Launch collection",
    body: "Deploy a community NFT contract with name, symbol, and IPFS metadata base.",
  },
  {
    step: "02",
    title: "Mint members",
    body: "Issue membership NFTs to contributors. Each token carries a unique metadata URI.",
  },
  {
    step: "03",
    title: "Delegate power",
    body: "Holders activate voting rights by delegating to themselves on-chain.",
  },
  {
    step: "04",
    title: "Govern together",
    body: "Create proposals, cast votes, and track outcomes transparently on Stellar.",
  },
];

export function StepTimeline() {
  return (
    <ol className="relative space-y-0">
      {steps.map((item, index) => (
        <li key={item.step} className="relative flex gap-6 pb-10 last:pb-0">
          {index < steps.length - 1 ? (
            <span
              aria-hidden
              className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-indigo-200"
            />
          ) : null}
          <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-indigo-600 bg-white text-xs font-bold text-indigo-600">
            {item.step}
          </span>
          <div className="pt-0.5">
            <h3 className="font-semibold text-zinc-900">{item.title}</h3>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-zinc-600">
              {item.body}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
