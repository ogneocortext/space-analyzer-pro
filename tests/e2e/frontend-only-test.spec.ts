import { test, expect } from '@playwright/test';

test('frontend only test', async ({ page }) => {
  console.log('Testing frontend only...');

  try {
    // Test frontend connection only
    const response = await page.goto('http://localhost:5173');
    expect(response?.status()).toBe(200);

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Check page title
    const title = await page.title();
    expect(title).toMatch(/space analyzer/i);

    // Check for basic page elements
    const body = await page.locator('body').first();
    await expect(body).toBeVisible();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/frontend-only-test.png',
      fullPage: true
    });

    console.log('✅ Frontend only test completed');

  } catch (error) {
    console.error('❌ Frontend only test failed:', error);
    await page.screenshot({
      path: 'test-results/frontend-only-test-error.png',
      fullPage: true
    });
    throw error;
  }
});
