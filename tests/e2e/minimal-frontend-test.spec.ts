import { test, expect } from '@playwright/test';
import { RetryHelper } from '../utils/retry-helper';

test('minimal frontend test', async ({ page }) => {
  console.log('Testing minimal frontend functionality...');
  
  try {
    // Navigate to frontend
    await RetryHelper.safeNavigate(page, 'http://localhost:5173');
    await page.waitForTimeout(1000);
    
    // Check if page loaded at all
    const pageTitle = await page.title();
    console.log(`Page title: ${pageTitle}`);
    expect(pageTitle).toMatch(/space analyzer/i);
    
    // Check if Vue app is mounting
    const appElement = await page.locator('#app').first();
    const appExists = await appElement.isVisible().catch(() => false);
    console.log(`App element visible: ${appExists}`);
    
    // Check for any Vue app content
    const pageContent = await page.content();
    const hasVueContent = pageContent.includes('createApp') || pageContent.includes('vue');
    console.log(`Has Vue content: ${hasVueContent}`);
    
    // Wait a bit more for Vue to potentially initialize
    await page.waitForTimeout(3000);
    
    // Check again after wait
    const appElementAfterWait = await page.locator('#app').first();
    const appExistsAfterWait = await appElementAfterWait.isVisible().catch(() => false);
    console.log(`App element visible after wait: ${appExistsAfterWait}`);
    
    // Check for any rendered content inside app
    const appContent = await page.locator('#app').textContent();
    console.log(`App content: ${appContent || 'empty'}`);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-results/minimal-frontend-test.png',
      fullPage: true 
    });
    
    // Basic assertion - at least app should exist
    expect(appExists || appExistsAfterWait || hasVueContent).toBe(true);
    
    console.log('✅ Minimal frontend test completed');
    
  } catch (error) {
    console.error('❌ Minimal frontend test failed:', error.message);
    
    try {
      await page.screenshot({ 
        path: 'test-results/minimal-frontend-test-error.png',
        fullPage: true 
      });
    } catch (screenshotError) {
      console.error('❌ Failed to take error screenshot');
    }
    
    throw error;
  }
});
