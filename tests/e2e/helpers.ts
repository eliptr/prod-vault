import { expect, type Page } from "@playwright/test";
export async function loadSample(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Today", exact: true }),
  ).toBeVisible();
  await page.goto("/#settings");
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Load sample data", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Load sample data", exact: true }),
  ).not.toBeVisible();
  await page.goto("/#today");
  await expect(
    page.getByRole("button", { name: "Read a little", exact: true }),
  ).toBeVisible();
}
