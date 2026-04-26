#!/usr/bin/env node

/**
 * Dynamic Port Configuration System
 * Automatically detects the correct port and manages port references across the application
 */

const fs = require('fs');
const path = require('path');
const net = require('net');

class PortConfig {
  constructor() {
    this.configFile = path.join(__dirname, '.port-config.json');
    this.defaultPort = 5173;
    this.fallbackPorts = [3006, 5173, 5174, 5175, 5176, 3000, 3001, 3002, 3003, 3004, 3005, 3007, 3008, 3009];
  }

  /**
   * Detect the actual port where the application is running
   */
  async detectActivePort() {
    console.log('🔍 Detecting active Space Analyzer port...');

    // First, try to read from existing config
    const savedConfig = this.loadConfig();
    if (savedConfig && savedConfig.port) {
      console.log(`💾 Found saved port configuration: ${savedConfig.port}`);
      if (await this.isPortActive(savedConfig.port)) {
        console.log(`✅ Port ${savedConfig.port} is active`);
        return savedConfig.port;
      } else {
        console.log(`❌ Saved port ${savedConfig.port} is not active, will search for new port`);
      }
    }

    // Try common development ports
    for (const port of this.fallbackPorts) {
      if (await this.isPortActive(port)) {
        console.log(`✅ Found active port: ${port}`);
        this.saveConfig({ port, lastDetected: new Date().toISOString() });
        return port;
      }
    }

    console.log(`❌ No active port found in common range, using default: ${this.defaultPort}`);
    return this.defaultPort;
  }

  /**
   * Check if a port is active and serving HTTP with Space Analyzer content
   */
  async isPortActive(port) {
    return new Promise((resolve) => {
      const client = new net.Socket();
      
      client.setTimeout(2000); // 2 second timeout
      
      client.on('connect', () => {
        // Send HTTP GET request to check if it's actually Space Analyzer
        const request = `GET / HTTP/1.1\r\nHost: localhost:${port}\r\nConnection: close\r\n\r\n`;
        client.write(request);
        
        let response = '';
        client.on('data', (data) => {
          response += data.toString();
        });
        
        client.on('end', () => {
          client.destroy();
          // Check if response contains Space Analyzer indicators or is a valid HTTP response
          const isSpaceAnalyzer = response.includes('Space Analyzer') || 
                                 response.includes('space-analyzer') ||
                                 response.includes('200 OK') ||
                                 response.includes('HTTP/1.1 200 OK') ||
                                 response.includes('<!doctype html>') ||
                                 response.includes('<html');
          resolve(isSpaceAnalyzer);
        });
      });
      
      client.on('timeout', () => {
        client.destroy();
        resolve(false);
      });
      
      client.on('error', () => {
        resolve(false);
      });
      
      client.connect(port, 'localhost');
    });
  }

  /**
   * Load saved port configuration
   */
  loadConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        const config = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        return config;
      }
    } catch (error) {
      console.warn('⚠️  Failed to load port config:', error.message);
    }
    return null;
  }

  /**
   * Save port configuration
   */
  saveConfig(config) {
    try {
      fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2));
      console.log(`💾 Port configuration saved: ${this.configFile}`);
    } catch (error) {
      console.warn('⚠️  Failed to save port config:', error.message);
    }
  }

  /**
   * Get the base URL with detected port
   */
  async getBaseUrl() {
    const port = await this.detectActivePort();
    return `http://localhost:${port}`;
  }

  /**
   * Update all files with hardcoded port references
   */
  async updatePortReferences(newPort) {
    console.log(`🔄 Updating port references to ${newPort}...`);

    const filesToUpdate = this.findFilesWithPortReferences();
    
    for (const filePath of filesToUpdate) {
      try {
        await this.updateFilePortReferences(filePath, newPort);
      } catch (error) {
        console.error(`❌ Failed to update ${filePath}:`, error.message);
      }
    }

    console.log(`✅ Port references updated in ${filesToUpdate.length} files`);
  }

  /**
   * Find all files that contain port references
   */
  findFilesWithPortReferences() {
    const files = [];
    const searchPaths = [
      'integrated-ollama-puppeteer-test.cjs',
      'test-all-features.cjs',
      'capture-dashboard-with-chrome.cjs',
      'capture-dashboard-screenshot.cjs',
      'force-dashboard-screenshot.cjs',
      'test-browser-mcp.js',
      'test-frontend-loading.cjs',
      'test-frontend-integration.cjs',
      'test-complete-flow.cjs',
      'test-real-data-scan.cjs',
      'test-scan.cjs',
      'test-scan-with-timeout.cjs',
      'test-api.cjs',
      'test-server.js',
      'test-health.cjs',
      'test-puppeteer.cjs',
      'test-ollama-vision.cjs',
      'test-ollama-vision-simple.cjs',
      'test-ollama-models.cjs',
      'test-gemini-simple.cjs',
      'test-google-ai.cjs',
      'test-google-ai.mjs',
      'test-llava-simple.cjs',
      'test-ai-directory.cjs',
      'test-analysisbridge-fixes.cjs',
      'test-enhanced-components.cjs',
      'test-fixed-system.cjs',
      'test-polyglot-integration.cjs',
      'test-polyglot-integration.js',
      'test-port-detection.js',
      'test-port-detection-simple.js',
      'test-base64-format.cjs',
      'test-application-with-real-data.cjs',
      'test-sidebar-pages.cjs',
      'test-simple-api.cjs',
      'test-connectivity.js',
      'test-basic-functionality.js',
      'test-react-integration.html',
      'test-react.html',
      'test-frontend.html',
      'test-page.html',
      'browser-ui-test.html',
      'launch-services.js',
      'start-browser-mcp.js',
      'submit-dashboard-to-llava.cjs',
      'get-ux-feedback.cjs',
      'analyze-real-dashboard.cjs',
      'debug-frontend-screenshot.cjs',
      'take-manual-screenshot.cjs',
      'force-dashboard-screenshot.cjs',
      'capture-dashboard-after-wizard.cjs',
      'enhanced-dashboard-analysis-2026-01-22T00-48-46-138Z.txt',
      'dashboard-for-z-ai-2026-01-22T00-35-28-668Z.png',
      'dashboard-for-z-ai-2026-01-22T00-35-51-205Z.png',
      'dashboard-real-content-2026-01-22T00-48-45-304Z.png',
      'debug-dashboard.png',
      'debug-screenshot-2026-01-22T00-18-02-453Z.png',
      'debug-screenshot.png',
      'test-puppeteer.png',
      'dashboard-after-wizard-2026-01-22T00-45-05-048Z.png',
      'screenshot-2026-01-22T00-10-18-684Z.png',
      'initial-load.png',
      'test.html',
      'index.html'
    ];

    for (const relativePath of searchPaths) {
      const fullPath = path.join(__dirname, relativePath);
      if (fs.existsSync(fullPath)) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Update port references in a specific file
   */
  async updateFilePortReferences(filePath, newPort) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Pattern to match localhost URLs with ports
    const portPattern = /localhost:(\d{4})/g;
    
    let updated = false;
    const newContent = content.replace(portPattern, (match, port) => {
      if (port !== newPort) {
        updated = true;
        return `localhost:${newPort}`;
      }
      return match;
    });

    if (updated) {
      fs.writeFileSync(filePath, newContent);
      console.log(`   📝 Updated ${path.basename(filePath)}`);
    }
  }

  /**
   * Clear saved port configuration
   */
  clearConfig() {
    try {
      if (fs.existsSync(this.configFile)) {
        fs.unlinkSync(this.configFile);
        console.log('🗑️  Cleared saved port configuration');
      }
    } catch (error) {
      console.warn('⚠️  Failed to clear port config:', error.message);
    }
  }

  /**
   * Get current port status
   */
  async getStatus() {
    const config = this.loadConfig();
    const detectedPort = await this.detectActivePort();
    
    return {
      savedPort: config ? config.port : null,
      detectedPort,
      isActive: await this.isPortActive(detectedPort),
      lastDetected: config ? config.lastDetected : null
    };
  }
}

// CLI interface
if (require.main === module) {
  const portConfig = new PortConfig();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'detect':
      portConfig.detectActivePort().then(port => {
        console.log(`🎯 Active port: ${port}`);
        process.exit(0);
      }).catch(error => {
        console.error('❌ Detection failed:', error.message);
        process.exit(1);
      });
      break;
      
    case 'update':
      const newPort = process.argv[3];
      if (!newPort) {
        console.error('❌ Usage: node port-config.js update <port>');
        process.exit(1);
      }
      portConfig.updatePortReferences(newPort).then(() => {
        console.log('✅ Port references updated');
        process.exit(0);
      }).catch(error => {
        console.error('❌ Update failed:', error.message);
        process.exit(1);
      });
      break;
      
    case 'status':
      portConfig.getStatus().then(status => {
        console.log('📊 Port Status:');
        console.log(`   Saved Port: ${status.savedPort || 'None'}`);
        console.log(`   Detected Port: ${status.detectedPort}`);
        console.log(`   Is Active: ${status.isActive ? 'Yes' : 'No'}`);
        console.log(`   Last Detected: ${status.lastDetected || 'Never'}`);
        process.exit(0);
      }).catch(error => {
        console.error('❌ Status check failed:', error.message);
        process.exit(1);
      });
      break;
      
    case 'clear':
      portConfig.clearConfig();
      console.log('✅ Configuration cleared');
      process.exit(0);
      break;
      
    default:
      console.log('🚀 Space Analyzer Port Configuration System');
      console.log('');
      console.log('Usage:');
      console.log('  node port-config.js detect     - Detect active port');
      console.log('  node port-config.js update <port> - Update all port references');
      console.log('  node port-config.js status     - Show current status');
      console.log('  node port-config.js clear      - Clear saved configuration');
      console.log('');
      console.log('Examples:');
      console.log('  node port-config.js detect');
      console.log('  node port-config.js update 3006');
      console.log('  node port-config.js status');
      break;
  }
}

module.exports = PortConfig;