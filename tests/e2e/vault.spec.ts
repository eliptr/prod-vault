import { loadSample } from "./helpers";
import { test, expect } from "@playwright/test";
test("projects, linked goals, quantity history, recurrence, and deletion", async ({
  page,
}) => {
  await page.goto("/#projects");
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Garden");
  await page.getByRole("button", { name: "Save project" }).click();
  await expect(
    page.getByRole("button", { name: "Garden", exact: true }),
  ).toBeVisible();
  await page.goto("/#goals");
  await page.getByRole("button", { name: "Add goal", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Finish the garden");
  await page.getByLabel("Progress source").selectOption("project");
  await page
    .getByRole("combobox", { name: "Project", exact: true })
    .selectOption({ label: "Garden" });
  await page.getByRole("button", { name: "Save goal" }).click();
  await page.goto("/#tasks");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Plant herbs");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Athens",
  }).format(new Date());
  await page.getByLabel("Due date").fill(today);
  await page
    .getByRole("combobox", { name: "Project", exact: true })
    .selectOption({ label: "Garden" });
  await page.getByRole("button", { name: "Save task" }).click();
  await page.getByRole("button", { name: "Complete Plant herbs" }).click();
  await page.goto("/#goals");
  await expect(page.getByText("100 / 100%")).toBeVisible();
  await page.goto("/#habits");
  await page.getByRole("button", { name: "Add habit", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Drink water");
  await page.getByLabel("Tracking").selectOption("quantity");
  await page.getByLabel("Daily target").fill("8");
  await page.getByLabel("Unit", { exact: true }).fill("glasses");
  await page.getByRole("button", { name: "Save habit" }).click();
  const input = page.getByRole("spinbutton", { name: /Drink water quantity/ });
  await input.fill("8");
  await input.blur();
  await page.reload();
  await expect(
    page.getByRole("spinbutton", { name: /Drink water quantity/ }),
  ).toHaveValue("8");
  await page
    .getByRole("button", { name: `Drink water ${today} complete` })
    .click();
  await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible();
  await page.goto("/#tasks");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Water herbs");
  await page.getByLabel("Due date").fill(today);
  await page
    .getByRole("combobox", { name: "Schedule", exact: true })
    .selectOption("weekly");
  await page.getByRole("button", { name: "Save task" }).click();
  await page.getByRole("button", { name: "Complete Water herbs" }).click();
  await page.getByRole("button", { name: "Upcoming", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Water herbs.*Repeating/ }).first(),
  ).toBeVisible();
  await page.goto("/#projects");
  await page.getByRole("button", { name: "Garden", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/#goals");
  await expect(page.getByText("Source removed", { exact: true })).toBeVisible();
});
test("create records, check habits, complete subtasks, and persist offline", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await page.getByRole("button", { name: "Add habit", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Read a page");
  await page.getByRole("button", { name: "Save habit" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Complete Read a page" }).click();
  await expect(
    page.getByRole("button", { name: "Reopen Read a page" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add task", exact: true })
    .first()
    .click();
  await page.getByLabel("Name", { exact: true }).fill("Plan tomorrow");
  await page
    .getByLabel("Due date")
    .fill(
      new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(
        new Date(),
      ),
    );
  await page.getByLabel("Subtasks").fill("Make tea\nOpen notebook");
  await page.getByRole("button", { name: "Save task" }).click();
  await page.getByRole("button", { name: "Complete Plan tomorrow" }).click();
  await page.getByRole("button", { name: "Details for Plan tomorrow" }).click();
  await expect(page.getByLabel("Make tea")).toBeChecked();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Reopen Read a page" }),
  ).toBeVisible();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
  await page.getByRole("button", { name: "Reopen Read a page" }).click();
  await expect(
    page.getByRole("button", { name: "Complete Read a page" }),
  ).toBeVisible();
  await context.setOffline(false);
  expect(errors).toEqual([]);
});
test("sample data, themes, backup validation and restore", async ({ page }) => {
  await page.goto("/");
  await loadSample(page);
  await expect(
    page.getByRole("button", { name: "Read a little" }),
  ).toBeVisible();
  await page.goto("/#settings");
  await page.getByLabel("Appearance").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export backup", exact: true })
    .click();
  const file = await download;
  const path = await file.path();
  expect(path).toBeTruthy();
  await page.getByLabel("Restore from backup", { exact: true }).setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{}"),
  });
  await expect(
    page.getByRole("alert").filter({ hasText: "Invalid backup" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dismiss", exact: true }).click();
  await page
    .getByLabel("Restore from backup", { exact: true })
    .setInputFiles(path!);
  await expect(page.getByRole("dialog")).toContainText("3 habits");
  await page.getByRole("button", { name: "Replace local data" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/#reports");
  await expect(
    page.getByRole("heading", { name: "Daily completion" }),
  ).toBeVisible();
  for (const theme of ["light", "dark"]) {
    await page.goto("/#settings");
    await page.getByLabel("Appearance").selectOption(theme);
    await page.goto("/");
    await page.screenshot({
      path: `test-results/${test.info().project.name}-${theme}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
