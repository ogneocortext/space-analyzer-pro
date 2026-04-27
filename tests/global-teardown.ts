/**
 * Global teardown for Playwright tests
 * Cleans up after tests
 */

import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up after tests...');
  console.log('✅ Test teardown complete');
}

export default globalTeardown;
