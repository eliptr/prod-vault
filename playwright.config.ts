import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  timeout: 90000,
  workers: 2,
  testDir: "tests/e2e",
  fullyParallel: true,
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
