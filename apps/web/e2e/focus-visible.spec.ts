import { expect, test, type Page } from "@playwright/test";

const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

async function expectKeyboardStopsToHaveRings(page: Page, path: string) {
  await page.goto(path);
  await page.locator("body").click({ position: { x: 1, y: 1 } });

  const visited = new Set<number>();

  for (let index = 0; index < 60; index += 1) {
    await page.keyboard.press("Tab");
    const focus = await page.evaluate((selector) => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement) || active === document.body) {
        return null;
      }

      const controls = Array.from(document.querySelectorAll(selector));
      const style = getComputedStyle(active);
      return {
        index: controls.indexOf(active),
        focusVisible: active.matches(":focus-visible"),
        outlineStyle: style.outlineStyle,
        outlineWidth: Number.parseFloat(style.outlineWidth),
      };
    }, focusableSelector);

    if (!focus) break;
    // Ignore development-tool shadow hosts; they are not app controls.
    if (focus.index < 0) continue;
    if (visited.has(focus.index)) break;
    visited.add(focus.index);

    expect(focus.focusVisible, `${path} control ${focus.index}`).toBe(true);
    expect(focus.outlineStyle, `${path} control ${focus.index}`).toBe("solid");
    expect(focus.outlineWidth, `${path} control ${focus.index}`).toBe(3);
  }

  expect(visited.size, `${path} should expose keyboard controls`).toBeGreaterThan(0);
}

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 900 },
]) {
  test(`shows consistent keyboard focus rings at ${viewport.name} width`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);

    for (const path of [
      "/",
      "/community",
      "/communities",
      "/proposals",
      "/proposals/invalid",
    ]) {
      await expectKeyboardStopsToHaveRings(page, path);
    }
  });
}

test("does not show a persistent ring after a pointer click", async ({ page }) => {
  await page.goto("/");
  const brand = page.getByRole("button", { name: "Scroll to top" });

  await brand.click();

  await expect(brand).toBeFocused();
  expect(await brand.evaluate((element) => element.matches(":focus-visible"))).toBe(
    false,
  );
});
