import { test, expect } from '@playwright/test';
import { RetryHelper } from '../utils/retry-helper';

test('debug console errors', async ({ page }) => {
  console.log('Capturing console errors...');
  
  try {
    // Capture all console messages
    const consoleMessages = [];
    
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location(),
        timestamp: new Date().toISOString()
      });
    });

    page.on('pageerror', (error) => {
      consoleMessages.push({
        type: 'error',
        text: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });

    page.on('requestfailed', (request) => {
      consoleMessages.push({
        type: 'requestfailed',
        url: request.url(),
        failure: request.failure(),
        timestamp: new Date().toISOString()
      });
    });

    // Navigate to frontend
    await RetryHelper.safeNavigate(page, 'http://localhost:5173');
    await page.waitForTimeout(5000);
    
    // Check page title
    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);
    expect(pageTitle).toMatch(/space analyzer/i);
    
    // Check app element
    const appElement = await page.locator('#app').first();
    const appExists = await appElement.isVisible().catch(() => false);
    console.log(`App element visible: ${appExists}`);
    
    // Check app content
    const appContent = await appElement.textContent();
    console.log(`App content: "${appContent || 'empty'}"`);
    
    // Log all console messages
    console.log('=== Console Messages ===');
    consoleMessages.forEach(msg => {
      console.log(`[${msg.type}] ${msg.text}`);
    });
    console.log('=== End Console Messages ===');
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-results/console-debug-test.png',
      fullPage: true 
    });
    
    // Basic assertion
    expect(pageTitle).toMatch(/space analyzer/i);
    
  } catch (error) {
    console.error('❌ Console debug test failed:', error.message);
    throw error;
  }
});
