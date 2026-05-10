#!/usr/bin/env node

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

class CleanupManager {
  constructor() {
    this.commonPorts = [8080, 8081, 8082, 5173, 5174, 5178, 3000, 4000];
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toLocaleTimeString();
    const colors = {
      INFO: '\x1b[36m',
      WARN: '\x1b[33m',
      ERROR: '\x1b[31m',
      SUCCESS: '\x1b[32m',
      RESET: '\x1b[0m'
    };
    
    console.log(`${colors[level]}[${timestamp}] ${message}${colors.RESET}`);
  }

  async killProcessesOnPorts() {
    this.log('🔍 Checking for processes on common ports...', 'WARN');
    
    const platform = os.platform();
    
    for (const port of this.commonPorts) {
      try {
        if (platform === 'win32') {
          // Windows method
          const { stdout } = await execAsync(`netstat -ano | findstr :${port}`, { timeout: 5000 });
          
          if (stdout) {
            const lines = stdout.split('\n');
            for (const line of lines) {
              if (line.includes(`:${port}`) && line.includes('LISTENING')) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 5) {
                  const pid = parts[parts.length - 1];
                  if (pid && pid !== process.pid.toString()) {
                    this.log(`🔪 Terminating process ${pid} on port ${port}`, 'WARN');
                    
                    try {
                      await execAsync(`taskkill /F /PID ${pid}`, { shell: true });
                      this.log(`✅ Killed process ${pid}`, 'SUCCESS');
                    } catch (killError) {
                      this.log(`⚠️ Could not kill process ${pid}: ${killError.message}`, 'WARN');
                    }
                  }
                }
              }
            }
          }
        } else {
          // Unix method
          try {
            const { stdout } = await execAsync(`lsof -ti:${port}`, { timeout: 3000 });
            
            if (stdout) {
              const pids = stdout.trim().split('\n').filter(line => line.trim());
              for (const pid of pids) {
                if (pid && pid !== process.pid.toString()) {
                  this.log(`🔪 Terminating process ${pid} on port ${port}`, 'WARN');
                  
                  try {
                    await execAsync(`kill -9 ${pid}`, { shell: true });
                    this.log(`✅ Killed process ${pid}`, 'SUCCESS');
                  } catch (killError) {
                    this.log(`⚠️ Could not kill process ${pid}: ${killError.message}`, 'WARN');
                  }
                }
              }
            }
          } catch (lsofError) {
            // Port is not in use, which is fine
          }
        }
      } catch (error) {
        this.log(`⚠️ Error checking port ${port}: ${error.message}`, 'WARN');
      }
    }
  }

  async killNodeProcesses() {
    this.log('🔍 Checking for Node.js processes...', 'WARN');
    
    try {
      const platform = os.platform();
      let command;
      
      if (platform === 'win32') {
        command = 'tasklist /fi "imagename eq node.exe" /fo csv';
      } else {
        command = 'ps aux | grep node | grep -v grep';
      }
      
      const { stdout } = await execAsync(command, { timeout: 5000 });
      
      if (stdout) {
        const lines = stdout.split('\n');
        let killedCount = 0;
        
        for (const line of lines) {
          if (line.includes('node.exe') || line.includes('node')) {
            const parts = platform === 'win32' 
              ? line.split(',') 
              : line.trim().split(/\s+/);
            
            const pid = platform === 'win32' 
              ? (parts[1] && parts[1].replace(/"/g, ''))
              : parts[1];
            
            if (pid && pid !== process.pid.toString()) {
              // Check if it's related to our project
              const isRelated = line.includes('space-analyzer') || 
                               line.includes('vite') || 
                               line.includes('server') ||
                               line.includes('dev');
              
              if (isRelated) {
                this.log(`🔪 Terminating Node.js process ${pid}`, 'WARN');
                
                try {
                  if (platform === 'win32') {
                    await execAsync(`taskkill /F /PID ${pid}`, { shell: true });
                  } else {
                    await execAsync(`kill -9 ${pid}`, { shell: true });
                  }
                  killedCount++;
                  this.log(`✅ Killed Node.js process ${pid}`, 'SUCCESS');
                } catch (killError) {
                  this.log(`⚠️ Could not kill process ${pid}: ${killError.message}`, 'WARN');
                }
              }
            }
          }
        }
        
        if (killedCount > 0) {
          this.log(`✅ Killed ${killedCount} related Node.js processes`, 'SUCCESS');
        } else {
          this.log('ℹ️ No related Node.js processes found', 'INFO');
        }
      }
    } catch (error) {
      this.log(`⚠️ Error checking Node.js processes: ${error.message}`, 'WARN');
    }
  }

  async clearTempFiles() {
    this.log('🧹 Cleaning up temporary files...', 'INFO');
    
    try {
      const platform = os.platform();
      let tempDirs = [];
      
      if (platform === 'win32') {
        tempDirs = [process.env.TEMP, process.env.TMP].filter(Boolean);
      } else {
        tempDirs = ['/tmp', '/var/tmp'];
      }
      
      for (const tempDir of tempDirs) {
        try {
          const { stdout } = await execAsync(`find "${tempDir}" -name "*space-analyzer*" -o -name "*playwright*" 2>/dev/null || echo ""`, { timeout: 5000 });
          
          if (stdout.trim()) {
            const files = stdout.trim().split('\n').filter(line => line.trim());
            
            for (const file of files) {
              try {
                await execAsync(`rm -rf "${file}"`, { shell: true });
                this.log(`🗑️ Removed: ${file}`, 'SUCCESS');
              } catch (removeError) {
                this.log(`⚠️ Could not remove ${file}: ${removeError.message}`, 'WARN');
              }
            }
          }
        } catch (error) {
          // Continue if temp directory doesn't exist or can't be accessed
        }
      }
    } catch (error) {
      this.log(`⚠️ Error cleaning temp files: ${error.message}`, 'WARN');
    }
  }

  async clearNodeModulesCache() {
    this.log('🧹 Cleaning Node.js cache...', 'INFO');
    
    try {
      const { stdout } = await execAsync('npm cache clean --force', { timeout: 10000 });
      this.log('✅ Cleaned npm cache', 'SUCCESS');
    } catch (error) {
      this.log(`⚠️ Error cleaning npm cache: ${error.message}`, 'WARN');
    }
  }

  async waitForProcessesToDie() {
    this.log('⏳ Waiting for processes to terminate...', 'INFO');
    await new Promise(resolve => setTimeout(resolve, 3000));
  }

  async run() {
    console.log('🧹 Space Analyzer Pro - Cleanup Script\n');
    
    try {
      await this.killProcessesOnPorts();
      await this.killNodeProcesses();
      await this.waitForProcessesToDie();
      await this.clearTempFiles();
      await this.clearNodeModulesCache();
      
      console.log('\n✅ Cleanup completed successfully!');
      console.log('\n🚀 Next steps:');
      console.log('   npm run start     - Start all services');
      console.log('   npm run status    - Check service status');
      console.log('   npm run dev       - Start frontend only');
      console.log('   npm run server    - Start backend only');
      
    } catch (error) {
      console.error('\n❌ Cleanup failed:', error.message);
      process.exit(1);
    }
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught error in cleanup:', error.message);
  process.exit(1);
});

// Run cleanup
new CleanupManager().run().catch(console.error);