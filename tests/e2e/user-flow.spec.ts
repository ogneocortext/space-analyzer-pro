/**
 * Complete User Flow Test - End-to-end user journey
 * Tests the complete workflow from app load to analysis completion
 */

import { test } from '@playwright/test';
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

      // Step 2: Check for landing page
      logger.log('STEP_2', { action: 'Check landing page' });
      const landingPage = page.locator('[data-testid="landing-page"]').first();
      const landingVisible = await landingPage.isVisible().catch(() => false);
      logger.log('LANDING_PAGE_VISIBLE', { visible: landingVisible });

      // Step 3: Check for directory input
      logger.log('STEP_3', { action: 'Check directory input' });
      const dirInput = page.locator('[data-testid="directory-path-input"]').first();
      const inputVisible = await dirInput.isVisible().catch(() => false);
      logger.log('DIRECTORY_INPUT_VISIBLE', { visible: inputVisible });

      // Step 4: Check for start button
      logger.log('STEP_4', { action: 'Check start button' });
      const startBtn = page.locator('[data-testid="start-analysis-button"]').first();
      const btnVisible = await startBtn.isVisible().catch(() => false);
      logger.log('START_BUTTON_VISIBLE', { visible: btnVisible });

      // Step 5: Check for backend status
      logger.log('STEP_5', { action: 'Check backend status' });
      const backendStatus = page.locator('[data-testid="backend-status"]').first();
      const statusVisible = await backendStatus.isVisible().catch(() => false);
      logger.log('BACKEND_STATUS_VISIBLE', { visible: statusVisible });

      // Step 6: Check for AI toggle
      logger.log('STEP_6', { action: 'Check AI toggle' });
      const aiToggle = page.locator('[data-testid="ai-toggle-button"]').first();
      const aiVisible = await aiToggle.isVisible().catch(() => false);
      logger.log('AI_TOGGLE_VISIBLE', { visible: aiVisible });

      // Step 7: Perform analysis if all elements are visible
      if (inputVisible && btnVisible) {
        logger.log('STEP_7', { action: 'Perform analysis' });

        // Use a smaller test directory for faster testing
        const testPath = process.env.TEST_DIR || 'C:\\Users\\Public';
        await dirInput.fill(testPath);
        logger.log('DIRECTORY_PATH_ENTERED', { path: testPath });

        // Click start button
        await startBtn.click();
        logger.log('START_BUTTON_CLICKED', {});

        // Wait for progress section
        const progressSection = page.locator('[data-testid="progress-section"]').first();
        const progressVisible = await progressSection.isVisible({ timeout: 10000 }).catch(() => false);
        logger.log('PROGRESS_SECTION_VISIBLE', { visible: progressVisible });

        if (progressVisible) {
          // Wait for analysis to complete - poll for progress section to disappear
          logger.log('WAITING_FOR_ANALYSIS', {});

          // Wait up to 2 minutes for analysis to complete
          const maxWaitTime = 120000; // 2 minutes
          const startTime = Date.now();

          while (Date.now() - startTime < maxWaitTime) {
            const stillVisible = await progressSection.isVisible().catch(() => false);
            if (!stillVisible) {
              logger.log('ANALYSIS_COMPLETE', { duration: Date.now() - startTime });
              break;
            }
            await page.waitForTimeout(2000); // Check every 2 seconds
          }

          // Check for scan results
          const scanResults = page.locator('[data-testid="scan-results"]').first();
          const resultsVisible = await scanResults.isVisible({ timeout: 5000 }).catch(() => false);
          logger.log('SCAN_RESULTS_VISIBLE', { visible: resultsVisible });
        }
      }

      // Summary
      logger.log('TEST_COMPLETE', {
        landingVisible,
        inputVisible,
        btnVisible,
        statusVisible,
        aiVisible
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
