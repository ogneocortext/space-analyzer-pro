/**
 * Global setup for Playwright tests
 * Initializes logging and starts the dev server if needed
 */

import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Playwright test setup...');
  
  // Create test results directories
  const resultsDir = path.join(process.cwd(), 'test-results');
  const logsDir = path.join(resultsDir, 'logs');
  const screenshotsDir = path.join(resultsDir, 'screenshots');
  
  [resultsDir, logsDir, screenshotsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  console.log('✅ Test directories created');
  console.log('📝 Logs will be saved to:', logsDir);
  console.log('📸 Screenshots will be saved to:', screenshotsDir);
}

export default globalSetup;
