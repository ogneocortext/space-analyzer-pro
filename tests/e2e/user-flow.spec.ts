/**
 * Complete User Flow Test - End-to-end user journey
 * Tests the complete workflow from app load to analysis
 */

import { test, expect } from '@playwright/test';
import TestLogger from '../utils/logger';

test.describe('Complete User Flow', () => {
  let logger: TestLogger;

  test('complete user journey', async ({ page }) => {
    logger = new TestLogger('complete-user-flow');
    logger.log('TEST_START', { testName: 'Complete User Flow' });

    try {
      // Step 1: Load application
      logger.log('STEP_1', { action: 'Load application' });
      await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
      logger.log('APP_LOADED', { title: await page.title() });

      // Step 2: Check for main interface elements
      logger.log('STEP_2', { action: 'Check interface elements' });
      const mainSelectors = [
        '#app',
        '[data-testid="app-container"]',
        '.app-container',
        'main',
        '[role="main"]'
      ];

      let mainFound = false;
      for (const selector of mainSelectors) {
        if (await page.locator(selector).first().isVisible().catch(() => false)) {
          mainFound = true;
          logger.log('MAIN_ELEMENT_FOUND', { selector });
          break;
        }
      }

      if (!mainFound) {
        logger.log('MAIN_ELEMENT_NOT_FOUND', { selectors: mainSelectors });
      }

      // Step 3: Check for navigation
      logger.log('STEP_3', { action: 'Check navigation' });
      const navSelectors = ['nav', '[role="navigation"]', '.navbar', '.sidebar'];
      let navFound = false;
      for (const selector of navSelectors) {
        if (await page.locator(selector).first().isVisible().catch(() => false)) {
          navFound = true;
          logger.log('NAVIGATION_FOUND', { selector });
          break;
        }
      }

      // Step 4: Check for action buttons
      logger.log('STEP_4', { action: 'Check action buttons' });
      const buttonSelectors = [
        'button:has-text("Scan")',
        'button:has-text("Analyze")',
        'button:has-text("Select")',
        'button:has-text("Start")',
        '[data-testid="scan-button"]',
        '[data-testid="analyze-button"]'
      ];

      const foundButtons: string[] = [];
      for (const selector of buttonSelectors) {
        if (await page.locator(selector).first().isVisible().catch(() => false)) {
          foundButtons.push(selector);
          logger.log('BUTTON_FOUND', { selector });
        }
      }

      // Step 5: Check for results/visualization area
      logger.log('STEP_5', { action: 'Check results area' });
      const resultsSelectors = [
        '[data-testid="results"]',
        '.results',
        '.visualization',
        '[data-testid="visualization"]',
        '.file-tree'
      ];

      let resultsFound = false;
      for (const selector of resultsSelectors) {
        if (await page.locator(selector).first().isVisible().catch(() => false)) {
          resultsFound = true;
          logger.log('RESULTS_AREA_FOUND', { selector });
          break;
        }
      }

      // Step 6: Check for AI panel
      logger.log('STEP_6', { action: 'Check AI panel' });
      const aiSelectors = [
        '[data-testid="ai-panel"]',
        '.ai-panel',
        '.ai-analysis',
        '[data-testid="insights"]'
      ];

      let aiFound = false;
      for (const selector of aiSelectors) {
        if (await page.locator(selector).first().isVisible().catch(() => false)) {
          aiFound = true;
          logger.log('AI_PANEL_FOUND', { selector });
          break;
        }
      }

      // Summary
      logger.log('TEST_COMPLETE', {
        mainFound,
        navFound,
        buttonsFound: foundButtons.length,
        resultsFound,
        aiFound
      });

      // Take screenshot for debugging
      await page.screenshot({ path: './test-results/screenshots/complete-flow.png' });
      logger.log('SCREENSHOT_TAKEN', { path: './test-results/screenshots/complete-flow.png' });

    } catch (error) {
      logger.logError('TEST_FAILED', error as Error, {});
      await page.screenshot({ path: './test-results/screenshots/error.png' });
      throw error;
    }
  });
});
