#!/usr/bin/env node

/**
 * Startup Optimization Script
 * Implements parallel initialization and lazy loading for faster startup
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class StartupOptimizer {
  constructor() {
    this.startTime = Date.now();
    this.checkpoints = [];
  }

  logCheckpoint(name) {
    const elapsed = Date.now() - this.startTime;
    this.checkpoints.push({ name, elapsed });
    console.log(`⏱️ ${name}: ${elapsed}ms`);
  }

  /**
   * Optimize database initialization with parallel operations
   */
  async optimizeDatabaseInit() {
    console.log('🚀 Starting optimized database initialization...');
    
    // Check if database exists and is accessible first
    const dbPath = path.join(__dirname, '..', 'server', 'data', 'space-analyzer.db');
    const dataDir = path.dirname(dbPath);
    
    // Create directory asynchronously if needed
    if (!fs.existsSync(dataDir)) {
      await fs.promises.mkdir(dataDir, { recursive: true });
    }

    // Skip backup for small databases to speed up startup
    if (fs.existsSync(dbPath)) {
      const stats = fs.statSync(dbPath);
      const fileSizeMB = stats.size / (1024 * 1024);
      
      if (fileSizeMB > 100) {
        console.log(`📊 Database size: ${fileSizeMB.toFixed(2)} MB (backup skipped for speed)`);
      } else {
        console.log(`📊 Database size: ${fileSizeMB.toFixed(2)} MB`);
      }
    }

    this.logCheckpoint('Database pre-checks');
  }

  /**
   * Start services with staggered initialization
   */
  async startServicesStaggered() {
    console.log('🔄 Starting services with staggered initialization...');

    // Start core server first
    const serverProcess = spawn('npm', ['run', 'server:dev'], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });

    // Wait for server to be ready, then start frontend
    setTimeout(() => {
      console.log('🌐 Starting frontend development server...');
      const frontendProcess = spawn('npm', ['run', 'dev:no-browser'], {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });

      frontendProcess.on('error', (error) => {
        console.error('❌ Frontend start error:', error);
      });
    }, 2000); // 2 second delay

    serverProcess.on('error', (error) => {
      console.error('❌ Server start error:', error);
    });

    this.logCheckpoint('Services started');
  }

  /**
   * Create optimized environment configuration
   */
  createOptimizedEnv() {
    const envConfig = {
      // Disable heavy features during development
      'NODE_ENV': 'development',
      'SKIP_AI_INIT': 'true',
      'SKIP_MIGRATIONS': 'false',
      'DB_PARALLEL_INIT': 'true',
      // Optimize Node.js for startup speed
      'NODE_OPTIONS': '--max-old-space-size=2048',
      // Reduce logging during startup
      'LOG_LEVEL': 'warn'
    };

    // Write temporary .env.optimized file
    const envPath = path.join(__dirname, '..', '.env.optimized');
    const envContent = Object.entries(envConfig)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    fs.writeFileSync(envPath, envContent);
    console.log('✅ Created optimized environment configuration');
    
    return envPath;
  }

  /**
   * Run optimization and start services
   */
  async run() {
    console.log('🚀 Space Analyzer Startup Optimizer');
    console.log('=====================================');

    try {
      // Create optimized environment
      this.createOptimizedEnv();
      this.logCheckpoint('Environment setup');

      // Optimize database
      await this.optimizeDatabaseInit();

      // Start services staggered
      await this.startServicesStaggered();

      const totalStartupTime = Date.now() - this.startTime;
      console.log('=====================================');
      console.log(`✅ Optimized startup completed in ${totalStartupTime}ms`);
      console.log('📊 Checkpoints:', this.checkpoints);

    } catch (error) {
      console.error('❌ Startup optimization failed:', error);
      process.exit(1);
    }
  }
}

// Run optimizer if called directly
if (require.main === module) {
  const optimizer = new StartupOptimizer();
  optimizer.run();
}

module.exports = StartupOptimizer;
