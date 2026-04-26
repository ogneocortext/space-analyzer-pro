const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function forceDashboardScreenshot() {
  console.log('📸 Capturing actual dashboard with real content...\n');
  
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-features=HttpsFirstBalancedModeAutoEnable',
        '--window-size=1920,1080',
        '--force-device-scale-factor=1'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log('🌐 Navigating to frontend...');
    await page.goto('http://localhost:3001', { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('🔍 Checking current page state...');
    
    // Get current URL and title
    const currentUrl = page.url();
    const currentTitle = await page.title();
    console.log(`📄 Current title: ${currentTitle}`);
    console.log(`🌐 Current URL: ${currentUrl}`);
    
    // Check if we're on the dashboard page
    const isDashboard = currentUrl.includes('/dashboard') || 
                       currentTitle.includes('Space Analyzer Pro') ||
                       await page.$('.dashboard-section, .dashboard-grid, .metric-card').then(el => el !== null);
    
    if (!isDashboard) {
      console.log('⚠️ Not on dashboard page, trying to navigate there...');
      
      // Try to find and click dashboard navigation
      const dashboardSelectors = [
        'a[href*="dashboard"]',
        'button:contains("Dashboard")',
        '[data-testid="dashboard-link"]',
        '.nav-item:contains("Dashboard")',
        'a:contains("Dashboard")'
      ];
      
      let navigated = false;
      for (const selector of dashboardSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            await element.click();
            await new Promise(resolve => setTimeout(resolve, 2000));
            navigated = true;
            console.log('✅ Navigated to dashboard');
            break;
          }
        } catch (error) {
          // Continue to next selector
        }
      }
      
      if (!navigated) {
        console.log('⚠️ Could not navigate to dashboard, capturing current page...');
      }
    }
    
    // Wait for any animations or loading
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if there's actual content (not just empty/loading state)
    console.log('🔍 Checking for actual dashboard content...');
    
    const contentChecks = [
      // Check for metric cards with data
      async () => {
        const cards = await page.$$('.metric-card');
        if (cards.length > 0) {
          const hasContent = await Promise.all(
            cards.slice(0, 3).map(async card => {
              const text = await card.textContent();
              return text && text.trim().length > 5 && !text.includes('Loading') && !text.includes('0');
            })
          );
          return hasContent.some(has => has);
        }
        return false;
      },
      // Check for charts
      async () => {
        const charts = await page.$$('canvas, svg, .chart, .visualization');
        return charts.length > 0;
      },
      // Check for analysis results
      async () => {
        const analysisElements = await page.$('[data-testid*="analysis"], .analysis-results, .file-count, .storage-size');
        return analysisElements.length > 0;
      },
      // Check for any meaningful content
      async () => {
        const bodyText = await page.textContent();
        return bodyText && bodyText.length > 500; // Reasonable amount of content
      }
    ];
    
    let hasContent = false;
    for (const check of contentChecks) {
      try {
        hasContent = await check();
        if (hasContent) {
          console.log('✅ Dashboard content detected');
          break;
        }
      } catch (error) {
        // Continue to next check
      }
    }
    
    if (!hasContent) {
      console.log('⚠️ No substantial dashboard content detected, but capturing anyway...');
      
      // Try to trigger some content loading
      console.log('🔄 Attempting to load dashboard content...');
      
      // Try to start analysis if there's a button
      const analysisButton = await page.$('button:contains("Start Analysis"), button:contains("Analyze"), .btn-primary');
      if (analysisButton) {
        console.log('🎯 Found analysis button, clicking to load content...');
        await analysisButton.click();
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // Try to select a directory if there's a directory picker
      const dirButton = await page.$('button:contains("Select Directory"), button:contains("Browse")');
      if (dirButton) {
        console.log('📁 Found directory button, clicking to load content...');
        await dirButton.click();
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Close any modal that might appear
        await page.keyboard.press('Escape');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Final wait for content to settle
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Take screenshot with better settings
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(__dirname, `dashboard-real-content-${timestamp}.png`);
    
    console.log('📸 Capturing high-quality screenshot...');
    await page.screenshot({ 
      path: screenshotPath, 
      fullPage: true,
      type: 'png'
    });
    
    // Get page info for verification
    const finalUrl = page.url();
    const finalTitle = await page.title();
    const finalSize = fs.statSync(screenshotPath).size;
    
    await browser.close();
    
    console.log(`\n✅ Screenshot captured: ${screenshotPath}`);
    console.log(`📏 File size: ${finalSize} bytes`);
    console.log(`📄 Page title: ${finalTitle}`);
    console.log(`🌐 Final URL: ${finalUrl}`);
    console.log(`📊 Content detected: ${hasContent ? 'Yes' : 'Limited'}`);
    
    return {
      screenshotPath,
      title: finalTitle,
      url: finalUrl,
      hasContent,
      fileSize: finalSize
    };
    
  } catch (error) {
    console.error('❌ Screenshot capture failed:', error.message);
    throw error;
  }
}

async function prepareForAIAnalysis(result) {
  console.log('\n🤖 Preparing dashboard for AI analysis...\n');
  
  try {
    // Read and encode image
    const imageBuffer = fs.readFileSync(result.screenshotPath);
    const base64Image = imageBuffer.toString('base64');
    
    // Create enhanced analysis prompt
    const prompt = `Please analyze this Space Analyzer dashboard screenshot and provide detailed feedback on:

1. **Dashboard Layout and Organization**
   - Overall layout structure and visual hierarchy
   - Information architecture and content organization
   - Spacing, alignment, and visual balance
   - Any overcrowding or empty space issues

2. **Data Visualization Components**
   - Chart types and their effectiveness for file system data
   - Data clarity, readability, and visual encoding
   - Color usage in visualizations and accessibility
   - Interactive elements and their usability

3. **Navigation and User Flow**
   - Main navigation structure and clarity
   - Active states and user feedback mechanisms
   - Breadcrumbs, progress indicators, or wayfinding
   - Ease of finding key features and functions

4. **Interactive Elements**
   - Button design, placement, and visual hierarchy
   - Form elements, input fields, and controls
   - Hover states, transitions, and micro-interactions
   - Touch target sizes and accessibility considerations

5. **Content and Information Display**
   - Text readability, typography, and hierarchy
   - Data presentation clarity and comprehension
   - Labels, legends, and explanatory text
   - Information density and cognitive load management

6. **Responsive Design Considerations**
   - How the layout adapts to different screen sizes
   - Mobile-friendliness and touch interactions
   - Potential responsive issues and breakpoints

7. **Visual Design and Branding**
   - Color scheme consistency, harmony, and accessibility
   - Typography choices and readability in dark theme
   - Visual polish, professional appearance, and attention to detail
   - Brand consistency and design system adherence

8. **Specific Space Analyzer Features**
   - File analysis visualization effectiveness
   - Storage metrics presentation and clarity
   - AI-powered insights display and usefulness
   - Search functionality integration and usability

Please provide specific, actionable recommendations for improving this dashboard interface. Focus on practical fixes that would enhance user experience, data comprehension, and overall usability for a file system analysis tool.`;

    console.log('📡 Enhanced analysis prompt prepared');
    console.log(`📷 Image size: ${imageBuffer.length} bytes`);
    console.log(`📷 Base64 length: ${base64Image.length} characters`);
    
    // Save comprehensive submission info
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const submissionInfo = {
      screenshotPath: result.screenshotPath,
      prompt: prompt,
      imageSize: imageBuffer.length,
      base64Size: base64Image.length,
      pageTitle: result.title,
      url: result.url,
      hasContent: result.hasContent,
      fileSize: result.fileSize,
      instructions: `
Enhanced Dashboard Analysis Results:

Screenshot: ${result.screenshotPath}
File Size: ${result.fileSize} bytes
Page Title: ${result.title}
URL: ${result.url}
Content Detected: ${result.hasContent ? 'Yes' : 'Limited'}

Enhanced AI Analysis Prompt:
${prompt}

This screenshot captures the actual Space Analyzer dashboard with real content, ready for comprehensive AI analysis using any vision model (LLaVA, Z.AI, GPT-4V, Claude, etc.).
      `
    };
    
    const infoPath = path.join(__dirname, `enhanced-dashboard-analysis-${timestamp}.txt`);
    fs.writeFileSync(infoPath, submissionInfo.instructions);
    
    console.log(`\n📋 Enhanced analysis info saved: ${infoPath}`);
    console.log(`\n📸 Screenshot ready for AI analysis: ${result.screenshotPath}`);
    
    return submissionInfo;
    
  } catch (error) {
    console.error('❌ Preparation failed:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting Enhanced Dashboard Screenshot Capture...\n');
    
    // Step 1: Capture screenshot with real content
    const result = await forceDashboardScreenshot();
    
    // Step 2: Prepare for AI analysis
    const submissionInfo = await prepareForAIAnalysis(result);
    
    console.log('\n✅ Enhanced capture completed successfully!');
    console.log('\n📋 Ready for AI Analysis:');
    console.log(`📸 Screenshot: ${result.screenshotPath}`);
    console.log(`📊 Content: ${result.hasContent ? 'Real dashboard data' : 'Limited content'}`);
    console.log(`📏 Size: ${result.fileSize} bytes`);
    console.log('\n🤖 Choose your AI model:');
    console.log('• LLaVA (local, fast, good for major issues)');
    console.log('• Z.AI (web, detailed technical guidance)');
    console.log('• GPT-4V (OpenAI, comprehensive analysis)');
    console.log('• Claude Vision (Anthropic, detailed insights)');
    
    return result;
    
  } catch (error) {
    console.error('\n❌ Process failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { forceDashboardScreenshot, prepareForAIAnalysis };
