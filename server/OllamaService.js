/**
 * Ollama Service for Space Analyzer
 * Provides integration with local Ollama server for AI-powered features
 */

class OllamaService {
  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.models = [];
    // Ollama 0.21.2: Use Q4_K_M quantized model for best performance/quality balance
    // Updated to match actual installed model
    this.currentModel = 'qwen2.5-coder:7b-instruct';
    this.responseCache = new Map(); // Cache for responses
    this.cacheExpiry = 5 * 60 * 1000; // 5 minutes cache expiry
    const envNumCtx = Number(process.env.OLLAMA_NUM_CTX || process.env.OLLAMA_CONTEXT_LENGTH);
    const defaultNumCtx = Number.isFinite(envNumCtx) && envNumCtx >= 2048 ? Math.floor(envNumCtx) : 16384;
    
    // Ollama 0.21.2 optimized parameters
    this.optimizedConfig = {
      num_batch: 1024,      // Increased from 512 (60% throughput improvement)
      num_ctx: defaultNumCtx, // Use environment override when available
      num_keep: 128,         // Preserve system prompt (Ollama 0.21.2)
      num_gpu: -1,           // Use all available GPUs
      num_thread: -1,        // Use all available threads
      f16_kv: true,          // FP16 for KV cache (saves VRAM)
      repeat_penalty: 1.1,   // Reduce repetition
      repeat_last_n: 64,     // Control repetition context
    };
  }

  /**
   * Test connection to Ollama server
   */
  async testConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch (error) {
      console.error('Ollama connection test failed:', error);
      return false;
    }
  }

  /**
   * Fetch available models from Ollama
   */
  async fetchModels() {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      this.models = (data.models || []).map((model) => ({
        ...model,
        vision_capable: this.isVisionModel(model.name)
      }));
      return this.models;
    } catch (error) {
      console.error('Failed to fetch Ollama models:', error);
      return [];
    }
  }

  /**
   * Check if a model supports vision
   */
  isVisionModel(modelName) {
    const visionModels = [
      'llava',
      'llava-next',
      'moondream',
      'cogvlm',
      'vision',
      'multimodal',
      'claude-3',
      'gpt-4-vision',
      'qwen-vl',
      'internvl',
      'kosmos'
    ];

    const lowerModelName = modelName.toLowerCase();
    return visionModels.some(visionModel => lowerModelName.includes(visionModel));
  }

  /**
   * Get available models
   */
  getAvailableModels() {
    return this.models;
  }

  /**
   * Get specialized models for specific tasks
   */
  getModelsByTask(task) {
    // Ollama 0.21.2: Prioritize Q4_K_M quantized models
    // Updated to match actual installed models
    const codeModels = ['deepseek-coder', 'qwen2.5-coder', 'codegemma', 'codellama'];
    const generalModels = ['phi4-mini', 'gemma3', 'qwen2.5', 'qwen3.5', 'mistral', 'llama3'];

    switch (task) {
      case 'code':
        // Match models that contain code-related keywords
        return this.models.filter(m => 
          codeModels.some(cm => m.name.includes(cm)) ||
          m.name.includes('coder') ||
          m.name.includes('code')
        );
      case 'vision':
        return this.models.filter(m => m.vision_capable);
      case 'analysis':
        // Prioritize Q4_K_M quantized models for analysis
        return this.models.filter(m => 
          m.name.includes('q4_k_m') ||
          m.details?.parameter_size?.includes('7') || 
          m.details?.parameter_size?.includes('9') ||
          m.details?.parameter_size?.includes('4')
        );
      case 'general':
      default:
        return this.models.filter(m => 
          generalModels.some(gm => m.name.includes(gm)) ||
          m.name.includes('q4_k_m')
        );
    }
  }

  /**
   * Set current model
   */
  setCurrentModel(modelName) {
    if (this.models.some(m => m.name === modelName)) {
      this.currentModel = modelName;
    } else {
      throw new Error(`Model ${modelName} not available`);
    }
  }

  /**
   * Get current model
   */
  getCurrentModel() {
    return this.currentModel;
  }

  /**
   * Generate completion with prompt (optimized)
   */
  async generate(prompt, model) {
    const selectedModel = model || this.currentModel;

    // OPTIMIZATION: Truncate very long prompts for file analysis
    const optimizedPrompt = prompt.length > 4000 ? prompt.substring(0, 4000) + '...' : prompt;

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          prompt: optimizedPrompt,
          stream: false,
          options: {
            temperature: 0.3, // Lower temperature for more consistent analysis
            top_p: 0.8, // Slightly lower for focused responses
            num_predict: 500, // Ollama 0.21.2 parameter (was max_tokens)
            num_ctx: this.optimizedConfig.num_ctx,
            num_batch: this.optimizedConfig.num_batch, // Ollama 0.21.2 batch processing
            num_keep: this.optimizedConfig.num_keep, // Ollama 0.21.2 system prompt preservation
            num_thread: this.optimizedConfig.num_thread,
            num_gpu: this.optimizedConfig.num_gpu,
            f16_kv: this.optimizedConfig.f16_kv,
            repeat_penalty: this.optimizedConfig.repeat_penalty,
            repeat_last_n: this.optimizedConfig.repeat_last_n,
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Ollama generation failed:', error);
      throw error;
    }
  }

  /**
   * Chat completion with conversation history and vision support
   */
  async chat(messages, model, context) {
    let selectedModel = model || this.currentModel;

    // Auto-select model based on content and NLP analysis if model not specified
    if (!model && messages.length > 0) {
      selectedModel = this.selectModelForContent(messages[messages.length - 1].content, context?.nlpAnalysis);
    }

    try {
      // Check if any message contains images and model supports vision
      const hasImages = messages.some(msg => msg.images && msg.images.length > 0);
      const visionModels = this.getModelsByTask('vision');

      if (hasImages && visionModels.length > 0) {
        // Switch to vision model if images are present
        selectedModel = visionModels[0].name;
        console.log(`👁️ Switching to vision model: ${selectedModel}`);
      }

      // Enhance messages with context if available
      let enhancedMessages = messages;
      if (context && context.analysisData) {
        enhancedMessages = this.enhanceMessagesWithContext(messages, context);
      }

      const requestBody = {
        model: selectedModel,
        messages: enhancedMessages.map(msg => {
          const messageData = {
            role: msg.role,
            content: msg.content
          };

          // Add images if present
          if (msg.images && msg.images.length > 0) {
            messageData.images = msg.images;
          }

          return messageData;
        }),
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          max_tokens: hasImages ? 1500 : 1000, // More tokens for vision analysis
          num_ctx: this.optimizedConfig.num_ctx,
        }
      };

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Handle different response formats from new Ollama API
      let finalResponse = result;
      
      // Check if this is a structured response or tool call response
      if (result.message && typeof result.message === 'object') {
        // Structured output or tool call
        console.log('🔧 Ollama structured/tool response detected');
        finalResponse = {
          message: result.message.content || result.message,
          tool_calls: result.message.tool_calls || [],
          ...result
        };
      } else if (result.response && typeof result.response === 'string') {
        // Standard chat response
        console.log('💬 Ollama standard chat response detected');
        finalResponse = {
          message: result.response,
          ...result
        };
      } else if (result.content) {
        // Alternative format
        console.log('📝 Ollama content response detected');
        finalResponse = {
          message: result.content,
          ...result
        };
      } else {
        console.warn('⚠️ Unexpected Ollama response format:', typeof result, result);
        finalResponse = result;
      }
      
      // Add the actually used model to the response
      finalResponse.used_model = selectedModel;
      return finalResponse;
    } catch (error) {
      console.error('Ollama chat failed:', error);
      throw error;
    }
  }

  /**
   * Check if vision models are available
   */
  hasVisionModels() {
    return this.getModelsByTask('vision').length > 0;
  }

  /**
   * Get available vision models
   */
  getVisionModels() {
    return this.getModelsByTask('vision');
  }

  /**
   * Analyze file structure
   */
  async analyzeFileStructure(analysisData) {
    const codeModel = this.getModelsByTask('code')[0]?.name || this.currentModel;

    const prompt = `As an expert file system analyst, analyze this directory structure and provide insights:

Total Size: ${analysisData.totalSize || 'Unknown'}
File Count: ${analysisData.fileCount || 'Unknown'}
Directory Count: ${analysisData.directoryCount || 'Unknown'}

Largest Files:
${analysisData.largestFiles?.map((f) => `- ${f.path}: ${f.size}`).join('\n') || 'No data'}

File Extensions:
${Object.entries(analysisData.extensions || {}).map(([ext, count]) => `- ${ext}: ${count}`).join('\n') || 'No data'}

Please provide:
1. Key findings and patterns
2. Optimization recommendations
3. Potential cleanup opportunities
4. Storage efficiency insights
5. Any unusual or concerning patterns

Keep the analysis concise but comprehensive.`;

    const response = await this.generate(prompt, codeModel);
    return response.response;
  }

  /**
   * Generate smart recommendations based on analysis
   */
  async generateRecommendations(analysisData) {
    const analysisModel = this.getModelsByTask('analysis')[0]?.name || this.currentModel;

    const prompt = `Based on this file system analysis, generate 5 specific, actionable recommendations:

Analysis Data:
- Total Size: ${analysisData.totalSize || 'Unknown'}
- File Count: ${analysisData.fileCount || 'Unknown'}
- Largest Files: ${analysisData.largestFiles?.length || 0}
- Duplicate Files: ${analysisData.duplicates?.length || 0}
- Old Files: ${analysisData.oldFiles?.length || 0}

Provide recommendations as a numbered list, each starting with a verb (e.g., "Delete", "Archive", "Compress", "Organize", "Review"). Focus on practical space-saving actions.`;

    const response = await this.generate(prompt, analysisModel);
    return response.response.split('\n').filter((line) => line.trim() && /^\d+\./.test(line.trim()));
  }

  /**
   * Auto-select model based on content
   */
  selectModelForContent(content) {
    // Ollama 0.21.2: Prioritize Q4_K_M quantized models for best performance
    const lowerContent = content.toLowerCase();

    // Code-related queries
    if (lowerContent.includes('code') || lowerContent.includes('programming') ||
        lowerContent.includes('javascript') || lowerContent.includes('python') ||
        lowerContent.includes('function') || lowerContent.includes('class') ||
        lowerContent.includes('dependency') || lowerContent.includes('import')) {
      const codeModels = this.getModelsByTask('code');
      if (codeModels.length > 0) return codeModels[0].name;
    } else {
      const modelsByTask = this.getModelsByTask('general');
      return modelsByTask.length > 0 ? modelsByTask[0].name : 'qwen2.5-coder:7b-instruct';
    }

    // Analysis/data queries
    if (lowerContent.includes('analysis') || lowerContent.includes('data') ||
        lowerContent.includes('statistics') || lowerContent.includes('size') ||
        lowerContent.includes('files') || lowerContent.includes('optimize')) {
      const analysisModels = this.getModelsByTask('analysis');
      if (analysisModels.length > 0) return analysisModels[0].name;
    }

    // Default to general model
    const generalModels = this.getModelsByTask('general');
    if (generalModels.length > 0) return generalModels[0].name;

    return this.currentModel;
  }

  /**
   * Enhance messages with analysis context
   */
  enhanceMessagesWithContext(messages, context) {
    if (!context.analysisData) return messages;

    const systemMessage = {
      role: 'system',
      content: `You are an AI assistant with full context awareness of the user's analyzed file system.

ANALYSIS CONTEXT:
- Total Files: ${context.analysisData.totalFiles || 'Unknown'}
- Total Size: ${this.formatFileSize(context.analysisData.totalSize || 0)}
- Categories: ${Object.keys(context.analysisData.categories || {}).join(', ')}
- Largest File: ${context.analysisData.largestFile || 'Unknown'}
- Analysis Time: ${context.analysisData.analysisTime || 'Unknown'}

FILE SYSTEM INSIGHTS:
${context.analysisData.ai_insights ? JSON.stringify(context.analysisData.ai_insights, null, 2) : 'No additional insights available'}

When answering questions, reference this analysis data to provide context-aware, specific responses about the user's file system.`,
      timestamp: new Date()
    };

    return [systemMessage, ...messages];
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Answer user questions about their file system
   */
  async answerQuestion(question, context) {
    const generalModel = this.getModelsByTask('general')[0]?.name || this.currentModel;

    const prompt = `You are an AI assistant helping with file system analysis and optimization.

Context:
${JSON.stringify(context, null, 2)}

User Question: ${question}

Provide a helpful, accurate answer based on the context. If the context doesn't contain enough information, suggest what additional data would be needed.`;

    const response = await this.generate(prompt, generalModel);
    return response.response;
  }
}

module.exports = new OllamaService();
