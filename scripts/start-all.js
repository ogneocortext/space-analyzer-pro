import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting Space Analyzer Pro - Integrated Services...\n');

// Set environment variables to coordinate logging
process.env.SA_MASTER_PROCESS = 'true';

// Start backend server with SA_QUIET to prevent duplicate logs
// The master process or the first service will handle the main reporting
const backend = spawn('npm', ['run', 'server:dev'], {
  shell: true,
  stdio: 'inherit',
  env: { ...process.env, SA_QUIET: 'true' }
});

// Start frontend dev server
// Frontend (Vite) will log the config once since it's the primary entry
const frontend = spawn('npm', ['run', 'dev:no-browser'], {
  shell: true,
  stdio: 'inherit'
});

// Handle shutdown
const cleanup = () => {
  console.log('\n🛑 Shutting down services...');
  backend.kill('SIGINT');
  frontend.kill('SIGINT');
  setTimeout(() => process.exit(0), 1000);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

console.log('✅ Services initiated');
console.log('   Monitoring logs below...\n');
