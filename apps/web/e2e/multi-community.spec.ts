/**
 * Covers issue #150: Playwright multi-community public browsing flow.
 */
import { expect, test } from "@playwright/test";
import {
  ALPHA_ID,
  BETA_ID,
  PROPOSAL_ID,
  installPublicFixtures,
} from "./fixtures";

test.beforeEach(async ({ page }) => {
  await installPublicFixtures(page);
});

test("browses canonical scoped routes and switches communities without stale proposals", async ({
  page,
}) => {
  await page.goto("/communities");
  await expect(page.getByRole("heading", { name: "Communities" })).toBeVisible();
  await page.getByLabel("Search communities by name").fill(" alpha ");
  await expect(page).toHaveURL(/\/communities\?q=alpha$/i);
  await page
    .getByRole("link", { name: "View Alpha Builders community details" })
    .click();
  await expect(page).toHaveURL(`/communities/${ALPHA_ID}`);
  await expect(page.getByRole("heading", { name: "Alpha Builders" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/communities\?q=alpha$/i);
  await expect(page.getByLabel("Search communities by name")).toHaveValue(
    "alpha",
  );
  await page
    .getByRole("link", { name: "View Alpha Builders community details" })
    .click();
  await page.getByRole("link", { name: "View community proposals" }).click();
  await expect(page).toHaveURL(`/communities/${ALPHA_ID}/proposals`);
  await expect(
    page.getByRole("heading", { name: "Alpha Builders proposals" }),
  ).toBeVisible();
  await expect(page.getByText("Fund Alpha treasury observability")).toBeVisible();
  await expect(page.getByText(/public dashboards for community treasury/)).toBeVisible();

  await page.getByRole("link", { name: /View proposal/i }).first().click();
  await expect(page).toHaveURL(
    `/communities/${ALPHA_ID}/proposals/${PROPOSAL_ID}`,
  );
  await expect(
    page.getByRole("heading", { name: "Fund Alpha treasury observability" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Open discussion/ })).toHaveAttribute(
    "href",
    "https://forum.example.org/t/alpha-observability",
  );
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText(
    "Alpha Builders",
  );

  await page.locator('button[aria-haspopup="dialog"]').click();
  const switcher = page.getByRole("dialog", { name: "Choose a community" });
  await switcher.getByRole("link", { name: /Beta Citizens/ }).click();
  await expect(page).toHaveURL(`/communities/${BETA_ID}`);
  await page.getByRole("link", { name: "View community proposals" }).click();
  await expect(page).toHaveURL(`/communities/${BETA_ID}/proposals`);
  await expect(page.getByText("Beta grants proposal")).toBeVisible();
  await expect(page.getByText("Fund Alpha treasury observability")).toHaveCount(0);

  const dimensions = await page.evaluate(() => ({
    client: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBe(dimensions.client);
});
