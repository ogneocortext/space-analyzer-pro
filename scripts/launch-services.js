#!/usr/bin/env node

/**
 * Launch Services
 * Launches backend and frontend services with configuration options
 */

import { spawn } from 'child_process';

const args = process.argv.slice(2);
const launchBackend = !args.includes('--frontend-only');
const launchFrontend = !args.includes('--backend-only');

console.log('🚀 Launching services...\n');

if (launchBackend) {
  console.log('Starting backend server...');
  spawn('npm', ['run', 'server:dev'], { shell: true, stdio: 'inherit' });
}

if (launchFrontend) {
  console.log('Starting frontend dev server...');
  spawn('npm', ['run', 'dev:no-browser'], { shell: true, stdio: 'inherit' });
}

console.log('\n✅ Services launched');
