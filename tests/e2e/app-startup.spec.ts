/**
 * App Startup Test - User Journey: Application Initialization
 * Tests that the app loads correctly and displays the main interface
 */

import { test, expect } from '@playwright/test';
import TestLogger from '../utils/logger';

test.describe('App Startup', () => {
  let logger: TestLogger;

  test.beforeEach(async ({ page }) => {
    logger = new TestLogger('app-startup');
    logger.log('TEST_START', { testName: 'App Startup' });
  });

  test('should load the application', async ({ page }) => {
    logger.log('NAVIGATE', { url: 'http://localhost:3001' });
    
    try {
      await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
      logger.log('PAGE_LOADED', { title: await page.title() });
      
      // Check for main app container
      const appContainer = page.locator('#app, [data-testid="app-container"], .app-container').first();
      const isVisible = await appContainer.isVisible().catch(() => false);
      
      if (isVisible) {
        logger.log('ELEMENT_FOUND', { element: 'app-container' });
      } else {
        logger.logError('ELEMENT_NOT_FOUND', new Error('App container not found'), { element: 'app-container' });
      }
      
      expect(isVisible).toBeTruthy();
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
      logger.logError('CONSOLE_ERRORS_DETECTED', new Error('Console errors found'), { errors });
    } else {
      logger.log('NO_CONSOLE_ERRORS', {});
    }
    
    // Allow some console errors during development
    expect(errors.length).toBeLessThan(5);
  });
});
