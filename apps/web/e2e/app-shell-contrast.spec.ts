import { expect, test, type Locator } from "@playwright/test";

async function contrast(locator: Locator) {
  return locator.evaluate((element) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d")!;
    const channels = (value: string) => {
      context.fillStyle = "#0b0f19";
      context.fillRect(0, 0, 1, 1);
      context.fillStyle = value;
      context.fillRect(0, 0, 1, 1);
      return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
    };
    const luminance = (value: string) => {
      const [r, g, b] = channels(value).map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return r * 0.2126 + g * 0.7152 + b * 0.0722;
    };
    const style = getComputedStyle(element);
    const foreground = luminance(style.color);
    const background = luminance(style.backgroundColor);
    return (Math.max(foreground, background) + 0.05) /
      (Math.min(foreground, background) + 0.05);
  });
}

test("app-shell primary CTA remains legible at rest, hover and disabled", async ({ page }) => {
  await page.goto("/proposals");
  const button = page.getByRole("button", { name: "Connect Wallet" });
  await expect(button).toBeVisible();
  expect(await contrast(button)).toBeGreaterThanOrEqual(4.5);

  await button.hover();
  expect(await contrast(button)).toBeGreaterThanOrEqual(4.5);

  await button.evaluate((element: HTMLButtonElement) => { element.disabled = true; });
  expect(await contrast(button)).toBeGreaterThanOrEqual(4.5);
  expect(await button.evaluate((element) => getComputedStyle(element).borderTopStyle)).toBe("dashed");
});

test("switcher and secondary CTA have visible boundaries and hover text", async ({ page }) => {
  await page.goto("/communities");
  const switcher = page.getByRole("button", { name: "Choose community" });
  const wallet = page.getByRole("button", { name: "Connect Wallet" });
  await expect(switcher).toBeVisible();
  await expect(wallet).toBeVisible();

  for (const control of [switcher, wallet]) {
    await control.hover();
    expect(await contrast(control)).toBeGreaterThanOrEqual(4.5);
    expect(await control.evaluate((element) => getComputedStyle(element).borderTopStyle)).toBe("solid");
  }
});
