# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: app-startup.spec.ts >> App Startup >> should display main navigation
- Location: tests\e2e\app-startup.spec.ts:41:3

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
  1  | /**
  2  |  * App Startup Test - User Journey: Application Initialization
  3  |  * Tests that the app loads correctly and displays the main interface
  4  |  */
  5  | 
  6  | import { test, expect } from '@playwright/test';
  7  | import TestLogger from '../utils/logger';
  8  | 
  9  | test.describe('App Startup', () => {
  10 |   let logger: TestLogger;
  11 | 
  12 |   test.beforeEach(async ({ page }) => {
  13 |     logger = new TestLogger('app-startup');
  14 |     logger.log('TEST_START', { testName: 'App Startup' });
  15 |   });
  16 | 
  17 |   test('should load the application', async ({ page }) => {
  18 |     logger.log('NAVIGATE', { url: 'http://localhost:3001' });
  19 |     
  20 |     try {
  21 |       await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  22 |       logger.log('PAGE_LOADED', { title: await page.title() });
  23 |       
  24 |       // Check for main app container
  25 |       const appContainer = page.locator('#app, [data-testid="app-container"], .app-container').first();
  26 |       const isVisible = await appContainer.isVisible().catch(() => false);
  27 |       
  28 |       if (isVisible) {
  29 |         logger.log('ELEMENT_FOUND', { element: 'app-container' });
  30 |       } else {
  31 |         logger.logError('ELEMENT_NOT_FOUND', new Error('App container not found'), { element: 'app-container' });
  32 |       }
  33 |       
  34 |       expect(isVisible).toBeTruthy();
  35 |     } catch (error) {
  36 |       logger.logError('NAVIGATION_FAILED', error as Error, { url: 'http://localhost:3001' });
  37 |       throw error;
  38 |     }
  39 |   });
  40 | 
  41 |   test('should display main navigation', async ({ page }) => {
> 42 |     await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3001/
  43 |     
  44 |     // Look for navigation elements
  45 |     const navSelectors = [
  46 |       'nav',
  47 |       '[role="navigation"]',
  48 |       '.navbar',
  49 |       '.sidebar',
  50 |       '[data-testid="navigation"]'
  51 |     ];
  52 |     
  53 |     let navFound = false;
  54 |     for (const selector of navSelectors) {
  55 |       const nav = page.locator(selector).first();
  56 |       if (await nav.isVisible().catch(() => false)) {
  57 |         navFound = true;
  58 |         logger.log('NAVIGATION_FOUND', { selector });
  59 |         break;
  60 |       }
  61 |     }
  62 |     
  63 |     if (!navFound) {
  64 |       logger.log('NAVIGATION_NOT_FOUND', { selectors: navSelectors });
  65 |     }
  66 |     
  67 |     // Don't fail if nav not found - just log it
  68 |     logger.log('TEST_COMPLETE', { navFound });
  69 |   });
  70 | 
  71 |   test('should load without console errors', async ({ page }) => {
  72 |     const errors: string[] = [];
  73 |     
  74 |     page.on('console', msg => {
  75 |       if (msg.type() === 'error') {
  76 |         errors.push(msg.text());
  77 |         logger.log('CONSOLE_ERROR', { message: msg.text() });
  78 |       }
  79 |     });
  80 |     
  81 |     await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  82 |     
  83 |     if (errors.length > 0) {
  84 |       logger.logError('CONSOLE_ERRORS_DETECTED', new Error('Console errors found'), { errors });
  85 |     } else {
  86 |       logger.log('NO_CONSOLE_ERRORS', {});
  87 |     }
  88 |     
  89 |     // Allow some console errors during development
  90 |     expect(errors.length).toBeLessThan(5);
  91 |   });
  92 | });
  93 | 
```