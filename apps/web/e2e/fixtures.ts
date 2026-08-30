import { expect, type Page } from "@playwright/test";

export const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";
export const FACTORY_ID = `C${"A".repeat(55)}`;
export const WALLET_ADDRESS = `G${"A".repeat(55)}`;
export const ALPHA_ID = "aa".repeat(32);
export const BETA_ID = "bb".repeat(32);
export const ALPHA_GOVERNOR = `C${"B".repeat(55)}`;
export const BETA_GOVERNOR = `C${"C".repeat(55)}`;
export const ALPHA_NFT = `C${"D".repeat(55)}`;
export const BETA_NFT = `C${"E".repeat(55)}`;
export const PROPOSAL_ID = "11".repeat(32);

function community(
  id: string,
  name: string,
  nftContract: string,
  governorContract: string,
  index: number,
) {
  return {
    record: {
      id,
      nftContract,
      governorContract,
      creator: WALLET_ADDRESS,
      communityOwner: WALLET_ADDRESS,
      createdAtLedger: 100 + index,
      creationIndex: index,
      metadataUri: `https://fixtures.stolla.test/${id}.json`,
      metadataHash: "12".repeat(32),
      metadataSchemaVersion: 1 as const,
    },
    metadata: {
      schemaVersion: 1 as const,
      name,
      description: `${name} deterministic browser fixture.`,
      externalLinks: [],
    },
    metadataError: null,
    governance: {
      votingDelay: 1,
      votingPeriod: 100,
      proposalThreshold: "1",
      quorum: "1",
      unavailableFields: [],
    },
  };
}

export async function installPublicFixtures(page: Page) {
  await page.addInitScript(
    ({ communities, proposals }) => {
      window.__STOLLA_E2E__ = {
        communities,
        proposals,
        diagnostics: { submissions: 0, invocations: [] },
      };
    },
    {
      communities: [
        community(ALPHA_ID, "Alpha Builders", ALPHA_NFT, ALPHA_GOVERNOR, 0),
        community(BETA_ID, "Beta Citizens", BETA_NFT, BETA_GOVERNOR, 1),
      ],
      proposals: {
        [ALPHA_GOVERNOR]: [
          { id: PROPOSAL_ID, description: "Alpha treasury proposal", state: 1 },
        ],
        [BETA_GOVERNOR]: [
          { id: PROPOSAL_ID, description: "Beta grants proposal", state: 1 },
        ],
      },
    },
  );
}

export async function installCreationFixtures(
  page: Page,
  scenario: "success" | "wallet-rejection" | "simulation-failure" = "success",
) {
  await page.addInitScript(
    ({ scenario, passphrase, wallet, expectedRecord }) => {
      const hash = "ab".repeat(32);
      window.__STOLLA_E2E__ = {
        wallet: {
          address: wallet,
          networkPassphrase: passphrase,
          rejected: scenario === "wallet-rejection",
        },
        communities: [],
        proposals: {},
        diagnostics: { submissions: 0, invocations: [] },
        deployment: {
          async simulate(input) {
            if (scenario === "simulation-failure") {
              throw new Error("Simulation failed: insufficient resources.");
            }
            window.__STOLLA_E2E__!.diagnostics!.invocations.push({
              contractId: input.factoryId,
              method: "create_community",
              sourceAccount: input.creator,
              networkPassphrase: input.networkPassphrase,
              metadata: input.metadata,
              governance: input.governance,
            });
            return {
              invocation: {
                contractId: input.factoryId,
                method: "create_community",
                sourceAccount: input.creator,
                networkPassphrase: input.networkPassphrase,
                metadataHash: "12".repeat(32),
                externalKey: "12".repeat(32),
                args: [],
              },
              feeStroops: "12345678",
              expectedRecord,
              sequence: "101",
              expiresAt: Math.floor(Date.now() / 1000) + 300,
              prepared: "mock-xdr",
            };
          },
          async signAndSubmit(simulation, signTransaction) {
            await new Promise((resolve) => setTimeout(resolve, 30));
            await signTransaction(String(simulation.prepared), {
              networkPassphrase: simulation.invocation.networkPassphrase,
              address: simulation.invocation.sourceAccount,
            });
            window.__STOLLA_E2E__!.diagnostics!.submissions += 1;
            return { transactionHash: hash };
          },
          async transactionStatus() {
            return "success";
          },
          async verifyRegistry() {
            return "verified";
          },
          async readFactoryOwner() {
            return wallet;
          },
        },
      };
    },
    {
      scenario,
      passphrase: TESTNET_PASSPHRASE,
      wallet: WALLET_ADDRESS,
      expectedRecord: community(
        "cc".repeat(32),
        "Creator Guild",
        ALPHA_NFT,
        ALPHA_GOVERNOR,
        2,
      ).record,
    },
  );
}

export async function completeWizardToReview(page: Page) {
  await page.goto("/communities/create");
  await expect(
    page.getByRole("heading", { name: "Describe your community" }),
  ).toBeVisible();
  // Allow the wizard hydration timeout to settle before editing controlled inputs.
  await page.waitForTimeout(50);
  await page.getByLabel("Community name (required)").fill("Creator Guild");
  await page.getByLabel("NFT symbol (required)").fill("CREATE");
  await page
    .getByLabel("Description (required)")
    .fill("A deterministic community creation fixture.");
  await page
    .getByLabel("NFT collection URI (required)")
    .fill("https://fixtures.stolla.test/collection.json");
  await page
    .getByLabel("Community metadata URI (required)")
    .fill("https://fixtures.stolla.test/community.json");
  await expect(page.getByLabel("Community name (required)")).toHaveValue(
    "Creator Guild",
  );
  await page.getByRole("button", { name: "Continue to governance" }).click();
  await expect(
    page.getByRole("heading", { name: "Configure governance" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review community" }).click();
  await expect(
    page.getByRole("heading", { name: "Review deployment inputs" }),
  ).toBeVisible();
  await page
    .getByLabel(/I confirm that these metadata and governance values/)
    .check();
}
