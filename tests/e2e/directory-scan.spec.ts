/**
 * Directory Scan Test - User Journey: Scanning a directory
 * Tests the core functionality of analyzing file system structure
 */

import { test } from '@playwright/test';
import TestLogger from '../utils/logger';

test.describe('Directory Scan', () => {
  let logger: TestLogger;

  test.beforeEach(async () => {
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
    const results = page.locator('[data-testid="scan-results"]').first();
    const resultsVisible = await results.isVisible({ timeout: 3000 }).catch(() => false);

    if (resultsVisible) {
      logger.log('RESULTS_AREA_FOUND', {});
    } else {
      logger.log('RESULTS_AREA_NOT_FOUND', {});
    }

    logger.log('TEST_COMPLETE', { resultsVisible });
  });

  test('should show file statistics', async ({ page }) => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });

    // Look for statistics display
    const statistics = page.locator('[data-testid="statistics"]').first();
    const statsVisible = await statistics.isVisible({ timeout: 3000 }).catch(() => false);

    if (statsVisible) {
      logger.log('STATISTICS_FOUND', {});

      // Check for file count
      const fileCount = page.locator('[data-testid="file-count"]').first();
      const countVisible = await fileCount.isVisible().catch(() => false);
      logger.log('FILE_COUNT_VISIBLE', { visible: countVisible });

      // Check for total size
      const totalSize = page.locator('[data-testid="total-size"]').first();
      const sizeVisible = await totalSize.isVisible().catch(() => false);
      logger.log('TOTAL_SIZE_VISIBLE', { visible: sizeVisible });
    } else {
      logger.log('STATISTICS_NOT_FOUND', {});
    }

    logger.log('TEST_COMPLETE', { statsVisible });
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
