const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function captureDashboardScreenshot() {
  console.log('📸 Capturing dashboard screenshot for AI analysis...\n');
  
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
    
    // Navigate to frontend
    console.log('🌐 Navigating to frontend...');
    await page.goto('http://localhost:3001', { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for the page to load completely
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Take screenshot of the full page
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(__dirname, `dashboard-for-z-ai-${timestamp}.png`);
    
    await page.screenshot({ 
      path: screenshotPath, 
      fullPage: true,
      type: 'png'
    });
    
    await browser.close();
    
    console.log(`✅ Screenshot saved: ${screenshotPath}`);
    return screenshotPath;
    
  } catch (error) {
    console.error('❌ Screenshot capture failed:', error.message);
    throw error;
  }
}

async function submitToZAI(imagePath) {
  console.log('\n🤖 Submitting to https://chat.z.ai/ for analysis...\n');
  
  try {
    // Read and encode image
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Create the analysis prompt
    const prompt = `Please analyze this frontend application screenshot and provide detailed feedback on:

1. **Layout Issues and Alignment Problems**
   - Element positioning and spacing
   - Visual hierarchy and organization
   - Any overlapping or misaligned elements

2. **Responsive Design Problems**
   - How well the layout adapts to different screen sizes
   - Mobile-friendliness and touch targets
   - Any horizontal scrolling or layout breaks

3. **UI/UX Issues**
   - User flow and interaction design
   - Visual consistency and design language
   - Any confusing or unclear elements

4. **Broken Components or Missing Elements**
   - Any incomplete or malfunctioning UI elements
   - Missing functionality or features
   - Error states or loading issues

5. **Color and Typography Issues**
   - Color contrast and accessibility
   - Font sizes and readability
   - Visual hierarchy and text styling

6. **Navigation Problems**
   - Menu structure and navigation clarity
   - Active states and user feedback
   - Any navigation usability issues

7. **Visual Bugs or Inconsistencies**
   - Any visual glitches or rendering issues
   - Design inconsistencies across elements
   - Spacing or alignment problems

Please provide specific, actionable recommendations for developers to improve this interface. Focus on practical fixes that would enhance the user experience.`;

    console.log('📡 Preparing request for chat.z.ai...');
    console.log(`📷 Image size: ${imageBuffer.length} bytes`);
    console.log(`📷 Base64 length: ${base64Image.length} characters`);
    
    // For now, we'll save the info needed for manual submission
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const submissionInfo = {
      imagePath: imagePath,
      prompt: prompt,
      imageSize: imageBuffer.length,
      base64Size: base64Image.length,
      instructions: `
Manual Submission Steps:
1. Go to https://chat.z.ai/
2. Upload the image: ${imagePath}
3. Use this prompt:
${prompt}

The image has been saved and is ready for manual submission.
      `
    };
    
    // Save submission info
    const infoPath = path.join(__dirname, `z-ai-submission-info-${timestamp}.txt`);
    fs.writeFileSync(infoPath, submissionInfo.instructions);
    
    console.log(`\n📋 Submission info saved: ${infoPath}`);
    console.log(`\n📸 Screenshot ready for manual upload: ${imagePath}`);
    console.log(`\n🌐 Visit https://chat.z.ai/ to upload and analyze the screenshot`);
    
    return submissionInfo;
    
  } catch (error) {
    console.error('❌ Submission preparation failed:', error.message);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting Dashboard Capture and Z.AI Analysis...\n');
    
    // Step 1: Capture screenshot
    const screenshotPath = await captureDashboardScreenshot();
    
    // Step 2: Prepare for Z.AI submission
    const submissionInfo = await submitToZAI(screenshotPath);
    
    console.log('\n✅ Process completed successfully!');
    console.log('\n📋 Next Steps:');
    console.log('1. Open https://chat.z.ai/');
    console.log(`2. Upload the screenshot: ${screenshotPath}`);
    console.log('3. Use the provided prompt for analysis');
    console.log('4. Compare results with the LLaVA analysis');
    
  } catch (error) {
    console.error('\n❌ Process failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { captureDashboardScreenshot, submitToZAI };
