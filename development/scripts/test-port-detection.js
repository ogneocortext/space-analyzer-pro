#!/usr/bin/env node

/**
 * Test script for dynamic port detection system
 * Verifies that PortDetector can find running services
 */

import { portDetector } from './src/services/PortDetector.js';

async function testPortDetection() {
    console.log('🔍 Testing Dynamic Port Detection System...\n');

    try {
        // Test 1: Detect all servers
        console.log('1. Detecting all servers...');
        const config = await portDetector.detectAllServers();
        console.log('✅ Detection complete:');
        console.log(`   Frontend: ${config.frontend}`);
        console.log(`   Backend:  ${config.backend}`);
        console.log(`   API:      ${config.api}`);
        console.log(`   Detected: ${config.detected ? 'Yes' : 'No'}`);
        console.log(`   Time:     ${new Date(config.timestamp).toLocaleString()}\n`);

        // Test 2: Get specific ports
        console.log('2. Getting specific service ports...');
        console.log(`   Frontend port: ${portDetector.getPort('frontend')}`);
        console.log(`   Backend port:  ${portDetector.getPort('backend')}`);
        console.log(`   API port:      ${portDetector.getPort('api')}\n`);

        // Test 3: Get base URLs
        console.log('3. Getting service base URLs...');
        console.log(`   Frontend URL: ${portDetector.getBaseUrl('frontend')}`);
        console.log(`   Backend URL:  ${portDetector.getBaseUrl('backend')}`);
        console.log(`   API URL:      ${portDetector.getApiBaseUrl()}\n`);

        // Test 4: Check server status
        console.log('4. Checking server status...');
        const status = await portDetector.checkServerStatus();
        console.log(`   Frontend: ${status.frontend.status} (${status.frontend.responseTime}ms)`);
        console.log(`   Backend:  ${status.backend.status} (${status.backend.responseTime}ms)`);
        console.log(`   API:      ${status.api.status} (${status.api.responseTime}ms)\n`);

        // Test 5: Get status summary
        console.log('5. Getting status summary...');
        const summary = await portDetector.getStatusSummary();
        console.log(`   Services detected: ${summary.detected ? 'Yes' : 'No'}`);
        console.log(`   Frontend status:  ${summary.frontend}`);
        console.log(`   Backend status:   ${summary.backend}`);
        console.log(`   API status:       ${summary.api}`);
        console.log(`   Uptime:          ${Math.round(summary.uptime / 1000)}s\n`);

        // Test 6: Refresh detection
        console.log('6. Testing refresh detection...');
        const refreshedConfig = await portDetector.refreshDetection();
        console.log(`✅ Refresh complete - Backend port: ${refreshedConfig.backend}\n`);

        console.log('🎉 All tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    }
}

// Run the test
testPortDetection();