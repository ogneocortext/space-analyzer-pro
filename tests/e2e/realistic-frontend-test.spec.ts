import { test, expect } from '@playwright/test';
import { RetryHelper } from '../utils/retry-helper';

test.describe('Realistic Frontend Tests', () => {
  test('should explore actual frontend structure', async ({ page }) => {
    console.log('Exploring actual frontend structure...');
    
    try {
      await RetryHelper.safeNavigate(page, 'http://localhost:5173');
      
      // Wait for page to fully load
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(3000);
      
      // Take screenshot first
      await page.screenshot({ 
        path: 'test-results/frontend-structure.png',
        fullPage: true 
      });
      
      // Get page content to analyze structure
      const pageContent = await page.content();
      console.log('✅ Page loaded successfully');
      
      // Look for common elements that might exist
      const commonSelectors = [
        'input',
        'button',
        'div',
        'section',
        'main',
        'header',
        'nav',
        'form',
        'h1', 'h2', 'h3',
        '.container',
        '.app',
        '#app',
        'body'
      ];
      
      const foundElements = [];
      for (const selector of commonSelectors) {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          foundElements.push({ selector, count: elements.length });
          console.log(`✅ Found ${elements.length} elements with selector: ${selector}`);
        }
      }
      
      // Check page title
      const title = await page.title();
      console.log(`✅ Page title: "${title}"`);
      expect(title).toBeTruthy();
      
      // Check for any text content
      const bodyText = await page.locator('body').textContent();
      expect(bodyText).toBeTruthy();
      console.log(`✅ Body text length: ${bodyText?.length || 0} characters`);
      
      // Look for any interactive elements
      const clickableElements = await page.locator('button, input, a, [role="button"]').all();
      console.log(`✅ Found ${clickableElements.length} interactive elements`);
      
      // Check for any forms
      const forms = await page.locator('form').all();
      console.log(`✅ Found ${forms.length} forms`);
      
      // Look for any data-testid attributes
      const dataTestElements = await page.locator('[data-testid]').all();
      console.log(`✅ Found ${dataTestElements.length} elements with data-testid`);
      
      console.log('✅ Frontend structure exploration completed');
    } catch (error) {
      console.error('❌ Frontend structure exploration failed:', error.message);
      
      try {
        await page.screenshot({ 
          path: 'test-results/frontend-structure-error.png',
          fullPage: true 
        });
      } catch (screenshotError) {
        console.error('❌ Failed to take error screenshot:', screenshotError);
      }
      
      throw error;
    }
  });

  test('should test basic interactions with available elements', async ({ page }) => {
    console.log('Testing basic interactions...');
    
    try {
      await RetryHelper.safeNavigate(page, 'http://localhost:5173');
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
      
      // Try to find any input-like elements
      const inputLikeElements = await page.locator('input, [contenteditable="true"], textarea').all();
      
      if (inputLikeElements.length > 0) {
        console.log(`✅ Found ${inputLikeElements.length} input-like elements`);
        
        // Try to interact with first input
        const firstInput = inputLikeElements[0];
        await firstInput.click();
        
        // Try to type something
        await firstInput.fill('/test/path');
        const value = await firstInput.inputValue();
        expect(value).toBe('/test/path');
        console.log('✅ Input interaction successful');
      } else {
        console.log('ℹ️ No input elements found, skipping input tests');
      }
      
      // Try to find any clickable elements
      const clickableElements = await page.locator('button, a, [role="button"], [role="link"]').all();
      
      if (clickableElements.length > 0) {
        console.log(`✅ Found ${clickableElements.length} clickable elements`);
        
        // Try to click first button/link
        const firstClickable = clickableElements[0];
        await firstClickable.click();
        console.log('✅ Click interaction successful');
        
        // Wait a bit to see what happens
        await page.waitForTimeout(1000);
      } else {
        console.log('ℹ️ No clickable elements found, skipping click tests');
      }
      
      // Test keyboard navigation
      await page.keyboard.press('Tab');
      await page.waitForTimeout(500);
      console.log('✅ Keyboard navigation test completed');
      
      // Test scrolling
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForTimeout(1000);
      console.log('✅ Scrolling test completed');
      
      // Take final screenshot
      await page.screenshot({ 
        path: 'test-results/interaction-test.png',
        fullPage: true 
      });
      
      console.log('✅ Basic interactions test completed');
    } catch (error) {
      console.error('❌ Basic interactions test failed:', error.message);
      
      try {
        await page.screenshot({ 
          path: 'test-results/interaction-test-error.png',
          fullPage: true 
        });
      } catch (screenshotError) {
        console.error('❌ Failed to take error screenshot:', screenshotError);
      }
      
      throw error;
    }
  });

  test('should test page performance and responsiveness', async ({ page }) => {
    console.log('Testing page performance...');
    
    try {
      const startTime = Date.now();
      
      await RetryHelper.safeNavigate(page, 'http://localhost:5173');
      
      const navigationTime = Date.now() - startTime;
      console.log(`✅ Navigation time: ${navigationTime}ms`);
      
      // Test page load timing
      const loadStartTime = Date.now();
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - loadStartTime;
      console.log(`✅ DOM content loaded in: ${loadTime}ms`);
      
      // Test viewport responsiveness
      const viewports = [
        { width: 1920, height: 1080 }, // Desktop
        { width: 1366, height: 768 },  // Laptop
        { width: 768, height: 1024 },  // Tablet
        { width: 375, height: 667 }   // Mobile
      ];
      
      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(500);
        
        // Check if page is still responsive
        const bodyVisible = await page.locator('body').isVisible();
        expect(bodyVisible).toBe(true);
        
        console.log(`✅ Viewport ${viewport.width}x${viewport.height} responsive`);
      }
      
      // Reset to desktop
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      // Test page metrics
      const metrics = await page.evaluate(() => ({
        title: document.title,
        url: window.location.href,
        userAgent: navigator.userAgent,
        language: navigator.language,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
        platform: navigator.platform
      }));
      
      console.log('✅ Page metrics:', metrics);
      expect(metrics.title).toBeTruthy();
      expect(metrics.url).toContain('localhost:5173');
      
      console.log('✅ Performance and responsiveness test completed');
    } catch (error) {
      console.error('❌ Performance test failed:', error.message);
      throw error;
    }
  });

  test('should handle network conditions gracefully', async ({ page }) => {
    console.log('Testing network conditions...');
    
    try {
      // Test slow loading simulation
      await page.route('**/*', async (route) => {
        // Add artificial delay for some resources
        if (route.request().resourceType() === 'document') {
          await route.continue();
        } else {
          await new Promise(resolve => setTimeout(resolve, 100));
          await route.continue();
        }
      });
      
      const startTime = Date.now();
      await RetryHelper.safeNavigate(page, 'http://localhost:5173');
      
      const slowLoadTime = Date.now() - startTime;
      console.log(`✅ Slow load test completed in: ${slowLoadTime}ms`);
      
      // Remove route to restore normal speed
      await page.unroute('**/*');
      
      // Test offline simulation
      await page.setOffline(true);
      
      // Try to navigate while offline
      try {
        await page.goto('http://localhost:5173', { timeout: 5000 });
        expect.fail('Should have failed offline');
      } catch (error) {
        expect(error.message).toContain('net::');
        console.log('✅ Offline behavior test passed');
      }
      
      // Restore online
      await page.setOffline(false);
      
      // Test reconnection
      await RetryHelper.safeNavigate(page, 'http://localhost:5173');
      console.log('✅ Reconnection test passed');
      
      console.log('✅ Network conditions test completed');
    } catch (error) {
      console.error('❌ Network conditions test failed:', error.message);
      throw error;
    }
  });
});
