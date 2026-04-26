#!/usr/bin/env node

/**
 * Integrated Ollama Puppeteer Test Script
 * Tests all 12 main pages of the Space Analyzer web app,
 * captures screenshots, and sends them to Ollama for UI/UX analysis
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

// Load environment variables from .env file
const pathlib = require('path');
require('dotenv').config({ path: pathlib.resolve(__dirname, '.env') });

// List of all 12 main pages to test
const pages = [
  'dashboard',
  'file-browser',
  'analysis',
  'duplicates',
  'smart-analysis',
  'neural',
  'treemap',
  'temperature',
  'ai-features',
  'ai-insights',
  'chat',
  'timetravel'
];

console.log('🚀 Starting Integrated Ollama/Gemini Puppeteer Test\n');
console.log(`📋 Will test ${pages.length} pages: ${pages.join(', ')}\n`);

// Configure Puppeteer with increased timeouts for complex pages
const puppeteerOptions = {
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1920,1080'
  ],
  defaultNavigationTimeout: 60000, // 60 seconds instead of 30
  waitUntil: 'domcontentloaded',
  timeout: 120000 // 2 minutes instead of 30 seconds
};

// Ollama analysis function (Gemini removed to avoid rate limits)

// Ollama analysis function (Gemini removed to avoid rate limits)

// Import the Ollama vision analysis function
async function analyzeScreenshotWithOllama(screenshotPath, pageName) {
  console.log(`🤖 Analyzing ${pageName} screenshot with Ollama...`);

  try {
    // Read and encode image
    const imageBuffer = fs.readFileSync(screenshotPath);
    const base64Image = imageBuffer.toString('base64');

    const requestBody = {
      model: "llava:7b",
      messages: [
        {
          role: "user",
          content: `Please analyze this screenshot of the "${pageName}" page in the Space Analyzer web application and provide detailed UI/UX feedback:

1. **Layout & Visual Hierarchy**
   - Is the layout well-organized and intuitive?
   - Does the visual hierarchy guide the user's attention effectively?
   - Are elements properly aligned and spaced?

2. **Navigation & User Flow**
   - Is navigation clear and consistent?
   - Are interactive elements (buttons, links) obvious?
   - Does the page flow logically?

3. **Content Presentation**
   - Is information clearly presented and easy to read?
   - Are data visualizations effective and understandable?
   - Is there appropriate use of typography and colors?

4. **Accessibility & Usability**
   - Are there any potential accessibility issues?
   - Is the interface mobile-friendly?
   - Are there any usability problems or confusing elements?

5. **Performance & Technical Issues**
   - Are there any loading or rendering issues visible?
   - Does the page appear to load quickly and smoothly?
   - Are there any broken elements or missing content?

Please provide specific, actionable recommendations for improving this page. Focus on practical fixes that would enhance user experience, accessibility, and overall design quality.`,
          images: [base64Image]
        }
      ],
      stream: false
    };

    console.log(`   📡 Sending ${pageName} screenshot to Ollama...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout for vision analysis

    const response = await fetch('http://localhost:30014/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    let content = '';
    if (result.message && result.message.content) {
      content = result.message.content;
    } else if (result.choices && result.choices[0] && result.choices[0].message) {
      content = result.choices[0].message.content;
    } else {
      content = 'No analysis content received';
    }

    console.log(`✅ ${pageName} analysis completed`);
    return content;

  } catch (error) {
    console.error(`❌ ${pageName} analysis failed:`, error.message);
    return `Analysis failed: ${error.message}`;
  }
}

async function runIntegratedTest() {
  let browser;
  let page;

  try {
    console.log('🌐 Launching Puppeteer browser...');
    browser = await puppeteer.launch({
      headless: true,
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

    // Create screenshots directory if it doesn't exist
    const screenshotsDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Create analysis results directory
    const analysisDir = path.join(__dirname, 'analysis-results');
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir, { recursive: true });
    }

    const baseUrl = 'http://localhost:3001';

    console.log('🏠 Navigating to Space Analyzer...');
    await page.goto(baseUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait a bit for the app to fully load
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('📊 Starting page-by-page analysis...\n');

    const results = {};

    for (let i = 0; i < pages.length; i++) {
      const pageName = pages[i];
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📄 Page ${i + 1}/${pages.length}: ${pageName.toUpperCase()}`);
      console.log(`${'='.repeat(60)}\n`);

      try {
        // Navigate to the page using hash navigation
        console.log(`🧭 Navigating to #${pageName}...`);
        await page.goto(`${baseUrl}/#${pageName}`, {
          waitUntil: 'networkidle2',
          timeout: 15000
        });

        // Wait for page content to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Take screenshot
        const screenshotPath = path.join(screenshotsDir, `${pageName}-screenshot-${Date.now()}.png`);
        console.log(`📸 Capturing screenshot...`);

        await page.screenshot({
          path: screenshotPath,
          fullPage: true
        });

        console.log(`   💾 Screenshot saved: ${path.basename(screenshotPath)}`);

        // Analyze with Ollama only (Gemini removed to avoid rate limits)
        const analysis = await analyzeScreenshotWithOllama(screenshotPath, pageName);

        // Save analysis results
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const analysisPath = path.join(analysisDir, `${pageName}-analysis-${timestamp}.txt`);

        const analysisContent = `Space Analyzer - ${pageName} Page Analysis
${'='.repeat(50)}

Date: ${new Date().toISOString()}
Page: ${pageName}
Screenshot: ${path.basename(screenshotPath)}

Analysis Results:
${'-'.repeat(20)}

${analysis}

${'-'.repeat(50)}
Raw Screenshot Path: ${screenshotPath}
`;

        fs.writeFileSync(analysisPath, analysisContent);
        console.log(`📋 Analysis saved: ${path.basename(analysisPath)}`);

        results[pageName] = {
          screenshot: screenshotPath,
          analysis: analysisPath,
          summary: (typeof analysis === 'string' ? analysis.substring(0, 200) + '...' : 'Analysis failed - not a string')
        };

      } catch (error) {
        console.error(`❌ Failed to process ${pageName}:`, error.message);
        results[pageName] = {
          error: error.message
        };
      }
    }

    // Generate summary report
    console.log(`\n${'='.repeat(80)}`);
    console.log('📊 INTEGRATED TEST SUMMARY');
    console.log(`${'='.repeat(80)}\n`);

    const summaryPath = path.join(__dirname, `integrated-test-summary-${Date.now()}.txt`);
    let summaryContent = `Space Analyzer Gemini-Only Analysis Summary
${'='.repeat(50)}

Test Date: ${new Date().toISOString()}
Pages Tested: ${pages.length}
Pages Completed: ${Object.keys(results).length}
AI Service: Google Gemini (gemini-3-flash-preview)

${'-'.repeat(50)}

`;

    for (const [pageName, result] of Object.entries(results)) {
      summaryContent += `${pageName.toUpperCase()}:\n`;
      if (result.error) {
        summaryContent += `  ❌ Error: ${result.error}\n`;
      } else {
        summaryContent += `  ✅ Completed\n`;
        summaryContent += `  📸 Screenshot: ${path.basename(result.screenshot)}\n`;
        summaryContent += `  📋 Analysis: ${path.basename(result.analysis)}\n`;
        summaryContent += `  💡 Summary: ${result.summary}\n`;
      }
      summaryContent += '\n';
    }

    summaryContent += `${'='.repeat(60)}\n`;
    summaryContent += 'Next Steps:\n';
    summaryContent += '1. Review individual analysis files for detailed feedback\n';
    summaryContent += '2. Implement UI/UX improvements based on Ollama recommendations\n';
    summaryContent += '3. Re-run tests to verify improvements\n';

    fs.writeFileSync(summaryPath, summaryContent);

    console.log('✅ All pages processed!');
    console.log(`📁 Screenshots saved in: ${screenshotsDir}`);
    console.log(`📋 Analysis results saved in: ${analysisDir}`);
    console.log(`📊 Summary report: ${path.basename(summaryPath)}`);

    // Print brief results
    console.log('\n🎯 Quick Results Summary:');
    for (const [pageName, result] of Object.entries(results)) {
      if (result.error) {
        console.log(`❌ ${pageName}: Failed`);
      } else {
        console.log(`✅ ${pageName}: Analyzed`);
      }
    }

  } catch (error) {
    console.error('💥 Test suite failed:', error.message);
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

// Run the integrated test
if (require.main === module) {
  runIntegratedTest().catch(console.error);
}

module.exports = { runIntegratedTest };

// Run the test if called directly
if (require.main === module && process.argv.length > 2) {
  runIntegratedTest().catch(console.error);
}