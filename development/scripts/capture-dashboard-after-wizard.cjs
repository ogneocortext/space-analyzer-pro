const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function captureDashboardAfterWizard() {
  console.log('📸 Capturing dashboard after closing welcome wizard...\n');
  
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
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('🔍 Looking for welcome wizard...');
    
    // Check if welcome wizard is present
    const wizardSelector = '.fixed.inset-0.bg-slate-900\\/95, .onboarding-wizard, [data-testid="onboarding"]';
    const wizardPresent = await page.$(wizardSelector).then(el => el !== null);
    
    if (wizardPresent) {
      console.log('✅ Welcome wizard detected, closing it...');
      
      // Try different methods to close the wizard
      const closeMethods = [
        // Method 1: Click X button
        async () => {
          const xButton = await page.$('button[aria-label="Skip onboarding"], button:has(X), .fixed button:last-child');
          if (xButton) {
            await xButton.click();
            return true;
          }
          return false;
        },
        // Method 2: Click Skip button if present
        async () => {
          const skipButton = await page.$('button:contains("Skip"), button:contains("Get Started")');
          if (skipButton) {
            await skipButton.click();
            return true;
          }
          return false;
        },
        // Method 3: Press Escape key
        async () => {
          await page.keyboard.press('Escape');
          return true;
        },
        // Method 4: Press Enter on Next/Get Started button
        async () => {
          const nextButton = await page.$('button:contains("Next"), button:contains("Get Started")');
          if (nextButton) {
            await nextButton.click();
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Try to skip if it goes to next step
            const xButton = await page.$('button[aria-label="Skip onboarding"]');
            if (xButton) {
              await xButton.click();
            }
            return true;
          }
          return false;
        }
      ];
      
      // Try each method
      let closed = false;
      for (const method of closeMethods) {
        try {
          closed = await method();
          if (closed) {
            console.log('✅ Wizard closed successfully');
            break;
          }
        } catch (error) {
          console.log(`⚠️ Method failed: ${error.message}`);
        }
      }
      
      if (!closed) {
        console.log('⚠️ Could not close wizard automatically, proceeding anyway...');
      }
      
      // Wait for wizard to disappear
      await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
      console.log('ℹ️ No welcome wizard detected, proceeding to dashboard...');
    }
    
    // Wait for dashboard to fully load
    console.log('⏳ Waiting for dashboard to load...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Try to ensure we're on the dashboard page
    const dashboardSelectors = [
      '.dashboard-section',
      '.dashboard-grid',
      '[data-testid="dashboard"]',
      '.space-analyzer-dashboard'
    ];
    
    let dashboardLoaded = false;
    for (const selector of dashboardSelectors) {
      const element = await page.$(selector);
      if (element) {
        dashboardLoaded = true;
        console.log(`✅ Dashboard detected with selector: ${selector}`);
        break;
      }
    }
    
    if (!dashboardLoaded) {
      console.log('⚠️ Dashboard elements not immediately visible, capturing anyway...');
    }
    
    // Take screenshot of the full page
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(__dirname, `dashboard-after-wizard-${timestamp}.png`);
    
    console.log('📸 Capturing screenshot...');
    await page.screenshot({ 
      path: screenshotPath, 
      fullPage: true,
      type: 'png'
    });
    
    // Get page title for verification
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);
    
    // Get URL for verification
    const url = page.url();
    console.log(`🌐 Current URL: ${url}`);
    
    await browser.close();
    
    console.log(`\n✅ Screenshot saved: ${screenshotPath}`);
    console.log(`📏 Screenshot size: ${fs.statSync(screenshotPath).size} bytes`);
    
    return {
      screenshotPath,
      title,
      url,
      wizardClosed: wizardPresent,
      dashboardLoaded
    };
    
  } catch (error) {
    console.error('❌ Screenshot capture failed:', error.message);
    throw error;
  }
}

async function prepareForAISubmission(result) {
  console.log('\n🤖 Preparing for AI analysis submission...\n');
  
  try {
    // Read and encode image
    const imageBuffer = fs.readFileSync(result.screenshotPath);
    const base64Image = imageBuffer.toString('base64');
    
    // Create analysis prompt for dashboard
    const prompt = `Please analyze this Space Analyzer dashboard screenshot and provide detailed feedback on:

1. **Dashboard Layout and Organization**
   - Overall layout structure and visual hierarchy
   - Information architecture and content organization
   - Spacing, alignment, and visual balance
   - Any overcrowding or empty space issues

2. **Data Visualization Components**
   - Chart types and their effectiveness
   - Data clarity and readability
   - Color usage in visualizations
   - Interactive elements and their usability

3. **Navigation and User Flow**
   - Main navigation structure and clarity
   - Active states and user feedback
   - Breadcrumbs or progress indicators
   - Ease of finding key features

4. **Interactive Elements**
   - Button design, placement, and clarity
   - Form elements and input fields
   - Hover states and micro-interactions
   - Touch target sizes and accessibility

5. **Content and Information Display**
   - Text readability and hierarchy
   - Data presentation clarity
   - Labels, legends, and explanatory text
   - Information density and cognitive load

6. **Responsive Design Considerations**
   - How the layout might adapt to different screen sizes
   - Mobile-friendliness of current design
   - Potential responsive issues

7. **Visual Design and Branding**
   - Color scheme consistency and harmony
   - Typography choices and readability
   - Visual polish and professional appearance
   - Brand consistency throughout

Please provide specific, actionable recommendations for improving this dashboard interface. Focus on practical fixes that would enhance user experience, data comprehension, and overall usability.`;

    console.log('📡 Analysis prompt prepared');
    console.log(`📷 Image size: ${imageBuffer.length} bytes`);
    console.log(`📷 Base64 length: ${base64Image.length} characters`);
    
    // Save submission info
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const submissionInfo = {
      screenshotPath: result.screenshotPath,
      prompt: prompt,
      imageSize: imageBuffer.length,
      base64Size: base64Image.length,
      pageTitle: result.title,
      url: result.url,
      wizardClosed: result.wizardClosed,
      dashboardLoaded: result.dashboardLoaded,
      instructions: `
Dashboard Screenshot Analysis Results:

Screenshot: ${result.screenshotPath}
Page Title: ${result.title}
URL: ${result.url}
Wizard Closed: ${result.wizardClosed ? 'Yes' : 'No'}
Dashboard Loaded: ${result.dashboardLoaded ? 'Yes' : 'No'}

AI Analysis Prompt:
${prompt}

Ready for submission to your chosen AI model (LLaVA, Z.AI, or others).
      `
    };
    
    const infoPath = path.join(__dirname, `dashboard-analysis-info-${timestamp}.txt`);
    fs.writeFileSync(infoPath, submissionInfo.instructions);
    
    console.log(`\n📋 Analysis info saved: ${infoPath}`);
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
    console.log('🚀 Starting Dashboard Capture After Wizard...\n');
    
    // Step 1: Capture screenshot after wizard
    const result = await captureDashboardAfterWizard();
    
    // Step 2: Prepare for AI analysis
    const submissionInfo = await prepareForAISubmission(result);
    
    console.log('\n✅ Process completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Choose your AI model (LLaVA, Z.AI, or another)');
    console.log(`2. Upload the screenshot: ${result.screenshotPath}`);
    console.log('3. Use the provided prompt for dashboard analysis');
    console.log('4. Compare results with previous AI analyses');
    
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

module.exports = { captureDashboardAfterWizard, prepareForAISubmission };
