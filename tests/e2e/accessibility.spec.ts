import { loadSample } from "./helpers";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("dark appearance has accessible contrast", async ({ page }) => {
  await page.goto("/");
  await loadSample(page);
  await expect(
    page.getByRole("button", { name: "Read a little", exact: true }),
  ).toBeVisible();
  await page.goto("/#settings");
  await page.getByLabel("Appearance").selectOption("dark");
  for (const section of ["today", "habits", "reports"]) {
    await page.goto("/#" + section);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      scan.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
});
test("accessible screens and keyboard editor", async ({ page }) => {
  await page.goto("/");
  await loadSample(page);
  for (const section of [
    "today",
    "habits",
    "tasks",
    "calendar",
    "projects",
    "goals",
    "reports",
    "settings",
  ]) {
    await page.goto("/#" + section);
    await expect(page.locator(".section-heading h1")).toBeVisible();
    const scan = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      scan.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
  }
  await page.goto("/#habits");
  await page.getByRole("button", { name: "Add habit", exact: true }).click();
  if (test.info().project.name === "mobile")
    await expect(
      page.getByRole("heading", { name: "New habit", exact: true }),
    ).toBeFocused();
  else await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    scan.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("waiting service worker update preserves records", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "One service-worker lifecycle test in Chromium.",
  );
  await page.goto("/");
  await loadSample(page);
  await expect(
    page.getByRole("button", { name: "Read a little", exact: true }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.evaluate(async () => {
    await navigator.serviceWorker.register("/sw.js?update-test=2");
  });
  await expect(
    page.getByRole("button", { name: "Update available" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Read a little", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Update available", includeHidden: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: "Update available" }).click(),
  ]);
  await expect(
    page.getByRole("button", { name: "Read a little", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Read a little", exact: true }),
  ).toBeVisible();
});
