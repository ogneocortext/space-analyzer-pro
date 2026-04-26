#!/usr/bin/env node

import { spawn } from 'child_process';
import path from 'path';

console.log('🧪 Testing Browser MCP Server...');

// Try to start the browser MCP server with a custom port
const browserMCP = spawn('npx', ['@browsermcp/mcp@latest'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    // Try to set a custom port via environment variable
    BROWSER_MCP_PORT: '9010'
  }
});

browserMCP.on('error', (error) => {
  console.error('❌ Browser MCP Server failed to start:', error);
  process.exit(1);
});

browserMCP.on('close', (code) => {
  console.log(`Browser MCP Server exited with code ${code}`);
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Browser MCP Server...');
  browserMCP.kill('SIGTERM');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down Browser MCP Server...');
  browserMCP.kill('SIGTERM');
});

console.log('✅ Browser MCP Server test started successfully!');
console.log('📡 Server should be available on port 9010');