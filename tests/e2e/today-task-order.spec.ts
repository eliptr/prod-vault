import { test, expect } from "@playwright/test";
import { defaults } from "../../src/lib/domain";

test("Today orders overdue, today and daily tasks and keeps details beside dates", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-11-04T10:00:00Z") });
  await page.goto("/#settings");
  const stamp = "2026-11-01T10:00:00.000Z";
  const tasks = [
    { id: "future", title: "Future daily", due: "2026-11-08", showDaily: true },
    { id: "today", title: "Due today", due: "2026-11-04", showDaily: false },
    { id: "late", title: "Overdue task", due: "2026-11-03", showDaily: false },
    {
      id: "earliest",
      title: "Oldest task",
      due: "2026-11-01",
      showDaily: false,
    },
  ].map((t) => ({
    ...t,
    createdAt: stamp,
    updatedAt: stamp,
    notes: "Task notes",
    priority: "medium",
    projectId: null,
    done: false,
    completedAt: null,
    templateId: null,
    subtasks: [{ id: t.id + "-sub", title: "First step", done: false }],
  }));
  await page.getByLabel("Restore from backup", { exact: true }).setInputFiles({
    name: "tasks.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 2,
        exportedAt: stamp,
        habits: [],
        entries: [],
        tasks,
        templates: [],
        projects: [],
        goals: [],
        settings: { ...defaults, lastExport: stamp },
      }),
    ),
  });
  await page
    .getByRole("button", { name: "Replace local data", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/#today");
    const rows = page.locator(".section-tasks .task-row");
    await expect(rows.locator(".task-title")).toHaveText([
      "Oldest task",
      "Overdue task",
      "Due today",
      "Future daily",
    ]);
    const row = rows.nth(2);
    const arrow = await row.locator(".expand svg").boundingBox();
    const edit = await row.locator(".edit-mark").boundingBox();
    const date = await row.locator("time").boundingBox();
    const meta = await row.locator(".task-meta").boundingBox();
    expect(Math.abs(date!.x - meta!.x)).toBeLessThan(2);
    const daily = rows.nth(3);
    const dailyLabel = await daily
      .getByText("Daily", { exact: true })
      .boundingBox();
    const dailyDate = await daily.locator("time").boundingBox();
    expect(dailyDate!.x - dailyLabel!.x - dailyLabel!.width).toBeLessThan(12);
    expect(
      Math.abs(arrow!.x + arrow!.width / 2 - edit!.x - edit!.width / 2),
    ).toBeLessThan(6);
    expect(
      Math.abs(arrow!.y + arrow!.height / 2 - date!.y - date!.height / 2),
    ).toBeLessThan(2);
    await row
      .getByRole("button", { name: "Details for Due today", exact: true })
      .click();
    await expect(row.getByText("Task notes", { exact: true })).toBeVisible();
    const subtask = row.getByRole("checkbox", {
      name: "First step",
      exact: true,
    });
    if (!(await subtask.isChecked())) await subtask.click();
    await expect(
      row.getByRole("checkbox", { name: "First step", exact: true }),
    ).toBeChecked();
    await row
      .getByRole("button", { name: "Details for Due today", exact: true })
      .click();
    await page.screenshot({
      path: `test-results/task-order-${test.info().project.name}-${width}.png`,
      fullPage: true,
      scale: "css",
    });
  }
});
