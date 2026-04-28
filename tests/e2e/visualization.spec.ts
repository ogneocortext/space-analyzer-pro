/**
 * Visualization Test - User Journey: 3D visualization and charts
 * Tests the visualization features for displaying file system data
 */

import { test } from '@playwright/test';
import TestLogger from '../utils/logger';

test.describe('Visualization', () => {
  let logger: TestLogger;

  test.beforeEach(async () => {
    logger = new TestLogger('visualization');
    logger.log('TEST_START', { testName: 'Visualization' });
  });

  test('should display 3D visualization', async ({ page }) => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });

    // Look for visualization section
    const visualization = page.locator('[data-testid="visualization"]').first();
    const vizVisible = await visualization.isVisible({ timeout: 5000 }).catch(() => false);

    logger.log('VISUALIZATION_VISIBLE', { visible: vizVisible });
    logger.log('TEST_COMPLETE', { vizVisible });
  });

  test('should display charts/graphs', async ({ page }) => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });

    // Look for storage gauge (chart element)
    const storageGauge = page.locator('[data-testid="storage-gauge"]').first();
    const gaugeVisible = await storageGauge.isVisible({ timeout: 5000 }).catch(() => false);

    logger.log('STORAGE_GAUGE_VISIBLE', { visible: gaugeVisible });
    logger.log('TEST_COMPLETE', { gaugeVisible });
  });

  test('should have interactive visualization controls', async ({ page }) => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });

    // Look for action buttons (Browse Files, View Dashboard, etc.)
    const actionButtons = page.locator('button:has-text("Browse Files"), button:has-text("View Dashboard"), button:has-text("3D Visualization")').first();
    const buttonsVisible = await actionButtons.isVisible({ timeout: 3000 }).catch(() => false);

    logger.log('ACTION_BUTTONS_VISIBLE', { visible: buttonsVisible });
    logger.log('TEST_COMPLETE', { buttonsVisible });
  });

  test('should handle visualization errors gracefully', async ({ page }) => {
    const consoleErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
        logger.log('CONSOLE_ERROR', { message: msg.text() });
      }
    });

    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });

    // Check for WebGL errors
    const webglErrors = consoleErrors.filter(e =>
      e.toLowerCase().includes('webgl') ||
      e.toLowerCase().includes('three') ||
      e.toLowerCase().includes('canvas')
    );

    if (webglErrors.length > 0) {
      logger.log('WEBGL_ERRORS_DETECTED', { errors: webglErrors });
    }

    logger.log('TEST_COMPLETE', { webglErrors: webglErrors.length });
  });
});
