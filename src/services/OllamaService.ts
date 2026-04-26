/**
 * Ollama Service for Space Analyzer
 * Provides integration with local Ollama server for AI-powered features
 */

import { portDetector } from './PortDetector';

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
  vision_capable?: boolean;
}

export interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  context?: any;
  used_model?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  model?: string;
  images?: string[]; // Base64 encoded images for vision models
}

export interface VisionAnalysisResult {
  description: string;
  objects: Array<{
    name: string;
    confidence: number;
    bbox?: [number, number, number, number];
  }>;
  text_detected?: string[];
  scene_type?: string;
  colors: {
    dominant: string[];
    palette: string[];
  };
  technical_details?: {
    resolution: string;
    aspect_ratio: string;
    estimated_quality: string;
  };
  file_analysis?: {
    type: string;
    relevance_score: number;
    insights: string[];
  };
}

class OllamaService {
  private baseUrl: string;
  private models: OllamaModel[] = [];
  private currentModel: string = 'qwen2.5-coder:7b-instruct';
  private defaultNumCtx: number;

  constructor(baseUrl?: string) {
    this.defaultNumCtx = this.resolveDefaultNumCtx();
    if (baseUrl) {
      this.baseUrl = baseUrl;
    } else {
      // Initialize with dynamic port detection
      this.initializeBaseUrl();
    }
  }

  private async initializeBaseUrl() {
    try {
      const config = await portDetector.detectAllServers();
      this.baseUrl = `${portDetector.getApiBaseUrl()}/ollama`;
      console.log(`🔗 OllamaService initialized with API URL: ${this.baseUrl}`);
    } catch (error) {
      console.warn('⚠️ Failed to detect backend port, using fallback');
      this.baseUrl = '/api/ollama';
    }
  }

  private resolveDefaultNumCtx(): number {
    const rawValue = (import.meta as any)?.env?.VITE_OLLAMA_NUM_CTX;
    const parsedValue = Number(rawValue);
    return Number.isFinite(parsedValue) && parsedValue >= 2048 ? Math.floor(parsedValue) : 16384;
  }

  /**
   * Test connection to Ollama server
   */
  async testConnection(): Promise<boolean> {
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
  async fetchModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      this.models = (data.models || []).map((model: any) => ({
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
  private isVisionModel(modelName: string): boolean {
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
  getAvailableModels(): OllamaModel[] {
    return this.models;
  }

  /**
   * Get specialized models for specific tasks
   */
  getModelsByTask(task: 'code' | 'general' | 'vision' | 'analysis'): OllamaModel[] {
    // Ollama 0.21.2: Partial matching for actual installed models
    const codeModels = ['deepseek-coder', 'qwen2.5-coder', 'codegemma', 'codellama'];
    const generalModels = ['phi4-mini', 'gemma3', 'qwen2.5', 'qwen3.5', 'llama3', 'mistral'];

    switch (task) {
      case 'code':
        return this.models.filter(m => 
          codeModels.some(cm => m.name.includes(cm)) ||
          m.name.includes('coder') ||
          m.name.includes('code')
        );
      case 'vision':
        return this.models.filter(m => m.vision_capable);
      case 'analysis':
        return this.models.filter(m => 
          m.name.includes('q4_k_m') ||
          m.details.parameter_size.includes('7') || 
          m.details.parameter_size.includes('9') ||
          m.details.parameter_size.includes('4')
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
  setCurrentModel(modelName: string): void {
    if (this.models.some(m => m.name === modelName)) {
      this.currentModel = modelName;
    } else {
      throw new Error(`Model ${modelName} not available`);
    }
  }

  /**
   * Get current model
   */
  getCurrentModel(): string {
    return this.currentModel;
  }

  /**
   * Generate completion with prompt
   */
  async generate(prompt: string, model?: string): Promise<OllamaResponse> {
    const selectedModel = model || this.currentModel;
    
    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: selectedModel,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.8,
            num_predict: 500,
            num_ctx: this.defaultNumCtx,
            num_batch: 1024,
            num_keep: 128,
            num_gpu: -1,
            num_thread: -1,
            f16_kv: true,
            top_k: 40,
            repeat_penalty: 1.1,
            repeat_last_n: 64
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
  async chat(messages: ChatMessage[], model?: string, context?: any): Promise<OllamaResponse> {
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

      const requestBody: any = {
        model: selectedModel,
        messages: enhancedMessages.map(msg => {
          const messageData: any = {
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
          num_predict: hasImages ? 1500 : 1000,
          num_ctx: this.defaultNumCtx,
          num_batch: 1024,
          num_keep: 128,
          f16_kv: true,
          top_k: 40,
          repeat_penalty: 1.1,
          repeat_last_n: 64
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
      // Add the actually used model to the response
      result.used_model = selectedModel;
      return result;
    } catch (error) {
      console.error('Ollama chat failed:', error);
      throw error;
    }
  }

  /**
   * Analyze image using Ollama vision models
   */
  async analyzeImage(imageData: string, prompt?: string): Promise<VisionAnalysisResult> {
    const visionModels = this.getModelsByTask('vision');
    
    if (visionModels.length === 0) {
      throw new Error('No vision models available. Please install a vision model like llava, llava-next, or moondream.');
    }

    const visionModel = visionModels[0].name;
    const defaultPrompt = `Analyze this image in detail. Provide:
1. A comprehensive description of what you see
2. Key objects or elements identified
3. Any text visible in the image
4. The type of scene or context
5. Dominant colors and visual characteristics
6. Technical details (resolution, quality, etc.)
7. Relevance for file system analysis (if applicable)`;

    const analysisPrompt = prompt || defaultPrompt;

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: visionModel,
          messages: [
            {
              role: 'user',
              content: analysisPrompt,
              images: [imageData]
            }
          ],
          stream: false,
          options: {
            temperature: 0.3, // Lower temperature for more factual analysis
            top_p: 0.9,
            num_predict: 1500,
            num_ctx: this.defaultNumCtx,
            top_k: 40,
            repeat_penalty: 1.1,
            repeat_last_n: 64
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return this.parseVisionResponse(result.response, visionModel);
    } catch (error) {
      console.error('Vision analysis failed:', error);
      throw error;
    }
  }

  /**
   * Analyze multiple images in a conversation context
   */
  async analyzeImagesInContext(images: string[], context: string, analysisData?: any): Promise<string> {
    const visionModels = this.getModelsByTask('vision');
    
    if (visionModels.length === 0) {
      throw new Error('No vision models available');
    }

    const visionModel = visionModels[0].name;
    
    let enhancedContext = context;
    if (analysisData) {
      enhancedContext += `\n\nFILE SYSTEM CONTEXT:\n- Total Files: ${analysisData.totalFiles || 'Unknown'}\n- Total Size: ${this.formatFileSize(analysisData.totalSize || 0)}\n- Categories: ${Object.keys(analysisData.categories || {}).join(', ')}\n`;
    }

    const prompt = `Analyze these images in the context of file system management and storage optimization:

${enhancedContext}

For each image, provide:
1. What the image shows
2. How it relates to file management or storage
3. Any actionable insights or recommendations
4. File type suggestions if applicable
5. Organization or cleanup implications`;

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: visionModel,
          messages: [
            {
              role: 'user',
              content: prompt,
              images: images
            }
          ],
          stream: false,
          options: {
            temperature: 0.5,
            top_p: 0.9,
            num_predict: 2000,
            num_ctx: this.defaultNumCtx,
            top_k: 40,
            repeat_penalty: 1.1,
            repeat_last_n: 64
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result.response;
    } catch (error) {
      console.error('Multi-image analysis failed:', error);
      throw error;
    }
  }

  /**
   * Parse vision model response into structured result
   */
  private parseVisionResponse(response: string, modelUsed: string): VisionAnalysisResult {
    // This is a basic parser - in a real implementation, you might want to use
    // more sophisticated parsing or structured output from the model
    const result: VisionAnalysisResult = {
      description: response,
      objects: [],
      colors: {
        dominant: [],
        palette: []
      }
    };

    // Try to extract structured information from the response
    const lines = response.split('\n').filter(line => line.trim());
    
    lines.forEach(line => {
      // Extract objects (basic pattern matching)
      if (line.toLowerCase().includes('object') || line.toLowerCase().includes('item')) {
        const objectMatch = line.match(/([a-zA-Z\s]+)(?:\s*\((\d+%?)\))?/);
        if (objectMatch) {
          result.objects.push({
            name: objectMatch[1].trim(),
            confidence: objectMatch[2] ? parseFloat(objectMatch[2].replace('%', '')) / 100 : 0.8
          });
        }
      }

      // Extract colors
      if (line.toLowerCase().includes('color') || line.toLowerCase().includes('dominant')) {
        const colorMatch = line.match(/(?:#?([0-9a-fA-F]{6})|([a-zA-Z]+\s*color))/g);
        if (colorMatch) {
          result.colors.dominant.push(...colorMatch);
        }
      }

      // Extract text
      if (line.toLowerCase().includes('text') || line.toLowerCase().includes('words')) {
        const textMatch = line.match(/"([^"]+)"/g);
        if (textMatch) {
          result.text_detected = textMatch.map(text => text.replace(/"/g, ''));
        }
      }

      // Extract scene type
      if (line.toLowerCase().includes('scene') || line.toLowerCase().includes('type')) {
        const sceneMatch = line.match(/(?:scene|type):?\s*([^.\n]+)/i);
        if (sceneMatch) {
          result.scene_type = sceneMatch[1].trim();
        }
      }
    });

    // Add file analysis context if this is for file system analysis
    if (response.toLowerCase().includes('file') || response.toLowerCase().includes('storage')) {
      result.file_analysis = {
        type: 'file_system_related',
        relevance_score: 0.8,
        insights: [
          'Image contains file system related content',
          'Can provide insights for storage management',
          'Relevant for file organization analysis'
        ]
      };
    }

    return result;
  }

  /**
   * Convert file to base64 for vision analysis
   */
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix to get just the base64
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Check if vision models are available
   */
  hasVisionModels(): boolean {
    return this.getModelsByTask('vision').length > 0;
  }

  /**
   * Get available vision models
   */
  getVisionModels(): OllamaModel[] {
    return this.getModelsByTask('vision');
  }
  async analyzeFileStructure(analysisData: any): Promise<string> {
    const codeModel = this.getModelsByTask('code')[0]?.name || this.currentModel;
    
    const prompt = `As an expert file system analyst, analyze this directory structure and provide insights:

Total Size: ${analysisData.totalSize || 'Unknown'}
File Count: ${analysisData.fileCount || 'Unknown'}
Directory Count: ${analysisData.directoryCount || 'Unknown'}

Largest Files:
${analysisData.largestFiles?.map((f: any) => `- ${f.path}: ${f.size}`).join('\n') || 'No data'}

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
  async generateRecommendations(analysisData: any): Promise<string[]> {
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
    return response.response.split('\n').filter((line: string) => line.trim() && /^\d+\./.test(line.trim()));
  }

  /**
   * Auto-select model based on content and NLP analysis
   */
  private selectModelForContent(content: string, nlpAnalysis?: any): string {
    // If NLP analysis is available, use it for more intelligent model selection
    if (nlpAnalysis) {
      const intent = nlpAnalysis.intent?.intent;

      switch (intent) {
        case 'code_analysis':
          const codeModels = this.getModelsByTask('code');
          if (codeModels.length > 0) return codeModels[0].name;
          break;

        case 'file_analysis':
        case 'storage_query':
        case 'file_search':
          const analysisModels = this.getModelsByTask('analysis');
          if (analysisModels.length > 0) return analysisModels[0].name;
          break;

        case 'visualization':
          const visionModels = this.getModelsByTask('vision');
          if (visionModels.length > 0) return visionModels[0].name;
          break;
      }

      // Check entities for code-related content
      const entities = nlpAnalysis.entities || [];
      const hasCodeEntity = entities.some((e: any) =>
        e.entity === 'code_type' || e.entity === 'build_system'
      );
      if (hasCodeEntity) {
        const codeModels = this.getModelsByTask('code');
        if (codeModels.length > 0) return codeModels[0].name;
      }
    }

    // Fallback to keyword-based selection
    const lowerContent = content.toLowerCase();

    // Code-related queries
    if (lowerContent.includes('code') || lowerContent.includes('programming') ||
        lowerContent.includes('javascript') || lowerContent.includes('python') ||
        lowerContent.includes('function') || lowerContent.includes('class') ||
        lowerContent.includes('dependency') || lowerContent.includes('import')) {
      const codeModels = this.getModelsByTask('code');
      if (codeModels.length > 0) return codeModels[0].name;
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
  private enhanceMessagesWithContext(messages: ChatMessage[], context: {analysisData?: any}): ChatMessage[] {
    if (!context.analysisData) return messages;

    const systemMessage: ChatMessage = {
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
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Answer user questions about their file system
   */
  async answerQuestion(question: string, context: any): Promise<string> {
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

export const ollamaService = new OllamaService();
export default ollamaService;
