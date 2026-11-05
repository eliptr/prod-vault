import { test, expect, type Page } from "@playwright/test";
import { defaults } from "../../src/lib/domain";

async function fixture(page: Page) {
  await page.clock.install({ time: new Date("2026-11-04T10:00:00Z") });
  await page.goto("/#settings");
  const stamp = "2026-11-01T10:00:00.000Z",
    base = { createdAt: stamp, updatedAt: stamp };
  const projects = [
    {
      ...base,
      id: "a",
      title: "Alpha",
      description: "",
      color: "#557363",
      deadline: null,
      status: "active",
    },
    {
      ...base,
      id: "z",
      title: "Zeta",
      description: "",
      color: "#557363",
      deadline: null,
      status: "active",
    },
  ];
  const tasks = ["Inbox", "Today", "Upcoming", "Overdue", "Completed"].flatMap(
    (group) =>
      [
        ["Medium Z", "medium", "z"],
        ["Low", "low", null],
        ["High A", "high", "a"],
        ["Medium A", "medium", "a"],
        ["High none", "high", null],
        ["Medium none", "medium", null],
      ].map(([name, priority, projectId]) => ({
        ...base,
        id: group + name,
        title: group + " " + name,
        priority,
        projectId,
        notes: "Notes",
        subtasks: [{ id: "s", title: "Step", done: false }],
        templateId: null,
        showDaily: false,
        done: group === "Completed",
        completedAt: group === "Completed" ? stamp : null,
        due:
          group === "Inbox"
            ? null
            : group === "Upcoming"
              ? "2026-11-07"
              : group === "Overdue"
                ? "2026-11-02"
                : "2026-11-04",
      })),
  );
  const habits = [
    {
      ...base,
      id: "gym",
      title: "Gym",
      icon: "",
      color: "#557363",
      kind: "quantity",
      period: "weekly",
      target: 3,
      unit: "days",
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      startDate: "2026-11-01",
      archived: false,
    },
  ];
  await page
    .getByLabel("Restore from backup", { exact: true })
    .setInputFiles({
      name: "fixture.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          version: 2,
          exportedAt: stamp,
          projects,
          tasks,
          habits,
          entries: [
            {
              id: "gym:2026-11-03",
              habitId: "gym",
              date: "2026-11-03",
              value: 3,
              updatedAt: stamp,
            },
          ],
          templates: [],
          goals: [
            {
              ...base,
              id: "g",
              title: "Gym goal",
              source: "habit",
              sourceId: "gym",
              target: 30,
              value: 0,
              startDate: "2026-11-01",
              deadline: null,
              archived: false,
            },
          ],
          settings: { ...defaults, theme: "dark", lastExport: stamp },
        }),
      ),
    });
  await page
    .getByRole("button", { name: "Replace local data", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
}

test("Tasks filters sort priorities and projects, with a working low Inbox disclosure", async ({
  page,
}) => {
  await fixture(page);
  for (const group of ["Inbox", "Today", "Upcoming", "Overdue", "Completed"]) {
    await page.goto("/#tasks?filter=" + group);
    await expect(page.locator(".task-title:visible")).toHaveText(
      [
        "High none",
        "High A",
        "Medium none",
        "Medium A",
        "Medium Z",
        ...(group === "Inbox" ? [] : ["Low"]),
      ].map((s) => group + " " + s),
    );
  }
  await page.goto("/#tasks?filter=Inbox");
  const toggle = page.getByRole("button", {
    name: "Low priority · 1",
    exact: true,
  });
  await toggle.click();
  await page
    .getByRole("button", { name: "Details for Inbox Low", exact: true })
    .click();
  await expect(
    page.locator("#inbox-low-tasks").getByText("Notes", { exact: true }),
  ).toBeVisible();
  const step = page
    .locator("#inbox-low-tasks")
    .getByRole("checkbox", { name: "Step", exact: true });
  await step.click();
  await expect(step).toBeChecked();
  await page.goto("/#today");
  await page.goto("/#tasks?filter=Inbox");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("button", { name: "Inbox Low", exact: true }).click();
  await page.getByLabel("Priority", { exact: true }).selectOption("medium");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(toggle).toHaveCount(0);
  await page.getByRole("button", { name: "Inbox Low", exact: true }).click();
  await page.getByLabel("Priority", { exact: true }).selectOption("low");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  for (const title of [
    "High none",
    "High A",
    "Medium none",
    "Medium A",
    "Medium Z",
  ]) {
    await page
      .getByRole("button", { name: "Complete Inbox " + title, exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Inbox " + title, exact: true }),
    ).toHaveCount(0);
  }
  await expect(toggle).toBeVisible();
  await expect(page.getByText("No inbox tasks", { exact: true })).toHaveCount(
    0,
  );
  await page
    .getByRole("button", { name: "Complete Inbox Low", exact: true })
    .click();
  await expect(toggle).toHaveCount(0);
  await expect(page.getByText("No inbox tasks", { exact: true })).toBeVisible();
});

test("weekly labels follow streaks, heatmaps are shorter and Today overdue dates stay red", async ({
  page,
}) => {
  await fixture(page);
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const screen of ["today", "habits", "calendar"]) {
      await page.goto("/#" + screen);
      const habit = page
        .locator(
          screen === "today"
            ? ".section-habits .habit-record"
            : ".habit-record",
        )
        .first();
      await expect(habit.locator(".streak + .weekly-progress")).toHaveText(
        "1 / 3",
      );
      expect(await habit.locator(".habit-meta").textContent()).not.toContain(
        "this week",
      );
      const streak = await habit.locator(".streak").boundingBox(),
        progress = await habit.locator(".weekly-progress").boundingBox();
      expect(Math.abs(streak!.y - progress!.y)).toBeLessThan(2);
      if (screen === "habits") {
        const grid = await habit.locator(".habit-grid").boundingBox();
        expect(grid!.width).toBe(168);
        expect(grid!.height).toBe(134);
        const cell = await habit
          .locator(".habit-grid button")
          .first()
          .boundingBox();
        expect(cell!.height).toBe(20);
        expect(cell!.width).toBe(24);
      }
      if (screen === "today") {
        const overdue = page.locator(".section-tasks time.overdue").first();
        await expect(overdue).toHaveAttribute("aria-label", /Overdue/);
        expect(await overdue.textContent()).not.toContain("Overdue");
        await page.locator(".section-goals .goal-source-toggle").click();
        await expect(
          page.locator(".section-goals .weekly-progress"),
        ).toHaveText("1 / 3");
      }
      await page.screenshot({
        path: `test-results/metadata-${test.info().project.name}-${width}-${screen}.png`,
        fullPage: true,
        scale: "css",
      });
    }
  }
});
