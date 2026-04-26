#!/usr/bin/env node

/**
 * Integrated Ollama Puppeteer Test Script
 * Tests all 12 main pages of Space Analyzer web app,
 * captures screenshots, and sends them to Ollama for UI/UX analysis
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

// Load environment variables from .env file
const pathlib = require('path');
require('dotenv').config({ path: pathlib.resolve(__dirname, '.env') });

// List of the 12 main pages to test (testing first 3 pages)
const pages = [
  'dashboard',
  'file-browser',
  'analysis'
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

// Google Gemini analysis function
async function analyzeScreenshotWithGemini(screenshotPath, pageName) {
  console.log(`🤖 Analyzing ${pageName} screenshot with Google Gemini...`);

  try {
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Google API key not found. Set GOOGLE_API_KEY or GEMINI_API_KEY environment variable.');
    }

    // Validate API key format
    if (!apiKey.startsWith('AIza') && apiKey.length < 30) {
      throw new Error('Invalid API key format. Please check your Google Gemini API key.');
    }

    const { GoogleGenerativeAI } = require('@google/generative-ai');

    // Get generative model
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    // Read and encode image
    const imageBuffer = fs.readFileSync(screenshotPath);
    const base64Image = imageBuffer.toString('base64');

    const prompt = `Please analyze this screenshot of the "${pageName}" page in the Space Analyzer web application and provide detailed UI/UX feedback:

1. **Layout & Visual Hierarchy**
   - Is the layout well-organized and intuitive?
   - Does the visual hierarchy guide the user's attention effectively?
   - Are elements properly aligned and spaced?
   - Are interactive elements (buttons, links) obvious?
   - Does the page flow logically?
   - Are there proper headings and sections?

2. **Navigation & User Flow**
   - Is navigation clear and consistent?
   - Are interactive elements (buttons, links) obvious?
   - Does the page flow logically?
   - Are there proper breadcrumbs and navigation aids?

3. **Content Presentation**
   - Is information clearly presented and easy to read?
   - Are data visualizations effective and understandable?
   - Is there appropriate use of typography and colors?
   - Are there any accessibility issues?
   - Is the interface mobile-friendly?
   - Are there any usability problems or confusing elements?

4. **Accessibility & Usability**
   - Are there any potential accessibility issues?
   - Is the interface mobile-friendly?
   - Are there any usability problems or confusing elements?

5. **Performance & Technical Issues**
   - Are there any loading or rendering issues visible?
   - Does the page appear to load quickly and smoothly?
   - Are there any broken elements or missing content?
   - Does the page use appropriate caching strategies?
   - Are there any console errors or JavaScript issues?

Please provide specific, actionable recommendations for improving this page. Focus on practical fixes that would enhance user experience, accessibility, and overall design quality.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: 'image/png'
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();

    if (!text || text.trim().length === 0) {
      throw new Error('Empty response from Gemini API');
    }

    console.log(`✅ ${pageName} analysis completed with Gemini`);
    return text;

  } catch (error) {
    console.error(`❌ ${pageName} Gemini analysis failed:`, error.message);
    return {
      error: true,
      service: 'Gemini',
      message: error.message,
      page: pageName,
      timestamp: new Date().toISOString()
    };
  }
}

// Ollama analysis function
async function analyzeScreenshotWithOllama(screenshotPath, pageName) {
  console.log(`🤖 Analyzing ${pageName} screenshot with Ollama...`);

  try {
    const response = await fetch(`${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gemma3:latest',
        prompt: `Please analyze this screenshot of the "${pageName}" page in the Space Analyzer web application and provide detailed UI/UX feedback:

1. **Layout & Visual Hierarchy**
   - Is the layout well-organized and intuitive?
   - Does the visual hierarchy guide the user's attention effectively?
   - Are elements properly aligned and spaced?
   - Are interactive elements (buttons, links) obvious?
   - Does the page flow logically?
   - Are there proper headings and sections?

2. **Navigation & User Flow**
   - Is navigation clear and consistent?
   - Are interactive elements (buttons, links) obvious?
   - Does the page flow logically?
   - Are there proper breadcrumbs and navigation aids?

3. **Content Presentation**
   - Is information clearly presented and easy to read?
   - Are data visualizations effective and understandable?
   - Is there appropriate use of typography and colors?
   - Are there any accessibility issues?
   - Is the interface mobile-friendly?
   - Are there any usability problems or confusing elements?

4. **Accessibility & Usability**
   - Are there any potential accessibility issues?
   - Is the interface mobile-friendly?
   - Are there any usability problems or confusing elements?

5. **Performance & Technical Issues**
   - Are there any loading or rendering issues visible?
   - Does the page appear to load quickly and smoothly?
   - Are there any broken elements or missing content?
   - Does the page use appropriate caching strategies?
   - Are there any console errors or JavaScript issues?

Please provide specific, actionable recommendations for improving this page. Focus on practical fixes that would enhance user experience, accessibility, and overall design quality.`
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    let content = '';
    if (result.message && result.message.content) {
      content = result.message.content;
    } else {
      content = 'No analysis content received';
    }

    console.log(`✅ ${pageName} analysis completed with Ollama`);
    return content;

  } catch (error) {
    console.error(`❌ ${pageName} Ollama analysis failed:`, error.message);
    return {
      error: true,
      service: 'Ollama',
      message: error.message,
      page: pageName,
      timestamp: new Date().toISOString()
    };
  }
}

// Helper function to validate if a result is valid
function isValidResult(result) {
  return typeof result === 'string' &&
         result.length > 10 && // Must be at least 10 characters
         !result.includes('[object Object]') &&
         !result.includes('failed') &&
         !result.includes('Error:') &&
         result.trim() !== '';
}

// Dynamic analysis function that switches between Ollama and Gemini
async function analyzeScreenshotDynamically(screenshotPath, pageName) {
  console.log(`🎯 Starting analysis race for ${pageName}...`);

  // Create promises for both services
  const geminiPromise = analyzeScreenshotWithGemini(screenshotPath, pageName);
  const ollamaPromise = analyzeScreenshotWithOllama(screenshotPath, pageName);

  // Track completion status
  let geminiCompleted = false;
  let ollamaCompleted = false;
  let geminiResult = null;
  let ollamaResult = null;

  // Start both promises and track their completion
  geminiPromise.then(result => {
    geminiCompleted = true;
    geminiResult = result;
    console.log(`🏁 Gemini completed for ${pageName}`);
  }).catch(error => {
    geminiCompleted = true;
    geminiResult = error;
    console.log(`❌ Gemini failed for ${pageName}: ${error.message}`);
  });

  ollamaPromise.then(result => {
    ollamaCompleted = true;
    ollamaResult = result;
    console.log(`🏁 Ollama completed for ${pageName}`);
  }).catch(error => {
    ollamaCompleted = true;
    ollamaResult = error;
    console.log(`❌ Ollama failed for ${pageName}: ${error.message}`);
  });

  // Wait for at least one to complete
  while (!geminiCompleted && !ollamaCompleted) {
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
  }

  // Check if we have a valid result from the first completer
  if (geminiCompleted && isValidResult(geminiResult)) {
    console.log(`⚡ ${pageName} completed fastest with Gemini`);
    return geminiResult;
  }

  if (ollamaCompleted && isValidResult(ollamaResult)) {
    console.log(`⚡ ${pageName} completed fastest with Ollama`);
    return ollamaResult;
  }

  // If first result was invalid, wait for the other one
  console.log(`⚠️  First result was invalid, waiting for fallback...`);

  // Wait for both to complete if needed
  const timeout = Date.now() + 300000; // 5 minute timeout
  while ((!geminiCompleted || !ollamaCompleted) && Date.now() < timeout) {
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
  }

  // Check for valid results
  if (isValidResult(geminiResult)) {
    console.log(`✅ ${pageName} completed with Gemini (fallback)`);
    return geminiResult;
  }

  if (isValidResult(ollamaResult)) {
    console.log(`✅ ${pageName} completed with Ollama (fallback)`);
    return ollamaResult;
  }

  // Both failed or returned invalid results
  const geminiError = geminiResult?.message || 'Unknown error';
  const ollamaError = ollamaResult?.message || 'Unknown error';
  return `Analysis failed: Gemini (${geminiError}), Ollama (${ollamaError})`;
}

// Create screenshots directory if it doesn't exist
const screenshotsDir = pathlib.join(__dirname, 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

async function captureAndAnalyzePage(pageName) {
  console.log(`🌐 Launching browser for ${pageName}...`);
  
  const browser = await puppeteer.launch(puppeteerOptions);
  const page = await browser.newPage();

  console.log('📄 Creating new page...');
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9'
  });

  // Take screenshot
  const screenshotPath = path.join(screenshotsDir, `${pageName}-${Date.now()}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  // Run dynamic analysis
  const result = await analyzeScreenshotDynamically(screenshotPath, pageName);

  // Save result
  const resultPath = path.join(screenshotsDir, `${pageName}-analysis.txt`);
  fs.writeFileSync(resultPath, result);

  await browser.close();
  console.log(`✅ ${pageName} analysis completed`);
}

// Main test execution
async function runIntegratedTest() {
  console.log('🌐 Launching Puppeteer browser...');
  
  const browser = await puppeteer.launch(puppeteerOptions);
  const page = await browser.newPage();

  console.log('📄 Creating new page...');
  await page.setViewport({ width: 1920, height: 1080 });
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9'
  });

  // Test each page
  for (const pageName of pages) {
    await captureAndAnalyzePage(pageName);
  }

  await browser.close();
  console.log('📊 All tests completed!');
}

// Run the test if called directly
if (require.main === module && process.argv.length > 2) {
  console.log('⏱ Running test with timeout...');
  runIntegratedTest().catch(console.error);
} else {
  console.log('⏱ Running test directly...');
  runIntegratedTest().catch(console.error);
}
