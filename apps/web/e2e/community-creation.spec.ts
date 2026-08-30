import { expect, test, type Page } from "@playwright/test";
import {
  ALPHA_GOVERNOR,
  ALPHA_NFT,
  FACTORY_ID,
  TESTNET_PASSPHRASE,
  WALLET_ADDRESS,
  completeWizardToReview,
  installCreationFixtures,
} from "./fixtures";

/**
 * Scoped to the application's own markup so the Next.js dev tools button and
 * route announcer cannot satisfy a selector.
 */
const wizard = (page: Page) => page.getByRole("main");

const simulateButton = (page: Page) =>
  wizard(page).getByRole("button", { name: /Simulate deployment|Rebuild simulation/i });
const deployButton = (page: Page) =>
  wizard(page).getByRole("button", { name: "Approve and deploy" });
const successHeading = (page: Page) =>
  wizard(page).getByRole("heading", {
    name: "Community verified in the registry",
  });

async function openReview(page: Page) {
  await completeWizardToReview(page);
  await expect(wizard(page).getByText(WALLET_ADDRESS)).toBeVisible();
  await expect(wizard(page).getByText("Creator Guild")).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await installCreationFixtures(page);
});

test("creates a community and ends on a registry-verified success screen", async ({
  page,
}) => {
  await openReview(page);

  await simulateButton(page).click();
  await expect(wizard(page).getByText(/12345678 stroops/)).toBeVisible();

  await deployButton(page).click();
  await expect(successHeading(page)).toBeVisible();
  await expect(wizard(page)).toContainText(ALPHA_NFT);
  await expect(wizard(page)).toContainText(ALPHA_GOVERNOR);
});

test("sends the expected factory invocation, source account and network", async ({
  page,
}) => {
  await openReview(page);
  await simulateButton(page).click();
  await expect(wizard(page).getByText(/12345678 stroops/)).toBeVisible();
  await deployButton(page).click();
  await expect(successHeading(page)).toBeVisible();

  const diagnostics = await page.evaluate(() => window.__STOLLA_E2E__?.diagnostics);
  expect(diagnostics?.submissions).toBe(1);
  expect(diagnostics?.invocations).toHaveLength(1);
  const invocation = diagnostics?.invocations[0] as {
    contractId: string;
    method: string;
    sourceAccount: string;
    networkPassphrase: string;
    metadata: { name: string; symbol: string };
  };
  expect(invocation.contractId).toBe(FACTORY_ID);
  expect(invocation.method).toBe("create_community");
  expect(invocation.sourceAccount).toBe(WALLET_ADDRESS);
  expect(invocation.networkPassphrase).toBe(TESTNET_PASSPHRASE);
  expect(invocation.metadata.name).toBe("Creator Guild");
  expect(invocation.metadata.symbol).toBe("CREATE");
});

test("returns to a recoverable review state when the wallet rejects", async ({
  page,
}) => {
  await installCreationFixtures(page, "wallet-rejection");
  await openReview(page);
  await simulateButton(page).click();
  await expect(wizard(page).getByText(/12345678 stroops/)).toBeVisible();

  await deployButton(page).click();
  await expect(
    wizard(page).getByText(/Wallet approval was declined/i).first(),
  ).toBeVisible();

  const diagnostics = await page.evaluate(() => window.__STOLLA_E2E__?.diagnostics);
  expect(diagnostics?.submissions).toBe(0);
  await expect(successHeading(page)).toHaveCount(0);
  await expect(deployButton(page)).toBeEnabled();

  await wizard(page).getByRole("button", { name: "Edit metadata" }).click();
  await expect(wizard(page).getByLabel("Community name (required)")).toHaveValue(
    "Creator Guild",
  );
  await wizard(page)
    .getByRole("button", { name: "Continue to governance" })
    .click();
  await wizard(page).getByRole("button", { name: "Review community" }).click();
  await expect(wizard(page).getByText("Creator Guild")).toBeVisible();
});

test("blocks signing when simulation fails", async ({ page }) => {
  await installCreationFixtures(page, "simulation-failure");
  await openReview(page);
  await simulateButton(page).click();

  await expect(
    wizard(page).getByText(/insufficient transaction resources/i).first(),
  ).toBeVisible();
  await expect(deployButton(page)).toHaveCount(0);
  await expect(successHeading(page)).toHaveCount(0);

  const diagnostics = await page.evaluate(() => window.__STOLLA_E2E__?.diagnostics);
  expect(diagnostics?.submissions).toBe(0);
  expect(diagnostics?.invocations).toHaveLength(0);
});

test("submits once when the deploy button is clicked repeatedly", async ({
  page,
}) => {
  await openReview(page);
  await simulateButton(page).click();
  await expect(wizard(page).getByText(/12345678 stroops/)).toBeVisible();

  /**
   * Three clicks in one tick, before React can re-render the button as
   * disabled. Playwright's own actionability waits would serialise them and
   * miss the race entirely.
   */
  await deployButton(page).evaluate((button: HTMLButtonElement) => {
    button.click();
    button.click();
    button.click();
  });

  await expect(successHeading(page)).toBeVisible();
  const diagnostics = await page.evaluate(() => window.__STOLLA_E2E__?.diagnostics);
  expect(diagnostics?.submissions).toBe(1);
  expect(diagnostics?.invocations).toHaveLength(1);
});

test("redirects the legacy /community/new route to the canonical wizard", async ({
  page,
}) => {
  await page.goto("/community/new");
  await expect(page).toHaveURL(/\/communities\/create\/?$/);
  await expect(
    page.getByRole("heading", { name: "Describe your community" }),
  ).toBeVisible();
});
