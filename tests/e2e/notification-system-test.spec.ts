import { test, expect } from '@playwright/test';
import { RetryHelper } from '../utils/retry-helper';

test('notification system functionality', async ({ page }) => {
  console.log('Testing notification system...');
  
  try {
    // Navigate to frontend
    await RetryHelper.safeNavigate(page, 'http://localhost:5173');
    await page.waitForTimeout(2000);
    
    // Check if notification bell is present
    const notificationBell = await page.locator('.notification-trigger').first();
    const bellExists = await notificationBell.isVisible().catch(() => false);
    console.log(`Notification bell visible: ${bellExists}`);
    
    // Check if notification bell has the bell emoji
    const bellContent = await notificationBell.textContent();
    console.log(`Bell content: ${bellContent || 'empty'}`);
    
    // Test clicking the notification bell
    if (bellExists) {
      await notificationBell.click();
      await page.waitForTimeout(1000);
      
      // Check if any notification panel opened
      const notificationPanel = await page.locator('.notification-overlay, .notification-center').first();
      const panelVisible = await notificationPanel.isVisible().catch(() => false);
      console.log(`Notification panel visible: ${panelVisible}`);
    }
    
    // Take screenshot
    await page.screenshot({ 
      path: 'test-results/notification-system-test.png',
      fullPage: true 
    });
    
    // Basic assertion - notification bell should be present
    expect(bellExists).toBe(true);
    
    console.log('✅ Notification system test completed');
    
  } catch (error) {
    console.error('❌ Notification system test failed:', error.message);
    
    try {
      await page.screenshot({ 
        path: 'test-results/notification-system-test-error.png',
        fullPage: true 
      });
    } catch (screenshotError) {
      console.error('❌ Failed to take error screenshot');
    }
    
    throw error;
  }
});
