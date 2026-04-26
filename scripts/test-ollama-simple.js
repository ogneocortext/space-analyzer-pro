const EnhancedOllamaService = require('./server/EnhancedOllamaService.js');

async function testOllama() {
  try {
    console.log('🧪 Testing EnhancedOllamaService...');
    
    const ollama = new EnhancedOllamaService();
    
    // Test if service is available
    console.log('📊 Service available:', ollama.isServiceAvailable());
    
    // Test fetch models
    console.log('📚 Fetching models...');
    const models = await ollama.fetchModels();
    console.log('📚 Models loaded:', models.length);
    
    // Test generate
    console.log('🤖 Testing generate...');
    const response = await ollama.generate('Hello, this is a test message', 'deepseek-coder:6.7b');
    console.log('✅ Generate response:', response.response ? response.response.substring(0, 100) + '...' : 'No response');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

testOllama();
