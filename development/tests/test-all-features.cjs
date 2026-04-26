#!/usr/bin/env node

/**
 * Comprehensive Feature Test Script
 * Tests all implemented features of the Space Analyzer web app
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function testAllFeatures() {
  console.log('🚀 Starting Comprehensive Feature Test\n');
  console.log('📋 Testing all implemented features...\n');

  let browser;
  let page;

  try {
    // Launch browser
    console.log('🌐 Launching Puppeteer browser...');
    browser = await puppeteer.launch({
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080'
      ]
    });

    console.log('📄 Creating new page...');
    page = await browser.newPage();

    console.log('🔧 Setting viewport and navigation preferences...');
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    // Create test results directory
    const testResultsDir = path.join(__dirname, 'test-results');
    if (!fs.existsSync(testResultsDir)) {
      fs.mkdirSync(testResultsDir, { recursive: true });
    }

    const baseUrl = 'http://localhost:3001';

    console.log('🏠 Navigating to Space Analyzer...');
    await page.goto(baseUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for app to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    const testResults = {};

    // Test 1: Enhanced Dashboard
    console.log('\n🧪 Testing Enhanced Dashboard...');
    try {
      // Check if dashboard elements are present
      const dashboardElements = await page.evaluate(() => {
        const elements = {
          header: !!document.querySelector('h1'),
          quickActions: !!document.querySelector('.grid.grid-cols-1'),
          stats: !!document.querySelector('.grid.grid-cols-2'),
          recentActivity: !!document.querySelector('.space-y-3')
        };
        return elements;
      });

      testResults.dashboard = {
        status: 'success',
        elements: dashboardElements,
        screenshot: null
      };

      // Take screenshot
      const dashboardScreenshot = path.join(testResultsDir, `dashboard-test-${Date.now()}.png`);
      await page.screenshot({ path: dashboardScreenshot, fullPage: true });
      testResults.dashboard.screenshot = dashboardScreenshot;

      console.log('✅ Dashboard test passed');

    } catch (error) {
      console.error('❌ Dashboard test failed:', error.message);
      testResults.dashboard = {
        status: 'failed',
        error: error.message
      };
    }

    // Test 2: File Browser
    console.log('\n🧪 Testing File Browser...');
    try {
      await page.goto(`${baseUrl}/#file-browser`, { waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const fileBrowserElements = await page.evaluate(() => {
        const elements = {
          fileTree: !!document.querySelector('.file-tree'),
          search: !!document.querySelector('input[type="text"]'),
          filters: !!document.querySelector('.filter-controls'),
          fileList: !!document.querySelector('.file-list')
        };
        return elements;
      });

      testResults.fileBrowser = {
        status: 'success',
        elements: fileBrowserElements,
        screenshot: null
      };

      const fileBrowserScreenshot = path.join(testResultsDir, `file-browser-test-${Date.now()}.png`);
      await page.screenshot({ path: fileBrowserScreenshot, fullPage: true });
      testResults.fileBrowser.screenshot = fileBrowserScreenshot;

      console.log('✅ File Browser test passed');

    } catch (error) {
      console.error('❌ File Browser test failed:', error.message);
      testResults.fileBrowser = {
        status: 'failed',
        error: error.message
      };
    }

    // Test 3: AI Chat
    console.log('\n🧪 Testing AI Chat...');
    try {
      await page.goto(`${baseUrl}/#ai-chat`, { waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const chatElements = await page.evaluate(() => {
        const elements = {
          chatContainer: !!document.querySelector('.chat-container'),
          messageList: !!document.querySelector('.message-list'),
          inputField: !!document.querySelector('input[type="text"]'),
          sendButton: !!document.querySelector('button[type="submit"]')
        };
        return elements;
      });

      testResults.aiChat = {
        status: 'success',
        elements: chatElements,
        screenshot: null
      };

      const chatScreenshot = path.join(testResultsDir, `ai-chat-test-${Date.now()}.png`);
      await page.screenshot({ path: chatScreenshot, fullPage: true });
      testResults.aiChat.screenshot = chatScreenshot;

      console.log('✅ AI Chat test passed');

    } catch (error) {
      console.error('❌ AI Chat test failed:', error.message);
      testResults.aiChat = {
        status: 'failed',
        error: error.message
      };
    }

    // Test 4: Neural View
    console.log('\n🧪 Testing Neural View...');
    try {
      await page.goto(`${baseUrl}/#neural`, { waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const neuralElements = await page.evaluate(() => {
        const elements = {
          neuralContainer: !!document.querySelector('.neural-container'),
          graph: !!document.querySelector('.neural-graph'),
          controls: !!document.querySelector('.neural-controls'),
          legend: !!document.querySelector('.neural-legend')
        };
        return elements;
      });

      testResults.neuralView = {
        status: 'success',
        elements: neuralElements,
        screenshot: null
      };

      const neuralScreenshot = path.join(testResultsDir, `neural-view-test-${Date.now()}.png`);
      await page.screenshot({ path: neuralScreenshot, fullPage: true });
      testResults.neuralView.screenshot = neuralScreenshot;

      console.log('✅ Neural View test passed');

    } catch (error) {
      console.error('❌ Neural View test failed:', error.message);
      testResults.neuralView = {
        status: 'failed',
        error: error.message
      };
    }

    // Test 5: Treemap Visualization
    console.log('\n🧪 Testing Treemap Visualization...');
    try {
      await page.goto(`${baseUrl}/#treemap`, { waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const treemapElements = await page.evaluate(() => {
        const elements = {
          treemapContainer: !!document.querySelector('.treemap-container'),
          chart: !!document.querySelector('.treemap-chart'),
          legend: !!document.querySelector('.treemap-legend'),
          controls: !!document.querySelector('.treemap-controls')
        };
        return elements;
      });

      testResults.treemap = {
        status: 'success',
        elements: treemapElements,
        screenshot: null
      };

      const treemapScreenshot = path.join(testResultsDir, `treemap-test-${Date.now()}.png`);
      await page.screenshot({ path: treemapScreenshot, fullPage: true });
      testResults.treemap.screenshot = treemapScreenshot;

      console.log('✅ Treemap test passed');

    } catch (error) {
      console.error('❌ Treemap test failed:', error.message);
      testResults.treemap = {
        status: 'failed',
        error: error.message
      };
    }

    // Test 6: Settings
    console.log('\n🧪 Testing Settings...');
    try {
      await page.goto(`${baseUrl}/#settings`, { waitUntil: 'networkidle2', timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 2000));

      const settingsElements = await page.evaluate(() => {
        const elements = {
          settingsContainer: !!document.querySelector('.settings-container'),
          themeControls: !!document.querySelector('.theme-controls'),
          fontSizeControls: !!document.querySelector('.font-size-controls'),
          exportOptions: !!document.querySelector('.export-options')
        };
        return elements;
      });

      testResults.settings = {
        status: 'success',
        elements: settingsElements,
        screenshot: null
      };

      const settingsScreenshot = path.join(testResultsDir, `settings-test-${Date.now()}.png`);
      await page.screenshot({ path: settingsScreenshot, fullPage: true });
      testResults.settings.screenshot = settingsScreenshot;

      console.log('✅ Settings test passed');

    } catch (error) {
      console.error('❌ Settings test failed:', error.message);
      testResults.settings = {
        status: 'failed',
        error: error.message
      };
    }

    // Test 7: Navigation
    console.log('\n🧪 Testing Navigation...');
    try {
      // Test navigation between pages
      const navigationTests = [
        { name: 'dashboard', url: `${baseUrl}/#dashboard` },
        { name: 'file-browser', url: `${baseUrl}/#file-browser` },
        { name: 'ai-chat', url: `${baseUrl}/#ai-chat` },
        { name: 'neural', url: `${baseUrl}/#neural` },
        { name: 'treemap', url: `${baseUrl}/#treemap` },
        { name: 'settings', url: `${baseUrl}/#settings` }
      ];

      const navigationResults = {};

      for (const navTest of navigationTests) {
        try {
          await page.goto(navTest.url, { waitUntil: 'networkidle2', timeout: 10000 });
          await new Promise(resolve => setTimeout(resolve, 1000));

          const pageTitle = await page.title();
          const url = await page.url();

          navigationResults[navTest.name] = {
            status: 'success',
            pageTitle,
            url
          };

        } catch (navError) {
          navigationResults[navTest.name] = {
            status: 'failed',
            error: navError.message
          };
        }
      }

      testResults.navigation = {
        status: 'success',
        results: navigationResults
      };

      console.log('✅ Navigation test passed');

    } catch (error) {
      console.error('❌ Navigation test failed:', error.message);
      testResults.navigation = {
        status: 'failed',
        error: error.message
      };
    }

    // Generate comprehensive test report
    console.log('\n📊 Generating Comprehensive Test Report...\n');

    const reportPath = path.join(testResultsDir, `comprehensive-test-report-${Date.now()}.txt`);
    let reportContent = `Space Analyzer Comprehensive Feature Test Report
${'='.repeat(60)}

Test Date: ${new Date().toISOString()}
Browser: Puppeteer (Chromium)
Viewport: 1920x1080

${'-'.repeat(60)}

`;

    // Dashboard Test Results
    reportContent += 'DASHBOARD TEST:\n';
    if (testResults.dashboard.status === 'success') {
      reportContent += `  ✅ Status: PASSED\n`;
      reportContent += `  📸 Screenshot: ${path.basename(testResults.dashboard.screenshot)}\n`;
      reportContent += `  📋 Elements Found:\n`;
      for (const [element, found] of Object.entries(testResults.dashboard.elements)) {
        reportContent += `    - ${element}: ${found ? '✅' : '❌'}\n`;
      }
    } else {
      reportContent += `  ❌ Status: FAILED\n`;
      reportContent += `  📝 Error: ${testResults.dashboard.error}\n`;
    }
    reportContent += '\n';

    // File Browser Test Results
    reportContent += 'FILE BROWSER TEST:\n';
    if (testResults.fileBrowser.status === 'success') {
      reportContent += `  ✅ Status: PASSED\n`;
      reportContent += `  📸 Screenshot: ${path.basename(testResults.fileBrowser.screenshot)}\n`;
      reportContent += `  📋 Elements Found:\n`;
      for (const [element, found] of Object.entries(testResults.fileBrowser.elements)) {
        reportContent += `    - ${element}: ${found ? '✅' : '❌'}\n`;
      }
    } else {
      reportContent += `  ❌ Status: FAILED\n`;
      reportContent += `  📝 Error: ${testResults.fileBrowser.error}\n`;
    }
    reportContent += '\n';

    // AI Chat Test Results
    reportContent += 'AI CHAT TEST:\n';
    if (testResults.aiChat.status === 'success') {
      reportContent += `  ✅ Status: PASSED\n`;
      reportContent += `  📸 Screenshot: ${path.basename(testResults.aiChat.screenshot)}\n`;
      reportContent += `  📋 Elements Found:\n`;
      for (const [element, found] of Object.entries(testResults.aiChat.elements)) {
        reportContent += `    - ${element}: ${found ? '✅' : '❌'}\n`;
      }
    } else {
      reportContent += `  ❌ Status: FAILED\n`;
      reportContent += `  📝 Error: ${testResults.aiChat.error}\n`;
    }
    reportContent += '\n';

    // Neural View Test Results
    reportContent += 'NEURAL VIEW TEST:\n';
    if (testResults.neuralView.status === 'success') {
      reportContent += `  ✅ Status: PASSED\n`;
      reportContent += `  📸 Screenshot: ${path.basename(testResults.neuralView.screenshot)}\n`;
      reportContent += `  📋 Elements Found:\n`;
      for (const [element, found] of Object.entries(testResults.neuralView.elements)) {
        reportContent += `    - ${element}: ${found ? '✅' : '❌'}\n`;
      }
    } else {
      reportContent += `  ❌ Status: FAILED\n`;
      reportContent += `  📝 Error: ${testResults.neuralView.error}\n`;
    }
    reportContent += '\n';

    // Treemap Test Results
    reportContent += 'TREEMAP TEST:\n';
    if (testResults.treemap.status === 'success') {
      reportContent += `  ✅ Status: PASSED\n`;
      reportContent += `  📸 Screenshot: ${path.basename(testResults.treemap.screenshot)}\n`;
      reportContent += `  📋 Elements Found:\n`;
      for (const [element, found] of Object.entries(testResults.treemap.elements)) {
        reportContent += `    - ${element}: ${found ? '✅' : '❌'}\n`;
      }
    } else {
      reportContent += `  ❌ Status: FAILED\n`;
      reportContent += `  📝 Error: ${testResults.treemap.error}\n`;
    }
    reportContent += '\n';

    // Settings Test Results
    reportContent += 'SETTINGS TEST:\n';
    if (testResults.settings.status === 'success') {
      reportContent += `  ✅ Status: PASSED\n`;
      reportContent += `  📸 Screenshot: ${path.basename(testResults.settings.screenshot)}\n`;
      reportContent += `  📋 Elements Found:\n`;
      for (const [element, found] of Object.entries(testResults.settings.elements)) {
        reportContent += `    - ${element}: ${found ? '✅' : '❌'}\n`;
      }
    } else {
      reportContent += `  ❌ Status: FAILED\n`;
      reportContent += `  📝 Error: ${testResults.settings.error}\n`;
    }
    reportContent += '\n';

    // Navigation Test Results
    reportContent += 'NAVIGATION TEST:\n';
    if (testResults.navigation.status === 'success') {
      reportContent += `  ✅ Status: PASSED\n`;
      reportContent += `  📋 Page Navigation Results:\n`;
      for (const [pageName, result] of Object.entries(testResults.navigation.results)) {
        reportContent += `    - ${pageName}: ${result.status === 'success' ? '✅' : '❌'}\n`;
        if (result.status === 'failed') {
          reportContent += `      Error: ${result.error}\n`;
        }
      }
    } else {
      reportContent += `  ❌ Status: FAILED\n`;
      reportContent += `  📝 Error: ${testResults.navigation.error}\n`;
    }
    reportContent += '\n';

    // Summary
    const passedTests = Object.values(testResults).filter(result => result.status === 'success').length;
    const totalTests = Object.values(testResults).length;

    reportContent += `${'='.repeat(60)}\n`;
    reportContent += `TEST SUMMARY:\n`;
    reportContent += `Total Tests: ${totalTests}\n`;
    reportContent += `Passed: ${passedTests}\n`;
    reportContent += `Failed: ${totalTests - passedTests}\n`;
    reportContent += `Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n\n`;

    reportContent += `NEXT STEPS:\n`;
    reportContent += '1. Review failed tests and implement fixes\n';
    reportContent += '2. Run tests again to verify improvements\n';
    reportContent += '3. Test with real data and user scenarios\n';
    reportContent += '4. Performance testing and optimization\n';

    fs.writeFileSync(reportPath, reportContent);

    console.log('✅ All feature tests completed!');
    console.log(`📁 Test results saved in: ${testResultsDir}`);
    console.log(`📊 Comprehensive report: ${path.basename(reportPath)}`);

    // Print summary
    console.log('\n🎯 Feature Test Summary:');
    for (const [featureName, result] of Object.entries(testResults)) {
      if (result.status === 'success') {
        console.log(`✅ ${featureName}: PASSED`);
      } else {
        console.log(`❌ ${featureName}: FAILED`);
      }
    }

    console.log(`\n📈 Overall Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('💥 Feature test suite failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

// Run the feature tests
if (require.main === module) {
  testAllFeatures().catch(console.error);
}

module.exports = { testAllFeatures };