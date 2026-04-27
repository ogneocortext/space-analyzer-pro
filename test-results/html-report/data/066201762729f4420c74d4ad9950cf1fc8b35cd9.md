# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ai-analysis.spec.ts >> AI Analysis >> should display AI analysis panel
- Location: tests\e2e\ai-analysis.spec.ts:17:3

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
  2   |  * AI Analysis Test - User Journey: AI-powered file analysis
  3   |  * Tests the AI features for intelligent file categorization and insights
  4   |  */
  5   | 
  6   | import { test, expect } from '@playwright/test';
  7   | import TestLogger from '../utils/logger';
  8   | 
  9   | test.describe('AI Analysis', () => {
  10  |   let logger: TestLogger;
  11  | 
  12  |   test.beforeEach(async ({ page }) => {
  13  |     logger = new TestLogger('ai-analysis');
  14  |     logger.log('TEST_START', { testName: 'AI Analysis' });
  15  |   });
  16  | 
  17  |   test('should display AI analysis panel', async ({ page }) => {
> 18  |     await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
      |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3001/
  19  |     
  20  |     // Enable AI toggle to show AI panel
  21  |     const aiToggle = page.locator('[data-testid="ai-toggle-button"]').first();
  22  |     if (await aiToggle.isVisible().catch(() => false)) {
  23  |       await aiToggle.click();
  24  |       await page.waitForTimeout(500);
  25  |     }
  26  |     
  27  |     // Look for AI panel/section
  28  |     const aiSelectors = [
  29  |       '[data-testid="ai-panel"]',
  30  |       '.ai-panel',
  31  |       '.ai-analysis',
  32  |       '[data-testid="ai-chat"]',
  33  |       '.ai-chat',
  34  |       '.insights-panel',
  35  |       '[data-testid="insights"]'
  36  |     ];
  37  | 
  38  |     let aiPanelFound = false;
  39  |     for (const selector of aiSelectors) {
  40  |       const element = page.locator(selector).first();
  41  |       if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
  42  |         aiPanelFound = true;
  43  |         logger.log('AI_PANEL_FOUND', { selector });
  44  |         break;
  45  |       }
  46  |     }
  47  | 
  48  |     if (!aiPanelFound) {
  49  |       logger.log('AI_PANEL_NOT_FOUND', { selectors: aiSelectors });
  50  |     }
  51  | 
  52  |     logger.log('TEST_COMPLETE', { aiPanelFound });
  53  |   });
  54  | 
  55  |   test('should show AI status indicator', async ({ page }) => {
  56  |     await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  57  |     
  58  |     // Enable AI toggle to show AI panel
  59  |     const aiToggle = page.locator('[data-testid="ai-toggle-button"]').first();
  60  |     if (await aiToggle.isVisible().catch(() => false)) {
  61  |       await aiToggle.click();
  62  |       await page.waitForTimeout(500);
  63  |     }
  64  |     
  65  |     // Look for AI status indicators
  66  |     const statusSelectors = [
  67  |       '[data-testid="ai-status"]',
  68  |       '.ai-status',
  69  |       '.ollama-status',
  70  |       '.ai-indicator',
  71  |       '[data-testid="ollama-status"]'
  72  |     ];
  73  | 
  74  |     const foundStatus: string[] = [];
  75  |     for (const selector of statusSelectors) {
  76  |       const element = page.locator(selector).first();
  77  |       if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
  78  |         const text = await element.textContent();
  79  |         foundStatus.push(`${selector}: ${text}`);
  80  |         logger.log('AI_STATUS_FOUND', { selector, text });
  81  |       }
  82  |     }
  83  | 
  84  |     if (foundStatus.length === 0) {
  85  |       logger.log('AI_STATUS_NOT_FOUND', { selectors: statusSelectors });
  86  |     }
  87  | 
  88  |     logger.log('TEST_COMPLETE', { foundStatus: foundStatus.length });
  89  |   });
  90  | 
  91  |   test('should allow AI model selection', async ({ page }) => {
  92  |     await page.goto('http://localhost:3001', { waitUntil: 'networkidle' });
  93  |     
  94  |     // Enable AI toggle to show AI panel
  95  |     const aiToggle = page.locator('[data-testid="ai-toggle-button"]').first();
  96  |     if (await aiToggle.isVisible().catch(() => false)) {
  97  |       await aiToggle.click();
  98  |       await page.waitForTimeout(500);
  99  |     }
  100 |     
  101 |     // Look for model selector
  102 |     const modelSelectors = [
  103 |       'select[data-testid="ai-model-select"]',
  104 |       '.model-selector',
  105 |       'select:has-text("Model")',
  106 |       '[data-testid="model-select"]',
  107 |       '.ai-model-select'
  108 |     ];
  109 | 
  110 |     let modelSelector = null;
  111 |     for (const selector of modelSelectors) {
  112 |       const element = page.locator(selector).first();
  113 |       if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
  114 |         modelSelector = element;
  115 |         logger.log('MODEL_SELECTOR_FOUND', { selector });
  116 |         break;
  117 |       }
  118 |     }
```