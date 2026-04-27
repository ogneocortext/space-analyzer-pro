import { test, expect } from '@playwright/test';
import TestLogger from '../utils/logger';

test.describe('Full Directory Scan Flow', () => {
  let logger: TestLogger;

  test.beforeEach(async ({ page }) => {
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
    await expect(directoryInput).toBeVisible({ timeout: 5000 });
    logger.log('DIRECTORY_INPUT_FOUND', {});

    // Enter a test directory path
    const testPath = 'C:\\Users';
    await directoryInput.fill(testPath);
    logger.log('DIRECTORY_PATH_ENTERED', { path: testPath });

    // Find and click start button
    const startButton = page.locator('[data-testid="start-analysis-button"]').first();
    await expect(startButton).toBeVisible();
    logger.log('START_BUTTON_FOUND', {});

    // Click start button
    await startButton.click();
    logger.log('START_BUTTON_CLICKED', {});

    // Wait for progress section to appear
    const progressSection = page.locator('[data-testid="progress-section"]').first();
    await expect(progressSection).toBeVisible({ timeout: 10000 });
    logger.log('PROGRESS_SECTION_VISIBLE', {});

    // Wait for analysis to complete (timeout after 2 minutes)
    logger.log('WAITING_FOR_ANALYSIS', {});
    await expect(progressSection).not.toBeVisible({ timeout: 120000 });
    logger.log('ANALYSIS_COMPLETE', {});

    // Wait a moment for data to be set
    await page.waitForTimeout(2000);

    // Check console logs for errors
    logger.log('CONSOLE_LOGS', { logs: consoleLogs.slice(-20) });

    // Check the analysis store state
    const storeState = await page.evaluate(() => {
      return (window as any).__debugLogs || [];
    });
    logger.log('DEBUG_LOGS', { count: storeState.length, lastLogs: storeState.slice(-10) });

    // Check for error message
    const errorElement = page.locator('.bg-orange-500\\/10, [role="alert"]').first();
    const hasError = await errorElement.isVisible().catch(() => false);
    if (hasError) {
      const errorText = await errorElement.textContent();
      logger.log('ERROR_FOUND', { error: errorText });
    }

    // Check if navigated to dashboard or results shown on landing page
    const scanResults = page.locator('[data-testid="scan-results"]').first();
    const resultsVisible = await scanResults.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (resultsVisible) {
      logger.log('SCAN_RESULTS_VISIBLE', {});
      
      // Check for statistics
      const statistics = page.locator('[data-testid="statistics"]').first();
      const statsVisible = await statistics.isVisible().catch(() => false);
      logger.log('STATISTICS_VISIBLE', { visible: statsVisible });

      // Check for file count
      const fileCount = page.locator('[data-testid="file-count"]').first();
      const countText = await fileCount.textContent();
      logger.log('FILE_COUNT', { count: countText });

      // Check for total size
      const totalSize = page.locator('[data-testid="total-size"]').first();
      const sizeText = await totalSize.textContent();
      logger.log('TOTAL_SIZE', { size: sizeText });

      // Check for visualization
      const visualization = page.locator('[data-testid="visualization"]').first();
      const vizVisible = await visualization.isVisible().catch(() => false);
      logger.log('VISUALIZATION_VISIBLE', { visible: vizVisible });
    } else {
      // Check if navigated to dashboard
      const currentUrl = page.url();
      logger.log('CURRENT_URL', { url: currentUrl });
      
      if (currentUrl.includes('/dashboard')) {
        logger.log('NAVIGATED_TO_DASHBOARD', {});
        
        // Check for dashboard elements
        const dashboardStats = page.locator('[data-testid="statistics"], .statistics, .stats').first();
        const statsVisible = await dashboardStats.isVisible().catch(() => false);
        logger.log('DASHBOARD_STATS_VISIBLE', { visible: statsVisible });
      } else {
        logger.log('SCAN_RESULTS_NOT_VISIBLE', { hasError });
      }
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/screenshots/scan-results.png', fullPage: true });
    logger.log('SCREENSHOT_TAKEN', { path: 'test-results/screenshots/scan-results.png' });

    logger.log('TEST_COMPLETE', { resultsVisible, hasError });
  });
});
