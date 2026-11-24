"use client";

import { useEffect, useState } from "react";
import type { ProposalActionRecord } from "./decode";
import { fetchProposalActionRecord } from "./fetch";

export type ProposalActionRecordLoader = (
  governorContractId: string,
  proposalIdHex: string,
) => Promise<ProposalActionRecord | null>;

export type ProposalActionRecordResolution =
  | { status: "loading" }
  | { status: "error"; error: string }
  /** `record` is null when the creation event could not be found. */
  | { status: "ready"; record: ProposalActionRecord | null };

export function useProposalActionRecord(
  governorContractId: string,
  proposalIdHex: string,
  load: ProposalActionRecordLoader = fetchProposalActionRecord,
): ProposalActionRecordResolution {
  const scopeKey = `${governorContractId}|${proposalIdHex}`;
  const [result, setResult] = useState<{
    scopeKey: string;
    resolution: ProposalActionRecordResolution;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    load(governorContractId, proposalIdHex)
      .then((record) => {
        if (!cancelled) {
          setResult({ scopeKey, resolution: { status: "ready", record } });
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setResult({
          scopeKey,
          resolution: {
            status: "error",
            error:
              error instanceof Error
                ? error.message
                : "Proposal actions could not be loaded.",
          },
        });
      });
    return () => {
      cancelled = true;
    };
  }, [governorContractId, proposalIdHex, scopeKey, load]);

  // A result for another proposal must never be shown for this one.
  return result?.scopeKey === scopeKey ? result.resolution : { status: "loading" };
}
