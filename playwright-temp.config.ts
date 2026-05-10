import { defineConfig, devices } from "@playwright/test";
import { PLAYWRIGHT_BASE_URL } from "./ports.config.js";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60000,
  retries: 2,
  workers: 1,

  outputDir: "./test-results/artifacts",

  reporter: [
    ["list"],
    ["json", { outputFile: "./test-results/performance-results.json" }],
  ],

  use: {
    headless: true,
    baseURL: PLAYWRIGHT_BASE_URL,
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});