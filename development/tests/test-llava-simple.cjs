const fs = require('fs');
const path = require('path');

async function testLlavaSimple() {
  console.log('🤖 Testing LLaVA with simple image analysis...\n');
  
  try {
    // Find the most recent screenshot
    let screenshotPath = null;
    try {
      const files = fs.readdirSync(__dirname).filter(file =>
        file.endsWith('.png') && (file.includes('debug') || file.includes('screenshot') || file.includes('dashboard'))
      ).sort().reverse();

      if (files.length > 0) {
        screenshotPath = path.join(__dirname, files[0]);
        console.log(`   📷 Using screenshot: ${files[0]}`);
      }
    } catch (error) {
      console.error('Error finding screenshot:', error.message);
    }

    if (!screenshotPath) {
      console.error('❌ No screenshot files found');
      return;
    }
    
    console.log('1. Reading and encoding image...');
    const imageBuffer = fs.readFileSync(screenshotPath);
    const base64Image = imageBuffer.toString('base64');
    console.log(`   📷 Image size: ${imageBuffer.length} bytes`);
    
    console.log('\n2. Testing with simple prompt...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

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
            content: "What do you see in this image? Describe the main elements.",
            images: [base64Image]
          }
        ],
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    console.log('\n✅ Simple Analysis Results:');
    console.log('='.repeat(50));
    console.log(result.message?.content || 'No content');
    console.log('='.repeat(50));
    
    // Try with a different model if available
    console.log('\n3. Checking available models...');
    const modelsResponse = await fetch('http://localhost:30014/api/tags');
    const models = await modelsResponse.json();
    
    const visionModels = models.models?.filter(m => 
      m.name.includes('llava') || 
      m.name.includes('vision') || 
      m.name.includes('llama') && m.name.includes('vision')
    );
    
    console.log('Available vision models:');
    if (visionModels.length > 0) {
      visionModels.forEach(model => {
        console.log(`  - ${model.name}`);
      });
    } else {
      console.log('  No vision models found');
      console.log('  Available models:', models.models?.map(m => m.name).join(', ') || 'None');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testLlavaSimple();