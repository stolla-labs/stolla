/**
 * Covers issue #395: mobile header overflow and wallet connect chrome via the
 * deterministic `__STOLLA_E2E__` bridge (no real Freighter extension).
 */
import { expect, test, type Page } from "@playwright/test";
import {
  MOCK_WALLET_ADDRESS,
  configureMockWallet,
} from "./fixtures/mockWallet";
import { attachRouteDiagnostics } from "./utils/diagnostics";

async function expectNoHorizontalOverflow(page: Page) {
  const width = page.viewportSize()?.width;
  await expect
    .poll(() =>
      page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        documentWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
      })),
    )
    .toEqual({
      clientWidth: width,
      documentWidth: width,
      bodyWidth: width,
    });

  const header = page.getByRole("banner");
  const box = await header.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual((width ?? 0) + 1);
}

test.describe("mobile header and wallet chrome", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      testInfo.project.name !== "mobile-chromium",
      "mobile header / account menu chrome is asserted on the Pixel 5 project",
    );
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status === testInfo.expectedStatus) return;
    await attachRouteDiagnostics(page, testInfo, {
      suite: "mobile-header-wallet",
      viewport: page.viewportSize(),
    });
  });

  for (const path of ["/communities", "/proposals"] as const) {
    test(`keeps the header inside the ${path} viewport without overflow`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page.getByRole("banner")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Connect Wallet" }),
      ).toBeVisible();
      await expect(
        page
          .getByRole("navigation", { name: "Member shortcuts" })
          .getByRole("button", { name: "Connect" }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  test("opens the mocked account menu without Freighter", async ({ page }) => {
    await configureMockWallet(page);
    await page.goto("/communities");

    const accountTrigger = page.getByRole("button", { name: /^Account / });
    await expect(accountTrigger).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await accountTrigger.click();
    const menu = page.getByRole("menu", { name: "Account menu" });
    await expect(menu).toBeVisible();
    await expect(menu.getByText(MOCK_WALLET_ADDRESS)).toBeVisible();
    await expect(
      menu.getByRole("menuitem", { name: "Disconnect" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(accountTrigger).toBeFocused();

    // Clear the bridge wallet so disconnect sticks (the provider polls the bridge).
    await page.evaluate(() => {
      if (window.__STOLLA_E2E__) delete window.__STOLLA_E2E__.wallet;
    });
    await accountTrigger.click();
    await menu.getByRole("menuitem", { name: "Disconnect" }).click();
    await expect(menu).toHaveCount(0);

    const connect = page.getByRole("button", { name: "Connect Wallet" });
    await expect(connect).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("shows Connect Wallet on /proposals and opens account menu when bridged", async ({
    page,
  }) => {
    await page.goto("/proposals");
    await expect(
      page.getByRole("button", { name: "Connect Wallet" }),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await configureMockWallet(page);
    await page.goto("/proposals");
    const accountTrigger = page.getByRole("button", { name: /^Account / });
    await expect(accountTrigger).toBeVisible();
    await accountTrigger.click();
    await expect(page.getByRole("menu", { name: "Account menu" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
