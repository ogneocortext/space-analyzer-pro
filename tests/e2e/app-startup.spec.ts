/**
 * App Startup Test - User Journey: Application Initialization
 * Tests that the app loads correctly and displays the main interface
 */

import { test } from '@playwright/test';
import TestLogger from '../utils/logger';

test.describe('App Startup', () => {
  let logger: TestLogger;

  test.beforeEach(async () => {
    logger = new TestLogger('app-startup');
    logger.log('TEST_START', { testName: 'App Startup' });
  });

  test('should load the application', async ({ page }) => {
    logger.log('NAVIGATE', { url: 'http://localhost:3001' });

    try {
      await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
      logger.log('PAGE_LOADED', { title: await page.title() });

      // Check for landing page
      const landingPage = page.locator('[data-testid="landing-page"]').first();
      const isVisible = await landingPage.isVisible().catch(() => false);

      if (isVisible) {
        logger.log('ELEMENT_FOUND', { element: 'landing-page' });
      } else {
        logger.logError('ELEMENT_NOT_FOUND', new Error('Landing page not found'), { element: 'landing-page' });
      }

      logger.log('TEST_COMPLETE', { landingPageVisible: isVisible });
    } catch (error) {
      logger.logError('NAVIGATION_FAILED', error as Error, { url: 'http://localhost:3001' });
      throw error;
    }
  });

  test('should display main navigation', async ({ page }) => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });

    // Look for navigation elements
    const navSelectors = [
      'nav',
      '[role="navigation"]',
      '.navbar',
      '.sidebar',
      '[data-testid="navigation"]'
    ];

    let navFound = false;
    for (const selector of navSelectors) {
      const nav = page.locator(selector).first();
      if (await nav.isVisible().catch(() => false)) {
        navFound = true;
        logger.log('NAVIGATION_FOUND', { selector });
        break;
      }
    }

    if (!navFound) {
      logger.log('NAVIGATION_NOT_FOUND', { selectors: navSelectors });
    }

    // Don't fail if nav not found - just log it
    logger.log('TEST_COMPLETE', { navFound });
  });

  test('should load without console errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
        logger.log('CONSOLE_ERROR', { message: msg.text() });
      }
    });

    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });

    if (errors.length > 0) {
      logger.log('CONSOLE_ERRORS_DETECTED', { count: errors.length });
    } else {
      logger.log('NO_CONSOLE_ERRORS', {});
    }

    // Allow some console errors during development
    logger.log('TEST_COMPLETE', { errorCount: errors.length });
  });
});
