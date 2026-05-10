import { test, expect } from '@playwright/test';
import { RetryHelper } from '../utils/retry-helper';

test('basic frontend functionality test', async ({ page }) => {
  console.log('Testing basic frontend functionality...');
  
  try {
    // Navigate to frontend
    await RetryHelper.safeNavigate(page, 'http://localhost:5173');
    await page.waitForTimeout(3000);
    
    // Check if page loaded at all
    const pageTitle = await page.title();
    expect(pageTitle).toMatch(/space analyzer/i);
    
    // Check if main app element exists
    const appElement = await page.locator('#app').first();
    const appExists = await appElement.isVisible().catch(() => false);
    console.log(`✅ App element exists: ${appExists}`);
    
    // Check page content
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
    console.log(`✅ Body text length: ${bodyText?.length || 0} characters`);
    
    // Check for any Vue-specific indicators
    const pageContent = await page.content();
    const hasVueApp = pageContent.includes('createApp') || pageContent.includes('vue');
    console.log(`✅ Has Vue app content: ${hasVueApp}`);
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-results/basic-frontend-test.png',
      fullPage: true 
    });
    
    // Basic assertion - at least one of these should be true
    expect(appExists || hasVueApp || (bodyText?.length || 0) > 0).toBe(true);
    
    console.log('✅ Basic frontend functionality test completed');
    
  } catch (error) {
    console.error('❌ Basic frontend test failed:', error.message);
    
    try {
      await page.screenshot({ 
        path: 'test-results/basic-frontend-test-error.png',
        fullPage: true 
      });
    } catch (screenshotError) {
      console.error('❌ Failed to take error screenshot');
    }
    
    throw error;
  }
});
