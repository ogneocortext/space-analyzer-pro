const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

async function debugFrontendScreenshot() {
  console.log('🔍 Debugging Frontend Screenshot Issues...\n');
  
  // Check if frontend is running
  console.log('1. Checking frontend accessibility...');
  try {
    const response = await fetch('http://localhost:3001');
    console.log(`   ✅ Frontend accessible: ${response.status}`);
  } catch (error) {
    console.error(`   ❌ Frontend not accessible: ${error.message}`);
    console.log('   💡 Make sure the frontend is running: npm run dev');
    return;
  }
  
  // Test Puppeteer with local frontend
  console.log('\n2. Testing Puppeteer with local frontend...');
  try {
    const browser = await puppeteer.launch({
      headless: false, // Show browser for debugging
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-features=HttpsFirstBalancedModeAutoEnable',
        '--window-size=1920,1080',
        '--force-device-scale-factor=1',
        '--disable-web-security',
        '--allow-running-insecure-content'
      ]
    });
    
    console.log('   ✅ Browser launched');
    
    const page = await browser.newPage();
    console.log('   ✅ Page created');
    
    // Enable console logging from the page
    page.on('console', msg => {
      console.log(`   📄 Browser console [${msg.type()}]: ${msg.text()}`);
    });
    
    page.on('pageerror', error => {
      console.error(`   ❌ Browser page error: ${error.message}`);
    });
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    console.log('   ✅ Viewport set');
    
    // Navigate to frontend with extended timeout
    console.log('   🌐 Navigating to frontend...');
    try {
      await page.goto('http://localhost:3001', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      console.log('   ✅ Navigation successful');
    } catch (navError) {
      console.error(`   ❌ Navigation failed: ${navError.message}`);
      
      // Try alternative wait strategies
      console.log('   🔄 Trying alternative wait strategy...');
      await page.goto('http://localhost:3001', { timeout: 10000 });
      await page.waitForTimeout(3000);
      console.log('   ✅ Navigation completed with timeout');
    }
    
    // Check page content
    console.log('   📄 Checking page content...');
    const content = await page.content();
    console.log(`   📄 Page HTML length: ${content.length} characters`);
    
    // Check if React app is loaded
    const hasReactRoot = content.includes('id="root"');
    console.log(`   📄 React root found: ${hasReactRoot}`);
    
    // Wait for React to load
    if (hasReactRoot) {
      console.log('   ⏳ Waiting for React app to load...');
      try {
        await page.waitForSelector('#root', { timeout: 10000 });
        console.log('   ✅ React app loaded');
      } catch (error) {
        console.log(`   ⚠️ React app may still be loading: ${error.message}`);
      }
    }
    
    // Take screenshot
    console.log('   📸 Taking screenshot...');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(__dirname, `debug-screenshot-${timestamp}.png`);
    
    await page.screenshot({ 
      path: screenshotPath, 
      fullPage: true,
      type: 'png'
    });
    
    console.log(`   ✅ Screenshot saved: ${screenshotPath}`);
    
    // Get page title
    try {
      const title = await page.title();
      console.log(`   📄 Page title: ${title}`);
    } catch (error) {
      console.log(`   ⚠️ Could not get page title: ${error.message}`);
    }
    
    await page.close();
    await browser.close();
    
    console.log('\n✅ Debug screenshot completed successfully!');
    console.log(`📁 Screenshot location: ${screenshotPath}`);
    
    return screenshotPath;
    
  } catch (error) {
    console.error('❌ Puppeteer debugging failed:', error.message);
    console.error('Stack trace:', error.stack);
    
    // Try manual fallback
    console.log('\n🔄 Trying manual screenshot fallback...');
    return takeManualScreenshot();
  }
}

// Manual screenshot fallback
async function takeManualScreenshot() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const screenshotPath = path.join(__dirname, `manual-screenshot-${timestamp}.png`);
  
  console.log(`📸 Taking manual screenshot: ${screenshotPath}`);
  
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    
    // Use PowerShell to capture screenshot
    const psCommand = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp = New-Object System.Drawing.Bitmap $screen.Width, $screen.Height; $graphics = [System.Drawing.Graphics]::FromImage($bmp); $graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size); $bmp.Save('${screenshotPath}', [System.Drawing.Imaging.ImageFormat]::Png); $graphics.Dispose(); $bmp.Dispose()`;
    
    exec(`powershell -Command "${psCommand}"`, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Manual screenshot failed:', error.message);
        console.log('💡 Please manually take a screenshot of the frontend and save it as:');
        console.log(screenshotPath);
        resolve(screenshotPath);
      } else {
        console.log(`✅ Manual screenshot saved: ${screenshotPath}`);
        resolve(screenshotPath);
      }
    });
  });
}

// Run the debug function
if (require.main === module) {
  debugFrontendScreenshot().then(screenshotPath => {
    console.log(`\n🎯 Next step: Analyze the screenshot`);
    console.log(`Run: node frontend-visual-analyzer.cjs analyze "${screenshotPath}"`);
  }).catch(error => {
    console.error('Debug session failed:', error.message);
  });
}

module.exports = { debugFrontendScreenshot, takeManualScreenshot };
