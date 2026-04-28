/**
 * Global setup for Playwright tests
 * Initializes logging and starts the dev server if needed
 */

import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import http from 'http';

async function globalSetup(_config: FullConfig) {
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

  // Start backend server
  console.log('🔧 Starting backend server...');
  const backendProcess = spawn('node', ['server/backend-server.js'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true
  });

  // Wait for backend to be ready
  await waitForServer('http://127.0.0.1:8080/api/health', 30000);
  console.log('✅ Backend server ready on port 8080');

  // Start frontend dev server
  console.log('🔧 Starting frontend dev server...');
  const frontendProcess = spawn('npm', ['run', 'dev:no-browser'], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, BROWSER: 'none' }
  });

  // Wait for frontend to be ready
  await waitForServer('http://localhost:3001', 30000);
  console.log('✅ Frontend dev server ready on port 3001');

  // Store process IDs for cleanup
  if (backendProcess.pid) {
    process.env.BACKEND_PID = backendProcess.pid.toString();
  }
  if (frontendProcess.pid) {
    process.env.FRONTEND_PID = frontendProcess.pid.toString();
  }
}

function waitForServer(url: string, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const checkServer = () => {
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });

      req.on('error', retry);
      req.setTimeout(5000, () => {
        req.destroy();
        retry();
      });

      function retry() {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Server at ${url} did not start within ${timeout}ms`));
        } else {
          setTimeout(checkServer, 1000);
        }
      }
    };

    checkServer();
  });
}

export default globalSetup;
