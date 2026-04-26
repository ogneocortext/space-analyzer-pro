const fs = require('fs');
const path = require('path');

async function testOllamaVision() {
  console.log('🤖 Testing Ollama Vision API with screenshot...\n');
  
  try {
    // Use a recent screenshot - find the most recent debug screenshot
    const fs = require('fs');
    const path = require('path');

    let screenshotPath = null;
    try {
      // Look for debug screenshots in current directory
      const files = fs.readdirSync(__dirname).filter(file =>
        file.startsWith('debug-screenshot') && file.endsWith('.png')
      ).sort().reverse(); // Most recent first

      if (files.length > 0) {
        screenshotPath = path.join(__dirname, files[0]);
        console.log(`   📷 Using most recent debug screenshot: ${files[0]}`);
      } else {
        // Fallback to any PNG file
        const pngFiles = fs.readdirSync(__dirname).filter(file =>
          file.endsWith('.png')
        ).sort().reverse();

        if (pngFiles.length > 0) {
          screenshotPath = path.join(__dirname, pngFiles[0]);
          console.log(`   📷 Using fallback screenshot: ${pngFiles[0]}`);
        }
      }
    } catch (error) {
      console.error('Error finding screenshot:', error.message);
    }

    if (!screenshotPath) {
      console.error('❌ No screenshot files found in current directory');
      return;
    }
    
    console.log('1. Reading screenshot file...');
    if (!fs.existsSync(screenshotPath)) {
      console.error('❌ Screenshot file not found:', screenshotPath);
      return;
    }
    
    // Read and encode image
    const imageBuffer = fs.readFileSync(screenshotPath);
    const base64Image = imageBuffer.toString('base64');
    console.log(`   📷 Image size: ${imageBuffer.length} bytes`);
    console.log(`   📷 Base64 length: ${base64Image.length} characters`);
    
    console.log('\n2. Sending to Ollama vision API...');
    
    const requestBody = {
      model: "llava:7b",
      messages: [
        {
          role: "user",
          content: "Analyze this frontend application screenshot. Focus on:\n1. Layout issues and alignment problems\n2. Responsive design problems\n3. UI/UX issues\n4. Broken components or missing elements\n5. Color and typography issues\n6. Navigation problems\n7. Any visual bugs or inconsistencies\n\nProvide specific, actionable feedback for developers to fix these issues.",
          images: [base64Image]
        }
      ],
      stream: false
    };
    
    console.log('   📡 Sending request...');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for vision requests

    const response = await fetch('http://localhost:30014/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    console.log('   ⏳ Waiting for response...');
    const result = await response.json();
    
    console.log('\n🔍 Raw Response:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\n✅ Analysis Results:');
    console.log('='.repeat(50));
    
    // Handle Ollama 14.3 response format
    let content = '';
    if (result.message && result.message.content) {
      // Ollama format
      content = result.message.content;
    } else if (result.choices && result.choices[0] && result.choices[0].message) {
      // OpenAI format (if using v1 endpoint)
      content = result.choices[0].message.content;
    } else {
      content = 'No content found in response';
    }
    
    console.log(content);
    console.log('='.repeat(50));
    
    console.log('\n📊 Response Details:');
    console.log(`Model: ${result.model || 'Unknown'}`);
    console.log(`Created: ${result.created_at || 'Unknown'}`);
    console.log(`Duration: ${result.total_duration || 'Unknown'}ms`);
    console.log(`Done: ${result.done || 'Unknown'}`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Vision analysis failed:', error.message);
    console.error('Stack trace:', error.stack);
    return null;
  }
}

// Run the test
testOllamaVision();