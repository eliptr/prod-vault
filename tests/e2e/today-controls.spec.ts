import { test, expect } from "@playwright/test";
import { defaults } from "../../src/lib/domain";

test("weekly sessions, goals, project tasks, daily display, and offline persistence", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add habit", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Gym");
  await page.getByLabel("Tracking").selectOption("weekly");
  await page.getByLabel("Weekly target").fill("3");
  await page.getByRole("button", { name: "Save habit" }).click();
  await page.getByRole("button", { name: "Complete Gym", exact: true }).click();
  await expect(page.getByText("1 / 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reopen Gym", exact: true }).click();
  await expect(page.getByText("0 / 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Complete Gym", exact: true }).click();
  await page.getByRole("button", { name: "Add goal", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Sessions goal");
  await page.getByLabel("Target", { exact: true }).fill("10");
  await page.getByRole("button", { name: "Save goal" }).click();
  await page
    .getByRole("button", {
      name: "Increase Progress for Sessions goal",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("spinbutton", {
      name: "Progress for Sessions goal",
      exact: true,
    }),
  ).toHaveValue("1");
  await page
    .getByRole("spinbutton", {
      name: "Progress for Sessions goal",
      exact: true,
    })
    .fill("12");
  await page
    .getByRole("spinbutton", {
      name: "Progress for Sessions goal",
      exact: true,
    })
    .press("Enter");
  await expect(
    page.getByRole("progressbar", { name: "Sessions goal", exact: true }),
  ).toHaveAttribute("aria-valuenow", "100");
  await page
    .getByRole("button", {
      name: "Decrease Progress for Sessions goal",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("spinbutton", {
      name: "Progress for Sessions goal",
      exact: true,
    }),
  ).toHaveValue("11");
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Fitness");
  await page.getByRole("button", { name: "Save project" }).click();
  await page.getByLabel("Tasks for Fitness", { exact: true }).click();
  await page
    .getByRole("button", { name: "Add task to Fitness", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Project", exact: true }),
  ).toHaveValue(/.+/);
  await page.getByLabel("Name", { exact: true }).fill("Book trainer");
  await page.getByLabel("Due date").fill("2099-12-31");
  await page
    .getByRole("combobox", { name: "Schedule", exact: true })
    .selectOption("daily");
  await page.getByRole("button", { name: "Save task" }).click();
  const tasksSection = page
    .locator(".overview>.section")
    .filter({ has: page.getByRole("heading", { name: /^Tasks/ }) });
  await expect(
    tasksSection.getByRole("button", {
      name: "Complete Book trainer",
      exact: true,
    }),
  ).toBeVisible();
  await tasksSection
    .getByRole("button", { name: "Complete Book trainer", exact: true })
    .click();
  await expect(
    tasksSection.getByRole("button", {
      name: "Complete Book trainer",
      exact: true,
    }),
  ).toHaveCount(0);
  const project = page.locator(".project-record").filter({
    has: page.getByRole("button", { name: "Fitness", exact: true }),
  });
  await project.getByText("Completed", { exact: true }).click();
  await project
    .getByRole("button", { name: "Reopen Book trainer", exact: true })
    .click();
  await expect(
    tasksSection.getByRole("button", {
      name: "Complete Book trainer",
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("1 / 3", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("spinbutton", {
      name: "Progress for Sessions goal",
      exact: true,
    }),
  ).toHaveValue("11");
  await expect(
    tasksSection.getByRole("button", {
      name: "Complete Book trainer",
      exact: true,
    }),
  ).toBeVisible();
  await context.setOffline(false);
  await page.screenshot({
    path: `test-results/today-controls-${test.info().project.name}.png`,
    fullPage: true,
    scale: "css",
  });
});
test("centered panels stay inside visual viewport with keyboard offsets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Today", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => {
    const viewport = new EventTarget();
    Object.assign(viewport, {
      height: 844,
      width: 390,
      offsetTop: 0,
      offsetLeft: 0,
    });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
  });
  for (const theme of ["light", "dark"]) {
    await page.goto("/#settings");
    await page.getByLabel("Appearance").selectOption(theme);
    await page.goto("/#today");
    for (const kind of ["habit", "task", "project", "goal"]) {
      const trigger = page.getByRole("button", {
        name: `Add ${kind}`,
        exact: true,
      });
      await trigger.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await expect(
        page.getByRole("heading", { name: `New ${kind}`, exact: true }),
      ).toBeFocused();
      await page.evaluate(() => {
        Object.assign(window.visualViewport!, {
          height: 360,
          width: 378,
          offsetTop: 48,
          offsetLeft: 6,
        });
        window.visualViewport!.dispatchEvent(new Event("resize"));
      });
      await page.getByLabel("Name", { exact: true }).fill("Long form check");
      const rect = await page.locator(".dialog-card").boundingBox();
      expect(rect!.x).toBeGreaterThanOrEqual(14);
      expect(rect!.x + rect!.width).toBeLessThanOrEqual(376);
      expect(rect!.y).toBeGreaterThanOrEqual(56);
      expect(rect!.y + rect!.height).toBeLessThanOrEqual(400);
      await expect(
        dialog.getByRole("button", { name: "Close editor", exact: true }),
      ).toBeVisible();
      const footer = await page.locator(".dialog-footer").boundingBox();
      expect(footer!.y + footer!.height).toBeLessThanOrEqual(400);
      await page.screenshot({
        path: `test-results/dialog-${test.info().project.name}-${kind}-${theme}.png`,
        scale: "css",
      });
      page.once("dialog", (dialog) => dialog.accept());
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await page.evaluate(() => {
        Object.assign(window.visualViewport!, {
          height: 844,
          width: 390,
          offsetTop: 0,
          offsetLeft: 0,
        });
        window.visualViewport!.dispatchEvent(new Event("resize"));
      });
    }
  }
  await page.goto("/#settings");
  await page.getByLabel("Restore from backup", { exact: true }).setInputFiles({
    name: "empty.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 2,
        exportedAt: new Date().toISOString(),
        habits: [],
        entries: [],
        tasks: [],
        templates: [],
        projects: [],
        goals: [],
        settings: defaults,
      }),
    ),
  });
  await expect(
    page.getByRole("dialog", { name: "Replace local data?", exact: true }),
  ).toBeVisible();
  const restoreBox = await page.locator(".dialog-card").boundingBox();
  expect(restoreBox!.x).toBeGreaterThanOrEqual(8);
  expect(restoreBox!.y + restoreBox!.height).toBeLessThanOrEqual(836);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.evaluate(() => {
    Object.assign(window.visualViewport!, {
      width: 1280,
      height: 844,
      offsetLeft: 0,
      offsetTop: 0,
    });
  });
  await page.goto("/#tasks");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  const desktop = await page.locator(".dialog-card").boundingBox();
  expect(desktop!.width).toBe(440);
  expect(desktop!.x + desktop!.width / 2).toBe(640);
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
});
