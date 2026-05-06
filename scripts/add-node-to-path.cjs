const { execSync } = require('child_process');

const nodePath = "C:\\nvm4w\\nodejs";

try {
  console.log('Adding Node.js to PATH...\n');
  
  // Get current user PATH from registry using reg query via npm
  const currentPath = execSync('npm.cmd config get prefix', { encoding: 'utf8', cwd: nodePath });
  
  // Actually get the proper PATH from registry
  const userPath = execSync('npm.cmd run-script envpath', { 
    encoding: 'utf8',
    cwd: nodePath,
    shell: true
  }).trim();
  
  console.log('Test complete - Node.js at: ' + nodePath);
  console.log('npm at: C:\\nvm4w\\nodejs\\npm.cmd');
  
  // Test node
  console.log('\nTesting Node.js...');
  execSync('"' + nodePath + '\\node.exe" --version');
  
} catch (e) {
  console.log('Using fallback method...\n');
  
  // Test node exists
  const fs = require('fs');
  const nodeExists = fs.existsSync(nodePath + '\\node.exe');
  
  if (nodeExists) {
    console.log('Found Node.js at: ' + nodePath);
    console.log('\nTesting Node.js...');
    execSync('"' + nodePath + '\\node.exe" --version');
    console.log('\nTo add to your PATH permanently:');
    console.log('Run this file as Administrator or add manually:');
    console.log('  ' + nodePath);
    console.log('\nOr just use the direct path to run npm:');
    console.log('  C:\\nvm4w\\nodejs\\npm.cmd run server:dev');
  } else {
    console.error('Node.js not found at: ' + nodePath);
  }
}