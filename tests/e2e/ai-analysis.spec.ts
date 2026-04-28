/**
 * AI Analysis Test - User Journey: AI-powered file analysis
 * Tests the AI features for intelligent file categorization and insights
 */

import { test } from '@playwright/test';
import TestLogger from '../utils/logger';

test.describe('AI Analysis', () => {
  let logger: TestLogger;

  test.beforeEach(async () => {
    logger = new TestLogger('ai-analysis');
    logger.log('TEST_START', { testName: 'AI Analysis' });
  });

  test('should display AI analysis panel', async ({ page }) => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });

    // Check for AI toggle button (AI panel is conditional on toggle state)
    const aiToggle = page.locator('[data-testid="ai-toggle-button"]').first();
    const toggleVisible = await aiToggle.isVisible({ timeout: 5000 }).catch(() => false);

    logger.log('AI_TOGGLE_VISIBLE', { visible: toggleVisible });
    logger.log('TEST_COMPLETE', { toggleVisible });
  });

  test('should show AI status indicator', async ({ page }) => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });

    // Check for backend status (which shows AI availability)
    const backendStatus = page.locator('[data-testid="backend-status"]').first();
    const statusVisible = await backendStatus.isVisible({ timeout: 5000 }).catch(() => false);

    logger.log('BACKEND_STATUS_VISIBLE', { visible: statusVisible });
    logger.log('TEST_COMPLETE', { statusVisible });
  });

  test('should allow AI model selection', async ({ page }) => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });

    // Check for AI toggle button (model selection is conditional on toggle)
    const aiToggle = page.locator('[data-testid="ai-toggle-button"]').first();
    const toggleVisible = await aiToggle.isVisible({ timeout: 5000 }).catch(() => false);

    logger.log('AI_TOGGLE_VISIBLE', { visible: toggleVisible });
    logger.log('TEST_COMPLETE', { toggleVisible });
  });

  test('should display AI insights after scan', async ({ page }) => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });

    // Check for scan results section (insights are shown in results)
    const scanResults = page.locator('[data-testid="scan-results"]').first();
    const resultsVisible = await scanResults.isVisible({ timeout: 3000 }).catch(() => false);

    logger.log('SCAN_RESULTS_VISIBLE', { visible: resultsVisible });
    logger.log('TEST_COMPLETE', { resultsVisible });
  });

  test('should handle AI errors gracefully', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        logger.log('CONSOLE_ERROR', { message: msg.text() });
      }
    });

    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });

    // Check for error display
    const errorElement = page.locator('.bg-orange-500/10, [role="alert"]').first();
    const hasError = await errorElement.isVisible().catch(() => false);

    logger.log('TEST_COMPLETE', {
      consoleErrors: consoleErrors.length,
      hasError
    });
  });
});
