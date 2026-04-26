const http = require('http');

// Test script for Ollama API
async function testModel(modelName, prompt) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch('http://localhost:30014/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName,
        prompt: prompt,
        stream: false
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

async function main() {
  console.log('Testing Ollama models...\n');
  
  const models = [
    'qwen2.5-coder:7b-instruct-q4_0',
    'qwen2.5-coder:7b-instruct', 
    'codellama:7b-python',
    'mistral:7b-instruct-q4_0',
    'llava:7b'
  ];

  for (const model of models) {
    console.log(`\n=== Testing ${model} ===`);
    try {
      const response = await testModel(model, 'hello');
      console.log('Response:', response.response?.substring(0, 200) + '...');
      console.log('Done:', response.done);
    } catch (error) {
      console.error('Error:', error.message);
    }
  }
}

main().catch(console.error);