#!/usr/bin/env node

/**
 * Unified Service Launcher
 * Starts both backend and frontend services simultaneously
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class UnifiedLauncher {
  constructor() {
    this.services = new Map();
    this.isShuttingDown = false;
  }

  async launch() {
    console.log('🚀 Space Analyzer - Unified Launcher');
    console.log('====================================\n');

    try {
      // Launch both services
      this.launchBackend();
      this.launchFrontend();
      
      // Wait a moment for services to start
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Display status
      this.displayStatus();
      
      // Handle shutdown
      this.setupShutdownHandlers();
      
      // Keep the process running
      await this.keepAlive();
      
    } catch (error) {
      console.error('❌ Launch failed:', error.message);
      process.exit(1);
    }
  }

  async keepAlive() {
    // Keep the parent process alive while services are running
    return new Promise((resolve) => {
      // This promise never resolves, keeping the process alive
      // until shutdown is triggered
    });
  }

  launchBackend() {
    console.log('🔧 Starting backend service...');
    
    const backend = spawn('npm', ['run', 'server:dev'], {
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, NODE_ENV: 'development' }
    });

    this.services.set('backend', backend);

    backend.on('error', (error) => {
      console.error('❌ Backend failed to start:', error.message);
    });

    backend.on('exit', (code) => {
      if (code !== 0 && !this.isShuttingDown) {
        console.error(`❌ Backend exited with code ${code}`);
      }
    });
  }

  launchFrontend() {
    console.log('🌐 Starting frontend service...');
    
    const frontend = spawn('npm', ['run', 'dev:no-browser'], {
      stdio: 'inherit',
      shell: true,
      env: { 
        ...process.env, 
        NODE_ENV: 'development'
      }
    });

    this.services.set('frontend', frontend);

    frontend.on('error', (error) => {
      console.error('❌ Frontend failed to start:', error.message);
    });

    frontend.on('exit', (code) => {
      if (code !== 0 && !this.isShuttingDown) {
        console.error(`❌ Frontend exited with code ${code}`);
      }
    });
  }

  displayStatus() {
    console.log('\n📊 Services Starting:');
    console.log('====================');
    console.log('Frontend:  http://localhost:3001 (or next available port)');
    console.log('Backend:   http://localhost:3001/api');
    console.log('');
    console.log('💡 The application will open in your browser automatically');
    console.log('🔧 To stop all services: Press Ctrl+C');
    console.log('====================================\n');
  }

  setupShutdownHandlers() {
    const shutdown = async () => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;
      
      console.log('\n🛑 Shutting down services...');
      
      // Stop all services
      for (const [name, service] of this.services) {
        console.log(`Stopping ${name}...`);
        service.kill('SIGTERM');
      }
      
      // Wait for services to stop
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('✅ All services stopped');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught exception:', error);
      shutdown();
    });
  }
}

// Run the launcher
const launcher = new UnifiedLauncher();
launcher.launch().catch(error => {
  console.error('❌ Launch failed:', error);
  process.exit(1);
});
