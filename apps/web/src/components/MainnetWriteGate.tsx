import { activeCapabilities } from "@/lib/stellar";
import { MAINNET_RUNBOOK_PATH } from "@/lib/network";

const RUNBOOK_URL = `https://github.com/stolla-labs/stolla/blob/main/${MAINNET_RUNBOOK_PATH}`;

export function mainnetWritesBlocked(): boolean {
  return !activeCapabilities.privilegedWrites.available;
}

export function MainnetWriteGate() {
  const writes = activeCapabilities.privilegedWrites;
  if (writes.available) return null;

  return (
    <p role="status" className="mt-2 text-sm text-amber-200">
      {writes.reason}{" "}
      <a className="underline" href={RUNBOOK_URL}>
        Open the testnet to mainnet runbook
      </a>
    </p>
  );
}
