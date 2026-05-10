/**
 * Simple Backend Connectivity Test
 * Tests that the backend API server is running and responding
 */

import { test, expect } from '@playwright/test';

test.describe('Backend Connectivity', () => {
  test('should respond to health check', async ({ page }) => {
    const response = await page.goto('http://localhost:8080/api/health', {
      timeout: 15000
    });

    expect(response?.status()).toBeLessThan(600);
    const data = await response?.json();
    console.log('Health check response:', data);

    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('version');
    expect(data.service).toBe('Space Analyzer Backend');
  });

  test('should respond to API info', async ({ page }) => {
    const response = await page.goto('http://localhost:8080/api/info', {
      timeout: 15000
    });

    expect(response?.status()).toBeLessThan(600);
    const data = await response?.json();
    console.log('API info response:', data);
    expect(data).toHaveProperty('version');
  });
});