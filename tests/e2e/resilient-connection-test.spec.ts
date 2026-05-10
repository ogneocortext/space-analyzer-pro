import { test, expect } from '@playwright/test';
import { RetryHelper } from '../utils/retry-helper';

test.describe('Resilient Connection Tests', () => {
  test('should connect to backend with retry logic', async ({ page }) => {
    console.log('Testing backend connection with retry...');
    
    try {
      const response = await RetryHelper.safeApiCall(
        page,
        'http://localhost:8080/api/health'
      );
      
      expect(response?.status()).toBe(200);
      
      const healthData = await response.json();
      expect(healthData).toHaveProperty('success', true);
      expect(healthData).toHaveProperty('status', 'healthy');
      
      console.log('✅ Backend connection with retry passed');
    } catch (error) {
      console.error('❌ Backend connection with retry failed:', error.message);
      throw error;
    }
  });

  test('should connect to frontend with retry logic', async ({ page }) => {
    console.log('Testing frontend connection with retry...');
    
    try {
      const response = await RetryHelper.safeNavigate(
        page,
        'http://localhost:5173',
        { waitUntil: 'domcontentloaded', timeout: 15000 }
      );
      
      expect(response?.status()).toBe(200);
      
      const title = await page.title();
      expect(title).toMatch(/space analyzer/i);
      
      console.log('✅ Frontend connection with retry passed');
    } catch (error) {
      console.error('❌ Frontend connection with retry failed:', error.message);
      throw error;
    }
  });

  test('should handle temporary network failures', async ({ page }) => {
    console.log('Testing network resilience...');
    
    // Test with invalid endpoint first
    try {
      await RetryHelper.safeApiCall(page, 'http://localhost:8080/api/invalid');
      expect.fail('Should have failed for invalid endpoint');
    } catch (error) {
      expect(error.message).toContain('returned status');
      console.log('✅ Network resilience test passed - correctly handled invalid endpoint');
    }
  });

  test('should wait for service availability', async ({ page }) => {
    console.log('Testing service availability wait...');
    
    try {
      await RetryHelper.waitForCondition(
        async () => {
          const response = await page.goto('http://localhost:8080/api/health');
          return response?.status() === 200;
        },
        30000, // 30 second timeout
        'Waiting for backend service to be available'
      );
      
      console.log('✅ Service availability wait completed');
    } catch (error) {
      console.error('❌ Service availability wait failed:', error.message);
      throw error;
    }
  });

  test('should take screenshot with error handling', async ({ page }) => {
    console.log('Testing screenshot with error handling...');
    
    try {
      await RetryHelper.safeNavigate(page, 'http://localhost:5173');
      
      // Take screenshot with error handling
      await page.screenshot({ 
        path: 'test-results/resilient-screenshot.png',
        fullPage: true 
      });
      
      console.log('✅ Screenshot with error handling completed');
    } catch (error) {
      console.error('❌ Screenshot test failed:', error.message);
      
      // Try to take error screenshot
      try {
        await page.screenshot({ 
          path: 'test-results/resilient-screenshot-error.png',
          fullPage: true 
        });
      } catch (screenshotError) {
        console.error('❌ Failed to take error screenshot:', screenshotError.message);
      }
      
      throw error;
    }
  });
});
