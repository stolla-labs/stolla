import { StrKey } from "@stellar/stellar-sdk";

export const BATCH_MINT_CAP = 25;

export type ParsedRecipients =
  | { ok: true; addresses: string[] }
  | { ok: false; message: string };

export type BatchMintProgress = {
  succeeded: string[];
  pending: string[];
  failed: string | null;
  stopped: boolean;
};

/** Split a newline or comma list and reject invalid G… addresses before any wallet prompt. */
export function parseRecipientList(raw: string): ParsedRecipients {
  const parts = raw
    .split(/[\n,]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    return { ok: false, message: "Add at least one recipient address." };
  }

  if (parts.length > BATCH_MINT_CAP) {
    return { ok: false, message: `Mint at most ${BATCH_MINT_CAP} recipients at a time.` };
  }

  const invalid = parts.filter((part) => !StrKey.isValidEd25519PublicKey(part));
  if (invalid.length > 0) {
    return {
      ok: false,
      message: `Invalid address: ${invalid[0]}. Fix the list before connecting a wallet.`,
    };
  }

  return { ok: true, addresses: parts };
}

/**
 * Mint one recipient at a time. The first hard failure stops the run.
 * Succeeded addresses are done; pending includes the failed address and the rest.
 */
export async function runSequentialMints(
  addresses: string[],
  mintOne: (address: string) => Promise<void>,
): Promise<BatchMintProgress> {
  const succeeded: string[] = [];

  for (let index = 0; index < addresses.length; index += 1) {
    const address = addresses[index];
    try {
      await mintOne(address);
      succeeded.push(address);
    } catch {
      return {
        succeeded,
        pending: addresses.slice(index),
        failed: address,
        stopped: true,
      };
    }
  }

  return { succeeded, pending: [], failed: null, stopped: false };
}
