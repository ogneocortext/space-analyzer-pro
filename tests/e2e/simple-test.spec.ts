import { test, expect } from '@playwright/test';

test.describe('Connection Tests', () => {
  test('should connect to backend health endpoint', async ({ page }) => {
    console.log('Testing backend connection...');

    // Test backend health endpoint
    const response = await page.goto('http://localhost:8080/api/health');
    expect(response?.status()).toBe(200);

    const healthData = await response.json();
    expect(healthData).toHaveProperty('success', true);
    expect(healthData).toHaveProperty('status', 'healthy');
    expect(healthData).toHaveProperty('version');
    expect(healthData).toHaveProperty('service', 'Space Analyzer Backend');

    console.log('✅ Backend health check passed');
  });

  test('should connect to frontend application', async ({ page }) => {
    console.log('Testing frontend connection...');

    // Test frontend
    const response = await page.goto('http://localhost:5173');
    expect(response?.status()).toBe(200);

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Check page title
    const title = await page.title();
    expect(title).toMatch(/space analyzer/i);

    // Check for basic page elements
    await page.waitForTimeout(2000);

    // Look for main application container
    const mainContainer = await page.locator('main, .main-content, #app, body').first();
    await expect(mainContainer).toBeVisible();

    console.log('✅ Frontend connection check passed');
  });

  test('should verify API endpoints are accessible', async ({ page }) => {
    console.log('Testing API endpoints...');

    // Test various API endpoints
    const endpoints = [
      '/api/health',
      '/api/info',
      '/api/version',
      '/api/status'
    ];

    for (const endpoint of endpoints) {
      const response = await page.goto(`http://localhost:8080${endpoint}`);
      expect(response?.status()).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty('success');

      console.log(`✅ ${endpoint} - Status: ${response?.status()}`);
    }
  });

  test('should take comprehensive screenshot', async ({ page }) => {
    console.log('Taking comprehensive screenshot...');

    // Navigate to frontend
    await page.goto('http://localhost:5173');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    // Take full page screenshot
    await page.screenshot({
      path: 'test-results/comprehensive-screenshot.png',
      fullPage: true,
      quality: 90
    });

    // Test page metrics
    const metrics = await page.evaluate(() => ({
      title: document.title,
      url: window.location.href,
      timestamp: new Date().toISOString()
    }));

    expect(metrics.title).toMatch(/space analyzer/i);
    expect(metrics.url).toBe('http://localhost:5173/');

    console.log('✅ Comprehensive screenshot completed');
    console.log('📊 Page metrics:', metrics);
  });
});
