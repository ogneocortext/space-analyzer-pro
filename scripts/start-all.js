#!/usr/bin/env node

/**
 * Start All Services
 * Starts both frontend and backend services concurrently
 */

import { spawn } from 'child_process';

console.log('🚀 Starting all services...\n');

// Start backend server
const backend = spawn('npm', ['run', 'server:dev'], {
  shell: true,
  stdio: 'inherit'
});

// Start frontend dev server
const frontend = spawn('npm', ['run', 'dev:no-browser'], {
  shell: true,
  stdio: 'inherit'
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down services...');
  backend.kill();
  frontend.kill();
  process.exit();
});

console.log('✅ Services started');
console.log('   Backend: http://localhost:8080');
console.log('   Frontend: http://localhost:3001');
console.log('\nPress Ctrl+C to stop all services\n');
