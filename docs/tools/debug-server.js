#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PROJECT_ROOT = "e:/Self Built Web and Mobile Apps/Space Analyzer";
const LOG_DIR = path.join(PROJECT_ROOT, "debug_logs");
const ELECTRON_DIR = path.join(PROJECT_ROOT, "space_analyzer_electron");
const JS_DIR = path.join(PROJECT_ROOT, "space_analyzer_js");

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

function createLogFile(component) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(LOG_DIR, `${component}_${timestamp}.log`);
  fs.writeFileSync(logFile, `# Space Analyzer Debug Log - ${component}\nStarted: ${new Date().toISOString()}\nHost: ${os.hostname()}\nPID: ${process.pid}\n\n`);
  return logFile;
}

function appendToLog(logFile, message, level = 'info') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
  try {
    fs.appendFileSync(logFile, logEntry);
  } catch (err) {
    console.error(`Failed to write to log: ${err.message}`);
  }
  console.log(`[${path.basename(logFile, '.log').toUpperCase()}] ${message}`);
}

function getSystemInfo() {
  const info = {
    timestamp: new Date().toISOString(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    cpuCount: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    homeDir: os.homedir(),
    tmpDir: os.tmpdir()
  };
  return info;
}

function launchJavaScriptAnalyzer() {
  const logFile = createLogFile('javascript');
  const systemInfo = getSystemInfo();
  appendToLog(logFile, `System Info: ${JSON.stringify(systemInfo, null, 2)}`, 'info');
  appendToLog(logFile, '🚀 Starting JavaScript Space Analyzer with comprehensive logging', 'info');
  
  try {
    const nodeProcess = spawn('node', ['index.js', '.'], {
      cwd: JS_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        SPACE_ANALYZER_DEBUG: 'true',
        NODE_OPTIONS: '--max-old-space-size=4096'
      }
    });

    appendToLog(logFile, `JavaScript process spawned with PID: ${nodeProcess.pid}`, 'info');

    let outputBuffer = '';
    let errorBuffer = '';

    nodeProcess.stdout.on('data', (data) => {
      const output = data.toString();
      outputBuffer += output;
      appendToLog(logFile, `STDOUT: ${output}`, 'info');
    });

    nodeProcess.stderr.on('data', (data) => {
      const error = data.toString();
      errorBuffer += error;
      appendToLog(logFile, `STDERR: ${error}`, 'error');
    });

    nodeProcess.on('close', (code) => {
      appendToLog(logFile, `JavaScript process completed with exit code: ${code}`, 'info');
      appendToLog(logFile, `Total output length: ${outputBuffer.length} characters`, 'info');
      appendToLog(logFile, `Total error length: ${errorBuffer.length} characters`, 'info');
      
      // Save final summary
      const summary = {
        exitCode: code,
        outputLength: outputBuffer.length,
        errorLength: errorBuffer.length,
        duration: Date.now() - fs.statSync(logFile).ctime.getTime(),
        timestamp: new Date().toISOString()
      };
      appendToLog(logFile, `Process Summary: ${JSON.stringify(summary, null, 2)}`, 'info');
    });

    nodeProcess.on('error', (err) => {
      appendToLog(logFile, `JavaScript process error: ${err.message}`, 'error');
      appendToLog(logFile, `Error code: ${err.code}`, 'error');
      appendToLog(logFile, `Error signal: ${err.signal}`, 'error');
    });

    return { 
      pid: nodeProcess.pid, 
      logFile, 
      process: nodeProcess,
      command: `node index.js .`,
      directory: JS_DIR
    };

  } catch (error) {
    appendToLog(logFile, `Failed to launch JavaScript analyzer: ${error.message}`, 'error');
    return null;
  }
}

function launchElectronApp() {
  const logFile = createLogFile('electron');
  const systemInfo = getSystemInfo();
  appendToLog(logFile, `System Info: ${JSON.stringify(systemInfo, null, 2)}`, 'info');
  appendToLog(logFile, '🚀 Starting Electron Space Analyzer with comprehensive logging', 'info');
  
  try {
    // Check dependencies first
    const packageJsonPath = path.join(ELECTRON_DIR, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      appendToLog(logFile, `❌ package.json not found in ${ELECTRON_DIR}`, 'error');
      return null;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    appendToLog(logFile, `Electron package: ${packageJson.name} v${packageJson.version}`, 'info');

    // Check node_modules
    const nodeModules = path.join(ELECTRON_DIR, 'node_modules');
    const electronExists = fs.existsSync(path.join(nodeModules, 'electron'));
    
    appendToLog(logFile, `node_modules exists: ${fs.existsSync(nodeModules)}`, 'info');
    appendToLog(logFile, `Electron module exists: ${electronExists}`, 'info');

    if (!electronExists) {
      appendToLog(logFile, '⚠️ Electron module not found, running npm install...', 'warn');
      
      const installProcess = spawn('npm', ['install'], {
        cwd: ELECTRON_DIR,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      appendToLog(logFile, `npm install process started with PID: ${installProcess.pid}`, 'info');

      installProcess.stdout.on('data', (data) => {
        appendToLog(logFile, `NPM INSTALL: ${data.toString()}`, 'info');
      });

      installProcess.stderr.on('data', (data) => {
        appendToLog(logFile, `NPM INSTALL ERROR: ${data.toString()}`, 'error');
      });

      installProcess.on('close', (code) => {
        appendToLog(logFile, `npm install completed with code: ${code}`, 'info');
        if (code === 0) {
          appendToLog(logFile, '✅ npm install successful, launching Electron', 'info');
          startElectronApp(logFile);
        } else {
          appendToLog(logFile, `❌ npm install failed with code: ${code}`, 'error');
        }
      });

      return { pid: installProcess.pid, logFile, process: installProcess, type: 'install' };
    } else {
      return startElectronApp(logFile);
    }

  } catch (error) {
    appendToLog(logFile, `Failed to prepare Electron: ${error.message}`, 'error');
    return null;
  }
}

function startElectronApp(logFile) {
  try {
    const electronProcess = spawn('npx', ['electron', 'main.js'], {
      cwd: ELECTRON_DIR,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        SPACE_ANALYZER_DEBUG: 'true',
        ELECTRON_ENABLE_LOGGING: 'true',
        DEBUG: 'electron:*'
      }
    });

    appendToLog(logFile, `Electron process spawned with PID: ${electronProcess.pid}`, 'info');
    appendToLog(logFile, `Working directory: ${ELECTRON_DIR}`, 'info');
    appendToLog(logFile, `Command: npx electron main.js`, 'info');

    let outputBuffer = '';
    let errorBuffer = '';

    electronProcess.stdout.on('data', (data) => {
      const output = data.toString();
      outputBuffer += output;
      appendToLog(logFile, `ELECTRON STDOUT: ${output}`, 'info');
    });

    electronProcess.stderr.on('data', (data) => {
      const error = data.toString();
      errorBuffer += error;
      appendToLog(logFile, `ELECTRON STDERR: ${error}`, 'error');
    });

    electronProcess.on('close', (code) => {
      appendToLog(logFile, `Electron process completed with exit code: ${code}`, 'info');
      appendToLog(logFile, `Total output length: ${outputBuffer.length} characters`, 'info');
      appendToLog(logFile, `Total error length: ${errorBuffer.length} characters`, 'info');
      
      // Save final summary
      const summary = {
        exitCode: code,
        outputLength: outputBuffer.length,
        errorLength: errorBuffer.length,
        timestamp: new Date().toISOString()
      };
      appendToLog(logFile, `Process Summary: ${JSON.stringify(summary, null, 2)}`, 'info');
    });

    electronProcess.on('error', (err) => {
      appendToLog(logFile, `Electron process error: ${err.message}`, 'error');
      appendToLog(logFile, `Error code: ${err.code}`, 'error');
      appendToLog(logFile, `Error signal: ${err.signal}`, 'error');
    });

    return { 
      pid: electronProcess.pid, 
      logFile, 
      process: electronProcess,
      command: 'npx electron main.js',
      directory: ELECTRON_DIR,
      type: 'electron'
    };

  } catch (error) {
    appendToLog(logFile, `Failed to start Electron: ${error.message}`, 'error');
    return null;
  }
}

function analyzeLogs(component) {
  try {
    const logFiles = fs.readdirSync(LOG_DIR).filter(file => file.endsWith('.log'));
    const relevantLogs = component ? 
      logFiles.filter(file => file.includes(component)) : logFiles;

    if (relevantLogs.length === 0) {
      return `📋 No ${component || ''} logs found`;
    }

    let totalContent = '';
    relevantLogs.forEach(file => {
      try {
        const filePath = path.join(LOG_DIR, file);
        const stats = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        totalContent += `\n## ${file} (${stats.size} bytes, modified: ${stats.mtime.toISOString()})\n`;
        totalContent += content;
        totalContent += '\n' + '='.repeat(80) + '\n';
      } catch (err) {
        totalContent += `\n## ${file} (ERROR READING: ${err.message})\n`;
      }
    });

    return `📋 Debug Logs Analysis\nComponent: ${component || 'all'}\nFound ${relevantLogs.length} log file(s)\n\n${totalContent}`;
  } catch (error) {
    return `❌ Log analysis error: ${error.message}`;
  }
}

function listActiveProcesses() {
  try {
    const processes = spawn('tasklist', ['/FI', 'IMAGENAME eq node.exe', '/FO', 'CSV'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    processes.stdout.on('data', (data) => {
      output += data.toString();
    });

    processes.on('close', () => {
      console.log('🖥️ Active Node.js processes:');
      console.log(output);
    });

  } catch (error) {
    console.log(`❌ Could not list processes: ${error.message}`);
  }
}

function cleanup() {
  console.log('\n🧹 Cleaning up debug server...');
  console.log(`📁 Logs saved to: ${LOG_DIR}`);
  process.exit(0);
}

// Set up signal handlers
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Command line interface
const args = process.argv.slice(2);
const command = args[0];

console.log(`
🔧 Space Analyzer Debug Server
==============================`);
console.log(`Project Root: ${PROJECT_ROOT}`);
console.log(`Log Directory: ${LOG_DIR}`);
console.log(`Electron Dir: ${ELECTRON_DIR}`);
console.log(`JavaScript Dir: ${JS_DIR}`);
console.log(`Node Version: ${process.version}`);
console.log('');

switch (command) {
  case 'launch-js': {
    console.log('🚀 Launching JavaScript Space Analyzer with comprehensive logging...');
    const jsProcess = launchJavaScriptAnalyzer();
    if (jsProcess) {
      console.log(`✅ JavaScript process started successfully`);
      console.log(`   PID: ${jsProcess.pid}`);
      console.log(`   Log: ${jsProcess.logFile}`);
      console.log(`   Dir: ${jsProcess.directory}`);
      console.log(`   Cmd: ${jsProcess.command}`);
      console.log('\n📝 Monitoring output in real-time...');
      console.log('Press Ctrl+C to stop and view logs');
    } else {
      console.log('❌ Failed to start JavaScript process');
    }
    break;
  }

  case 'launch-electron': {
    console.log('🚀 Launching Electron Space Analyzer with comprehensive logging...');
    const electronProcess = launchElectronApp();
    if (electronProcess) {
      console.log(`✅ ${electronProcess.type} process started successfully`);
      console.log(`   PID: ${electronProcess.pid}`);
      console.log(`   Log: ${electronProcess.logFile}`);
      console.log(`   Dir: ${electronProcess.directory}`);
      console.log(`   Cmd: ${electronProcess.command}`);
      console.log('\n📝 Monitoring output in real-time...');
      console.log('Press Ctrl+C to stop and view logs');
    } else {
      console.log('❌ Failed to start Electron process');
    }
    break;
  }

  case 'logs': {
    const component = args[1];
    console.log(analyzeLogs(component));
    break;
  }

  case 'processes':
    listActiveProcesses();
    break;

  case 'info':
    console.log('📊 System Information:');
    console.log(JSON.stringify(getSystemInfo(), null, 2));
    break;

  default:
    console.log(`
🔧 Space Analyzer Debug Server

Usage:
  node debug-server.js launch-js       - Launch JavaScript analyzer with logging
  node debug-server.js launch-electron - Launch Electron app with logging
  node debug-server.js logs [component] - Analyze recent logs
  node debug-server.js processes       - List active Node.js processes
  node debug-server.js info            - Show system information

Components: javascript, electron
Examples:
  node debug-server.js launch-js
  node debug-server.js logs electron
  node debug-server.js logs javascript
    `);
}