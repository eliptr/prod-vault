import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { loadSample } from "./helpers";

test("one-time goals persist offline and round trip through backup without save notices", async ({
  page,
  context,
  isMobile,
}) => {
  await loadSample(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#today");
  await page.getByRole("button", { name: "Add goal", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Book appointment");
  await page.getByLabel("Deadline", { exact: true }).fill("2026-12-31");
  await page
    .getByLabel("Progress source", { exact: true })
    .selectOption("once");
  await expect(page.getByLabel("Target", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(
    page.getByText("Saved on this device", { exact: true }),
  ).toHaveCount(0);
  const check = page.getByRole("button", {
    name: "Complete Book appointment",
    exact: true,
  });
  await expect(check.locator(".check-ring")).toHaveCount(1);
  await expect(
    page.locator(".one-time-goal").getByText("One-time", { exact: true }),
  ).toHaveCount(0);
  const titleBox = await page
    .locator(".one-time-goal .record-name")
    .boundingBox();
  const checkBox = await check.boundingBox();
  expect(
    Math.abs(
      titleBox!.y + titleBox!.height / 2 - checkBox!.y - checkBox!.height / 2,
    ),
  ).toBeLessThan(2);
  const dateBox = await page.locator(".one-time-goal time").boundingBox();
  expect(dateBox!.y - titleBox!.y - titleBox!.height).toBeLessThan(5);
  const project = page.locator(".section-projects .project-record").first();
  const toggle = await project.locator(".project-tasks-toggle").boundingBox();
  const progress = await project.locator(".progress-value").boundingBox();
  expect(
    Math.abs(
      toggle!.y + toggle!.height / 2 - progress!.y - progress!.height / 2,
    ),
  ).toBeLessThan(2);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page
    .getByRole("button", { name: "Complete Book appointment", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reopen Book appointment", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  if (isMobile)
    await expect(
      page.getByRole("button", {
        name: "Reopen Book appointment",
        exact: true,
      }),
    ).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.locator(".save-status")).toBeEmpty();
  await page.screenshot({
    path: `test-results/goal-toggle-${test.info().project.name}.png`,
    fullPage: true,
    scale: "css",
  });
  await expect(
    page
      .getByRole("button", { name: "Reopen Book appointment", exact: true })
      .locator("svg"),
  ).toHaveCount(1);
  await expect(
    page
      .getByRole("button", { name: "Reopen Book appointment", exact: true })
      .locator(".check-ring"),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Reopen Book appointment", exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
  await page.goto("/#settings");
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const file = (await (await pending).path())!;
  const backup = JSON.parse(await readFile(file, "utf8"));
  expect(
    backup.goals.find((g: { title: string }) => g.title === "Book appointment"),
  ).toMatchObject({ oneTime: true, value: 1, target: 1, source: "manual" });
  await page
    .getByLabel("Restore from backup", { exact: true })
    .setInputFiles(file);
  await page
    .getByRole("button", { name: "Replace local data", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/#goals");
  await page
    .getByRole("button", { name: "Reopen Book appointment", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Complete Book appointment",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "false");
  await page
    .getByRole("button", { name: "Book appointment", exact: true })
    .click();
  await expect(page.getByLabel("Progress source", { exact: true })).toHaveValue(
    "once",
  );
});
