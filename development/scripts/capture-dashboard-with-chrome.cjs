#!/usr/bin/env node

/**
 * Chrome Browser Automation Script
 * Connects to existing Chrome browser instance at http://localhost:3001
 * and captures screenshots of the Space Analyzer dashboard
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function captureDashboardWithChrome() {
  console.log('🚀 Starting Chrome Browser Automation\n');
  console.log('📋 Connecting to Chrome browser at http://localhost:3001\n');

  let browser;
  let page;

  try {
    // Connect to existing Chrome browser instance
    console.log('🌐 Connecting to Chrome browser...');
    
    try {
      browser = await puppeteer.connect({
        browserURL: 'http://localhost:3001',
        defaultViewport: { width: 1280, height: 720 }
      });
      console.log('✅ Successfully connected to existing Chrome browser instance');
    } catch (connectError) {
      console.log('❌ Failed to connect to existing browser, launching new instance...');
      
      // Launch browser with remote debugging enabled
      browser = await puppeteer.launch({
        headless: false,
        devtools: true,
        args: [
          '--remote-debugging-port=9222',
          '--remote-debugging-address=0.0.0.0',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
      console.log('✅ Successfully launched new browser instance');
    }

    // Create a new page
    console.log('📄 Creating new page...');
    page = await browser.newPage();

    // Configure page settings
    console.log('🔧 Configuring page settings...');
    await page.setViewport({ width: 1280, height: 720 });

    // Configure request interception to improve performance
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Handle console logs
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('Page console error:', msg.text());
      } else {
        console.log('Page console:', msg.text());
      }
    });

    // Handle page errors
    page.on('pageerror', (error) => {
      console.error('Page error:', error.message);
    });

    // Handle dialog boxes
    page.on('dialog', async (dialog) => {
      console.log('Dialog detected:', dialog.message());
      await dialog.accept();
    });

    // Create screenshots directory if it doesn't exist
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Test pages to capture
    const testPages = [
      { name: 'dashboard', url: 'http://localhost:3001' },
      { name: 'file-browser', url: 'http://localhost:3001/#file-browser' },
      { name: 'analysis', url: 'http://localhost:3001/#analysis' },
      { name: 'neural', url: 'http://localhost:3001/#neural' },
      { name: 'treemap', url: 'http://localhost:3001/#treemap' }
    ];

    console.log('📊 Starting page-by-page capture...\n');

    const results = {};

    for (let i = 0; i < testPages.length; i++) {
      const pageInfo = testPages[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📄 Page ${i + 1}/${testPages.length}: ${pageInfo.name.toUpperCase()}`);
      console.log(`${'='.repeat(60)}\n`);

      try {
        // Navigate to the page
        console.log(`🧭 Navigating to ${pageInfo.url}...`);
        await page.goto(pageInfo.url, {
          waitUntil: 'networkidle2',
          timeout: 30000
        });

        // Wait for page content to load
        console.log('⏳ Waiting for page to load...');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Take screenshot
        const screenshotPath = path.join(screenshotsDir, `${pageInfo.name}-screenshot-${Date.now()}.png`);
        console.log(`📸 Capturing screenshot...`);

        await page.screenshot({
          path: screenshotPath,
          fullPage: true
        });

        console.log(`   💾 Screenshot saved: ${path.basename(screenshotPath)}`);

        results[pageInfo.name] = {
          screenshot: screenshotPath,
          status: 'success'
        };

      } catch (error) {
        console.error(`❌ Failed to capture ${pageInfo.name}:`, error.message);
        results[pageInfo.name] = {
          error: error.message
        };
      }
    }

    // Generate summary report
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 CHROME AUTOMATION SUMMARY');
    console.log(`${'='.repeat(80)}\n`);

    const summaryPath = path.join(__dirname, `chrome-capture-summary-${Date.now()}.txt`);
    let summaryContent = `Space Analyzer Chrome Browser Automation Summary
${'='.repeat(50)}

Test Date: ${new Date().toISOString()}
Pages Tested: ${testPages.length}
Browser: Chrome (Connected to http://localhost:3001)
Viewport: 1280x720

${'-'.repeat(50)}

`;

    for (const [pageName, result] of Object.entries(results)) {
      summaryContent += `${pageName.toUpperCase()}:\n`;
      if (result.error) {
        summaryContent += `  ❌ Error: ${result.error}\n`;
      } else {
        summaryContent += `  ✅ Success\n`;
        summaryContent += `  📸 Screenshot: ${path.basename(result.screenshot)}\n`;
      }
      summaryContent += '\n';
    }

    summaryContent += `${'='.repeat(60)}\n`;
    summaryContent += 'Next Steps:\n';
    summaryContent += '1. Review captured screenshots for UI/UX issues\n';
    summaryContent += '2. Use screenshots for AI analysis with Ollama\n';
    summaryContent += '3. Implement improvements based on feedback\n';

    fs.writeFileSync(summaryPath, summaryContent);

    console.log('✅ All pages processed!');
    console.log(`📁 Screenshots saved in: ${screenshotsDir}`);
    console.log(`📊 Summary report: ${path.basename(summaryPath)}`);

    // Print brief results
    console.log('\n🎯 Quick Results Summary:');
    for (const [pageName, result] of Object.entries(results)) {
      if (result.error) {
        console.log(`❌ ${pageName}: Failed`);
      } else {
        console.log(`✅ ${pageName}: Captured`);
      }
    }

  } catch (error) {
    console.error('💥 Chrome automation failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (browser) {
      // For existing browser connections, we don't close the browser
      // as it might be used by other processes
      console.log('🔌 Disconnecting from browser (not closing)');
      await browser.disconnect().catch(() => {});
    }
  }
}

// Run the Chrome automation
if (require.main === module) {
  captureDashboardWithChrome().catch(console.error);
}

module.exports = { captureDashboardWithChrome };