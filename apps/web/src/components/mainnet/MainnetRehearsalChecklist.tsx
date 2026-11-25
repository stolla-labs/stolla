"use client";

import {
  runbookUrl,
  type RehearsalCheck,
  type RehearsalCheckId,
  type RehearsalVerdict,
} from "@/lib/mainnet/rehearsal";

/**
 * The launch rehearsal, as a creator reads it.
 *
 * Hard gates come first and say that deployment is held; soft ones follow as
 * cautions a creator may knowingly accept. Items this app measured show their
 * result, and items it cannot see offer a confirmation with that fact written
 * next to the box — a checklist that hides which of its ticks were verified is
 * worse than no checklist, because it is read as evidence.
 */
export function MainnetRehearsalChecklist({
  checks,
  verdict,
  onToggle,
  networkLabel,
}: {
  checks: readonly RehearsalCheck[];
  verdict: RehearsalVerdict;
  onToggle: (id: RehearsalCheckId) => void;
  networkLabel: string;
}) {
  if (checks.length === 0) return null;

  const hard = checks.filter((check) => check.gate === "hard");
  const soft = checks.filter((check) => check.gate === "soft");

  return (
    <section
      aria-labelledby="rehearsal-heading"
      data-testid="mainnet-rehearsal"
      className="rounded-xl border border-slate-800 bg-[#151b2b] p-4 sm:p-5"
    >
      <h2 id="rehearsal-heading" className="font-semibold text-slate-100">
        {networkLabel} launch rehearsal
      </h2>
      <p
        role="status"
        data-testid="rehearsal-verdict"
        className={`mt-2 text-sm ${verdict.blocked ? "text-amber-200" : "text-slate-400"}`}
      >
        {verdict.blocked
          ? `Deployment is held until ${verdict.blocking.length} item${
              verdict.blocking.length === 1 ? "" : "s"
            } below ${verdict.blocking.length === 1 ? "is" : "are"} resolved.`
          : verdict.warnings.length > 0
            ? `Nothing is blocking the deployment. ${verdict.warnings.length} caution${
                verdict.warnings.length === 1 ? "" : "s"
              } left, which you can accept knowingly.`
            : "Every item on this list is resolved."}
      </p>

      {hard.length > 0 && (
        <Group
          title="Must be true before deploying"
          note="Without these the deployment fails, or succeeds into something nobody can use."
          checks={hard}
          onToggle={onToggle}
        />
      )}
      {soft.length > 0 && (
        <Group
          title="Worth settling first"
          note="These do not block the deployment. They are what first launches usually get wrong."
          checks={soft}
          onToggle={onToggle}
        />
      )}
    </section>
  );
}

function Group({
  title,
  note,
  checks,
  onToggle,
}: {
  title: string;
  note: string;
  checks: readonly RehearsalCheck[];
  onToggle: (id: RehearsalCheckId) => void;
}) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-medium text-slate-200">{title}</h3>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
      <ul className="mt-3 space-y-3">
        {checks.map((check) => (
          <li
            key={check.id}
            data-testid={`rehearsal-${check.id}`}
            data-status={check.status}
            className="rounded-lg border border-slate-800 bg-[#0b0f19] p-3"
          >
            {check.verification === "declared" ? (
              <label className="flex items-start gap-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={check.status === "pass"}
                  onChange={() => onToggle(check.id)}
                  className="mt-0.5 size-4 shrink-0"
                />
                <span className="min-w-0">
                  <span className="block">{check.title}</span>
                  <Detail check={check} />
                </span>
              </label>
            ) : (
              <div className="flex items-start gap-3 text-sm text-slate-200">
                <span
                  aria-hidden="true"
                  className={`mt-0.5 shrink-0 ${
                    check.status === "pass" ? "text-emerald-300" : "text-amber-300"
                  }`}
                >
                  {check.status === "pass" ? "✓" : "!"}
                </span>
                <span className="min-w-0">
                  <span className="block">
                    {check.title}
                    <span className="sr-only">
                      {check.status === "pass" ? " — checked and passing" : " — not satisfied"}
                    </span>
                  </span>
                  <Detail check={check} />
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Detail({ check }: { check: RehearsalCheck }) {
  if (check.status === "pass") return null;

  return (
    <span className="mt-1 block text-xs text-slate-400">
      {check.detail}{" "}
      <a
        href={runbookUrl(check.runbookAnchor)}
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        Runbook
        <span className="sr-only"> for {check.title} (opens in a new tab)</span>
      </a>
    </span>
  );
}
