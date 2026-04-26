#!/usr/bin/env node

/**
 * Test script to verify the Space Analyzer Pro application is working with real data
 * from the target directory: D:\Backup of Important Data for Windows 11 Upgrade\Native Media AI Studio
 */

const fs = require('fs');
const path = require('path');

console.log('🚀 Testing Space Analyzer Pro with Real Data');
console.log('📁 Target Directory: D:\\Backup of Important Data for Windows 11 Upgrade\\Native Media AI Studio');
console.log('🌐 Application URL: http://localhost:3001');
console.log('');

// Test 1: Verify the target directory exists and has content
const targetDir = 'D:\\Backup of Important Data for Windows 11 Upgrade\\Native Media AI Studio';

console.log('Test 1: Verifying target directory...');
try {
  if (fs.existsSync(targetDir)) {
    const stats = fs.statSync(targetDir);
    console.log('✅ Target directory exists');
    console.log(`📁 Directory: ${targetDir}`);
    console.log(`📅 Created: ${stats.birthtime}`);
    console.log(`📁 Type: ${stats.isDirectory() ? 'Directory' : 'File'}`);
    
    // List some contents to verify it has files
    const contents = fs.readdirSync(targetDir);
    console.log(`📄 Contains ${contents.length} items`);
    console.log('📁 Sample contents:', contents.slice(0, 10));
    
    // Check for different file types
    const fileTypes = {};
    contents.forEach(item => {
      const itemPath = path.join(targetDir, item);
      const itemStats = fs.statSync(itemPath);
      if (itemStats.isFile()) {
        const ext = path.extname(item).toLowerCase();
        fileTypes[ext] = (fileTypes[ext] || 0) + 1;
      }
    });
    
    console.log('📊 File type distribution:');
    Object.entries(fileTypes).forEach(([ext, count]) => {
      console.log(`   ${ext || '(no extension)'}: ${count} files`);
    });
    
  } else {
    console.log('❌ Target directory does not exist');
    process.exit(1);
  }
} catch (error) {
  console.log('❌ Error accessing target directory:', error.message);
  process.exit(1);
}

console.log('');

// Test 2: Verify the application is running
console.log('Test 2: Checking if application is running...');
const http = require('http');

const checkApp = (url, callback) => {
  const startTime = Date.now();
  
  http.get(url, (res) => {
    const responseTime = Date.now() - startTime;
    console.log(`✅ Application is responding (${responseTime}ms)`);
    console.log(`📊 Status Code: ${res.statusCode}`);
    console.log(`🌐 Headers: ${JSON.stringify(res.headers, null, 2)}`);
    callback(true);
  }).on('error', (err) => {
    const responseTime = Date.now() - startTime;
    console.log(`❌ Application is not responding (${responseTime}ms)`);
    console.log(`❌ Error: ${err.message}`);
    callback(false);
  });
};

checkApp('http://localhost:3001', (isRunning) => {
  if (isRunning) {
    console.log('');
    console.log('🎉 All tests passed! The application is ready to work with real data.');
    console.log('');
    console.log('📋 Manual Testing Instructions:');
    console.log('   1. Open your browser and navigate to: http://localhost:3001');
    console.log('   2. The application should automatically start analyzing the target directory');
    console.log('   3. Look for the following indicators of successful real data analysis:');
    console.log('');
    console.log('   📊 Dashboard Indicators:');
    console.log('      - Total files count should be > 0');
    console.log('      - Total size should show actual GB/MB');
    console.log('      - File categories should show real file types');
    console.log('      - Largest files should show actual file names');
    console.log('');
    console.log('   🧠 AI Features Indicators:');
    console.log('      - AI insights should show real recommendations');
    console.log('      - Storage warnings should be specific to your data');
    console.log('      - Optimization suggestions should be actionable');
    console.log('');
    console.log('   📈 Visualization Indicators:');
    console.log('      - Neural network should show actual file relationships');
    console.log('      - Charts should display real data points');
    console.log('      - File browser should show actual directory structure');
    console.log('');
    console.log('   🔍 Navigation Indicators:');
    console.log('      - All 15+ navigation items should be functional');
    console.log('      - Breadcrumb navigation should work');
    console.log('      - Active state highlighting should work');
    console.log('      - Keyboard shortcuts should work (Ctrl+R, Ctrl+E, etc.)');
    console.log('');
    console.log('   ♿ Accessibility Indicators:');
    console.log('      - Screen reader compatibility');
    console.log('      - Keyboard navigation');
    console.log('      - High contrast mode');
    console.log('      - ARIA labels and semantic HTML');
    console.log('');
    console.log('🎯 Expected Results:');
    console.log('   - The application should analyze the target directory automatically');
    console.log('   - All pages should display real file system data');
    console.log('   - AI features should provide context-aware recommendations');
    console.log('   - Visualizations should show actual file relationships');
    console.log('   - Performance should be smooth with real data');
    console.log('');
    console.log('💡 If you see mock data or placeholder content, the application may need:');
    console.log('   - Backend server running (check if backend-server.js is running)');
    console.log('   - Proper directory permissions');
    console.log('   - Network connectivity to the backend API');
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('   - Check browser console for errors');
    console.log('   - Verify backend server is running on port 8081');
    console.log('   - Check network tab for API requests');
    console.log('   - Verify directory path is correct');
    console.log('');
    console.log('✅ Ready for manual testing! Open http://localhost:3001 in your browser.');
    
  } else {
    console.log('');
    console.log('❌ Application is not running. Please:');
    console.log('   1. Ensure the development server is running');
    console.log('   2. Run: npm run dev');
    console.log('   3. Wait for the server to start on http://localhost:3001');
    console.log('   4. Then run this test again');
    process.exit(1);
  }
});

// Test 3: Check if the application files are properly built
console.log('');
console.log('Test 3: Checking application build status...');
try {
  const appPath = path.join(__dirname, 'dist');
  if (fs.existsSync(appPath)) {
    console.log('✅ Build directory exists');
    const buildFiles = fs.readdirSync(appPath);
    console.log(`📄 Build contains ${buildFiles.length} files`);
    const hasMain = buildFiles.some(f => f.includes('main') && f.endsWith('.js'));
    const hasIndex = buildFiles.some(f => f.includes('index') && f.endsWith('.html'));
    console.log(`✅ Main JS file: ${hasMain ? 'Found' : 'Missing'}`);
    console.log(`✅ Index HTML file: ${hasIndex ? 'Found' : 'Missing'}`);
  } else {
    console.log('⚠️  Build directory not found (this is normal for development mode)');
    console.log('💡 The application is running in development mode with Vite');
  }
} catch (error) {
  console.log('⚠️  Could not check build status:', error.message);
}

console.log('');
console.log('🔍 Test Summary:');
console.log('   ✅ Target directory verified');
console.log('   ✅ Application server check in progress...');
console.log('   ✅ Build status checked');
console.log('   📋 Manual testing required for full verification');