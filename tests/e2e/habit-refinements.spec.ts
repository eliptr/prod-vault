import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { defaults } from "../../src/lib/domain";
import { loadSample } from "./helpers";

async function legacyWeekly(page: Page, target = 4) {
  await page.clock.install({ time: new Date("2026-11-04T10:00:00Z") });
  await page.goto("/#settings");
  const stamp = "2026-10-01T10:00:00.000Z";
  const base = { createdAt: stamp, updatedAt: stamp };
  await page.getByLabel("Restore from backup", { exact: true }).setInputFiles({
    name: "legacy-weekly.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 2,
        exportedAt: stamp,
        habits: [
          {
            ...base,
            id: "gym",
            title: "Gym",
            icon: "",
            color: "#557363",
            kind: "quantity",
            period: "weekly",
            target,
            unit: "sessions",
            weekdays: [0, 1, 2, 3, 4, 5, 6],
            startDate: "2026-10-01",
            archived: false,
          },
        ],
        entries: [2, 3].map((d) => ({
          id: `gym:2026-11-0${d}`,
          habitId: "gym",
          date: `2026-11-0${d}`,
          value: d === 2 ? 3 : 7,
          updatedAt: stamp,
        })),
        tasks: [],
        templates: [],
        projects: [],
        goals: [
          {
            ...base,
            id: "days-goal",
            title: "Gym days",
            source: "habit",
            sourceId: "gym",
            target: 10,
            value: 0,
            startDate: "2026-11-01",
            deadline: null,
            archived: false,
          },
        ],
        settings: { ...defaults, lastExport: "2026-11-04T10:00:00.000Z" },
      }),
    ),
  });
  await page
    .getByRole("button", { name: "Replace local data", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}

test("weekly days, historical corrections, goals and backups agree without rewriting old quantities", async ({
  page,
  context,
}) => {
  await legacyWeekly(page);
  await page.goto("/#today");
  await expect(
    page
      .locator(".overview > .section")
      .first()
      .getByText("2 / 4 this week", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("2 / 10", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Complete Gym", exact: true }).click();
  await expect(
    page
      .locator(".overview > .section")
      .first()
      .getByText("3 / 4 this week", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reopen Gym", exact: true }).click();
  await expect(
    page
      .locator(".overview > .section")
      .first()
      .getByText("2 / 4 this week", { exact: true }),
  ).toBeVisible();
  await page.goto("/#habits");
  const grid = page.getByRole("group", {
    name: "Gym monthly history",
    exact: true,
  });
  await grid.locator('[data-date="2026-11-03"]').click();
  await page
    .locator(".history-editor")
    .getByRole("button", { name: "Reopen Gym", exact: true })
    .click();
  await expect(
    page.getByText("1 / 4 this week", { exact: true }),
  ).toBeVisible();
  await expect(grid.locator('[data-date="2026-11-02"]')).toHaveAttribute(
    "data-level",
    "3",
  );
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.goto("/#calendar?date=2026-11-04");
  await expect(page.locator("main .section h2").first()).toHaveText("Tasks");
  await expect(page.locator("main .section h2").last()).toContainText("Habits");
  await page.getByRole("button", { name: "Complete Gym", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Reopen Gym", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/#goals");
  await expect(page.getByText("2 / 10", { exact: true })).toBeVisible();
  await context.setOffline(false);
  await page.goto("/#settings");
  const pending = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const backup = JSON.parse(
    await readFile((await (await pending).path())!, "utf8"),
  );
  expect(backup.version).toBe(2);
  expect(
    backup.entries.find((e: { date: string }) => e.date === "2026-11-02").value,
  ).toBe(3);
  expect(backup.habits[0].unit).toBe("sessions");
  await page.goto("/#reports");
  await expect(
    page.getByText("/ 4 days this week", { exact: false }),
  ).toBeVisible();
});

test("weekly target validation accepts new day targets and flags legacy targets", async ({
  page,
}) => {
  await legacyWeekly(page, 30);
  await page.goto("/#habits");
  await expect(
    page.getByText("Set target to 1–7 days", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Gym", exact: true }).click();
  await expect(page.getByLabel("Weekly target")).toHaveValue("30");
  await page.getByRole("button", { name: "Save habit", exact: true }).click();
  await expect(page.getByLabel("Weekly target")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Weekly target").fill("1.5");
  await page.getByRole("button", { name: "Save habit", exact: true }).click();
  await expect(page.getByLabel("Weekly target")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Weekly target").fill("4");
  await page.getByRole("button", { name: "Save habit", exact: true }).click();
  await expect(
    page.getByText("2 / 4 this week", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add habit", exact: true }).click();
  await page.getByLabel("Tracking").selectOption("weekly");
  await expect(page.getByLabel("Weekly target")).toHaveValue("3");
  await expect(page.getByLabel("Unit", { exact: true })).toHaveCount(0);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Close editor", exact: true }).click();
});

test("monthly heatmaps support keyboard movement, selection and week starts", async ({
  page,
}) => {
  await legacyWeekly(page);
  await page.goto("/#habits?month=2026-10");
  const grid = page.getByRole("group", {
    name: "Gym monthly history",
    exact: true,
  });
  await expect(grid.locator("button")).toHaveCount(31);
  const gridBox = await grid.boundingBox();
  const rowBox = await page.locator(".has-month > .habit-row").boundingBox();
  expect(gridBox!.y).toBeGreaterThanOrEqual(rowBox!.y + rowBox!.height);
  expect(gridBox!.width).toBe(168);
  expect(gridBox!.height).toBeLessThanOrEqual(158);

  await grid.locator('[tabindex="0"]').focus();
  await page.keyboard.press("Home");
  await expect(grid.locator('[data-date="2026-10-01"]')).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(grid.locator('[data-date="2026-10-02"]')).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(grid.locator('[data-date="2026-10-09"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".history-editor")).toBeVisible();
  await page
    .locator(".history-editor")
    .getByRole("button", { name: "Complete Gym", exact: true })
    .click();
  await expect(grid.locator('[data-date="2026-10-09"]')).toHaveAttribute(
    "data-level",
    "3",
  );
  await page.keyboard.press("Escape");
  await expect(grid.locator('[data-date="2026-10-09"]')).toBeFocused();
  await page.goto("/#settings");
  await page.getByLabel("Week starts on").selectOption("0");
  await page.goto("/#habits?month=2026-10");
  await expect(page.locator(".heatmap-day").first()).toHaveText("Su");
  await page.goto("/#habits?month=2026-11");
  await expect(page.locator('[data-date="2026-11-05"]')).toBeDisabled();
  await page.getByRole("button", { name: "Gym", exact: true }).click();
  await page.getByLabel("Tracking").selectOption("quantity");
  await page.getByLabel("Tue", { exact: true }).uncheck();
  await page.getByRole("button", { name: "Save habit", exact: true }).click();
  const unscheduled = page.locator('[data-date="2026-11-03"]');
  await expect(unscheduled).toBeDisabled();
  await expect(unscheduled).toHaveAttribute("data-level", "3");
  await expect(unscheduled).toHaveAttribute(
    "title",
    /Not scheduled.*7 \/ 4 sessions/,
  );
});

test("compact controls, icon-only add and phone header removal retain creation access", async ({
  page,
}) => {
  await loadSample(page);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const screen of ["habits", "tasks"]) {
      await page.goto("/#" + screen);
      const header = page.locator(".section-heading .primary");
      if (width === 390) {
        await expect(header).not.toBeVisible();
        const bottom = page.locator(".quick-trigger");
        await expect(bottom).toHaveText("");
        const rect = await bottom.boundingBox();
        expect(rect!.width).toBe(44);
        expect(rect!.height).toBe(44);
      } else await expect(header).toBeVisible();
      if (screen === "habits") {
        const records = page.locator(".habit-list > .has-month");
        const first = await records.nth(0).boundingBox();
        const second = await records.nth(1).boundingBox();
        expect(Math.abs(first!.y - second!.y)).toBeLessThan(2);
        expect(first!.x + first!.width).toBeLessThanOrEqual(second!.x);
        await expect(page.locator(".habit-list .entry-caption")).toHaveCount(0);
        const check = await records
          .nth(1)
          .locator(".habit-control")
          .boundingBox();
        const grid = await records.nth(1).locator(".habit-grid").boundingBox();
        expect(grid!.y - check!.y - check!.height).toBeLessThanOrEqual(4);
        expect(grid!.y).toBeGreaterThanOrEqual(check!.y + check!.height);
      }
      await page
        .getByRole("button", {
          name: screen === "habits" ? "Add habit" : "Add task",
          exact: true,
        })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
    }
    await page.goto("/#today");
    const habitSection = await page
      .locator(".overview > .section-habits")
      .boundingBox();
    const goalSection = await page
      .locator(".overview > .section-goals")
      .boundingBox();
    expect(Math.abs(habitSection!.y - goalSection!.y)).toBeLessThan(2);
    expect(habitSection!.x + habitSection!.width).toBeLessThanOrEqual(
      goalSection!.x,
    );
    const expected = width === 390 ? 28 : 24;
    for (const control of await page.locator(".value-control button").all()) {
      const rect = await control.boundingBox();
      if (rect) expect(rect.width).toBe(expected);
    }
    expect(
      await page
        .locator(".content")
        .evaluate((e) => getComputedStyle(e).paddingLeft),
    ).toBe(width === 390 ? "8px" : "16px");
  }
});
