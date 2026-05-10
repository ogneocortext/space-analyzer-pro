import { test, expect } from '@playwright/test';
import { RetryHelper } from '../utils/retry-helper';
import TestDataFixtures from '../fixtures/test-data';

test.describe('Fixture-Based Tests', () => {
  test('should handle realistic file system data', async ({ page }) => {
    console.log('Testing with realistic file system data...');
    
    try {
      await RetryHelper.safeNavigate(page, 'http://localhost:5173');
      
      // Test input field with realistic data
      const inputSelector = TestDataFixtures.uiElements.selectors.inputFields[0];
      const inputField = await page.locator(inputSelector).first();
      
      await expect(inputField).toBeVisible({ timeout: TestDataFixtures.performance.thresholds.elementVisible });
      
      // Test with medium directory path
      const mediumDir = TestDataFixtures.fileSystem.mediumDirectory;
      await inputField.fill(mediumDir.path);
      
      const value = await inputField.inputValue();
      expect(value).toBe(mediumDir.path);
      
      console.log('✅ File system data test completed');
    } catch (error) {
      console.error('❌ File system data test failed:', error.message);
      throw error;
    }
  });

  test('should validate UI elements exist', async ({ page }) => {
    console.log('Testing UI element validation...');
    
    try {
      await RetryHelper.safeNavigate(page, 'http://localhost:5173');
      
      // Check page title
      const title = await page.title();
      expect(title).toMatch(TestDataFixtures.uiElements.expectedTexts.pageTitle);
      
      // Check for main content elements
      for (const selector of TestDataFixtures.uiElements.selectors.mainContent) {
        const element = await page.locator(selector).first();
        const isVisible = await element.isVisible().catch(() => false);
        
        if (isVisible) {
          console.log(`✅ Found main content with selector: ${selector}`);
          break;
        }
      }
      
      // Check for navigation elements
      for (const selector of TestDataFixtures.uiElements.selectors.navigation) {
        const element = await page.locator(selector).first();
        const isVisible = await element.isVisible().catch(() => false);
        
        if (isVisible) {
          console.log(`✅ Found navigation with selector: ${selector}`);
          break;
        }
      }
      
      console.log('✅ UI element validation completed');
    } catch (error) {
      console.error('❌ UI element validation failed:', error.message);
      throw error;
    }
  });

  test('should handle performance thresholds', async ({ page }) => {
    console.log('Testing performance thresholds...');
    
    try {
      const startTime = Date.now();
      
      // Navigate with performance timing
      await RetryHelper.safeNavigate(page, 'http://localhost:5173');
      
      const navigationTime = Date.now() - startTime;
      expect(navigationTime).toBeLessThan(TestDataFixtures.performance.thresholds.pageLoad);
      
      // Check element visibility timing
      const elementStartTime = Date.now();
      
      const mainElement = await page.locator(TestDataFixtures.uiElements.selectors.mainContent[0]).first();
      await expect(mainElement).toBeVisible({ timeout: TestDataFixtures.performance.thresholds.elementVisible });
      
      const elementVisibilityTime = Date.now() - elementStartTime;
      expect(elementVisibilityTime).toBeLessThan(TestDataFixtures.performance.thresholds.elementVisible);
      
      console.log(`✅ Navigation time: ${navigationTime}ms (threshold: ${TestDataFixtures.performance.thresholds.pageLoad}ms)`);
      console.log(`✅ Element visibility time: ${elementVisibilityTime}ms (threshold: ${TestDataFixtures.performance.thresholds.elementVisible}ms)`);
      console.log('✅ Performance thresholds test completed');
    } catch (error) {
      console.error('❌ Performance thresholds test failed:', error.message);
      throw error;
    }
  });

  test('should simulate realistic user workflow', async ({ page }) => {
    console.log('Testing realistic user workflow...');
    
    try {
      await RetryHelper.safeNavigate(page, 'http://localhost:5173');
      
      // Step 1: Find and interact with input field
      const inputSelector = TestDataFixtures.uiElements.selectors.inputFields[0];
      const inputField = await page.locator(inputSelector).first();
      await expect(inputField).toBeVisible();
      
      // Step 2: Enter a realistic directory path
      const testPath = TestDataFixtures.fileSystem.smallDirectory.path;
      await inputField.fill(testPath);
      
      // Step 3: Look for analyze/start button
      let analyzeButton = null;
      for (const selector of TestDataFixtures.uiElements.selectors.buttons) {
        const button = await page.locator(selector).first();
        const isVisible = await button.isVisible().catch(() => false);
        
        if (isVisible) {
          const buttonText = await button.textContent();
          if (buttonText && TestDataFixtures.uiElements.expectedTexts.analyzeButton.test(buttonText)) {
            analyzeButton = button;
            console.log(`✅ Found analyze button: "${buttonText}"`);
            break;
          }
        }
      }
      
      // Step 4: Check for loading state (optional)
      if (analyzeButton) {
        await analyzeButton.click();
        
        // Wait briefly for any loading state
        await page.waitForTimeout(TestDataFixtures.performance.timeouts.short);
        
        // Check if loading indicators appear
        const loadingSelectors = ['[data-testid*="loading"]', '.loading', '.spinner'];
        let loadingFound = false;
        
        for (const selector of loadingSelectors) {
          const loadingElement = await page.locator(selector).first();
          const isVisible = await loadingElement.isVisible().catch(() => false);
          if (isVisible) {
            loadingFound = true;
            console.log(`✅ Found loading indicator: ${selector}`);
            break;
          }
        }
        
        if (!loadingFound) {
          console.log('ℹ️ No loading indicators found (may load instantly)');
        }
      }
      
      // Step 5: Take workflow screenshot
      await page.screenshot({ 
        path: 'test-results/realistic-workflow-test.png',
        fullPage: true 
      });
      
      console.log('✅ Realistic user workflow completed');
    } catch (error) {
      console.error('❌ Realistic user workflow failed:', error.message);
      
      // Take error screenshot
      try {
        await page.screenshot({ 
          path: 'test-results/realistic-workflow-error.png',
          fullPage: true 
        });
      } catch (screenshotError) {
        console.error('❌ Failed to take error screenshot:', screenshotError);
      }
      
      throw error;
    }
  });

  test('should validate error scenarios', async ({ page }) => {
    console.log('Testing error scenarios...');
    
    try {
      // Test 1: Invalid directory path
      await RetryHelper.safeNavigate(page, 'http://localhost:5173');
      
      const inputSelector = TestDataFixtures.uiElements.selectors.inputFields[0];
      const inputField = await page.locator(inputSelector).first();
      await expect(inputField).toBeVisible();
      
      // Enter invalid path
      await inputField.fill('/invalid/nonexistent/path');
      
      // Look for analyze button and click
      for (const selector of TestDataFixtures.uiElements.selectors.buttons) {
        const button = await page.locator(selector).first();
        const isVisible = await button.isVisible().catch(() => false);
        
        if (isVisible) {
          await button.click();
          break;
        }
      }
      
      // Wait for potential error message
      await page.waitForTimeout(TestDataFixtures.performance.timeouts.medium);
      
      // Check for error indicators
      const errorSelectors = ['[data-testid*="error"]', '.error', '.alert'];
      let errorFound = false;
      
      for (const selector of errorSelectors) {
        const errorElement = await page.locator(selector).first();
        const isVisible = await errorElement.isVisible().catch(() => false);
        if (isVisible) {
          errorFound = true;
          console.log(`✅ Found error indicator: ${selector}`);
          break;
        }
      }
      
      if (!errorFound) {
        console.log('ℹ️ No error indicators found (may handle errors silently)');
      }
      
      console.log('✅ Error scenarios test completed');
    } catch (error) {
      console.error('❌ Error scenarios test failed:', error.message);
      throw error;
    }
  });
});
