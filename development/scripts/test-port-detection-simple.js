#!/usr/bin/env node

/**
 * Simple test to verify dynamic port detection works
 * Tests the core functionality without complex startup
 */

console.log('🔧 Testing Dynamic Port Detection System...\n');

// Test 1: Import PortDetector
try {
    console.log('1. Testing PortDetector import...');
    const { portDetector } = await import('./src/services/PortDetector.js');
    console.log('✅ PortDetector imported successfully\n');
    
    // Test 2: Basic detection
    console.log('2. Testing server detection...');
    const config = await portDetector.detectAllServers();
    console.log('✅ Detection completed:');
    console.log(`   Frontend: ${config.frontend}`);
    console.log(`   Backend:  ${config.backend}`);
    console.log(`   API:      ${config.api}\n`);
    
    // Test 3: URL generation
    console.log('3. Testing URL generation...');
    const frontendUrl = portDetector.getBaseUrl('frontend');
    const backendUrl = portDetector.getBaseUrl('backend');
    const apiUrl = portDetector.getApiBaseUrl();
    
    console.log(`   Frontend URL: ${frontendUrl}`);
    console.log(`   Backend URL:  ${backendUrl}`);
    console.log(`   API URL:      ${apiUrl}\n`);
    
    // Test 4: Check if backend is actually running
    console.log('4. Testing backend connectivity...');
    try {
        const response = await fetch(`${backendUrl}/api/health`, { 
            signal: AbortSignal.timeout(3000) 
        });
        if (response.ok) {
            const health = await response.json();
            console.log('✅ Backend is running and healthy');
            console.log(`   Status: ${health.status}`);
            console.log(`   Server: ${health.server || 'unknown'}`);
        } else {
            console.log('⚠️ Backend responded but not healthy');
        }
    } catch (error) {
        console.log('❌ Backend not accessible');
        console.log(`   Error: ${error.message}`);
    }
    
    console.log('\n🎉 Dynamic Port Detection Test Complete!');
    console.log('\n💡 Next steps:');
    console.log('   1. Start backend: npm run server');
    console.log('   2. Start frontend: npm run dev');
    console.log('   3. Both will auto-detect each other\'s ports');
    
} catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
}