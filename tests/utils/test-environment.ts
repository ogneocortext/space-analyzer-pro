/**
 * Test Environment Setup
 * Simplified test environment utilities
 */

import { Page } from '@playwright/test';

export class TestEnvironment {
  static async setup(page: Page, options: { mockAPI?: boolean; mockErrors?: boolean } = {}) {
    console.log('Setting up test environment with options:', options);

    // Set up console logging
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.log('Browser console error:', msg.text());
      }
    });

    page.on('pageerror', (error) => {
      console.log('Page error:', error.message);
    });

    // Set viewport
    await page.setViewportSize({ width: 1280, height: 720 });

    // Set timeout
    page.setDefaultTimeout(10000);

    console.log('✅ Test environment setup completed');
  }

  static async cleanup(page: Page) {
    console.log('Cleaning up test environment...');

    // Clear any cookies, local storage, etc.
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    console.log('✅ Test environment cleanup completed');
  }
}

export default TestEnvironment;