/**
 * Enhanced Complete User Flow Test - Improved with Page Objects and Assertions
 * Tests the complete workflow from app load to analysis completion
 */

import { test, expect } from '@playwright/test';
import { LandingPage, AnalysisPage, AIPage } from '../utils/page-objects';
import { TestAssertions } from '../utils/test-assertions';
import { TestEnvironment, TestDataFactory } from '../utils/test-fixtures';
import TestLogger from '../utils/logger';

test.describe('Enhanced Complete User Flow', () => {
  let logger: TestLogger;
  let landingPage: LandingPage;
  let analysisPage: AnalysisPage;
  let aiPage: AIPage;

  test.beforeEach(async ({ page }) => {
    logger = new TestLogger('enhanced-user-flow');
    landingPage = new LandingPage(page, logger);
    analysisPage = new AnalysisPage(page, logger);
    aiPage = new AIPage(page, logger);
    
    // Setup test environment with mocks
    await TestEnvironment.setup(page, { mockAPI: true });
    
    logger.log('TEST_START', { testName: 'Enhanced Complete User Flow' });
  });

  test('complete user journey with analysis', async ({ page }) => {
    try {
      // Step 1: Load application
      logger.log('STEP_1', { action: 'Load application' });
      await landingPage.navigateTo('http://localhost:3001');
      await landingPage.waitForPageLoad();
      await TestAssertions.assertPageTitle(page, 'Space Analyzer');
      logger.log('APP_LOADED', { title: await page.title() });

      // Step 2: Validate landing page elements
      logger.log('STEP_2', { action: 'Validate landing page elements' });
      const landingElements = await landingPage.validatePageElements();
      
      await TestAssertions.assertElementVisible(page, '[data-testid="landing-page"]');
      await TestAssertions.assertElementVisible(page, '[data-testid="directory-path-input"]');
      await TestAssertions.assertElementVisible(page, '[data-testid="start-analysis-button"]');
      
      expect(landingElements.landingPage, 'Landing page should be visible').toBe(true);
      expect(landingElements.directoryInput, 'Directory input should be visible').toBe(true);
      expect(landingElements.startButton, 'Start button should be visible').toBe(true);
      
      logger.log('LANDING_PAGE_VALIDATED', { elements: landingElements });

      // Step 3: Enter directory path
      logger.log('STEP_3', { action: 'Enter directory path' });
      const testPath = process.env.TEST_DIR || TestDataFactory.generateRandomFilePath();
      await landingPage.enterDirectoryPath(testPath);
      await TestAssertions.assertInputValue(page, '[data-testid="directory-path-input"]', testPath);
      logger.log('DIRECTORY_PATH_ENTERED', { path: testPath });

      // Step 4: Start analysis
      logger.log('STEP_4', { action: 'Start analysis' });
      await landingPage.startAnalysis();
      await TestAssertions.assertElementVisible(page, '[data-testid="progress-section"]', 10000);
      logger.log('ANALYSIS_STARTED', {});

      // Step 5: Wait for analysis completion
      logger.log('STEP_5', { action: 'Wait for analysis completion' });
      await analysisPage.waitForAnalysisCompletion(30000); // 30 seconds for test
      logger.log('ANALYSIS_COMPLETED', {});

      // Step 6: Validate scan results
      logger.log('STEP_6', { action: 'Validate scan results' });
      await TestAssertions.assertScanResults(page, 10000);
      
      const analysisElements = await analysisPage.validateAnalysisElements();
      expect(analysisElements.scanResults, 'Scan results should be visible').toBe(true);
      
      logger.log('SCAN_RESULTS_VALIDATED', { elements: analysisElements });

      // Step 7: Test AI features if available
      logger.log('STEP_7', { action: 'Test AI features' });
      if (landingElements.aiToggle) {
        await landingPage.toggleAI();
        await TestAssertions.assertElementVisible(page, '[data-testid="ai-panel"]', 5000);
        
        // Test AI analysis
        if (await aiPage.isAIPanelVisible()) {
          await TestAssertions.assertAIAnalysis(page, 15000);
          logger.log('AI_ANALYSIS_COMPLETED', {});
        }
      }

      // Step 8: Validate final state
      logger.log('STEP_8', { action: 'Validate final state' });
      await TestAssertions.assertNoConsoleErrors(page);
      await TestAssertions.assertNoJavaScriptErrors(page);

      // Take final screenshot
      await landingPage.takeScreenshot('enhanced-user-flow-complete');
      
      logger.log('TEST_COMPLETE', {
        landingElements,
        analysisElements,
        testPath
      });

    } catch (error) {
      logger.logError('TEST_FAILED', error as Error, {});
      await landingPage.takeScreenshot('enhanced-user-flow-error');
      throw error;
    }
  });

  test('user journey with error handling', async ({ page }) => {
    // Setup error mocks
    await TestEnvironment.setup(page, { mockErrors: true });

    await landingPage.navigateTo('http://localhost:3001');
    await landingPage.waitForPageLoad();

    // Test error scenario
    await TestAssertions.assertErrorHandling(
      page,
      async () => {
        await landingPage.enterDirectoryPath('/invalid/path');
        await landingPage.startAnalysis();
      },
      'Invalid directory path'
    );

    logger.log('TEST_COMPLETE', { errorHandling: 'passed' });
  });

  test('user journey with slow responses', async ({ page }) => {
    // Setup slow responses
    await TestEnvironment.setup(page, { slowResponses: true, responseDelay: 2000 });

    await landingPage.navigateTo('http://localhost:3001');
    await landingPage.waitForPageLoad();

    // Test loading states
    await landingPage.enterDirectoryPath(TestDataFactory.generateRandomFilePath());
    await landingPage.startAnalysis();

    // Should show loading state
    await TestAssertions.assertLoadingState(page, '[data-testid="progress-section"]');
    
    // Wait for completion
    await analysisPage.waitForAnalysisCompletion(45000); // Longer timeout for slow responses

    logger.log('TEST_COMPLETE', { slowResponses: 'passed' });
  });

  test('user journey with AI features', async ({ page }) => {
    await landingPage.navigateTo('http://localhost:3001');
    await landingPage.waitForPageLoad();

    // Ensure AI toggle is available
    const isAIToggleVisible = await landingPage.isAIToggleVisible();
    if (isAIToggleVisible) {
      // Enable AI
      await landingPage.toggleAI();
      
      // Perform analysis
      await landingPage.enterDirectoryPath(TestDataFactory.generateRandomFilePath());
      await landingPage.startAnalysis();
      
      // Wait for analysis and AI results
      await analysisPage.waitForAnalysisCompletion(30000);
      
      // Test AI features
      await TestAssertions.assertAIAnalysis(page, 15000);
      
      // Validate AI elements
      const aiElements = await aiPage.validateAIElements();
      expect(aiElements.aiPanel, 'AI panel should be visible').toBe(true);
      expect(aiElements.insights, 'AI insights should be visible').toBe(true);
      
      logger.log('TEST_COMPLETE', { aiFeatures: 'passed', aiElements });
    } else {
      logger.log('AI_FEATURES_NOT_AVAILABLE', {});
      test.skip();
    }
  });

  test('user journey with responsive design', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ];

    for (const viewport of viewports) {
      logger.log('TESTING_VIEWPORT', { name: viewport.name, width: viewport.width, height: viewport.height });
      
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await landingPage.navigateTo('http://localhost:3001');
      await landingPage.waitForPageLoad();

      // Test basic functionality on this viewport
      const landingElements = await landingPage.validatePageElements();
      expect(landingElements.landingPage, `Landing page should be visible on ${viewport.name}`).toBe(true);
      
      // Test analysis on this viewport
      if (landingElements.directoryInput && landingElements.startButton) {
        await landingPage.enterDirectoryPath(TestDataFactory.generateRandomFilePath());
        await landingPage.startAnalysis();
        
        // Verify progress section is visible
        await TestAssertions.assertElementVisible(page, '[data-testid="progress-section"]', 10000);
        
        // Wait for completion or timeout
        await analysisPage.waitForAnalysisCompletion(20000);
      }
    }

    logger.log('TEST_COMPLETE', { responsiveDesign: 'passed', viewports: viewports.length });
  });

  test('user journey with performance monitoring', async ({ page }) => {
    const startTime = Date.now();
    
    await landingPage.navigateTo('http://localhost:3001');
    await landingPage.waitForPageLoad();
    
    const loadTime = Date.now() - startTime;
    
    // Assert reasonable load time
    expect(loadTime, 'App should load within 10 seconds').toBeLessThan(10000);
    
    // Perform analysis and measure performance
    await landingPage.enterDirectoryPath(TestDataFactory.generateRandomFilePath());
    await landingPage.startAnalysis();
    
    const analysisStartTime = Date.now();
    await analysisPage.waitForAnalysisCompletion(30000);
    const analysisTime = Date.now() - analysisStartTime;
    
    // Assert reasonable analysis time
    expect(analysisTime, 'Analysis should complete within 30 seconds').toBeLessThan(30000);
    
    logger.log('TEST_COMPLETE', { 
      performance: 'passed',
      loadTime,
      analysisTime
    });
  });

  test('user journey with accessibility validation', async ({ page }) => {
    await landingPage.navigateTo('http://localhost:3001');
    await landingPage.waitForPageLoad();

    // Test accessibility on landing page
    await TestAssertions.assertAccessibilityBasics(page);
    
    // Perform analysis
    await landingPage.enterDirectoryPath(TestDataFactory.generateRandomFilePath());
    await landingPage.startAnalysis();
    
    // Wait for analysis completion
    await analysisPage.waitForAnalysisCompletion(30000);
    
    // Test accessibility on results page
    await TestAssertions.assertAccessibilityBasics(page);
    
    // Test keyboard navigation through results
    await page.keyboard.press('Tab');
    await TestAssertions.assertElementFocused(page, ':focus');
    
    logger.log('TEST_COMPLETE', { accessibility: 'passed' });
  });
});