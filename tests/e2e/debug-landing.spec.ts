import { test, expect } from '@playwright/test';

test('debug landing page', async ({ page }) => {
  await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  
  // Take a screenshot
  await page.screenshot({ path: 'test-results/screenshots/landing-debug.png', fullPage: true });
  
  // Log the page content
  const content = await page.content();
  console.log('Page HTML length:', content.length);
  
  // Check for landing-page element
  const landingPage = page.locator('[data-testid="landing-page"]');
  console.log('Landing page visible:', await landingPage.isVisible().catch(() => false));
  
  // Check for directory input
  const dirInput = page.locator('[data-testid="directory-path-input"]');
  console.log('Directory input visible:', await dirInput.isVisible().catch(() => false));
  
  // Check for start button
  const startBtn = page.locator('[data-testid="start-analysis-button"]');
  console.log('Start button visible:', await startBtn.isVisible().catch(() => false));
  
  // List all inputs
  const inputs = await page.locator('input').all();
  console.log('Number of inputs:', inputs.length);
  
  // List all buttons
  const buttons = await page.locator('button').all();
  console.log('Number of buttons:', buttons.length);
  
  // Get button text
  for (const btn of buttons) {
    const text = await btn.textContent();
    console.log('Button text:', text);
  }
});
