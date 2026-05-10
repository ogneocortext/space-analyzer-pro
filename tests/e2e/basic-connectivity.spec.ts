/**
 * Basic Connectivity Test - Simplified version to identify issues
 */

import { test, expect } from '@playwright/test';

test.describe('Basic Connectivity', () => {
  test('should connect to frontend', async ({ page }) => {
    console.log('Testing frontend connection...');
    
    try {
      const response = await page.goto('http://localhost:5173', { 
        waitUntil: 'domcontentloaded',
        timeout: 10000 
      });
      
      console.log('Frontend response status:', response?.status());
      expect(response?.status()).toBe(200);
      
      const title = await page.title();
      console.log('Page title:', title);
      expect(title).toBeTruthy();
      
      console.log('✅ Frontend connectivity test passed');
    } catch (error) {
      console.error('❌ Frontend test failed:', error.message);
      throw error;
    }
  });

  test('should connect to backend API', async ({ page }) => {
    console.log('Testing backend connection...');
    
    try {
      const response = await page.goto('http://localhost:8080/api/health', { 
        timeout: 10000 
      });
      
      console.log('Backend response status:', response?.status());
      expect(response?.status()).toBe(200);
      
      const data = await response?.json();
      console.log('Backend response:', data);
      expect(data).toHaveProperty('status');
      
      console.log('✅ Backend connectivity test passed');
    } catch (error) {
      console.error('❌ Backend test failed:', error.message);
      throw error;
    }
  });
});