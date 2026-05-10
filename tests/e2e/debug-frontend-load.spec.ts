import { test, expect } from '@playwright/test';
import { RetryHelper } from '../utils/retry-helper';

test('debug frontend loading issues', async ({ page }) => {
  console.log('Debugging frontend loading issues...');

  try {
    // Capture console errors
    const consoleMessages = [];
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        timestamp: new Date().toISOString()
      });
    });

    // Capture unhandled errors
    page.on('pageerror', (error) => {
      consoleMessages.push({
        type: 'error',
        text: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });

    // Capture failed resource loads
    page.on('requestfailed', (request) => {
      consoleMessages.push({
        type: 'requestfailed',
        url: request.url(),
        failure: request.failure(),
        timestamp: new Date().toISOString()
      });
    });

    await RetryHelper.safeNavigate(page, 'http://localhost:5173');
    await page.waitForTimeout(5000);

    // Check if Vue app actually loaded
    const appElement = await page.locator('#app').first();
    const appExists = await appElement.isVisible().catch(() => false);

    // Check for any Vue-specific elements using simpler approach
    const vueElements = await page.locator('[data-v-]').all();

    // Check for loading indicators
    const loadingIndicators = await page.locator('.loading, [data-loading], .spinner').all();

    // Check page content after load
    const pageContent = await page.content();
    const hasVueContent = pageContent.includes('createApp') || pageContent.includes('vue');

    console.log(`✅ App element visible: ${appExists}`);
    console.log(`✅ Vue elements found: ${vueElements.length}`);
    console.log(`✅ Loading indicators: ${loadingIndicators.length}`);
    console.log(`✅ Has Vue content: ${hasVueContent}`);

    // Log all console messages
    console.log('=== Console Messages ===');
    consoleMessages.forEach(msg => {
      console.log(`[${msg.type}] ${msg.text}`);
    });
    console.log('=== End Console Messages ===');

    // Take screenshot
    await page.screenshot({
      path: 'test-results/debug-frontend-load.png',
      fullPage: true
    });

    // Basic assertions
    expect(appExists || vueElements.length > 0 || hasVueContent).toBe(true);

  } catch (error) {
    console.error('❌ Debug test failed:', error.message);

    try {
      await page.screenshot({
        path: 'test-results/debug-frontend-load-error.png',
        fullPage: true
      });
    } catch (screenshotError) {
      console.error('❌ Failed to take error screenshot');
    }

    throw error;
  }
});
