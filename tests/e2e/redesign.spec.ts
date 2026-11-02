import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { loadSample } from "./helpers";

test("navigation links preserve filters and calendar selection across reload", async ({
  page,
}) => {
  await loadSample(page);
  await page.goto("/#tasks");
  await page.getByRole("button", { name: "Upcoming", exact: true }).click();
  await expect(page).toHaveURL(/filter=Upcoming/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Upcoming", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/#calendar");
  await page
    .getByRole("button", { name: "Previous month", exact: true })
    .click();
  const date = await page
    .locator(".calendar-grid button")
    .nth(5)
    .getAttribute("aria-label");
  await page.getByRole("button", { name: date!, exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: date!, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByLabel("Due date")).toHaveValue(date!);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".bottom-nav a")).toHaveCount(5);
  await page
    .locator(".bottom-nav")
    .getByRole("link", { name: "More", exact: true })
    .click();
  for (const label of ["Projects", "Goals", "Reports", "Settings"])
    await expect(
      page
        .locator(".more-links")
        .getByRole("link", { name: label, exact: true }),
    ).toBeVisible();
});

test("inline validation and dirty dialog cancellation retain input and focus", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Add task", exact: true });
  await trigger.click();
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Name", { exact: true })).toBeFocused();
  await page.getByLabel("Name", { exact: true }).fill("A daily task");
  await page
    .getByRole("combobox", { name: "Schedule", exact: true })
    .selectOption("daily");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(page.getByLabel("Due date")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("Due date")).toBeFocused();
  await page.getByRole("heading", { name: "New task", exact: true }).focus();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "A daily task",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("thumb add and inline historical edits work offline", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Quick add", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "New habit", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "New habit", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Gym sessions");
  await page.getByLabel("Tracking").selectOption("weekly");
  await page.getByLabel("Weekly target").fill("3");
  await page.getByRole("button", { name: "Save habit", exact: true }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.goto("/#habits");
  await page.getByText("History", { exact: false }).click();
  const grid = page.locator(".habit-grid");
  const dates = grid.locator("button:enabled");
  await dates.last().click();
  const entry = page.locator(".history-editor");
  await entry.getByRole("button", { name: /Increase/ }).click();
  await entry.getByRole("button", { name: /Increase/ }).click();
  await expect(entry.getByRole("spinbutton")).toHaveValue("2");
  await page.reload();
  await expect(
    page.getByText("2 / 3 this week", { exact: true }),
  ).toBeVisible();
  await context.setOffline(false);
});

test("screen navigation leaves stored records and backup structure intact", async ({
  page,
}) => {
  await loadSample(page);
  async function backup() {
    await page.goto("/#settings");
    const pending = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Export backup", exact: true })
      .click();
    const download = await pending;
    return JSON.parse(await readFile((await download.path())!, "utf8"));
  }
  const before = await backup();
  for (const screen of [
    "habits",
    "tasks",
    "projects",
    "goals",
    "calendar",
    "reports",
    "more",
    "today",
  ]) {
    await page.goto("/#" + screen);
    await expect(page.locator(".section-heading h1")).toBeVisible();
  }
  const after = await backup();
  expect(after.version).toBe(2);
  for (const table of [
    "habits",
    "entries",
    "tasks",
    "templates",
    "projects",
    "goals",
  ])
    expect(after[table]).toEqual(before[table]);
  delete before.settings.lastExport;
  delete after.settings.lastExport;
  expect(after.settings).toEqual(before.settings);
});

test("all screens reflow with long records in both themes", async ({
  page,
}) => {
  await loadSample(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [360, 390, 430, 768, 1280, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ["light", "dark"]) {
      await page.goto("/#settings");
      await page.getByLabel("Appearance").selectOption(theme);
      for (const screen of [
        "today",
        "habits",
        "tasks",
        "calendar",
        "projects",
        "goals",
        "reports",
        "settings",
        "more",
      ]) {
        await page.goto("/#" + screen);
        await expect(page.locator(".section-heading h1")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        if ([390, 1440].includes(width))
          await page.screenshot({
            path: `test-results/redesign-${test.info().project.name}-${width}-${theme}-${screen}.png`,
            fullPage: true,
            scale: "css",
          });
      }
    }
  }
  await page.setViewportSize({ width: 360, height: 844 });
  await page.goto("/#today");
  await page.getByRole("button", { name: "Add goal", exact: true }).click();
  await page
    .getByLabel("Name", { exact: true })
    .fill(
      "A very long goal title that still needs readable controls on a small phone screen",
    );
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^A very long goal title/ }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const targets = await page
    .locator(".value-control button, .check, .quick-trigger")
    .evaluateAll((nodes) =>
      nodes
        .map((n) => n.getBoundingClientRect())
        .every((r) => r.width >= 44 && r.height >= 44),
    );
  expect(targets).toBe(true);
  expect(errors).toEqual([]);
});

test("all record editors retain optional fields, links and archive actions", async ({
  page,
}) => {
  await loadSample(page);
  await page.goto("/#habits");
  await page
    .getByRole("button", { name: "Read a little", exact: true })
    .click();
  await page.getByText("Appearance", { exact: true }).click();
  await expect(page.getByLabel("Icon", { exact: true })).toHaveValue("📖");
  await expect(page.getByLabel("Color", { exact: true })).toHaveValue(
    "#8aa3bb",
  );
  await page.getByLabel("Name", { exact: true }).fill("Daily reading");
  await page.getByLabel("Daily target").fill("12");
  await page.getByRole("button", { name: "Save habit", exact: true }).click();
  await page
    .getByRole("button", { name: "Daily reading", exact: true })
    .click();
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Daily reading", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Show archived", exact: true })
    .click();
  await page
    .locator(".record-name")
    .filter({ hasText: "Daily reading" })
    .click();
  await page.getByRole("button", { name: "Unarchive", exact: true }).click();
  await page.goto("/#projects");
  await page
    .getByRole("button", { name: "A calmer home", exact: true })
    .click();
  await expect(page.getByLabel("Description", { exact: true })).not.toHaveValue(
    "",
  );
  await page.getByLabel("Status", { exact: true }).selectOption("completed");
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(
    page.locator(".record-meta").getByText("completed", { exact: true }),
  ).toBeVisible();
  await page.goto("/#goals");
  await page
    .getByRole("button", { name: "Read 100 pages", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Habit", exact: true }),
  ).toHaveValue("sample-read");
  await page.getByLabel("Target", { exact: true }).fill("120");
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(page.getByText("90 / 120", { exact: true })).toBeVisible();
  await page.goto("/#tasks");
  await page
    .getByRole("button", { name: "Clear a small corner", exact: true })
    .click();
  await page.getByText("Notes & subtasks", { exact: true }).click();
  await page.getByLabel("Notes", { exact: true }).fill("Keep this note");
  await page.getByLabel("Subtasks").fill("First step\nSecond step");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Clear a small corner", exact: true })
    .click();
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue(
    "Keep this note",
  );
  await expect(page.getByLabel("Subtasks")).toHaveValue(
    "First step\nSecond step",
  );
  await expect(
    page.getByRole("combobox", { name: "Project", exact: true }),
  ).toHaveValue("sample-project");
  await page.keyboard.press("Escape");
});

test("enlarged text and landscape retain reflow and dialog access", async ({
  page,
}) => {
  await loadSample(page);
  for (const size of [
    { width: 360, height: 844, font: "32px" },
    { width: 844, height: 390, font: "16px" },
  ]) {
    await page.setViewportSize({ width: size.width, height: size.height });
    for (const screen of [
      "today",
      "habits",
      "tasks",
      "calendar",
      "projects",
      "goals",
      "reports",
      "settings",
    ]) {
      await page.goto("/#" + screen);
      await page.evaluate((font) => {
        document.documentElement.style.fontSize = font;
      }, size.font);
      await expect(page.locator(".section-heading h1")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.goto("/#tasks");
    await page.getByRole("button", { name: "Add task", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Save task", exact: true }),
    ).toBeVisible();
    const dialog = await page.locator(".dialog-card").boundingBox();
    expect(dialog!.y).toBeGreaterThanOrEqual(8);
    expect(dialog!.y + dialog!.height).toBeLessThanOrEqual(size.height - 8);
    await page.keyboard.press("Escape");
    await page
      .getByRole("link", { name: "Skip to content", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("main")).toBeFocused();
  }
});
