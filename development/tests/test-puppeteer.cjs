const puppeteer = require('puppeteer');

async function testPuppeteer() {
  console.log('🤖 Testing Puppeteer...');
  
  try {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage'
      ]
    });
    
    console.log('✅ Browser launched successfully');
    
    console.log('Creating new page...');
    const page = await browser.newPage();
    
    console.log('Setting viewport...');
    await page.setViewport({ width: 1920, height: 1080 });
    
    console.log('Navigating to test page...');
    await page.goto('https://example.com', { waitUntil: 'networkidle2' });
    
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'test-puppeteer.png' });
    
    console.log('Getting page title...');
    const title = await page.title();
    console.log('Page title:', title);
    
    await page.close();
    await browser.close();
    
    console.log('✅ Puppeteer test completed successfully!');
    console.log('Screenshot saved as: test-puppeteer.png');
    
  } catch (error) {
    console.error('❌ Puppeteer test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

testPuppeteer();
