import { expect, test, type Page } from "@playwright/test";
import { configureMockWallet } from "./fixtures/mockWallet";

async function expectNoHorizontalOverflow(page: Page) {
  const width = page.viewportSize()?.width;
  await expect
    .poll(() =>
      page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        headerWidth: document.querySelector("header")?.scrollWidth ?? width,
      })),
    )
    .toEqual({
      clientWidth: width,
      documentWidth: width,
      bodyWidth: width,
      headerWidth: width,
    });
}

test("navigates landing, Community, and Proposals without mobile overflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "Browse communities" }).first().click();
  await expect(page).toHaveURL("/communities");

  await expect(
    page.getByRole("heading", { level: 1, name: "Communities" }),
  ).toBeVisible();
  const appNavigation = page.getByRole("navigation");
  await expect(
    appNavigation.getByRole("link", { name: "Legacy collection" }),
  ).toBeVisible();
  await expect(
    appNavigation.getByRole("link", { name: "Proposals" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect Wallet" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await appNavigation.getByRole("link", { name: "Proposals" }).click();
  await expect(page).toHaveURL("/proposals");
  await expect(
    page.getByRole("heading", { level: 1, name: "Proposals" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await appNavigation.getByRole("link", { name: "Legacy collection" }).click();
  await expect(page).toHaveURL("/community");
  await expect(
    page.getByRole("heading", { level: 1, name: "Community NFT" }),
  ).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test("mobile header chrome keeps wallet connect affordance and account menu within viewport on /communities and /proposals", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/communities");
  const connectButton = page.getByRole("button", { name: "Connect Wallet" });
  await expect(connectButton).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.goto("/proposals");
  await expect(connectButton).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await configureMockWallet(page);
  await page.goto("/communities");

  const accountTrigger = page.getByRole("button", { name: /^Account / });
  await expect(accountTrigger).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await accountTrigger.click();
  const accountMenu = page.getByRole("menu", { name: "Account menu" });
  await expect(accountMenu).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("menuitem", { name: "Disconnect" }).click();
  await expect(page.getByRole("button", { name: "Connect Wallet" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
