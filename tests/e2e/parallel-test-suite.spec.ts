import { test, expect } from '@playwright/test';
import { RetryHelper } from '../utils/retry-helper';

test.describe('Parallel Test Suite', () => {
  test('basic frontend functionality', async ({ page }) => {
    console.log('Testing basic frontend functionality...');

    await RetryHelper.safeNavigate(page, 'http://localhost:5173');
    await page.waitForTimeout(2000);

    const title = await page.title();
    expect(title).toMatch(/space analyzer/i);

    const body = await page.locator('body').first();
    await expect(body).toBeVisible();

    console.log('✅ Basic frontend functionality test completed');
  });

  test('page load performance', async ({ page }) => {
    console.log('Testing page load performance...');

    const startTime = Date.now();
    await RetryHelper.safeNavigate(page, 'http://localhost:5173');
    const loadTime = Date.now() - startTime;

    expect(loadTime).toBeLessThan(5000);
    console.log(`✅ Page loaded in ${loadTime}ms`);
  });

  test('responsive design test', async ({ page }) => {
    console.log('Testing responsive design...');

    await RetryHelper.safeNavigate(page, 'http://localhost:5173');

    const viewports = [
      { width: 1920, height: 1080 },
      { width: 768, height: 1024 }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);

      const bodyVisible = await page.locator('body').isVisible();
      expect(bodyVisible).toBe(true);
    }

    console.log('✅ Responsive design test completed');
  });

  test('error handling test', async ({ page }) => {
    console.log('Testing error handling...');

    try {
      // Test with invalid URL
      await page.goto('http://localhost:5173/nonexistent', { timeout: 5000 });
    } catch (error) {
      expect(error.message).toContain('404');
      console.log('✅ Error handling test completed');
    }

    // Navigate back to valid page
    await RetryHelper.safeNavigate(page, 'http://localhost:5173');
    console.log('✅ Error recovery test completed');
  });
});
