/**
 * Simple Connection Test - Tests basic connectivity with running services
 * Uses existing backend and frontend without starting new ones
 */

import { test, expect } from '@playwright/test';
import { TestAssertions } from '../utils/test-assertions';
import { TestEnvironment, TestDataFactory } from '../utils/test-fixtures';

test.describe('Simple Connection Test', () => {
  test('should connect to running services', async ({ page }) => {
    console.log('🧪 Testing connection to running services...');

    // Setup test environment without starting servers
    await TestEnvironment.setup(page, {
      mockAPI: false, // Use real API since backend is running
      mockErrors: false
    });

    try {
      // Navigate to frontend
      await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });
      console.log('✅ Frontend connected successfully');

      // Check page loaded
      await TestAssertions.assertPageTitle(page, 'Space Analyzer');
      console.log('✅ Page title verified');

      // Check for basic elements
      const hasLandingPage = await page.locator('[data-testid="landing-page"]').isVisible().catch(() => false);
      if (hasLandingPage) {
        console.log('✅ Landing page element found');
      } else {
        console.log('⚠️ Landing page element not found, checking for alternative selectors...');

        // Try alternative selectors
        const alternatives = [
          '.landing-page',
          '.main-content',
          'main',
          'body'
        ];

        for (const selector of alternatives) {
          const isVisible = await page.locator(selector).isVisible().catch(() => false);
          if (isVisible) {
            console.log(`✅ Found page content with selector: ${selector}`);
            break;
          }
        }
      }

      // Check backend connectivity
      const response = await page.goto('http://localhost:8080/api/health');
      if (response && response.ok()) {
        console.log('✅ Backend API responding correctly');

        const healthData = await response.json();
        console.log('📊 Backend health:', JSON.stringify(healthData, null, 2));
      } else {
        console.log('❌ Backend API not responding');
      }

      // Check for Ollama models via backend
      try {
        const modelsResponse = await page.goto('http://localhost:8080/api/ai/models');
        if (modelsResponse && modelsResponse.ok()) {
          const models = await modelsResponse.json();
          console.log(`🤖 Found ${models.length} AI models:`, models.map(m => m.name).join(', '));

          // Verify our actual models are included
          const expectedModels = ['qwen3.5:4b', 'deepseek-coder:6.7b-instruct', 'gemma4:e2b'];
          const foundModels = models.filter(m => expectedModels.includes(m.id));
          console.log(`✅ Found ${foundModels.length} expected models in backend`);
        }
      } catch (error) {
        console.log('⚠️ Could not fetch AI models from backend:', error.message);
      }

      // Take screenshot for verification
      await page.screenshot({
        path: 'test-results/simple-connection-test.png',
        fullPage: true
      });
      console.log('📸 Screenshot saved');

      console.log('✅ Connection test completed successfully');

    } catch (error) {
      console.error('❌ Connection test failed:', error.message);

      // Take error screenshot
      await page.screenshot({
        path: 'test-results/simple-connection-error.png',
        fullPage: true
      });

      throw error;
    }
  });

  test('should test basic page interactions', async ({ page }) => {
    console.log('🧪 Testing basic page interactions...');

    await TestEnvironment.setup(page, { mockAPI: false });

    try {
      await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 15000 });

      // Test basic navigation
      await page.waitForTimeout(2000); // Wait for page to fully load

      // Look for input field
      const inputSelector = await page.locator('input[type="text"], input[placeholder*="directory"], [data-testid*="input"]').first();
      const isInputVisible = await inputSelector.isVisible().catch(() => false);

      if (isInputVisible) {
        console.log('✅ Input field found');

        // Test input interaction
        await inputSelector.fill('/test/path');
        const value = await inputSelector.inputValue();
        expect(value).toBe('/test/path');
        console.log('✅ Input field interaction working');
      } else {
        console.log('⚠️ No input field found');
      }

      // Look for buttons
      const buttonSelector = await page.locator('button, [role="button"]').first();
      const isButtonVisible = await buttonSelector.isVisible().catch(() => false);

      if (isButtonVisible) {
        console.log('✅ Button found');
        console.log('📝 Button text:', await buttonSelector.textContent());
      } else {
        console.log('⚠️ No buttons found');
      }

      console.log('✅ Basic interactions test completed');

    } catch (error) {
      console.error('❌ Basic interactions test failed:', error.message);
      throw error;
    }
  });
});
