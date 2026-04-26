const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Use a local cache directory for better control
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
  
  // Windows-specific configuration
  defaultViewport: {
    width: 1920,
    height: 1080,
  },
  
  // Launch arguments for Windows compatibility
  args: [
    // Disable sandbox issues on Windows
    '--no-sandbox',
    '--disable-setuid-sandbox',
    
    // Disable GPU issues
    '--disable-gpu',
    '--disable-dev-shm-usage',
    
    // Disable features that might cause issues
    '--disable-features=HttpsFirstBalancedModeAutoEnable',
    '--disable-extensions',
    
    // Windows-specific flags
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    
    // Memory and performance
    '--max_old_space_size=4096',
    '--memory-pressure-off',
    
    // Other stability improvements
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-background-networking',
  ],
  
  // Enable extensions if needed (some Windows policies require this)
  enableExtensions: false,
  
  // Use headless mode
  headless: true,
  
  // Timeout settings
  protocolTimeout: 30000,
  defaultNavigationTimeout: 30000,
  
  // Ignore HTTPS errors for local development
  ignoreHTTPSErrors: true,
  
  // Accept insecure certificates
  acceptInsecureCerts: true,
  
  // User agent
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};
