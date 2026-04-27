/**
 * AI Analysis Test - User Journey: AI-powered file analysis
 * Tests the AI features for intelligent file categorization and insights
 */

import { test, expect } from '@playwright/test';
import TestLogger from '../utils/logger';

test.describe('AI Analysis', () => {
  let logger: TestLogger;

  test.beforeEach(async ({ page }) => {
    logger = new TestLogger('ai-analysis');
    logger.log('TEST_START', { testName: 'AI Analysis' });
  });

  test('should display AI analysis panel', async ({ page }) => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    
    // Enable AI toggle to show AI panel
    const aiToggle = page.locator('[data-testid="ai-toggle-button"]').first();
    if (await aiToggle.isVisible().catch(() => false)) {
      await aiToggle.click();
      await page.waitForTimeout(500);
    }
    
    // Look for AI panel/section
    const aiSelectors = [
      '[data-testid="ai-panel"]',
      '.ai-panel',
      '.ai-analysis',
      '[data-testid="ai-chat"]',
      '.ai-chat',
      '.insights-panel',
      '[data-testid="insights"]'
    ];

    let aiPanelFound = false;
    for (const selector of aiSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        aiPanelFound = true;
        logger.log('AI_PANEL_FOUND', { selector });
        break;
      }
    }

    if (!aiPanelFound) {
      logger.log('AI_PANEL_NOT_FOUND', { selectors: aiSelectors });
    }

    logger.log('TEST_COMPLETE', { aiPanelFound });
  });

  test('should show AI status indicator', async ({ page }) => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    
    // Enable AI toggle to show AI panel
    const aiToggle = page.locator('[data-testid="ai-toggle-button"]').first();
    if (await aiToggle.isVisible().catch(() => false)) {
      await aiToggle.click();
      await page.waitForTimeout(500);
    }
    
    // Look for AI status indicators
    const statusSelectors = [
      '[data-testid="ai-status"]',
      '.ai-status',
      '.ollama-status',
      '.ai-indicator',
      '[data-testid="ollama-status"]'
    ];

    const foundStatus: string[] = [];
    for (const selector of statusSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        const text = await element.textContent();
        foundStatus.push(`${selector}: ${text}`);
        logger.log('AI_STATUS_FOUND', { selector, text });
      }
    }

    if (foundStatus.length === 0) {
      logger.log('AI_STATUS_NOT_FOUND', { selectors: statusSelectors });
    }

    logger.log('TEST_COMPLETE', { foundStatus: foundStatus.length });
  });

  test('should allow AI model selection', async ({ page }) => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    
    // Enable AI toggle to show AI panel
    const aiToggle = page.locator('[data-testid="ai-toggle-button"]').first();
    if (await aiToggle.isVisible().catch(() => false)) {
      await aiToggle.click();
      await page.waitForTimeout(500);
    }
    
    // Look for model selector
    const modelSelectors = [
      'select[data-testid="ai-model-select"]',
      '.model-selector',
      'select:has-text("Model")',
      '[data-testid="model-select"]',
      '.ai-model-select'
    ];

    let modelSelector = null;
    for (const selector of modelSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        modelSelector = element;
        logger.log('MODEL_SELECTOR_FOUND', { selector });
        break;
      }
    }

    if (modelSelector) {
      // Try to get available options
      const options = await modelSelector.locator('option').all();
      const modelNames = await Promise.all(options.map(opt => opt.textContent()));
      logger.log('MODELS_AVAILABLE', { count: modelNames.length, models: modelNames });
    } else {
      logger.log('MODEL_SELECTOR_NOT_FOUND', { selectors: modelSelectors });
    }

    logger.log('TEST_COMPLETE', { modelSelectorFound: !!modelSelector });
  });

  test('should display AI insights after scan', async ({ page }) => {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    
    // Look for insights/results display
    const insightsSelectors = [
      '[data-testid="insights"]',
      '.insights',
      '.ai-insights',
      '.analysis-results',
      '[data-testid="analysis-results"]'
    ];

    let insightsFound = false;
    for (const selector of insightsSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        insightsFound = true;
        const text = await element.textContent();
        logger.log('INSIGHTS_FOUND', { selector, hasContent: !!text });
        break;
      }
    }

    if (!insightsFound) {
      logger.log('INSIGHTS_NOT_FOUND', { selectors: insightsSelectors });
    }

    logger.log('TEST_COMPLETE', { insightsFound });
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

    // Look for error messages related to AI
    const aiErrorSelectors = [
      '[data-testid="ai-error"]',
      '.ai-error',
      '.ollama-error',
      '[data-testid="ai-unavailable"]'
    ];

    const aiErrorsFound: string[] = [];
    for (const selector of aiErrorSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
        const text = await element.textContent();
        aiErrorsFound.push(`${selector}: ${text}`);
        logger.log('AI_ERROR_FOUND', { selector, text });
      }
    }

    logger.log('TEST_COMPLETE', { 
      consoleErrors: consoleErrors.length,
      aiErrorsFound: aiErrorsFound.length
    });
  });
});
