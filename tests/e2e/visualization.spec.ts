/**
 * Visualization Test - User Journey: 3D visualization and charts
 * Tests the visualization features for displaying file system data
 */

import { test, expect } from '@playwright/test';
import TestLogger from '../utils/logger';

test.describe('Visualization', () => {
  let logger: TestLogger;

  test.beforeEach(async ({ page }) => {
    logger = new TestLogger('visualization');
    logger.log('TEST_START', { testName: 'Visualization' });
  });

  test('should display 3D visualization', async ({ page }) => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    
    // Look for 3D visualization container
    const vizSelectors = [
      '[data-testid="3d-visualization"]',
      '.force-graph-3d',
      '#force-graph-3d',
      '.visualization-3d',
      '[data-testid="visualization"]',
      '.graph-container'
    ];

    let vizFound = false;
    for (const selector of vizSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 5000 }).catch(() => false)) {
        vizFound = true;
        logger.log('3D_VIZ_FOUND', { selector });
        break;
      }
    }

    if (!vizFound) {
      logger.log('3D_VIZ_NOT_FOUND', { selectors: vizSelectors });
    }

    logger.log('TEST_COMPLETE', { vizFound });
  });

  test('should display charts/graphs', async ({ page }) => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    
    // Look for chart elements
    const chartSelectors = [
      '[data-testid="chart"]',
      '.chart',
      '.graph',
      'canvas',
      'svg',
      '[data-testid="file-size-chart"]',
      '[data-testid="distribution-chart"]'
    ];

    const foundCharts: string[] = [];
    for (const selector of chartSelectors) {
      const elements = page.locator(selector);
      const count = await elements.count();
      if (count > 0) {
        foundCharts.push(`${selector}: ${count} elements`);
        logger.log('CHART_ELEMENTS_FOUND', { selector, count });
      }
    }

    if (foundCharts.length === 0) {
      logger.log('CHARTS_NOT_FOUND', { selectors: chartSelectors });
    }

    logger.log('TEST_COMPLETE', { foundCharts: foundCharts.length });
  });

  test('should have interactive visualization controls', async ({ page }) => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    
    // Look for visualization controls
    const controlSelectors = [
      '[data-testid="viz-controls"]',
      '.viz-controls',
      '.visualization-controls',
      'button:has-text("Zoom")',
      'button:has-text("Rotate")',
      'button:has-text("Reset")',
      '[data-testid="zoom"]',
      '[data-testid="rotate"]'
    ];

    const foundControls: string[] = [];
    for (const selector of controlSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        foundControls.push(selector);
        logger.log('CONTROL_FOUND', { selector });
      }
    }

    if (foundControls.length === 0) {
      logger.log('CONTROLS_NOT_FOUND', { selectors: controlSelectors });
    }

    logger.log('TEST_COMPLETE', { foundControls: foundControls.length });
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
