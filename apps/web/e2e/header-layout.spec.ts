import { expect, test, type Page } from "@playwright/test";
import { TESTNET_PASSPHRASE, WALLET_ADDRESS } from "./fixtures";

async function expectNoHeaderOrViewportOverflow(page: Page) {
  const viewportWidth = page.viewportSize()?.width ?? 390;
  await expect
    .poll(async () => {
      return page.evaluate((vw) => {
        const header = document.querySelector("header");
        const headerRect = header?.getBoundingClientRect();
        const clientWidth = document.documentElement.clientWidth;
        const documentWidth = document.documentElement.scrollWidth;
        const bodyWidth = document.body.scrollWidth;
        const headerRightEdge = headerRect ? Math.round(headerRect.right) : 0;

        return (
          documentWidth <= clientWidth &&
          bodyWidth <= clientWidth &&
          headerRightEdge <= vw + 1
        );
      }, viewportWidth);
    })
    .toBe(true);
}

async function installDeferredWalletBridge(page: Page) {
  await page.addInitScript(
    ({ address, networkPassphrase }) => {
      window.__STOLLA_E2E__ = {
        ...(window.__STOLLA_E2E__ ?? {}),
        wallet: {
          address,
          networkPassphrase,
          autoConnect: false,
          disconnected: false,
        },
      };
    },
    { address: WALLET_ADDRESS, networkPassphrase: TESTNET_PASSPHRASE },
  );
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
] as const) {
  test(`header switcher accessible name stays complete at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/communities");

    const switcher = page.getByRole("button", { name: "Choose community" });
    await expect(switcher).toBeVisible();
    const box = await switcher.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(120);

    const clipped = await switcher.evaluate((el) => {
      const text = el.querySelector("span");
      if (!text) return true;
      return text.scrollWidth > text.clientWidth + 1;
    });
    expect(clipped).toBe(false);

    await expect(
      page.getByRole("navigation", { name: "Primary" }).getByRole("link", {
        name: "Legacy collection",
      }),
    ).toBeVisible();
  });
}

for (const route of ["/communities", "/proposals"] as const) {
  test(`mobile header chrome avoids horizontal overflow and supports mocked wallet connect/menu/disconnect on ${route}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installDeferredWalletBridge(page);
    await page.goto(route);

    await expectNoHeaderOrViewportOverflow(page);

    const connectButton = page.getByRole("button", { name: "Connect Wallet" });
    await expect(connectButton).toBeVisible();
    await connectButton.click();

    const accountTrigger = page.getByRole("button", { name: /^Account /i });
    await expect(accountTrigger).toBeVisible();
    await expectNoHeaderOrViewportOverflow(page);

    await accountTrigger.click();
    const menu = page.getByRole("menu", { name: "Account menu" });
    await expect(menu).toBeVisible();
    await expect(menu.getByText(WALLET_ADDRESS)).toBeVisible();
    await expectNoHeaderOrViewportOverflow(page);

    await menu.getByRole("menuitem", { name: "Disconnect" }).click();
    await expect(menu).toBeHidden();
    await expect(page.getByRole("button", { name: "Connect Wallet" })).toBeVisible();
    await expectNoHeaderOrViewportOverflow(page);
  });
}

test("desktop header supports deterministic wallet connect and disconnect via E2E bridge", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await installDeferredWalletBridge(page);
  await page.goto("/proposals");

  const connectButton = page.getByRole("button", { name: "Connect Wallet" });
  await expect(connectButton).toBeVisible();
  await connectButton.click();

  const disconnectButton = page.getByRole("button", { name: "Disconnect" });
  await expect(disconnectButton).toBeVisible();
  await disconnectButton.click();

  await expect(page.getByRole("button", { name: "Connect Wallet" })).toBeVisible();
});
