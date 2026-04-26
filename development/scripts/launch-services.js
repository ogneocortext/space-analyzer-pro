#!/usr/bin/env node

/**
 * Service Stack Launcher
 * Launches the complete Space Analyzer service stack without auto-opening browser
 */

import { spawn, exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ServiceLauncher {
  constructor() {
    this.services = new Map();
    this.isShuttingDown = false;
  }

  async launch() {
    console.log('🚀 Space Analyzer Service Stack Launcher');
    console.log('=========================================\n');

    try {
      // Check prerequisites
      await this.checkPrerequisites();
      
      // Launch services
      await this.launchBackend();
      await this.launchFrontend();
      
      // Wait for services to be ready
      await this.waitForServices();
      
      // Display status
      this.displayStatus();
      
      // Handle shutdown
      this.setupShutdownHandlers();
      
    } catch (error) {
      console.error('❌ Launch failed:', error.message);
      process.exit(1);
    }
  }

  async checkPrerequisites() {
    console.log('📋 Checking prerequisites...');
    
    // Check if Ollama is running
    const ollamaStatus = await this.checkOllama();
    if (!ollamaStatus) {
      console.log('⚠️  Ollama not detected. Please install and start Ollama for AI features.');
      console.log('   Download: https://ollama.com/download\n');
    } else {
      console.log('✅ Ollama is running\n');
    }
  }

  async checkOllama() {
    return new Promise((resolve) => {
      exec('curl -s http://localhost:30014/api/tags', (error) => {
        resolve(!error);
      });
    });
  }

  async launchBackend() {
    console.log('🔧 Starting backend service...');
    
    return new Promise((resolve, reject) => {
      const backendPath = join(__dirname, 'server', 'backend-server.js');
      
      if (!existsSync(backendPath)) {
        reject(new Error('Backend server not found. Please ensure server/backend-server.js exists.'));
        return;
      }

      const backend = spawn('node', [backendPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'development' }
      });

      this.services.set('backend', backend);

      backend.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Server running on port')) {
          console.log('✅ Backend started successfully');
          resolve();
        }
      });

      backend.stderr.on('data', (data) => {
        console.error('Backend error:', data.toString());
      });

      backend.on('error', (error) => {
        reject(new Error(`Backend failed to start: ${error.message}`));
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.services.has('backend')) {
          reject(new Error('Backend startup timeout'));
        }
      }, 10000);
    });
  }

  async launchFrontend() {
    console.log('🌐 Starting frontend service...');
    
    return new Promise((resolve, reject) => {
      const frontend = spawn('npm', ['run', 'dev'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { 
          ...process.env, 
          NODE_ENV: 'development',
          BROWSER: 'none' // Prevent auto-opening browser
        }
      });

      this.services.set('frontend', frontend);

      frontend.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Local:') || output.includes('VITE v')) {
          console.log('✅ Frontend started successfully');
          resolve();
        }
      });

      frontend.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('Error') || output.includes('Failed')) {
          console.error('Frontend error:', output);
        }
      });

      frontend.on('error', (error) => {
        reject(new Error(`Frontend failed to start: ${error.message}`));
      });

      // Timeout after 15 seconds
      setTimeout(() => {
        if (!this.services.has('frontend')) {
          reject(new Error('Frontend startup timeout'));
        }
      }, 15000);
    });
  }

  async waitForServices() {
    console.log('⏳ Waiting for services to be ready...');
    
    // Wait for both services to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Test backend health
    const backendReady = await this.testBackendHealth();
    if (!backendReady) {
      throw new Error('Backend health check failed');
    }
    
    console.log('✅ All services are ready\n');
  }

  async testBackendHealth() {
    return new Promise((resolve) => {
      exec('curl -s http://localhost:3001/health', (error, stdout) => {
        resolve(!error && stdout.includes('ok'));
      });
    });
  }

  displayStatus() {
    console.log('📊 Service Status:');
    console.log('==================');
    console.log('Frontend:  http://localhost:3001');
    console.log('Backend:   http://localhost:3001');
    console.log('Ollama:    http://localhost:30014');
    console.log('');
    console.log('💡 To access the application:');
    console.log('   1. Open your browser');
    console.log('   2. Navigate to: http://localhost:3001');
    console.log('');
    console.log('🔧 To stop all services: Press Ctrl+C');
    console.log('=========================================\n');
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
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught exception:', error);
      shutdown();
    });
  }
}

// Run the launcher
if (import.meta.url === `file://${process.argv[1]}`) {
  const launcher = new ServiceLauncher();
  launcher.launch().catch(error => {
    console.error('❌ Launch failed:', error);
    process.exit(1);
  });
}

export default ServiceLauncher;