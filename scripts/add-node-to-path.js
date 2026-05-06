const { execSync } = require('child_process');

const nodePath = "C:\\nvm4w\\nodejs";

try {
  console.log('Adding Node.js to PATH...\n');
  
  // Get current user PATH from registry
  const currentPath = execSync('reg query "HKCU\\Environment" /v Path', { encoding: 'utf8' });
  const pathMatch = currentPath.match(/Path\s+REG_EXPAND_SZ\s+(.+)/);
  let userPath = pathMatch ? pathMatch[1].trim() : '';
  
  console.log('Current PATH:\n' + userPath + '\n');
  
  // Check if already in PATH
  if (userPath.includes(nodePath)) {
    console.log('Node.js is already in your PATH.\n');
  } else {
    // Add to PATH
    const newPath = userPath + ';' + nodePath;
    execSync('setx PATH "' + newPath + '"', { stdio: 'inherit' });
    console.log('\nSUCCESS: Added Node.js to PATH');
    console.log('IMPORTANT: Restart your terminal/IDE, then run: npm run server:dev\n');
  }
  
  // Test node
  console.log('Testing Node.js...');
  execSync('"' + nodePath + '\\node.exe" --version');
  
} catch (e) {
  console.error('Error:', e.message);
}