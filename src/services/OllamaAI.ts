/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

import { AnalysisResult } from "./AnalysisBridge";
import { portDetector } from "./PortDetector";

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  numCtx?: number;
}

export interface AIInsight {
  type: "summary" | "recommendation" | "warning" | "pattern" | "optimization";
  title: string;
  description: string;
  confidence: number;
  priority: "low" | "medium" | "high";
  actionItems?: string[];
}

export interface AIAnalysisResult {
  summary: string;
  insights: AIInsight[];
  recommendations: string[];
  warnings: string[];
  patterns: string[];
  generatedAt: Date;
  modelUsed: string;
  processingTime: number;
}

export class OllamaService {
  private config: OllamaConfig;
  private isAvailable: boolean = false;
  private availableModels: any[] = [];
  private lastCheck = 0;
  private readonly CHECK_INTERVAL = 60000; // 1 minute

  constructor(config?: Partial<OllamaConfig>) {
    const envNumCtx = Number((import.meta as any)?.env?.VITE_OLLAMA_NUM_CTX);
    const defaultNumCtx =
      Number.isFinite(envNumCtx) && envNumCtx >= 2048 ? Math.floor(envNumCtx) : 16384;

    this.config = {
      baseUrl: config?.baseUrl || "http://localhost:11434",
      model: config?.model || "qwen2.5-coder:7b-instruct",
      temperature: config?.temperature || 0.3,
      maxTokens: config?.maxTokens || 2048,
      timeout: config?.timeout || 30000,
      numCtx: config?.numCtx || defaultNumCtx,
    };
    this.initializeBaseUrl();
  }

  private async initializeBaseUrl() {
    try {
      const config = await portDetector.detectAllServers();
      this.config.baseUrl = `${portDetector.getBaseUrl("backend")}`;
      console.warn(`🔗 OllamaAI initialized with backend URL: ${this.config.baseUrl}`);
    } catch (error) {
      console.warn("⚠️ Failed to detect backend port, using fallback");
      this.config.baseUrl = "http://localhost:11434";
    }
  }

  /**
   * Check if Ollama is available
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`);
      if (response.ok) {
        this.isAvailable = true;
        return true;
      }
    } catch (error) {
      console.warn("Ollama not available:", error);
    }
    this.isAvailable = false;
    return false;
  }

  /**
   * Generate a natural language summary of the analysis
   */
  async generateSummary(data: AnalysisResult): Promise<string> {
    const prompt = this.buildSummaryPrompt(data);
    return this.queryModel(prompt);
  }

  /**
   * Analyze files and generate AI insights
   */
  async analyzeFiles(data: AnalysisResult): Promise<AIAnalysisResult> {
    const startTime = Date.now();

    const summary = await this.generateSummary(data);
    const insights = await this.generateInsights(data);
    const recommendations = await this.generateRecommendations(data);
    const warnings = await this.identifyWarnings(data);
    const patterns = await this.identifyPatterns(data);

    return {
      summary,
      insights,
      recommendations,
      warnings,
      patterns,
      generatedAt: new Date(),
      modelUsed: this.config.model,
      processingTime: Date.now() - startTime,
    };
  }

  /**
   * Answer natural language questions about the analysis
   */
  async askQuestion(data: AnalysisResult, question: string): Promise<string> {
    const prompt = `
You are analyzing a file system. Based on the analysis data below, answer the user's question.

## Analysis Data:
- Total Files: ${data.totalFiles.toLocaleString()}
- Total Size: ${(data.totalSize / 1024 / 1024 / 1024).toFixed(2)} GB
- Analysis Type: ${data.analysisType || "Unknown"}

## Categories:
${Object.entries(data.categories || {})
  .map(([cat, info]) => `- ${cat}: ${info.count} files, ${(info.size / 1024 / 1024).toFixed(2)} MB`)
  .join("\n")}

## User Question:
${question}

Please provide a concise, helpful answer based on the analysis data.
`;

    return this.queryModel(prompt);
  }

  /**
   * Get cleanup suggestions for large files
   */
  async suggestCleanup(data: AnalysisResult): Promise<string[]> {
    const largeFiles = data.files
      .filter((f) => f.size > 10 * 1024 * 1024) // > 10MB
      .sort((a, b) => b.size - a.size)
      .slice(0, 20);

    const prompt = `
You are a file system optimization assistant. Based on these large files, suggest cleanup priorities:

${largeFiles.map((f) => `- ${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB): ${f.path}`).join("\n")}

For each file, suggest:
1. Whether it can be safely deleted
2. If it should be archived instead
3. If it's essential and should be kept

Return your response as a numbered list of cleanup actions.
`;

    const response = await this.queryModel(prompt);
    return response
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => line.replace(/^\d+\.\s*/, "").trim());
  }

  /**
   * Build summary prompt
   */
  private buildSummaryPrompt(data: AnalysisResult): string {
    return `
You are a file system analysis assistant. Provide a brief summary (2-3 sentences) of this analysis:

Total Files: ${data.totalFiles.toLocaleString()}
Total Size: ${(data.totalSize / 1024 / 1024 / 1024).toFixed(2)} GB
Categories: ${Object.keys(data.categories || {}).join(", ")}

Focus on the most notable patterns and insights.
Keep it concise and informative.
`;
  }

  /**
   * Generate detailed insights
   */
  private async generateInsights(data: AnalysisResult): Promise<AIInsight[]> {
    const categoryInfo = Object.entries(data.categories || {}).sort(
      (a, b) => b[1].size - a[1].size
    );

    const prompt = `
Analyze this file system and identify key insights. Return as JSON array with objects containing: type, title, description, confidence (0-1), priority (low/medium/high)

File System Data:
- ${categoryInfo.map(([cat, info]) => `${cat}: ${info.count} files, ${(info.size / 1024 / 1024).toFixed(2)} MB`).join("\n- ")}

Identify:
1. Storage patterns
2. Potential issues
3. Optimization opportunities
4. Unusual file distributions

Return only valid JSON array.
`;

    try {
      const response = await this.queryModel(prompt);
      const jsonMatch = response.match(/\[.*\]/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error("Failed to parse AI insights:", error);
    }

    return [];
  }

  /**
   * Generate recommendations
   */
  private async generateRecommendations(data: AnalysisResult): Promise<string[]> {
    const prompt = `
Based on this file system analysis, provide 5 specific recommendations for better organization and storage management:

${Object.entries(data.categories || {})
  .map(([cat, info]) => `- ${cat}: ${info.count} files, ${(info.size / 1024 / 1024).toFixed(2)} MB`)
  .join("\n")}

Consider:
- File organization
- Archive opportunities
- Duplicate handling
- Storage optimization

Return only the recommendations as a numbered list.
`;

    try {
      const response = await this.queryModel(prompt);
      return response
        .split("\n")
        .filter((line) => line.trim().length > 0 && /^\d+\./.test(line))
        .map((line) => line.replace(/^\d+\.\s*/, "").trim());
    } catch (error) {
      console.error("Failed to generate recommendations:", error);
      return [];
    }
  }

  /**
   * Identify warnings
   */
  private async identifyWarnings(data: AnalysisResult): Promise<string[]> {
    const warnings: string[] = [];

    // Check for large directories
    if (data.totalSize > 50 * 1024 * 1024 * 1024) {
      warnings.push(`Large storage usage: ${(data.totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
    }

    // Check for many small files
    if (data.totalFiles > 50000) {
      warnings.push(
        `High file count may impact performance: ${data.totalFiles.toLocaleString()} files`
      );
    }

    // Check for temp/cache files
    const tempPatterns = ["node_modules", ".git", "__pycache__", "*.pyc", "*.log", ".cache"];
    const tempFiles = data.files.filter((f) =>
      tempPatterns.some(
        (pattern) => f.path.includes(pattern) || f.name.endsWith(pattern.replace("*", ""))
      )
    );
    if (tempFiles.length > 100) {
      warnings.push(`Found ${tempFiles.length} temporary/cache files that may be safe to clean`);
    }

    return warnings;
  }

  /**
   * Identify patterns
   */
  private async identifyPatterns(data: AnalysisResult): Promise<string[]> {
    const patterns: string[] = [];
    const categories = data.categories || {};

    // Check for media-heavy storage
    if (categories["Media"]?.size > 5 * 1024 * 1024 * 1024) {
      patterns.push("Media-heavy storage - consider external backup");
    }

    // Check for development-heavy storage
    if (categories["Code"]?.count > 1000) {
      patterns.push("Active development environment with many source files");
    }

    // Check for config-heavy storage
    if (categories["Config"]?.count > 50) {
      patterns.push("Multiple configuration files - ensure version control");
    }

    return patterns;
  }

  /**
   * Query the Ollama model
   */
  private async queryModel(prompt: string): Promise<string> {
    const response = await fetch(`${this.config.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.config.model,
        prompt,
        stream: false,
        options: {
          temperature: this.config.temperature,
          num_predict: this.config.maxTokens,
          num_ctx: this.config.numCtx,
          num_batch: 1024,
          num_keep: 128,
          f16_kv: true,
          repeat_penalty: 1.1,
          repeat_last_n: 64,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama request failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response || "";
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<OllamaConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): OllamaConfig {
    return { ...this.config };
  }

  /**
   * Check if service is available
   */
  isOllamaAvailable(): boolean {
    return this.isAvailable;
  }
}

// Export singleton instance with different name to avoid conflict
export const ollamaAIService = new OllamaService();

// Helper function to check Ollama availability
export async function checkOllamaStatus(): Promise<{ available: boolean; url: string }> {
  const available = await ollamaAIService.checkAvailability();
  return {
    available,
    url: ollamaAIService.getConfig().baseUrl,
  };
}
