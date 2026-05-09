/**
 * Unified AI Service for Space Analyzer
 * Consolidates all AI backends (Ollama, Google AI, Python ML) into a single interface
 * Provides intelligent backend selection, rate limiting, and unified error handling
 */

import { OllamaService } from './OllamaService';
import { GoogleAIService } from './GoogleAIService';
import { PythonAIService } from './PythonAIService';
import { OllamaRateLimiter } from './OllamaRateLimiter';

// Unified interfaces
export interface AIInsight {
  id: string;
  type: "recommendation" | "warning" | "optimization" | "pattern";
  title: string;
  description: string;
  confidence: number;
  priority: "low" | "medium" | "high" | "critical";
  actionable: boolean;
  action?: string;
  source: "ollama" | "google" | "python" | "local";
  timestamp: number;
}

export interface AnalysisOptions {
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
  includeRecommendations?: boolean;
  includePatterns?: boolean;
  includeOptimizations?: boolean;
  maxInsights?: number;
  preferredBackend?: "ollama" | "google" | "python" | "auto";
}

export interface AIBackendConfig {
  name: string;
  available: boolean;
  priority: number;
  maxTokens?: number;
  costPerToken?: number;
  features: string[];
}

export interface UsageMetrics {
  backends: Map<string, {
    requests: number;
    tokens: number;
    cost: number;
    avgResponseTime: number;
    errors: number;
    successRate: number;
  }>;
  total: {
    insights: number;
    accuracy: number;
    userSatisfaction: number;
    cost: number;
  };
}

export class UnifiedAIService {
  private static instance: UnifiedAIService;
  private backends: Map<string, any> = new Map();
  private rateLimiter: OllamaRateLimiter;
  private metrics: UsageMetrics;
  private fallbackOrder: string[] = ["ollama", "google", "python", "local"];

  private constructor() {
    this.initializeBackends();
    this.rateLimiter = new OllamaRateLimiter();
    this.metrics = {
      backends: new Map(),
      total: {
        insights: 0,
        accuracy: 0,
        userSatisfaction: 0,
        cost: 0,
      },
    };
  }

  static getInstance(): UnifiedAIService {
    if (!UnifiedAIService.instance) {
      UnifiedAIService.instance = new UnifiedAIService();
    }
    return UnifiedAIService.instance;
  }

  /**
   * Initialize all available AI backends
   */
  private async initializeBackends(): Promise<void> {
    // Initialize Ollama (Local)
    try {
      const ollamaService = new OllamaService();
      const ollamaAvailable = await ollamaService.checkAvailability();
      this.backends.set("ollama", {
        service: ollamaService,
        config: {
          name: "Ollama (Local)",
          available: ollamaAvailable,
          priority: 1,
          features: ["text-generation", "code-analysis", "file-categorization"],
        },
      });
    } catch (error) {
      console.warn("Failed to initialize Ollama:", error);
      this.backends.set("ollama", {
        service: null,
        config: {
          name: "Ollama (Local)",
          available: false,
          priority: 1,
          features: [],
        },
      });
    }

    // Initialize Google AI (Cloud)
    try {
      const googleService = new GoogleAIService();
      const googleAvailable = await googleService.checkAvailability();
      this.backends.set("google", {
        service: googleService,
        config: {
          name: "Google AI",
          available: googleAvailable,
          priority: 2,
          maxTokens: 1000000,
          costPerToken: 0.000001,
          features: ["text-generation", "code-analysis", "translation"],
        },
      });
    } catch (error) {
      console.warn("Failed to initialize Google AI:", error);
      this.backends.set("google", {
        service: null,
        config: {
          name: "Google AI",
          available: false,
          priority: 2,
          features: [],
        },
      });
    }

    // Initialize Python ML (Local)
    try {
      const pythonService = new PythonAIService();
      const pythonAvailable = await pythonService.checkAvailability();
      this.backends.set("python", {
        service: pythonService,
        config: {
          name: "Python ML",
          available: pythonAvailable,
          priority: 3,
          features: ["ml-analysis", "pattern-recognition", "anomaly-detection"],
        },
      });
    } catch (error) {
      console.warn("Failed to initialize Python ML:", error);
      this.backends.set("python", {
        service: null,
        config: {
          name: "Python ML",
          available: false,
          priority: 3,
          features: [],
        },
      });
    }
  }

  /**
   * Main analysis method with intelligent backend selection
   */
  async analyzeProject(files: any[], options: AnalysisOptions = {}): Promise<AIInsight[]> {
    const startTime = Date.now();
    const insights: AIInsight[] = [];

    try {
      // Select optimal backend
      const selectedBackend = await this.selectOptimalBackend(options);
      
      if (!selectedBackend) {
        throw new Error("No AI backends available");
      }

      // Check rate limits
      const canProceed = await this.rateLimiter.checkLimit(selectedBackend.name);
      if (!canProceed) {
        throw new Error(`Rate limit exceeded for ${selectedBackend.name}`);
      }

      // Prepare project context
      const projectContext = this.prepareProjectContext(files, selectedBackend);

      // Generate insights using selected backend
      const backendInsights = await this.generateInsights(
        selectedBackend,
        projectContext,
        options
      );
      insights.push(...backendInsights);

      // Update metrics
      this.updateMetrics(selectedBackend.name, insights, Date.now() - startTime);

      // Report progress
      if (options.onProgress) {
        options.onProgress(100);
      }

      return insights;
    } catch (error) {
      console.error("AI analysis failed:", error);
      
      // Try fallback backends
      if (options.preferredBackend !== "auto") {
        return this.analyzeProject(files, { ...options, preferredBackend: "auto" });
      }
      
      throw error;
    }
  }

  /**
   * Intelligently select the best backend for the task
   */
  private async selectOptimalBackend(options: AnalysisOptions): Promise<any> {
    const preferredBackend = options.preferredBackend || "auto";

    if (preferredBackend !== "auto") {
      const backend = this.backends.get(preferredBackend);
      if (backend?.config.available) {
        return backend;
      }
    }

    // Auto-selection logic
    const availableBackends = Array.from(this.backends.values())
      .filter(backend => backend.config.available)
      .sort((a, b) => a.config.priority - b.config.priority);

    if (availableBackends.length === 0) {
      throw new Error("No AI backends available");
    }

    // Select based on task requirements
    if (options.includePatterns) {
      const patternBackend = availableBackends.find(backend =>
        backend.config.features.includes("pattern-recognition")
      );
      if (patternBackend) return patternBackend;
    }

    if (options.includeOptimizations) {
      const optimizationBackend = availableBackends.find(backend =>
        backend.config.features.includes("ml-analysis")
      );
      if (optimizationBackend) return optimizationBackend;
    }

    // Default to highest priority available backend
    return availableBackends[0];
  }

  /**
   * Generate insights using specific backend
   */
  private async generateInsights(
    backend: any,
    context: any,
    options: AnalysisOptions
  ): Promise<AIInsight[]> {
    const serviceName = backend.config.name;
    const startTime = Date.now();

    try {
      let rawResponse: string;

      switch (backend.service?.constructor?.name) {
        case "OllamaService":
          rawResponse = await backend.service.generate(context.prompt, {
            model: "llama2",
            max_tokens: options.maxInsights ? options.maxInsights * 100 : 1000,
            temperature: 0.7,
          });
          break;

        case "GoogleAIService":
          rawResponse = await backend.service.generateContent(context.prompt, {
            maxOutputTokens: options.maxInsights ? options.maxInsights * 100 : 1000,
            temperature: 0.7,
          });
          break;

        case "PythonAIService":
          rawResponse = await backendService.analyze(context.files, {
            analysis_type: "comprehensive",
            include_patterns: options.includePatterns,
            include_optimizations: options.includeOptimizations,
          });
          break;

        default:
          throw new Error(`Unknown backend service: ${backend.service?.constructor?.name}`);
      }

      // Parse response into standardized insights
      const insights = this.parseResponse(rawResponse, serviceName);
      
      // Apply limits
      if (options.maxInsights && insights.length > options.maxInsights) {
        insights.splice(options.maxInsights);
      }

      return insights;
    } catch (error) {
      console.error(`Backend ${serviceName} failed:`, error);
      throw error;
    }
  }

  /**
   * Parse backend response into standardized AIInsight format
   */
  private parseResponse(response: string, source: string): AIInsight[] {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(response);
      if (Array.isArray(parsed)) {
        return parsed.map((item, index) => ({
          id: `${source}-${Date.now()}-${index}`,
          type: item.type || "recommendation",
          title: item.title || "AI Insight",
          description: item.description || "Generated insight",
          confidence: item.confidence || 0.8,
          priority: item.priority || "medium",
          actionable: item.actionable !== false,
          action: item.action,
          source: source as any,
          timestamp: Date.now(),
        }));
      }
    } catch (error) {
      // Fallback: parse text response
      return this.parseTextResponse(response, source);
    }

    return [];
  }

  /**
   * Parse text response into insights
   */
  private parseTextResponse(response: string, source: string): AIInsight[] {
    const lines = response.split('\n').filter(line => line.trim());
    const insights: AIInsight[] = [];

    lines.forEach((line, index) => {
      if (line.startsWith('-') || line.startsWith('*') || line.startsWith('•')) {
        const cleaned = line.replace(/^[-*•]\s*/, '').trim();
        insights.push({
          id: `${source}-text-${Date.now()}-${index}`,
          type: "recommendation",
          title: cleaned.substring(0, 50) + (cleaned.length > 50 ? '...' : ''),
          description: cleaned,
          confidence: 0.7,
          priority: "medium",
          actionable: true,
          source: source as any,
          timestamp: Date.now(),
        });
      }
    });

    return insights;
  }

  /**
   * Prepare project context for AI analysis
   */
  private prepareProjectContext(files: any[], backend: any): any {
    const fileTypes = this.analyzeFileTypes(files);
    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
    const fileCount = files.length;

    return {
      files: files.slice(0, 100), // Limit context size
      fileTypes,
      totalSize,
      fileCount,
      backend: backend.config.name,
      prompt: this.generateAnalysisPrompt(fileTypes, totalSize, fileCount),
    };
  }

  /**
   * Analyze file types in the project
   */
  private analyzeFileTypes(files: any[]): Record<string, number> {
    const types: Record<string, number> = {};
    
    files.forEach(file => {
      const ext = file.name?.split('.').pop()?.toLowerCase() || 'unknown';
      types[ext] = (types[ext] || 0) + 1;
    });

    return types;
  }

  /**
   * Generate analysis prompt based on project characteristics
   */
  private generateAnalysisPrompt(fileTypes: Record<string, number>, totalSize: number, fileCount: number): string {
    const dominantTypes = Object.entries(fileTypes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([type, count]) => `${count} ${type} files`)
      .join(', ');

    return `Analyze this project and provide actionable insights:

Project Overview:
- Total files: ${fileCount}
- Total size: ${this.formatBytes(totalSize)}
- Main file types: ${dominantTypes}

Provide insights in the following JSON format:
[
  {
    "type": "recommendation|warning|optimization|pattern",
    "title": "Brief title",
    "description": "Detailed description",
    "confidence": 0.8,
    "priority": "low|medium|high|critical",
    "actionable": true,
    "action": "Specific action to take"
  }
]

Focus on:
1. Code quality and maintainability
2. Performance optimization opportunities
3. Security considerations
4. Best practices for the detected file types
5. Duplicate file detection
6. Unused or obsolete files`;
  }

  /**
   * Format bytes to human readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Update usage metrics
   */
  private updateMetrics(backendName: string, insights: AIInsight[], responseTime: number): void {
    const backendMetrics = this.metrics.backends.get(backendName) || {
      requests: 0,
      tokens: 0,
      cost: 0,
      avgResponseTime: 0,
      errors: 0,
      successRate: 0,
    };

    backendMetrics.requests++;
    backendMetrics.avgResponseTime = 
      (backendMetrics.avgResponseTime * (backendMetrics.requests - 1) + responseTime) / 
      backendMetrics.requests;

    this.metrics.backends.set(backendName, backendMetrics);
    this.metrics.total.insights += insights.length;
  }

  /**
   * Get backend status and metrics
   */
  getBackendStatus(): Map<string, AIBackendConfig> {
    const status = new Map();
    this.backends.forEach((backend, name) => {
      status.set(name, backend.config);
    });
    return status;
  }

  /**
   * Get usage metrics
   */
  getMetrics(): UsageMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      backends: new Map(),
      total: {
        insights: 0,
        accuracy: 0,
        userSatisfaction: 0,
        cost: 0,
      },
    };
  }

  /**
   * Test all backends availability
   */
  async testBackends(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [name, backend] of this.backends) {
      try {
        results[name] = backend.config.available;
      } catch (error) {
        results[name] = false;
      }
    }

    return results;
  }
}

export default UnifiedAIService;