import { defineConfig, devices } from '@playwright/test';
const ports = require('../ports.config.js');

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 2,
  workers: 1, // Run sequentially for better debugging
  
  // Output directory for test artifacts
  outputDir: './test-results/artifacts',
  
  // Reporter with detailed logging
  reporter: [
    ['html', { outputFolder: './test-results/html-report', open: 'never' }],
    ['list'],
    ['json', { outputFile: './test-results/results.json' }],
  ],
  
  use: {
    headless: process.env.CI ? true : false, // Headless in CI, headed for local debugging
    baseURL: ports.PLAYWRIGHT_BASE_URL, // Uses centralized port configuration
    viewport: { width: 1920, height: 1080 },
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure', // Capture traces on failure
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Custom logging
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  
  // Global setup for logging
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
});
