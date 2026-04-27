# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: directory-scan.spec.ts >> Directory Scan >> should allow directory selection
- Location: tests\e2e\directory-scan.spec.ts:18:3

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
  1   | /**
  2   |  * Directory Scan Test - User Journey: Scanning a directory
  3   |  * Tests the core functionality of analyzing file system structure
  4   |  */
  5   | 
  6   | import { test, expect } from '@playwright/test';
  7   | import TestLogger from '../utils/logger';
  8   | import path from 'path';
  9   | 
  10  | test.describe('Directory Scan', () => {
  11  |   let logger: TestLogger;
  12  | 
  13  |   test.beforeEach(async ({ page }) => {
  14  |     logger = new TestLogger('directory-scan');
  15  |     logger.log('TEST_START', { testName: 'Directory Scan' });
  16  |   });
  17  | 
  18  |   test('should allow directory selection', async ({ page }) => {
> 19  |     await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3001/
  20  |     logger.log('PAGE_LOADED', {});
  21  | 
  22  |     // Look for directory input field
  23  |     const directoryInput = page.locator('[data-testid="directory-path-input"]').first();
  24  |     const inputVisible = await directoryInput.isVisible({ timeout: 5000 }).catch(() => false);
  25  |     
  26  |     if (inputVisible) {
  27  |       logger.log('DIRECTORY_INPUT_FOUND', {});
  28  |       // Enter a test path
  29  |       await directoryInput.fill('C:\\Test');
  30  |       logger.log('DIRECTORY_PATH_ENTERED', { path: 'C:\\Test' });
  31  |     } else {
  32  |       logger.log('DIRECTORY_INPUT_NOT_FOUND', {});
  33  |     }
  34  | 
  35  |     // Look for start button
  36  |     const startButton = page.locator('[data-testid="start-analysis-button"]').first();
  37  |     const buttonVisible = await startButton.isVisible({ timeout: 5000 }).catch(() => false);
  38  |     
  39  |     if (buttonVisible) {
  40  |       logger.log('START_BUTTON_FOUND', {});
  41  |     } else {
  42  |       logger.log('START_BUTTON_NOT_FOUND', {});
  43  |     }
  44  | 
  45  |     logger.log('TEST_COMPLETE', { inputVisible, buttonVisible });
  46  |   });
  47  | 
  48  |   test('should display scan results after directory selection', async ({ page }) => {
  49  |     await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  50  |     
  51  |     // Look for results area
  52  |     const resultsSelectors = [
  53  |       '[data-testid="scan-results"]',
  54  |       '.scan-results',
  55  |       '.results-container',
  56  |       '.file-tree',
  57  |       '.directory-tree',
  58  |       '[role="tree"]'
  59  |     ];
  60  | 
  61  |     let resultsFound = false;
  62  |     for (const selector of resultsSelectors) {
  63  |       const element = page.locator(selector).first();
  64  |       if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
  65  |         resultsFound = true;
  66  |         logger.log('RESULTS_AREA_FOUND', { selector });
  67  |         break;
  68  |       }
  69  |     }
  70  | 
  71  |     if (!resultsFound) {
  72  |       logger.log('RESULTS_AREA_NOT_FOUND', { selectors: resultsSelectors });
  73  |     }
  74  | 
  75  |     logger.log('TEST_COMPLETE', { resultsFound });
  76  |   });
  77  | 
  78  |   test('should show file statistics', async ({ page }) => {
  79  |     await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  80  |     
  81  |     // Look for statistics display
  82  |     const statsSelectors = [
  83  |       '[data-testid="statistics"]',
  84  |       '.statistics',
  85  |       '.stats',
  86  |       '.file-count',
  87  |       '.total-size',
  88  |       '[data-testid="file-count"]',
  89  |       '[data-testid="total-size"]'
  90  |     ];
  91  | 
  92  |     const foundStats: string[] = [];
  93  |     for (const selector of statsSelectors) {
  94  |       const element = page.locator(selector).first();
  95  |       if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
  96  |         foundStats.push(selector);
  97  |         logger.log('STATS_ELEMENT_FOUND', { selector });
  98  |       }
  99  |     }
  100 | 
  101 |     if (foundStats.length === 0) {
  102 |       logger.log('STATS_NOT_FOUND', { selectors: statsSelectors });
  103 |     }
  104 | 
  105 |     logger.log('TEST_COMPLETE', { foundStats: foundStats.length });
  106 |   });
  107 | 
  108 |   test('should handle scan errors gracefully', async ({ page }) => {
  109 |     // Monitor for error messages
  110 |     const errorSelectors = [
  111 |       '[role="alert"]',
  112 |       '.error-message',
  113 |       '.error',
  114 |       '[data-testid="error"]',
  115 |       '.toast-error'
  116 |     ];
  117 | 
  118 |     page.on('console', msg => {
  119 |       if (msg.type() === 'error') {
```