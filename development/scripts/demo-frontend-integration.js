#!/usr/bin/env node

/**
 * Demonstration of how frontend services use dynamic port detection
 * Shows the integration between frontend components and PortDetector
 */

import { portDetector } from './src/services/PortDetector.ts';

async function demonstrateFrontendIntegration() {
    console.log('🌐 Frontend Integration Demo\n');

    // Simulate frontend startup
    console.log('1. Frontend application starting...');
    console.log('   Detecting backend services...\n');

    // Detect servers
    const config = await portDetector.detectAllServers();
    
    console.log('2. Backend services detected:');
    console.log(`   ✓ Backend API: http://localhost:${config.backend}/api`);
    console.log(`   ✓ Health check: http://localhost:${config.backend}/api/health\n`);

    // Simulate different frontend services using the detected ports
    console.log('3. Frontend services initializing with dynamic ports:');
    
    // AnalysisBridge simulation
    console.log('   📊 AnalysisBridge: Connecting to backend...');
    const analysisUrl = portDetector.getApiBaseUrl();
    console.log(`      → ${analysisUrl}`);
    
    // OllamaService simulation  
    console.log('   🤖 OllamaService: Connecting to AI backend...');
    const ollamaUrl = `${portDetector.getBaseUrl('backend')}/api/ollama`;
    console.log(`      → ${ollamaUrl}`);
    
    // AI Context simulation
    console.log('   🧠 AI Context: Checking AI capabilities...');
    const healthUrl = `${portDetector.getApiBaseUrl()}/health`;
    console.log(`      → ${healthUrl}\n`);

    // Simulate API calls
    console.log('4. Testing API connectivity...');
    try {
        const response = await fetch(healthUrl);
        if (response.ok) {
            const health = await response.json();
            console.log('   ✓ Backend health check passed');
            console.log(`   ✓ AI Features: ${health.features?.aiCategorization ? 'Enabled' : 'Disabled'}`);
            console.log(`   ✓ Ollama: ${health.ollama ? 'Available' : 'Not Available'}`);
        }
    } catch (error) {
        console.log('   ❌ Backend health check failed');
    }

    console.log('\n5. Dynamic port benefits:');
    console.log('   ✓ No hardcoded ports in frontend code');
    console.log('   ✓ Automatic detection of running services');
    console.log('   ✓ Seamless development and production environments');
    console.log('   ✓ No need to manually change ports when servers restart');
    
    console.log('\n🎉 Frontend integration demo complete!');
    console.log('\n💡 Usage in your React components:');
    console.log(`
import { portDetector } from '../services/PortDetector';

// In your component or service
const config = await portDetector.detectAllServers();
const apiUrl = portDetector.getApiBaseUrl();

// Make API calls
const response = await fetch(\`\${apiUrl}/health\`);
`);
}

// Run the demonstration
demonstrateFrontendIntegration().catch(console.error);
