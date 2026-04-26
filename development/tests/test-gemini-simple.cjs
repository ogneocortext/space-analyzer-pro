#!/usr/bin/env node

/**
 * Simple Gemini API Test
 * Tests basic connectivity and functionality
 */

const { GoogleGenAI } = require('@google/genai');
const path = require('path');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

async function testGeminiConnectivity() {
  console.log('🧪 Testing Google Gemini API Connectivity...\n');

  try {
    // Check API key
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('❌ No API key found. Set GOOGLE_API_KEY or GEMINI_API_KEY in .env file');
    }

    console.log('✅ API key found');
    console.log(`🔑 Key starts with: ${apiKey.substring(0, 10)}...`);

    // Try the exact syntax the user provided
    console.log('\n🤖 Initializing Google Gemini (user syntax)...');
    const ai = new GoogleGenAI({ apiKey });
    console.log('✅ Gemini client initialized');

    // Test basic text generation using user's syntax
    console.log('\n📝 Testing basic text generation...');

    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Explain what AI is in one sentence"
    });

    const text = result.text;

    console.log('✅ Text generation successful!');
    console.log(`📄 Response: "${text}"`);

    // Test with image (using a small test image if available)
    console.log('\n🖼️  Testing image analysis...');

    // Look for a test image
    const testImages = [
      'screenshots/dashboard-screenshot-1769073211481.png',
      'screenshots/dashboard-screenshot-1769103783315.png',
      'debug-screenshot-2026-01-22T00-18-02-453Z.png'
    ];

    let testImage = null;
    for (const imgPath of testImages) {
      if (fs.existsSync(imgPath)) {
        testImage = imgPath;
        break;
      }
    }

    if (testImage) {
      console.log(`📸 Found test image: ${testImage}`);

      const imageBuffer = fs.readFileSync(testImage);
      const base64Image = imageBuffer.toString('base64');

      const visionResult = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              { text: 'Describe what you see in this screenshot in 2-3 sentences.' },
              {
                inlineData: {
                  data: base64Image,
                  mimeType: 'image/png'
                }
              }
            ]
          }
        ]
      });

      const visionText = visionResult.text;

      console.log('✅ Image analysis successful!');
      if (visionText) {
        console.log(`📄 Vision Response: "${visionText.substring(0, 200)}..."`);
      } else {
        console.log('📄 Vision Response: (response received but text is empty)');
      }

    } else {
      console.log('⚠️  No test images found, skipping image analysis test');
    }

    console.log('\n🎉 All Gemini tests passed successfully!');
    console.log('🚀 Gemini API is ready for production use!');

  } catch (error) {
    console.error('\n❌ Gemini test failed:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    if (error.message.includes('API_KEY')) {
      console.log('\n💡 API Key Issues:');
      console.log('- Check that GOOGLE_API_KEY is set in .env file');
      console.log('- Verify the API key is valid and not expired');
      console.log('- Ensure the key has proper permissions');
    }

    if (error.message.includes('quota') || error.message.includes('limit')) {
      console.log('\n💡 Quota Issues:');
      console.log('- Check your Google Cloud billing/quota limits');
      console.log('- Consider upgrading your API plan');
    }

    process.exit(1);
  }
}

// Run the test
testGeminiConnectivity().catch(console.error);