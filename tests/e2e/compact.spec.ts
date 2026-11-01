import { test, expect } from "@playwright/test";
import { loadSample } from "./helpers";
test("compact density, responsive themes and controls", async ({ page }) => {
  await loadSample(page);
  for (const width of [360, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ["light", "dark"]) {
      await page.goto("/#settings");
      await page.getByLabel("Appearance").selectOption(theme);
      await page.goto("/#today");
      await expect(
        page.getByRole("heading", { name: "Today", exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await expect(
        page.locator(".welcome,.page-footer,.sidebar-note,.stats"),
      ).toHaveCount(0);
      const controls = await page
        .locator("main button:visible,main input:visible")
        .evaluateAll((elements) =>
          elements
            .map((e) => ({
              label: e.getAttribute("aria-label") || e.textContent,
              rect: e.getBoundingClientRect(),
            }))
            .filter((e) => e.rect.width < 24 || e.rect.height < 24)
            .map((e) => e.label),
        );
      expect(controls).toEqual([]);
      if (width === 390) {
        const nav = await page.locator(".bottom-nav").boundingBox();
        for (const locator of [
          page.locator(".summary-strip"),
          page.locator(".habit-row"),
          page.getByRole("heading", { name: /^Tasks/ }),
          page.locator(".task-row").nth(0),
          page.locator(".task-row").nth(1),
        ]) {
          for (const box of await locator.all()) {
            const rect = await box.boundingBox();
            expect(rect).toBeTruthy();
            expect(rect!.y + rect!.height).toBeLessThan(nav!.y);
          }
        }
      }
      await page.screenshot({
        path: `test-results/compact-${test.info().project.name}-${width}-${theme}.png`,
        fullPage: true,
        scale: "css",
      });
    }
  }
});
