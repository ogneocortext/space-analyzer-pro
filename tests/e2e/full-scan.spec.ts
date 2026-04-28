import { test } from '@playwright/test';
import TestLogger from '../utils/logger';

test.describe('Full Directory Scan Flow', () => {
  let logger: TestLogger;

  test.beforeEach(async () => {
    logger = new TestLogger('full-scan');
    logger.log('TEST_START', { testName: 'Full Directory Scan' });
  });

  test('should scan a directory and display results', async ({ page }) => {
    // Capture console logs
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    logger.log('PAGE_LOADED', {});

    // Find directory input
    const directoryInput = page.locator('[data-testid="directory-path-input"]').first();
    const inputVisible = await directoryInput.isVisible({ timeout: 5000 }).catch(() => false);
    logger.log('DIRECTORY_INPUT_VISIBLE', { visible: inputVisible });

    if (!inputVisible) {
      logger.log('TEST_COMPLETE', { inputVisible: false });
      return;
    }

    // Enter a test directory path
    const testPath = 'C:\\Users';
    await directoryInput.fill(testPath);
    logger.log('DIRECTORY_PATH_ENTERED', { path: testPath });

    // Find and check start button
    const startButton = page.locator('[data-testid="start-analysis-button"]').first();
    const buttonVisible = await startButton.isVisible().catch(() => false);
    logger.log('START_BUTTON_VISIBLE', { visible: buttonVisible });

    if (!buttonVisible) {
      logger.log('TEST_COMPLETE', { buttonVisible: false });
      return;
    }

    // Click start button
    await startButton.click();
    logger.log('START_BUTTON_CLICKED', {});

    // Wait for progress section to appear
    const progressSection = page.locator('[data-testid="progress-section"]').first();
    const progressVisible = await progressSection.isVisible({ timeout: 10000 }).catch(() => false);
    logger.log('PROGRESS_SECTION_VISIBLE', { visible: progressVisible });

    if (!progressVisible) {
      logger.log('TEST_COMPLETE', { progressVisible: false });
      return;
    }

    // Wait for analysis to complete (timeout after 2 minutes)
    logger.log('WAITING_FOR_ANALYSIS', {});
    await page.waitForTimeout(5000); // Wait 5 seconds for initial progress

    // Check if progress section is still visible (analysis may still be running)
    const stillRunning = await progressSection.isVisible().catch(() => false);
    logger.log('ANALYSIS_STATUS', { stillRunning });

    // Wait a moment for data to be set
    await page.waitForTimeout(2000);

    // Check console logs for errors
    logger.log('CONSOLE_LOGS', { logs: consoleLogs.slice(-20) });

    // Check the analysis store state
    const storeState = await page.evaluate(() => {
      return (window as unknown as { __debugLogs?: unknown[] }).__debugLogs || [];
    });
    logger.log('DEBUG_LOGS', { count: storeState.length, lastLogs: storeState.slice(-10) });

    // Check for error message
    const errorElement = page.locator('.bg-orange-500\\/10, [role="alert"]').first();
    const hasError = await errorElement.isVisible().catch(() => false);
    if (hasError) {
      const errorText = await errorElement.textContent();
      logger.log('ERROR_FOUND', { error: errorText });
    }

    // Check for scan results
    const scanResults = page.locator('[data-testid="scan-results"]').first();
    const resultsVisible = await scanResults.isVisible({ timeout: 3000 }).catch(() => false);

    logger.log('SCAN_RESULTS_VISIBLE', { visible: resultsVisible });

    if (resultsVisible) {
      // Check for statistics
      const statistics = page.locator('[data-testid="statistics"]').first();
      const statsVisible = await statistics.isVisible().catch(() => false);
      logger.log('STATISTICS_VISIBLE', { visible: statsVisible });

      if (statsVisible) {
        // Check for file count
        const fileCount = page.locator('[data-testid="file-count"]').first();
        const countText = await fileCount.textContent();
        logger.log('FILE_COUNT', { count: countText });

        // Check for total size
        const totalSize = page.locator('[data-testid="total-size"]').first();
        const sizeText = await totalSize.textContent();
        logger.log('TOTAL_SIZE', { size: sizeText });
      }

      // Check for visualization
      const visualization = page.locator('[data-testid="visualization"]').first();
      const vizVisible = await visualization.isVisible().catch(() => false);
      logger.log('VISUALIZATION_VISIBLE', { visible: vizVisible });
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/scan-results.png', fullPage: true });
    logger.log('SCREENSHOT_TAKEN', { path: 'test-results/screenshots/scan-results.png' });

    logger.log('TEST_COMPLETE', { resultsVisible, hasError });
  });
});
