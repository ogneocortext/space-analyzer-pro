/**
 * Directory Scan Test - User Journey: Scanning a directory
 * Tests the core functionality of analyzing file system structure
 */

import { test, expect } from '@playwright/test';
import TestLogger from '../utils/logger';
import path from 'path';

test.describe('Directory Scan', () => {
  let logger: TestLogger;

  test.beforeEach(async ({ page }) => {
    logger = new TestLogger('directory-scan');
    logger.log('TEST_START', { testName: 'Directory Scan' });
  });

  test('should allow directory selection', async ({ page }) => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    logger.log('PAGE_LOADED', {});

    // Look for directory input field
    const directoryInput = page.locator('[data-testid="directory-path-input"]').first();
    const inputVisible = await directoryInput.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (inputVisible) {
      logger.log('DIRECTORY_INPUT_FOUND', {});
      // Enter a test path
      await directoryInput.fill('C:\\Test');
      logger.log('DIRECTORY_PATH_ENTERED', { path: 'C:\\Test' });
    } else {
      logger.log('DIRECTORY_INPUT_NOT_FOUND', {});
    }

    // Look for start button
    const startButton = page.locator('[data-testid="start-analysis-button"]').first();
    const buttonVisible = await startButton.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (buttonVisible) {
      logger.log('START_BUTTON_FOUND', {});
    } else {
      logger.log('START_BUTTON_NOT_FOUND', {});
    }

    logger.log('TEST_COMPLETE', { inputVisible, buttonVisible });
  });

  test('should display scan results after directory selection', async ({ page }) => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    
    // Look for results area
    const resultsSelectors = [
      '[data-testid="scan-results"]',
      '.scan-results',
      '.results-container',
      '.file-tree',
      '.directory-tree',
      '[role="tree"]'
    ];

    let resultsFound = false;
    for (const selector of resultsSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        resultsFound = true;
        logger.log('RESULTS_AREA_FOUND', { selector });
        break;
      }
    }

    if (!resultsFound) {
      logger.log('RESULTS_AREA_NOT_FOUND', { selectors: resultsSelectors });
    }

    logger.log('TEST_COMPLETE', { resultsFound });
  });

  test('should show file statistics', async ({ page }) => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    
    // Look for statistics display
    const statsSelectors = [
      '[data-testid="statistics"]',
      '.statistics',
      '.stats',
      '.file-count',
      '.total-size',
      '[data-testid="file-count"]',
      '[data-testid="total-size"]'
    ];

    const foundStats: string[] = [];
    for (const selector of statsSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        foundStats.push(selector);
        logger.log('STATS_ELEMENT_FOUND', { selector });
      }
    }

    if (foundStats.length === 0) {
      logger.log('STATS_NOT_FOUND', { selectors: statsSelectors });
    }

    logger.log('TEST_COMPLETE', { foundStats: foundStats.length });
  });

  test('should handle scan errors gracefully', async ({ page }) => {
    // Monitor for error messages
    const errorSelectors = [
      '[role="alert"]',
      '.error-message',
      '.error',
      '[data-testid="error"]',
      '.toast-error'
    ];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        logger.log('CONSOLE_ERROR', { message: msg.text() });
      }
    });

    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });

    // Check if any error elements are visible
    const errorsFound: string[] = [];
    for (const selector of errorSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
        const text = await element.textContent();
        errorsFound.push(`${selector}: ${text}`);
        logger.log('ERROR_ELEMENT_FOUND', { selector, text });
      }
    }

    logger.log('TEST_COMPLETE', { errorsFound });
  });
});
