import Image from "next/image";
import Link from "next/link";
import { AudienceSection } from "@/components/landing/AudienceSection";
import { BentoGrid } from "@/components/landing/BentoGrid";
import { GovernanceSection } from "@/components/landing/GovernanceSection";
import { MembershipSection } from "@/components/landing/MembershipSection";
import { StepTimeline } from "@/components/landing/StepTimeline";
import { ValueSection } from "@/components/landing/ValueSection";

const stack = ["Soroban", "SEP-0050", "OpenZeppelin", "IPFS", "Next.js"];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[90vh] overflow-hidden bg-zinc-950 text-white">
        <Image
          src="/images/stellar-sky.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-50"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-zinc-950/40 via-zinc-950/70 to-zinc-950" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.25),_transparent_60%)]" />

        <div className="relative mx-auto flex min-h-[90vh] max-w-6xl flex-col justify-center px-4 pb-28 pt-28 sm:pb-36 sm:pt-32">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] text-indigo-300">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              Stellar Testnet
            </p>
            <h1 className="mt-8 text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
              Launch your community.
              <br />
              <span className="bg-gradient-to-r from-indigo-200 via-indigo-400 to-violet-400 bg-clip-text text-transparent">
                Govern on-chain.
              </span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-zinc-300 sm:text-xl">
              Stolla gives Stellar projects NFT membership collections and
              transparent DAO voting — deploy, mint, delegate, and vote from
              one dashboard.
            </p>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                href="/community"
                className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
              >
                Get started
              </Link>
              <Link
                href="/proposals"
                className="inline-flex items-center justify-center rounded-full border border-zinc-600 px-8 py-3.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-400 hover:bg-white/5 hover:text-white"
              >
                Browse proposals
              </Link>
            </div>
          </div>

          <dl className="mt-16 grid grid-cols-2 gap-6 border-t border-white/10 pt-10 sm:grid-cols-4 sm:gap-8">
            {[
              { value: "1 NFT", label: "1 vote" },
              { value: "SEP-0050", label: "NFT standard" },
              { value: "Soroban", label: "smart contracts" },
              { value: "MIT", label: "open source" },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="font-mono text-lg font-semibold text-white sm:text-xl">
                  {stat.value}
                </dt>
                <dd className="mt-1 text-sm text-zinc-400">{stat.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Product preview */}
      <section className="relative z-10 -mt-20 px-4 sm:-mt-28">
        <div className="mx-auto max-w-5xl">
          <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white p-1.5 shadow-2xl shadow-indigo-900/15 ring-1 ring-zinc-900/5">
            <div className="relative aspect-[16/10] overflow-hidden rounded-xl bg-zinc-100">
              <Image
                src="/images/dashboard-preview.jpg"
                alt="Stolla governance dashboard showing active proposals and vote progress"
                fill
                sizes="(max-width: 1280px) 100vw, 1024px"
                className="object-cover object-top"
                priority
              />
            </div>
          </div>
          <p className="mt-4 text-center text-sm text-zinc-500">
            Proposals, vote counts, and member actions — all in one place.
          </p>
        </div>
      </section>

      <ValueSection />

      <AudienceSection />

      {/* How it works */}
      <section id="how-it-works" className="py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl items-start gap-12 px-4 lg:grid-cols-2 lg:gap-20">
          <div className="lg:sticky lg:top-28">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
              How it works
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              From collection to first vote in four steps
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-zinc-600">
              Deploy contracts on Soroban, mint membership NFTs, delegate voting
              power, and start governing — entirely from the browser.
            </p>
            <div className="relative mt-8 hidden aspect-[4/3] overflow-hidden rounded-2xl shadow-lg ring-1 ring-zinc-900/5 lg:block">
              <Image
                src="/images/community.jpg"
                alt="Community members collaborating on governance"
                fill
                sizes="(max-width: 1024px) 0vw, 50vw"
                className="object-cover"
              />
            </div>
            <Link
              href="/community"
              className="mt-8 inline-flex items-center rounded-full bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Open community
            </Link>
          </div>

          <div>
            <div className="relative mb-10 aspect-[16/10] overflow-hidden rounded-2xl shadow-lg ring-1 ring-zinc-900/5 lg:hidden">
              <Image
                src="/images/community.jpg"
                alt="Community members collaborating on governance"
                fill
                sizes="100vw"
                className="object-cover"
              />
            </div>
            <StepTimeline />
          </div>
        </div>
      </section>

      <MembershipSection />

      <GovernanceSection />

      {/* Features */}
      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid items-end gap-8 lg:grid-cols-2 lg:gap-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
                Features
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
                Everything a Stellar community needs
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-zinc-600">
                Battle-tested contracts, wallet-native UX, and IPFS-ready
                metadata — composed for real governance workflows.
              </p>
            </div>
            <div className="relative aspect-[16/10] overflow-hidden rounded-2xl shadow-lg ring-1 ring-zinc-900/5">
              <Image
                src="/images/workspace.jpg"
                alt="Workspace for building on Stellar"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </div>
          <div className="mt-12">
            <BentoGrid />
          </div>
        </div>
      </section>

      {/* Stack */}
      <section className="border-t border-zinc-200 bg-zinc-50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Built with
          </p>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {stack.map((item) => (
              <li
                key={item}
                className="rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 shadow-sm"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:pb-28">
        <div className="relative overflow-hidden rounded-3xl bg-zinc-950">
          <Image
            src="/images/stellar-sky.jpg"
            alt=""
            fill
            sizes="(max-width: 1152px) 100vw, 1152px"
            className="object-cover opacity-35"
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-zinc-950/95 via-zinc-950/80 to-zinc-950/95" />
          <div className="relative px-6 py-16 text-center sm:px-16 sm:py-20">
            <h2 className="text-3xl font-bold text-white sm:text-4xl">
              Ready to launch your community?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-lg text-zinc-300">
              Connect Freighter and run your first governance vote on Stellar
              testnet today.
            </p>
            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/community"
                className="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100"
              >
                Get started
              </Link>
              <Link
                href="/proposals"
                className="inline-flex items-center justify-center rounded-full border border-zinc-600 px-8 py-3.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-400 hover:text-white"
              >
                Browse proposals
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
