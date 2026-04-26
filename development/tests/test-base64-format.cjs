const fs = require('fs');

async function testBase64Format() {
  console.log('🔍 Testing Base64 Image Format for Ollama...\n');
  
  try {
    const screenshotPath = 'E:\\Self Built Web and Mobile Apps\\Space Analyzer\\debug-screenshot-2026-01-22T00-18-02-453Z.png';
    
    console.log('1. Reading image file...');
    const imageBuffer = fs.readFileSync(screenshotPath);
    console.log(`   📷 Raw image size: ${imageBuffer.length} bytes`);
    
    console.log('\n2. Testing different base64 formats...');
    
    // Format 1: Raw base64 (current method)
    const base64Raw = imageBuffer.toString('base64');
    console.log(`   📊 Raw base64 length: ${base64Raw.length} characters`);
    console.log(`   📊 Raw base64 starts with: ${base64Raw.substring(0, 20)}...`);
    
    // Format 2: With data URI prefix
    const base64WithPrefix = `data:image/png;base64,${base64Raw}`;
    console.log(`   📊 With prefix length: ${base64WithPrefix.length} characters`);
    console.log(`   📊 With prefix starts with: ${base64WithPrefix.substring(0, 30)}...`);
    
    // Test both formats
    console.log('\n3. Testing raw base64 format...');
    await testWithImage(base64Raw, 'Raw Base64');
    
    console.log('\n4. Testing with prefix format...');
    await testWithImage(base64Raw, 'With Prefix'); // Still use raw for API call
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testWithImage(base64Image, formatName) {
  try {
    const response = await fetch('http://localhost:30014/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: "llava:7b",
        messages: [
          {
            role: "user",
            content: "Briefly describe what you see in this image.",
            images: [base64Image]
          }
        ],
        stream: false
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log(`   ✅ ${formatName}: SUCCESS`);
    console.log(`   📝 Response: ${result.message?.content?.substring(0, 100)}...`);
    
  } catch (error) {
    console.log(`   ❌ ${formatName}: FAILED - ${error.message}`);
  }
}

testBase64Format();
