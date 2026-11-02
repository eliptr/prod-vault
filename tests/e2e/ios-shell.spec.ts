import { test, expect } from "@playwright/test";

test("iPhone safe areas and browser chrome follow the selected theme", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Today", exact: true }),
  ).toBeVisible();
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /viewport-fit=cover/,
  );
  const colors = async (color: string, scheme: string) => {
    await expect(page.locator("html")).toHaveAttribute("data-theme", scheme);
    for (const meta of await page.locator('meta[name="theme-color"]').all())
      await expect(meta).toHaveAttribute("content", color);
    await expect(page.locator('meta[name="color-scheme"]')).toHaveAttribute(
      "content",
      scheme,
    );
  };
  await colors("#191e1b", "dark");
  await page.evaluate(() => {
    document.documentElement.style.setProperty("--safe-area-top", "59px");
    document.documentElement.style.setProperty("--safe-area-bottom", "34px");
  });
  const nav = await page.locator(".bottom-nav").boundingBox();
  const buttons = await page.locator(".bottom-nav a").all();
  expect(buttons).toHaveLength(5);
  for (const button of buttons) {
    const rect = await button.boundingBox();
    expect(rect!.height).toBeGreaterThanOrEqual(44);
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(844 - 34);
  }
  expect(nav!.height).toBe(87);
  const heading = await page
    .getByRole("heading", { name: "Today", exact: true })
    .boundingBox();
  expect(heading!.y).toBeGreaterThanOrEqual(59);
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    "rgb(25, 30, 27)",
  );
  await page.screenshot({
    path: `test-results/ios-safe-area-${test.info().project.name}.png`,
    scale: "css",
  });
  await page.goto("/#settings");
  await page.getByLabel("Appearance").selectOption("light");
  await colors("#f5f6f4", "light");
  await page.emulateMedia({ colorScheme: "light" });
  await page.getByLabel("Appearance").selectOption("dark");
  await colors("#191e1b", "dark");
  await page.reload();
  await colors("#191e1b", "dark");
  await page.getByLabel("Appearance").selectOption("system");
  await colors("#f5f6f4", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await colors("#191e1b", "dark");
});
