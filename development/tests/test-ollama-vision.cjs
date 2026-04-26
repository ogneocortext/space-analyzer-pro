const http = require('http');
const fs = require('fs');

// Test Ollama vision API
async function testOllamaVision() {
  console.log('🤖 Testing Ollama Vision API...\n');
  
  try {
    // Check if Ollama is running
    console.log('1. Checking Ollama connection...');
    const response = await fetch('http://localhost:30014/api/tags');
    
    if (!response.ok) {
      throw new Error(`Ollama not accessible: ${response.status}`);
    }
    
    const models = await response.json();
    console.log('✅ Ollama is accessible');
    console.log('Available models:', models.models?.map(m => m.name).join(', ') || 'None');
    
    // Check if llava is available (vision model)
    const hasLlava = models.models?.some(m => m.name.includes('llava'));
    if (!hasLlava) {
      console.log('⚠️ llava model not found. Vision analysis may not work.');
      console.log('Available models:', models.models?.map(m => m.name).join(', ') || 'None');
    } else {
      console.log('✅ llava model found - vision capabilities available');
    }
    
    console.log('\n2. Testing vision API with a simple prompt...');
    
    // Test with a simple text prompt first
    const testResponse = await fetch('http://localhost:30014/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llava:7b',
        messages: [
          {
            role: 'user',
            content: 'Hello! Can you help me analyze frontend screenshots for UI/UX issues?'
          }
        ],
        stream: false
      })
    });
    
    if (!testResponse.ok) {
      throw new Error(`Vision API test failed: ${testResponse.status}`);
    }
    
    const testResult = await testResponse.json();
    console.log('✅ Vision API is working');
    console.log('Test response:', testResult.message?.content?.substring(0, 100) + '...');
    
    console.log('\n3. Ready for frontend analysis!');
    console.log('Run: node frontend-visual-analyzer.cjs');
    
  } catch (error) {
    console.error('❌ Ollama Vision API test failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Ensure Ollama is running: ollama serve');
    console.log('2. Ensure llava model is available: ollama pull llava:7b');
    console.log('3. Check Ollama is accessible on http://localhost:30014');
  }
}

// Test if we can take a screenshot
async function testScreenshotCapability() {
  console.log('\n📸 Testing screenshot capability...\n');
  
  try {
    // Try to require puppeteer
    require('puppeteer');
    console.log('✅ Puppeteer available - can take high-quality screenshots');
  } catch (error) {
    console.log('⚠️ Puppeteer not available - will use fallback screenshot methods');
    console.log('Install with: npm install puppeteer');
  }
}

// Run tests
async function runTests() {
  await testOllamaVision();
  await testScreenshotCapability();
}

if (require.main === module) {
  runTests();
}

module.exports = { testOllamaVision, testScreenshotCapability };
