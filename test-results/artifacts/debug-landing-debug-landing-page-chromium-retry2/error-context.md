# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: debug-landing.spec.ts >> debug landing page
- Location: tests\e2e\debug-landing.spec.ts:3:1

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3001/
Call log:
  - navigating to "http://localhost:3001/", waiting until "networkidle"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e6]:
    - heading "This site can’t be reached" [level=1] [ref=e7]
    - paragraph [ref=e8]:
      - strong [ref=e9]: localhost
      - text: refused to connect.
    - generic [ref=e10]:
      - paragraph [ref=e11]: "Try:"
      - list [ref=e12]:
        - listitem [ref=e13]: Checking the connection
        - listitem [ref=e14]:
          - link "Checking the proxy and the firewall" [ref=e15] [cursor=pointer]:
            - /url: "#buttons"
    - generic [ref=e16]: ERR_CONNECTION_REFUSED
  - generic [ref=e17]:
    - button "Reload" [ref=e19] [cursor=pointer]
    - button "Details" [ref=e20] [cursor=pointer]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('debug landing page', async ({ page }) => {
> 4  |   await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3001/
  5  |   
  6  |   // Take a screenshot
  7  |   await page.screenshot({ path: 'test-results/screenshots/landing-debug.png', fullPage: true });
  8  |   
  9  |   // Log the page content
  10 |   const content = await page.content();
  11 |   console.log('Page HTML length:', content.length);
  12 |   
  13 |   // Check for landing-page element
  14 |   const landingPage = page.locator('[data-testid="landing-page"]');
  15 |   console.log('Landing page visible:', await landingPage.isVisible().catch(() => false));
  16 |   
  17 |   // Check for directory input
  18 |   const dirInput = page.locator('[data-testid="directory-path-input"]');
  19 |   console.log('Directory input visible:', await dirInput.isVisible().catch(() => false));
  20 |   
  21 |   // Check for start button
  22 |   const startBtn = page.locator('[data-testid="start-analysis-button"]');
  23 |   console.log('Start button visible:', await startBtn.isVisible().catch(() => false));
  24 |   
  25 |   // List all inputs
  26 |   const inputs = await page.locator('input').all();
  27 |   console.log('Number of inputs:', inputs.length);
  28 |   
  29 |   // List all buttons
  30 |   const buttons = await page.locator('button').all();
  31 |   console.log('Number of buttons:', buttons.length);
  32 |   
  33 |   // Get button text
  34 |   for (const btn of buttons) {
  35 |     const text = await btn.textContent();
  36 |     console.log('Button text:', text);
  37 |   }
  38 | });
  39 | 
```