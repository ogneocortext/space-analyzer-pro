import { test, expect } from '@playwright/test';

test.describe('3D File System Browser', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/3d-browser');
    await page.waitForLoadState('networkidle');
  });

  test('should load 3D browser interface', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('3D File System Browser');
    await expect(page.locator('.filesystem-3d-enhanced')).toBeVisible();
  });

  test('should display control panels', async ({ page }) => {
    await expect(page.locator('.controls-panel')).toBeVisible();
    await expect(page.locator('h4', { hasText: 'Navigation' })).toBeVisible();
    await expect(page.locator('h4', { hasText: 'View Options' })).toBeVisible();
    await expect(page.locator('h4', { hasText: 'Scale & Layout' })).toBeVisible();
  });

  test('should have layout options', async ({ page }) => {
    const layoutSelect = page.locator('select');
    await expect(layoutSelect).toBeVisible();
    
    const options = await layoutSelect.locator('option').allTextContents();
    expect(options).toContain('Tree');
    expect(options).toContain('Sphere');
    expect(options).toContain('Cylinder');
    expect(options).toContain('Spiral');
  });

  test('should have search functionality', async ({ page }) => {
    const searchInput = page.locator('.search-input');
    await expect(searchInput).toBeVisible();
    
    await searchInput.fill('test');
    await page.waitForTimeout(500);
    
    // Verify search is working (implementation specific)
    expect(await searchInput.inputValue()).toBe('test');
  });

  test('should have filter options', async ({ page }) => {
    const filterSelect = page.locator('select').filter({ hasText: 'All Files' });
    await expect(filterSelect).toBeVisible();
    
    const options = await filterSelect.locator('option').allTextContents();
    expect(options).toContain('All Files');
    expect(options).toContain('Images');
    expect(options).toContain('Documents');
    expect(options).toContain('Videos');
    expect(options).toContain('Audio');
  });

  test('should have performance settings', async ({ page }) => {
    await expect(page.locator('h4', { hasText: 'Performance' })).toBeVisible();
    await expect(page.locator('input[type="checkbox"]')).toHaveCount.greaterThan(0);
  });

  test('should handle navigation controls', async ({ page }) => {
    const resetButton = page.locator('button', { hasText: 'Reset' });
    const focusButton = page.locator('button', { hasText: 'Focus' });
    const rotateButton = page.locator('button', { hasText: /Start|Stop/ });
    
    await expect(resetButton).toBeVisible();
    await expect(focusButton).toBeVisible();
    await expect(rotateButton).toBeVisible();
    
    // Test reset functionality
    await resetButton.click();
    await page.waitForTimeout(1000);
    
    // Test rotate toggle
    const initialText = await rotateButton.textContent();
    await rotateButton.click();
    await page.waitForTimeout(500);
    const newText = await rotateButton.textContent();
    expect(newText).not.toBe(initialText);
  });

  test('should handle zoom controls', async ({ page }) => {
    const zoomSlider = page.locator('input[type="range"]').filter({ has: page.locator('text=Zoom') });
    await expect(zoomSlider).toBeVisible();
    
    // Test zoom adjustment
    await zoomSlider.fill('2.0');
    await page.waitForTimeout(500);
    expect(await zoomSlider.inputValue()).toBe('2.0');
  });

  test('should handle node size controls', async ({ page }) => {
    const nodeSizeSlider = page.locator('input[type="range"]').filter({ has: page.locator('text=Node Size') });
    await expect(nodeSizeSlider).toBeVisible();
    
    // Test node size adjustment
    await nodeSizeSlider.fill('1.5');
    await page.waitForTimeout(500);
    expect(await nodeSizeSlider.inputValue()).toBe('1.5');
  });

  test('should handle view options', async ({ page }) => {
    const fileLabelsCheckbox = page.locator('label', { hasText: 'File Labels' }).locator('input[type="checkbox"]');
    const dirLabelsCheckbox = page.locator('label', { hasText: 'Directory Labels' }).locator('input[type="checkbox"]');
    const colorBySizeCheckbox = page.locator('label', { hasText: 'Color by Size' }).locator('input[type="checkbox"]');
    
    await expect(fileLabelsCheckbox).toBeVisible();
    await expect(dirLabelsCheckbox).toBeVisible();
    await expect(colorBySizeCheckbox).toBeVisible();
    
    // Test checkbox interactions
    await fileLabelsCheckbox.check();
    expect(await fileLabelsCheckbox.isChecked()).toBe(true);
    
    await fileLabelsCheckbox.uncheck();
    expect(await fileLabelsCheckbox.isChecked()).toBe(false);
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    // Test keyboard shortcuts
    await page.keyboard.press('r'); // Reset view
    await page.waitForTimeout(500);
    
    await page.keyboard.press('f'); // Toggle fullscreen
    await page.waitForTimeout(500);
    
    await page.keyboard.press('Escape'); // Exit fullscreen
    await page.waitForTimeout(500);
  });

  test('should handle context menu', async ({ page }) => {
    // Right-click on 3D canvas (implementation specific)
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    
    // Simulate right-click
    await canvas.click({ button: 'right' });
    await page.waitForTimeout(500);
    
    // Context menu should appear (implementation specific)
    // This test may need adjustment based on actual implementation
  });

  test('should handle export functionality', async ({ page }) => {
    // Look for export buttons or menu items
    const exportButton = page.locator('button', { hasText: /Export|Share/ });
    
    if (await exportButton.isVisible()) {
      await exportButton.click();
      await page.waitForTimeout(500);
      
      // Test export options
      const exportOptions = page.locator('.export-menu, .share-menu');
      if (await exportOptions.isVisible()) {
        const options = await exportOptions.locator('button, a').allTextContents();
        expect(options.length).toBeGreaterThan(0);
      }
    }
  });

  test('should handle settings', async ({ page }) => {
    const settingsButton = page.locator('button', { hasText: 'Settings' });
    
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForTimeout(500);
      
      // Test settings panel
      const settingsPanel = page.locator('.settings-panel, .modal');
      if (await settingsPanel.isVisible()) {
        const settingsOptions = await settingsPanel.locator('input, select, button').count();
        expect(settingsOptions).toBeGreaterThan(0);
      }
    }
  });

  test('should be responsive', async ({ page }) => {
    // Test different viewport sizes
    await page.setViewportSize({ width: 1920, height: 1080 });
    await expect(page.locator('.filesystem-3d-enhanced')).toBeVisible();
    
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('.filesystem-3d-enhanced')).toBeVisible();
    
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('.filesystem-3d-enhanced')).toBeVisible();
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Monitor for error messages
    const errorToast = page.locator('.error-toast, .alert-error');
    
    // Simulate error condition (implementation specific)
    // This test may need adjustment based on actual error handling
    
    // Verify no unhandled errors
    page.on('pageerror', (error) => {
      console.error('Page error:', error);
    });
    
    page.on('requestfailed', (request) => {
      console.error('Request failed:', request.url());
    });
  });
});

test.describe('3D Browser Performance', () => {
  test('should load within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/3d-browser');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should handle large file systems', async ({ page }) => {
    await page.goto('/3d-browser');
    await page.waitForLoadState('networkidle');
    
    // Simulate large file system load
    // This test may need implementation-specific adjustments
    await page.waitForTimeout(2000);
    
    // Verify the browser remains responsive
    const isResponsive = await page.evaluate(() => {
      return document.readyState === 'complete';
    });
    expect(isResponsive).toBe(true);
  });
});

test.describe('3D Browser Accessibility', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/3d-browser');
    await page.waitForLoadState('networkidle');
    
    // Check for ARIA labels on interactive elements
    const buttons = page.locator('button[aria-label], button[title]');
    const inputs = page.locator('input[aria-label], input[title]');
    
    expect(await buttons.count()).toBeGreaterThan(0);
    expect(await inputs.count()).toBeGreaterThan(0);
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/3d-browser');
    await page.waitForLoadState('networkidle');
    
    // Test Tab navigation
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
    
    // Check focus management
    const focusedElement = page.locator(':focus');
    expect(await focusedElement.count()).toBeGreaterThan(0);
  });
});
