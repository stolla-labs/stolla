/**
 * Covers issue #305: a short public smoke path proving the landing page's
 * multi-community entry points render without a wallet extension, even when
 * the registry is empty.
 */
import { expect, test, type Page } from "@playwright/test";

async function installEmptyRegistryFixture(page: Page) {
  await page.addInitScript(() => {
    window.__STOLLA_E2E__ = {
      communities: [],
      proposals: {},
      diagnostics: { submissions: 0, invocations: [] },
    };
  });
}

test.beforeEach(async ({ page }) => {
  await installEmptyRegistryFixture(page);
});

test("guides a walletless visitor from the landing page to Browse and Create communities", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: /Launch your community/ }),
  ).toBeVisible();

  // The hero and the closing CTA both offer this link; take the first one.
  await page.getByRole("link", { name: "Browse communities" }).first().click();
  await expect(page).toHaveURL(/\/communities\/?$/);
  await expect(page.getByRole("heading", { name: "Communities" })).toBeVisible();
  // The registry is configured but reports zero communities: this is the
  // known empty state, not a blank crash or an unhandled error boundary.
  await expect(
    page.getByText("No communities are registered yet."),
  ).toBeVisible();
  // Scoped to <main>: the route announcer outside it also carries role="alert".
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);

  await page.goto("/");
  await page.getByRole("link", { name: "Create a community" }).first().click();
  await expect(page).toHaveURL(/\/communities\/create\/?$/);
  await expect(
    page.getByRole("heading", { name: "Describe your community" }),
  ).toBeVisible();
  await expect(page.getByLabel("Community name (required)")).toBeVisible();
  // Scoped to <main>: the route announcer outside it also carries role="alert".
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
});
