#!/usr/bin/env node

/**
 * Test script for Google AI Service
 * Tests the fixed Google SDK implementation
 */

const fs = require('fs');
const path = require('path');

// Simple test without TypeScript compilation
console.log('🧪 Testing Google AI Implementation\n');

async function testGoogleAIImplementation() {
  try {
    // Test 1: Check if @google/genai is properly installed
    console.log('1️⃣ Testing @google/genai import...');
    const { GoogleGenAI } = require('@google/genai');
    console.log('✅ @google/genai imported successfully');

    // Test 2: Check API key
    console.log('2️⃣ Checking API key configuration...');
    const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.log('❌ No API key found');
      console.log('💡 Set GOOGLE_API_KEY or GEMINI_API_KEY environment variable');
      return;
    }

    if (!apiKey.startsWith('AIza') || apiKey.length < 30) {
      console.log('❌ Invalid API key format');
      return;
    }

    console.log('✅ API key found and format looks valid');

    // Test 3: Initialize client
    console.log('3️⃣ Testing client initialization...');
    const genAI = new GoogleGenAI({ apiKey });
    console.log('✅ Client initialized successfully');

    // Test 4: List available models
    console.log('4️⃣ Testing model listing...');
    try {
      const models = await genAI.models.list();
      console.log('✅ Available models:');
      console.log('Models response:', JSON.stringify(models, null, 2));
    } catch (error) {
      console.log('⚠️ Could not list models:', error.message);
    }

    // Test 5: Simple text generation
    console.log('5️⃣ Testing text generation...');
    const startTime = Date.now();
    
    // Use the correct current model name and API structure
    console.log('Using model: gemini-2.0-flash');
    
    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: 'What is 2 + 2? Answer with just the number.'
    });
    
    const text = result.text;
    const processingTime = Date.now() - startTime;

    if (text && text.trim().length > 0) {
      console.log('✅ Text generation successful');
      console.log('Response:', text.trim());
      console.log('Processing time:', processingTime, 'ms');
    } else {
      console.log('❌ Empty response received');
    }

    console.log('\n🎉 Google AI implementation test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('API key')) {
      console.log('\n💡 API Key Setup:');
      console.log('1. Get API key: https://aistudio.google.com/apikey');
      console.log('2. Set environment: set GOOGLE_API_KEY=your_key_here (Windows)');
      console.log('3. Or create .env file with GOOGLE_API_KEY=your_key_here');
    } else if (error.message.includes('quota') || error.message.includes('billing')) {
      console.log('\n💡 Quota/Billing Issue:');
      console.log('Check your Google AI Studio quota and billing settings');
    } else if (error.message.includes('model')) {
      console.log('\n💡 Model Issue:');
      console.log('The model might not be available. Try gemini-1.5-flash instead');
    }
  }
}

// Run tests
testGoogleAIImplementation().catch(console.error);
