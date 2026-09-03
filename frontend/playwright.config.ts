import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "../test-results/playwright",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { outputFolder: "../playwright-report", open: "never" }]],
  expect: { timeout: 10_000, toHaveScreenshot: { animations: "disabled", caret: "hide", maxDiffPixelRatio: 0.01 } },
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure", video: "retain-on-failure", locale: "en-IN", timezoneId: "Asia/Kolkata", colorScheme: "light" },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "tablet", use: { viewport: { width: 1024, height: 768 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1" ? undefined : { command: "npm run dev", url: baseURL, reuseExistingServer: !process.env.CI, timeout: 120_000 },
});
