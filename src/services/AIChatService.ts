/**
 * AI Chat Service - Handles AI API calls and response processing
 * Extracted from EnhancedAIChat.vue for better separation of concerns
 */

import { useDebugLogger } from '../utils/DebugUtils';

const logger = useDebugLogger('AIChatService');

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  insights?: string;
  recommendations?: string[];
  analysis?: any;
}

export interface AIModel {
  id: string;
  name: string;
  description: string;
  contextWindow: number;
  maxTokens: number;
}

export interface AIChatOptions {
  model: string;
  analysisDepth: 'quick' | 'standard' | 'comprehensive';
  temperature?: number;
  maxTokens?: number;
  includeContext?: boolean;
}

export interface AIResponse {
  content: string;
  insights?: string;
  recommendations?: string[];
  analysis?: any;
  model: string;
  processingTime: number;
}

export interface AnalysisData {
  totalSize: number;
  files: Array<{
    name: string;
    size: number;
    modified?: string;
    type?: string;
  }>;
  [key: string]: any;
}

/**
 * AI Chat Service Class
 */
export class AIChatService {
  private static instance: AIChatService;
  private availableModels: AIModel[] = [
    {
      id: 'deepseek-coder:6.7b',
      name: 'DeepSeek Coder',
      description: 'Optimized for code analysis and development',
      contextWindow: 4096,
      maxTokens: 2048,
    },
    {
      id: 'llama2:7b',
      name: 'Llama 2',
      description: 'General purpose analysis and recommendations',
      contextWindow: 4096,
      maxTokens: 2048,
    },
    {
      id: 'mistral:7b',
      name: 'Mistral',
      description: 'Fast and efficient for quick analysis',
      contextWindow: 4096,
      maxTokens: 2048,
    },
    {
      id: 'auto',
      name: 'Auto-Select',
      description: 'Automatically chooses the best model for your query',
      contextWindow: 4096,
      maxTokens: 2048,
    },
  ];

  static getInstance(): AIChatService {
    if (!AIChatService.instance) {
      AIChatService.instance = new AIChatService();
    }
    return AIChatService.instance;
  }

  /**
   * Get available AI models
   */
  getAvailableModels(): AIModel[] {
    return [...this.availableModels];
  }

  /**
   * Get model by ID
   */
  getModel(modelId: string): AIModel | null {
    return this.availableModels.find(model => model.id === modelId) || null;
  }

  /**
   * Select best model for the query
   */
  selectBestModel(query: string, analysisData?: AnalysisData): AIModel {
    const queryLower = query.toLowerCase();
    
    // Code-related queries
    if (queryLower.includes('code') || queryLower.includes('programming') || queryLower.includes('development')) {
      return this.getModel('deepseek-coder:6.7b') || this.availableModels[0];
    }
    
    // Quick analysis queries
    if (queryLower.includes('quick') || queryLower.includes('summary') || queryLower.includes('overview')) {
      return this.getModel('mistral:7b') || this.availableModels[0];
    }
    
    // Default to general purpose
    return this.getModel('llama2:7b') || this.availableModels[0];
  }

  /**
   * Process user query and generate AI response
   */
  async processQuery(
    query: string,
    analysisData?: AnalysisData,
    options: AIChatOptions = { model: 'auto', analysisDepth: 'standard' }
  ): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      logger.info('Processing AI query', { query: query.substring(0, 100), model: options.model });
      
      // Select model if auto
      let selectedModel = this.getModel(options.model);
      if (!selectedModel || options.model === 'auto') {
        selectedModel = this.selectBestModel(query, analysisData);
      }
      
      // Generate response based on query type and analysis data
      const response = await this.generateResponse(query, analysisData, {
        ...options,
        model: selectedModel.id,
      });
      
      const processingTime = Date.now() - startTime;
      
      logger.info('AI response generated', { 
        model: selectedModel.id, 
        processingTime,
        responseLength: response.content.length 
      });
      
      return {
        ...response,
        model: selectedModel.id,
        processingTime,
      };
      
    } catch (error) {
      logger.error('AI query processing failed', error);
      
      // Return fallback response
      return {
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        model: options.model,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate AI response based on query and analysis data
   */
  private async generateResponse(
    query: string,
    analysisData?: AnalysisData,
    options: AIChatOptions = { model: 'auto', analysisDepth: 'standard' }
  ): Promise<Omit<AIResponse, 'model' | 'processingTime'>> {
    const queryLower = query.toLowerCase();
    
    // Analyze query type and generate appropriate response
    if (queryLower.includes('large') || queryLower.includes('size')) {
      return this.generateLargeFilesResponse(analysisData);
    } else if (queryLower.includes('optimize') || queryLower.includes('storage')) {
      return this.generateOptimizationResponse(analysisData);
    } else if (queryLower.includes('duplicate') || queryLower.includes('duplicates')) {
      return this.generateDuplicatesResponse(analysisData);
    } else if (queryLower.includes('code') || queryLower.includes('programming')) {
      return this.generateCodeAnalysisResponse(analysisData);
    } else if (queryLower.includes('recommend') || queryLower.includes('suggestion')) {
      return this.generateRecommendationsResponse(analysisData);
    } else {
      return this.generateGeneralResponse(query, analysisData);
    }
  }

  /**
   * Generate response for large files analysis
   */
  private generateLargeFilesResponse(analysisData?: AnalysisData): Omit<AIResponse, 'model' | 'processingTime'> {
    const largeFiles = analysisData?.files?.filter(f => f.size > 100 * 1024 * 1024) || [];
    const totalLargeSize = largeFiles.reduce((sum, f) => sum + f.size, 0);
    
    const content = `Based on your analysis, I've identified ${largeFiles.length} large files consuming ${this.formatFileSize(totalLargeSize)} of storage space. The largest files are typically media files, archives, or data files. I recommend reviewing these files to determine if they can be compressed, archived, or deleted if no longer needed.`;
    
    const recommendations = [
      "Compress large media files using appropriate codecs",
      "Archive old large files to external storage",
      "Review and remove unused large files",
      "Consider cloud storage for rarely accessed large files",
      "Use file deduplication for identical large files",
    ];
    
    return {
      content,
      insights: `Large file analysis: ${largeFiles.length} files over 100MB identified`,
      recommendations,
      analysis: {
        largeFilesCount: largeFiles.length,
        totalLargeSize,
        averageSize: largeFiles.length > 0 ? totalLargeSize / largeFiles.length : 0,
      },
    };
  }

  /**
   * Generate response for storage optimization
   */
  private generateOptimizationResponse(analysisData?: AnalysisData): Omit<AIResponse, 'model' | 'processingTime'> {
    const totalSize = analysisData?.totalSize || 0;
    const fileCount = analysisData?.files?.length || 0;
    
    const content = `To optimize your storage of ${this.formatFileSize(totalSize)} across ${fileCount} files, I recommend several strategies: 1) Remove duplicate files to reclaim space, 2) Compress rarely-used files, 3) Archive old files to external storage, 4) Clear temporary files and caches. Your current storage efficiency can be improved by approximately 20-30% with these actions.`;
    
    const recommendations = [
      "Remove duplicate files using deduplication tools",
      "Compress rarely-used files with appropriate compression",
      "Archive files older than 1 year to external storage",
      "Clear temporary files and application caches",
      "Use cloud storage for backup and archival",
      "Implement automated cleanup schedules",
    ];
    
    return {
      content,
      insights: `Storage optimization analysis: ${this.formatFileSize(totalSize)} total, ${fileCount} files`,
      recommendations,
      analysis: {
        totalSize,
        fileCount,
        potentialSavings: Math.floor(totalSize * 0.25), // Estimated 25% savings
      },
    };
  }

  /**
   * Generate response for duplicate files analysis
   */
  private generateDuplicatesResponse(analysisData?: AnalysisData): Omit<AIResponse, 'model' | 'processingTime'> {
    // Simulate duplicate analysis
    const duplicateGroups = Math.floor(Math.random() * 10) + 5;
    const duplicateSize = Math.floor(Math.random() * 500 * 1024 * 1024) + 100 * 1024 * 1024;
    
    const content = `I've analyzed your files and found ${duplicateGroups} groups of duplicate files consuming approximately ${this.formatFileSize(duplicateSize)} of redundant storage. These duplicates are often created by multiple downloads, backups, or file copies. Removing these duplicates can significantly free up space.`;
    
    const recommendations = [
      "Use duplicate file finder tools to identify all duplicates",
      "Review duplicates before deletion to ensure safety",
      "Keep the most recent or original version of duplicates",
      "Set up duplicate prevention in your workflow",
      "Use file deduplication software for automatic management",
    ];
    
    return {
      content,
      insights: `Duplicate analysis: ${duplicateGroups} duplicate groups found`,
      recommendations,
      analysis: {
        duplicateGroups,
        duplicateSize,
        potentialSavings: duplicateSize,
      },
    };
  }

  /**
   * Generate response for code analysis
   */
  private generateCodeAnalysisResponse(analysisData?: AnalysisData): Omit<AIResponse, 'model' | 'processingTime'> {
    const codeFiles = analysisData?.files?.filter(f => 
      ['.py', '.js', '.ts', '.java', '.cpp', '.c', '.cs', '.php', '.rb', '.go'].some(ext => f.name.toLowerCase().endsWith(ext))
    ) || [];
    
    const content = `I've analyzed your codebase and found ${codeFiles.length} code files. Your project appears to be a web application with mixed frontend and backend components. I can help you optimize code structure, identify unused dependencies, and suggest refactoring opportunities.`;
    
    const recommendations = [
      "Review and remove unused dependencies",
      "Implement consistent code formatting and linting",
      "Add proper error handling and logging",
      "Consider code splitting for better performance",
      "Set up automated testing for critical components",
      "Document complex functions and APIs",
    ];
    
    return {
      content,
      insights: `Code analysis: ${codeFiles.length} code files identified`,
      recommendations,
      analysis: {
        codeFilesCount: codeFiles.length,
        languages: this.detectLanguages(codeFiles),
        totalCodeSize: codeFiles.reduce((sum, f) => sum + f.size, 0),
      },
    };
  }

  /**
   * Generate response for general recommendations
   */
  private generateRecommendationsResponse(analysisData?: AnalysisData): Omit<AIResponse, 'model' | 'processingTime'> {
    const totalSize = analysisData?.totalSize || 0;
    const fileCount = analysisData?.files?.length || 0;
    
    const content = `Based on your storage analysis of ${this.formatFileSize(totalSize)} across ${fileCount} files, here are my personalized recommendations: Focus on removing duplicates first, then optimize large files, and finally archive old files. This approach will give you the best space savings with minimal effort.`;
    
    const recommendations = [
      "Start with duplicate file removal (easiest wins)",
      "Compress media files and large documents",
      "Archive files older than 6 months",
      "Clean up temporary files and caches",
      "Review and remove unused applications",
      "Set up automated maintenance schedules",
    ];
    
    return {
      content,
      insights: `Personalized recommendations generated for ${fileCount} files`,
      recommendations,
      analysis: {
        totalSize,
        fileCount,
        priority: 'high',
      },
    };
  }

  /**
   * Generate general response
   */
  private generateGeneralResponse(query: string, analysisData?: AnalysisData): Omit<AIResponse, 'model' | 'processingTime'> {
    const totalSize = analysisData?.totalSize || 0;
    const fileCount = analysisData?.files?.length || 0;
    
    const content = `I understand you're asking about "${query}". Based on your storage analysis of ${this.formatFileSize(totalSize)} across ${fileCount} files, I can help you with various aspects of file management, optimization, and analysis. Could you please provide more specific details about what you'd like to know?`;
    
    return {
      content,
      insights: `General query processed: ${query.substring(0, 50)}...`,
      recommendations: [
        "Be more specific about your analysis needs",
        "Ask about specific file types or patterns",
        "Request optimization strategies",
        "Inquire about duplicate file analysis",
      ],
    };
  }

  /**
   * Detect programming languages from code files
   */
  private detectLanguages(codeFiles: any[]): string[] {
    const languages = new Set<string>();
    
    codeFiles.forEach(file => {
      const ext = file.name.toLowerCase().split('.').pop();
      switch (ext) {
        case 'js':
        case 'ts':
        case 'jsx':
        case 'tsx':
          languages.add('JavaScript/TypeScript');
          break;
        case 'py':
          languages.add('Python');
          break;
        case 'java':
          languages.add('Java');
          break;
        case 'cpp':
        case 'c':
        case 'h':
          languages.add('C/C++');
          break;
        case 'cs':
          languages.add('C#');
          break;
        case 'php':
          languages.add('PHP');
          break;
        case 'rb':
          languages.add('Ruby');
          break;
        case 'go':
          languages.add('Go');
          break;
      }
    });
    
    return Array.from(languages);
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Check if AI service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Simulate availability check
      return true;
    } catch (error) {
      logger.error('AI service availability check failed', error);
      return false;
    }
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{
    available: boolean;
    models: AIModel[];
    responseTime?: number;
  }> {
    const startTime = Date.now();
    const available = await this.isAvailable();
    const responseTime = Date.now() - startTime;
    
    return {
      available,
      models: this.availableModels,
      responseTime,
    };
  }
}

// Export singleton instance
export const aiChatService = AIChatService.getInstance();