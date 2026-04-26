// Test file for Modern Space Analyzer with AI features
const { AIService } = require('./src/services/AIService');

// Mock file data for testing
const mockFiles = [
  {
    path: 'src/components/Button.tsx',
    size: 2048,
    type: 'tsx',
    content: `
import React from 'react';
import { ButtonProps } from './types';

export const Button: React.FC<ButtonProps> = ({ children, onClick, variant = 'primary' }) => {
  return (
    <button 
      className={\`btn btn-\${variant}\`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
`
  },
  {
    path: 'src/utils/api.ts',
    size: 1024,
    type: 'ts',
    content: `
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.API_URL,
  timeout: 10000,
});

export const fetchData = async (endpoint: string) => {
  try {
    const response = await api.get(endpoint);
    return response.data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};
`
  },
  {
    path: 'src/hooks/useAuth.ts',
    size: 1536,
    type: 'ts',
    content: `
import { useState, useEffect } from 'react';
import { auth } from '../firebase';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return { user, loading };
};
`
  },
  {
    path: 'src/styles/globals.css',
    size: 4096,
    type: 'css',
    content: `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}
`
  },
  {
    path: 'package.json',
    size: 512,
    type: 'json',
    content: `
{
  "name": "modern-app",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.0.0",
    "axios": "^1.0.0",
    "typescript": "^4.0.0"
  },
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test"
  }
}
`
  }
];

// Test the AI service
async function testAIService() {
  console.log('🤖 Testing AI Service with Ollama and Gemini');
  console.log('==========================================');
  
  // Initialize AI service
  const aiService = new AIService({
    ollamaEndpoint: 'http://localhost:11434',
    geminiApiKey: '***REMOVED***',
    usageTracking: true,
    fallbackStrategy: 'ollama-first'
  });

  console.log('🔧 AI Service Configuration:');
  console.log(`   • Ollama Endpoint: ${aiService.config.ollamaEndpoint}`);
  console.log(`   • Gemini API Key: ${aiService.config.geminiApiKey ? 'Configured' : 'Not configured'}`);
  console.log(`   • Usage Tracking: ${aiService.config.usageTracking ? 'Enabled' : 'Disabled'}`);
  console.log(`   • Fallback Strategy: ${aiService.config.fallbackStrategy}`);
  console.log('');

  // Test 1: Check service availability
  console.log('🔍 Testing Service Availability');
  console.log('--------------------------------');
  
  try {
    const ollamaAvailable = await aiService.checkOllamaAvailability();
    console.log(`   • Ollama Service: ${ollamaAvailable ? 'Available ✅' : 'Not Available ❌'}`);
  } catch (error) {
    console.log(`   • Ollama Service: Error - ${error.message}`);
  }
  
  const geminiAvailable = aiService.isGeminiAvailable();
  const geminiStatus = aiService.getGeminiUsageStatus();
  console.log(`   • Gemini Service: ${geminiAvailable ? 'Available ✅' : 'Not Available ❌'}`);
  console.log(`   • Daily Usage: $${geminiStatus.used.toFixed(4)} / $${geminiStatus.limit}`);
  console.log(`   • Usage Percentage: ${geminiStatus.percentage.toFixed(1)}%`);
  console.log('');

  // Test 2: Analyze project with AI
  console.log('🧠 Testing AI Analysis');
  console.log('----------------------');
  
  try {
    console.log('📁 Analyzing project with mock files...');
    const startTime = Date.now();
    
    const insights = await aiService.analyzeProject(mockFiles, {
      onProgress: (progress) => {
        console.log(`   📊 Progress: ${progress}%`);
      },
      includeRecommendations: true,
      includePatterns: true,
      includeOptimizations: true,
      maxInsights: 10
    });
    
    const endTime = Date.now();
    console.log(`   ⏱️  Analysis completed in ${endTime - startTime}ms`);
    console.log(`   📊 Generated ${insights.length} insights`);
    console.log('');

    // Display insights
    console.log('🎯 AI Insights Generated:');
    console.log('-------------------------');
    
    insights.forEach((insight, index) => {
      console.log(`${index + 1}. ${insight.title}`);
      console.log(`   📝 Type: ${insight.type}`);
      console.log(`   🎨 Priority: ${insight.priority}`);
      console.log(`   🎯 Confidence: ${(insight.confidence * 100).toFixed(1)}%`);
      console.log(`   🤖 Source: ${insight.source}`);
      console.log(`   📋 Description: ${insight.description}`);
      if (insight.actionable && insight.action) {
        console.log(`   🔧 Action: ${insight.action}`);
      }
      console.log('');
    });

  } catch (error) {
    console.error('❌ AI Analysis failed:', error.message);
    console.log('');
  }

  // Test 3: Check usage metrics
  console.log('📊 Usage Metrics');
  console.log('----------------');
  
  try {
    const metrics = await aiService.getUsageMetrics();
    
    console.log('🤖 Ollama Metrics:');
    console.log(`   • Requests: ${metrics.ollama.requests}`);
    console.log(`   • Tokens: ${metrics.ollama.tokens.toLocaleString()}`);
    console.log(`   • Avg Response Time: ${metrics.ollama.avgResponseTime.toFixed(0)}ms`);
    console.log(`   • Errors: ${metrics.ollama.errors}`);
    console.log('');
    
    console.log('🧠 Gemini Metrics:');
    console.log(`   • Requests: ${metrics.gemini.requests}`);
    console.log(`   • Tokens: ${metrics.gemini.tokens.toLocaleString()}`);
    console.log(`   • Cost: $${metrics.gemini.cost.toFixed(4)}`);
    console.log(`   • Avg Response Time: ${metrics.gemini.avgResponseTime.toFixed(0)}ms`);
    console.log(`   • Errors: ${metrics.gemini.errors}`);
    console.log('');
    
    console.log('📈 Total Metrics:');
    console.log(`   • Total Insights: ${metrics.total.insights}`);
    console.log(`   • Accuracy: ${(metrics.total.accuracy * 100).toFixed(1)}%`);
    console.log(`   • User Satisfaction: ${(metrics.total.userSatisfaction * 100).toFixed(1)}%`);
    console.log(`   • Total Cost: $${metrics.total.cost.toFixed(4)}`);
    console.log('');

  } catch (error) {
    console.error('❌ Failed to get metrics:', error.message);
    console.log('');
  }

  // Test 4: Cost projection
  console.log('💰 Cost Projection');
  console.log('-----------------');
  
  try {
    const projection = aiService.getCostProjection(50); // 50 insights
    
    console.log('📊 Projected costs for 50 insights:');
    console.log(`   • Ollama (Local): $${projection.ollama.toFixed(4)}`);
    console.log(`   • Gemini (Cloud): $${projection.gemini.toFixed(4)}`);
    console.log(`   • Recommended: ${projection.recommended}`);
    console.log('');

  } catch (error) {
    console.error('❌ Failed to get cost projection:', error.message);
    console.log('');
  }

  // Test 5: Execute action (mock)
  console.log('🔧 Testing Action Execution');
  console.log('---------------------------');
  
  try {
    await aiService.executeAction('refactor-component', mockFiles);
    console.log('✅ Action executed successfully');
    
    // Update accuracy with positive feedback
    aiService.updateAccuracy('positive');
    console.log('✅ User feedback recorded (positive)');
    
  } catch (error) {
    console.error('❌ Action execution failed:', error.message);
    console.log('');
  }

  // Final metrics check
  console.log('📊 Final Metrics Check');
  console.log('----------------------');
  
  try {
    const finalMetrics = await aiService.getUsageMetrics();
    console.log(`📈 Updated User Satisfaction: ${(finalMetrics.total.userSatisfaction * 100).toFixed(1)}%`);
    console.log(`📈 Updated Accuracy: ${(finalMetrics.total.accuracy * 100).toFixed(1)}%`);
    console.log('');

  } catch (error) {
    console.error('❌ Failed to get final metrics:', error.message);
  }

  console.log('🎉 AI Service Test Complete!');
  console.log('==========================');
  console.log('✅ Key Features Demonstrated:');
  console.log('   • Ollama (Local) integration');
  console.log('   • Gemini (Cloud) fallback');
  console.log('   • Usage tracking and cost management');
  console.log('   • Insight generation and filtering');
  console.log('   • Action execution capability');
  console.log('   • User feedback integration');
  console.log('   • Cost projection and optimization');
  console.log('');
  console.log('🚀 Ready for integration with Modern Space Analyzer Dashboard!');
}

// Run the test
testAIService().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});