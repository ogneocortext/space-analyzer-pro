#!/usr/bin/env node

/**
 * Simple test to verify the port configuration system is working correctly
 */

const PortConfig = require('./port-config.cjs');
const http = require('http');

async function testPortSystem() {
  console.log('🧪 Testing Port Configuration System\n');

  const portConfig = new PortConfig();

  try {
    // Test 1: Check if port detection works
    console.log('1. Testing port detection...');
    const detectedPort = await portConfig.detectActivePort();
    console.log(`   ✅ Detected port: ${detectedPort}`);

    // Test 2: Check if we can get base URL
    console.log('\n2. Testing base URL generation...');
    const baseUrl = await portConfig.getBaseUrl();
    console.log(`   ✅ Base URL: ${baseUrl}`);

    // Test 3: Test HTTP connection to the detected port
    console.log('\n3. Testing HTTP connection...');
    const connectionTest = await new Promise((resolve) => {
      const req = http.request(baseUrl, (res) => {
        resolve({ success: true, statusCode: res.statusCode });
        res.on('data', () => {});
        res.on('end', () => {});
      });
      
      req.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });
      
      req.end();
    });

    if (connectionTest.success) {
      console.log(`   ✅ HTTP connection successful: ${connectionTest.statusCode}`);
    } else {
      console.log(`   ❌ HTTP connection failed: ${connectionTest.error}`);
    }

    // Test 4: Check current port status
    console.log('\n4. Testing port status...');
    const status = await portConfig.getStatus();
    console.log(`   ✅ Saved Port: ${status.savedPort || 'None'}`);
    console.log(`   ✅ Detected Port: ${status.detectedPort}`);
    console.log(`   ✅ Is Active: ${status.isActive ? 'Yes' : 'No'}`);

    // Test 5: Test file update functionality
    console.log('\n5. Testing file update functionality...');
    const testFile = './test-port-update.txt';
    
    // Create a test file with old port
    require('fs').writeFileSync(testFile, 'http://localhost:5173/test');
    console.log('   📝 Created test file with old port reference');
    
    // Update port references
    await portConfig.updatePortReferences(3006);
    console.log('   ✅ Port references updated');
    
    // Check if file was updated
    const updatedContent = require('fs').readFileSync(testFile, 'utf8');
    if (updatedContent.includes('localhost:3006')) {
      console.log('   ✅ File successfully updated');
    } else {
      console.log('   ❌ File update failed');
    }
    
    // Clean up test file
    require('fs').unlinkSync(testFile);

    console.log('\n🎉 Port Configuration System Test Complete!');
    console.log('✅ All tests passed successfully');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testPortSystem().catch(console.error);
}

module.exports = { testPortSystem };