import { test, expect } from "@playwright/test";
import { loadSample } from "./helpers";

test("habit visibility and icons work on Today, offline and after restore", async ({
  page,
  context,
}) => {
  await page.clock.install({ time: new Date("2026-11-16T10:00:00Z") });
  await loadSample(page);
  const todayHabits = page.locator(".section-habits .name-text");
  const habitNames = page.locator(".habit-list .name-text");
  await expect(todayHabits).toHaveText([
    "Move your body",
    "A moment of focus",
    "Read a little",
  ]);
  await expect(page.locator(".summary-strip strong").first()).toHaveText("0/3");
  await page
    .getByRole("button", { name: "Read a little", exact: true })
    .click();
  const show = page.getByLabel("Show on Today", { exact: true });
  await expect(show).toBeChecked();
  await show.uncheck();
  await page.getByText("Appearance", { exact: true }).click();
  const picker = page.getByRole("button", { name: "Choose icon", exact: true });
  await picker.click();
  await page.getByRole("button", { name: "Leaf", exact: true }).click();
  await expect(picker).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByLabel("Icon", { exact: true })).toHaveValue("🌿");
  await page.getByRole("button", { name: "Save habit", exact: true }).click();
  await expect(todayHabits).toHaveText(["Move your body", "A moment of focus"]);
  await expect(page.locator(".summary-strip strong").first()).toHaveText("0/2");
  await page.getByRole("button", { name: "Log habit", exact: true }).click();
  await expect(
    page
      .locator(".goal-source")
      .getByRole("button", { name: "Read a little", exact: true }),
  ).toBeVisible();

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(todayHabits).toHaveCount(2);
  await page.goto("/#calendar");
  await expect(
    page.getByRole("button", { name: "Read a little", exact: true }),
  ).toBeVisible();
  await page.goto("/#habits");
  await expect(habitNames).toHaveText([
    "Move your body",
    "Read a little",
    "A moment of focus",
  ]);

  await page.goto("/#settings");
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const backupPath = (await (await pending).path())!;
  await page
    .getByLabel("Restore from backup", { exact: true })
    .setInputFiles(backupPath);
  await page
    .getByRole("button", { name: "Replace local data", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/#habits");
  await page
    .getByRole("button", { name: "Read a little", exact: true })
    .click();
  await expect(show).not.toBeChecked();
  await show.check();
  await page.getByText("Appearance", { exact: true }).click();
  await expect(page.getByLabel("Icon", { exact: true })).toHaveValue("🌿");
  await page.getByLabel("Icon", { exact: true }).fill("🚲");
  await page.getByRole("button", { name: "Save habit", exact: true }).click();
  await expect(habitNames).toHaveText([
    "Move your body",
    "A moment of focus",
    "Read a little",
  ]);
  await page.goto("/#today");
  await expect(todayHabits).toHaveText([
    "Move your body",
    "A moment of focus",
    "Read a little",
  ]);
});

test("pointer activation and dialog focus restoration do not draw broad outlines", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await loadSample(page);
  await page.goto("/#habits");
  const trigger = page.getByRole("button", {
    name: "Read a little",
    exact: true,
  });
  await trigger.click();
  await expect(
    page.getByRole("heading", { name: "Edit habit", exact: true }),
  ).toHaveCSS("outline-style", "none");
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveCSS("outline-style", "none");
  await page.keyboard.press("Tab");
  await expect(page.locator(":focus")).toHaveCSS("outline-style", "solid");
});
