#!/usr/bin/env node

/**
 * Test script for Google AI Service
 * Tests the fixed Google SDK implementation
 */

import fs from 'fs';
import path from 'path';
import { GoogleAIService } from './src/services/GoogleAIService.ts';

console.log('🧪 Testing Google AI Service Implementation\n');

async function testGoogleAI() {
  const googleAI = GoogleAIService.getInstance();

  try {
    // Test 1: Initialize service
    console.log('1️⃣ Testing service initialization...');
    await googleAI.initialize();
    console.log('✅ Service initialized successfully\n');

    // Test 2: Check status
    console.log('2️⃣ Checking service status...');
    const status = googleAI.getStatus();
    console.log('Status:', status);
    console.log('✅ Status check completed\n');

    // Test 3: Text generation
    console.log('3️⃣ Testing text generation...');
    const textResult = await googleAI.generateText(
      'Explain the benefits of using TypeScript in web development in 2-3 sentences.'
    );
    
    if (textResult.success) {
      console.log('✅ Text generation successful');
      console.log('Response length:', textResult.content?.length, 'characters');
      console.log('Processing time:', textResult.metadata?.processingTime, 'ms\n');
    } else {
      console.log('❌ Text generation failed:', textResult.error);
    }

    // Test 4: Image analysis (if test image exists)
    const testImagePath = './test-screenshot.png';
    if (fs.existsSync(testImagePath)) {
      console.log('4️⃣ Testing image analysis...');
      const imageBuffer = fs.readFileSync(testImagePath);
      const imageResult = await googleAI.analyzeImage(
        imageBuffer,
        'Describe what you see in this screenshot of a web application.'
      );
      
      if (imageResult.success) {
        console.log('✅ Image analysis successful');
        console.log('Response length:', imageResult.content?.length, 'characters');
        console.log('Processing time:', imageResult.metadata?.processingTime, 'ms\n');
      } else {
        console.log('❌ Image analysis failed:', imageResult.error);
      }
    } else {
      console.log('4️⃣ Skipping image analysis test (no test image found)\n');
    }

    // Test 5: Error handling
    console.log('5️⃣ Testing error handling...');
    const errorResult = await googleAI.generateText('');
    if (!errorResult.success) {
      console.log('✅ Error handling working correctly');
      console.log('Error message:', errorResult.error);
    } else {
      console.log('❌ Error handling test failed');
    }

    console.log('\n🎉 Google AI Service tests completed!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('API key')) {
      console.log('\n💡 To fix this issue:');
      console.log('1. Get an API key from https://aistudio.google.com/apikey');
      console.log('2. Set environment variable: export GOOGLE_API_KEY=your_key_here');
      console.log('3. Or create a .env file with the key');
    }
  }
}

// Run tests
testGoogleAI().catch(console.error);
