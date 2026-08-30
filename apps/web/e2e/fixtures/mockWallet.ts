import type { Page } from "@playwright/test";
import { Keypair, Networks } from "@stellar/stellar-sdk";

const MOCK_WALLET_KEYPAIR = Keypair.fromRawEd25519Seed(
  Buffer.alloc(32, 7),
);
export const MOCK_WALLET_ADDRESS = MOCK_WALLET_KEYPAIR.publicKey();

export type MockWalletSetup = {
  network?: string;
  networkPassphrase?: string;
  rejectSignature?: boolean;
};

export async function configureMockWallet(
  page: Page,
  setup: MockWalletSetup = {},
) {
  await page.addInitScript(
    ({ controls, address, secretKey }) => {
      window.__stollaMockWallet = controls;
      window.__STOLLA_E2E__ = {
        wallet: {
          address,
          networkPassphrase: controls.networkPassphrase,
          rejected: controls.rejectSignature,
          secretKey,
          signedNetworkPassphrases: [],
        },
        communities: [],
        proposals: {},
        diagnostics: { submissions: 0, invocations: [] },
      };
    },
    {
      controls: {
        network: "TESTNET",
        networkPassphrase: Networks.TESTNET,
        rejectSignature: false,
        ...setup,
      },
      address: MOCK_WALLET_ADDRESS,
      secretKey: MOCK_WALLET_KEYPAIR.secret(),
    },
  );
}

/** The passphrases the application actually handed to the wallet for signing. */
export function signedNetworkPassphrases(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const bridgeRecord =
      window.__STOLLA_E2E__?.wallet?.signedNetworkPassphrases;
    return bridgeRecord?.length
      ? bridgeRecord
      : window.__stollaMockWalletRecord?.signedNetworkPassphrases ?? [];
  });
}
