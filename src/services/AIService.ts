/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

// AI Service with Ollama (Local) and Gemini (Cloud Fallback) Integration
// Includes comprehensive usage tracking for Gemini API

interface AIServiceConfig {
  ollamaEndpoint: string;
  geminiApiKey: string;
  usageTracking: boolean;
  fallbackStrategy: "ollama-first" | "gemini-first" | "ollama-only" | "gemini-only";
}

interface UsageMetrics {
  ollama: {
    requests: number;
    tokens: number;
    avgResponseTime: number;
    errors: number;
  };
  gemini: {
    requests: number;
    tokens: number;
    cost: number;
    avgResponseTime: number;
    errors: number;
  };
  total: {
    insights: number;
    accuracy: number;
    userSatisfaction: number;
    cost: number;
  };
}

interface AIInsight {
  id: string;
  type: "recommendation" | "warning" | "optimization" | "pattern";
  title: string;
  description: string;
  confidence: number;
  priority: "low" | "medium" | "high" | "critical";
  actionable: boolean;
  action?: string;
  source: "ollama" | "gemini";
  timestamp: number;
}

interface AnalysisOptions {
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
  includeRecommendations?: boolean;
  includePatterns?: boolean;
  includeOptimizations?: boolean;
  maxInsights?: number;
}

export class AIService {
  private config: AIServiceConfig;
  private metrics: UsageMetrics;
  private geminiCostPerToken = 0.000001; // $0.001 per 1K tokens
  private geminiDailyLimit = 100; // $100 daily limit
  private geminiDailyUsage = 0;

  constructor(config: AIServiceConfig) {
    this.config = config;
    this.metrics = {
      ollama: { requests: 0, tokens: 0, avgResponseTime: 0, errors: 0 },
      gemini: { requests: 0, tokens: 0, cost: 0, avgResponseTime: 0, errors: 0 },
      total: { insights: 0, accuracy: 0, userSatisfaction: 0, cost: 0 },
    };

    // Load saved metrics
    this.loadMetrics();

    // Reset daily usage if needed
    this.resetDailyUsageIfNeeded();
  }

  // Main analysis method
  async analyzeProject(files: any[], options: AnalysisOptions = {}): Promise<AIInsight[]> {
    const startTime = Date.now();
    const insights: AIInsight[] = [];

    try {
      // Prepare project context
      const projectContext = this.prepareProjectContext(files);

      // Generate insights based on configuration
      if (this.config.fallbackStrategy === "ollama-only") {
        const ollamaInsights = await this.generateOllamaInsights(projectContext, options);
        insights.push(...ollamaInsights);
      } else if (this.config.fallbackStrategy === "gemini-only") {
        const geminiInsights = await this.generateGeminiInsights(projectContext, options);
        insights.push(...geminiInsights);
      } else {
        // Try primary strategy first, then fallback
        const primaryService =
          this.config.fallbackStrategy === "ollama-first" ? "ollama" : "gemini";
        const fallbackService = primaryService === "ollama" ? "gemini" : "ollama";

        try {
          const primaryInsights = await this.generateInsights(
            primaryService,
            projectContext,
            options
          );
          insights.push(...primaryInsights);
        } catch (error) {
          console.warn(`Primary service (${primaryService}) failed, trying fallback:`, error);
          const fallbackInsights = await this.generateInsights(
            fallbackService,
            projectContext,
            options
          );
          insights.push(...fallbackInsights);
        }
      }

      // Update metrics
      const endTime = Date.now();
      this.metrics.total.insights += insights.length;
      this.metrics.total.cost += this.metrics.gemini.cost;

      // Save metrics
      this.saveMetrics();

      return insights;
    } catch (error) {
      console.error("AI analysis failed:", error);
      throw error;
    }
  }

  // Generate insights using specified service
  private async generateInsights(
    service: "ollama" | "gemini",
    context: any,
    options: AnalysisOptions
  ): Promise<AIInsight[]> {
    if (service === "ollama") {
      return this.generateOllamaInsights(context, options);
    } else {
      return this.generateGeminiInsights(context, options);
    }
  }

  // Generate insights using Ollama (Local)
  private async generateOllamaInsights(
    context: any,
    options: AnalysisOptions
  ): Promise<AIInsight[]> {
    const startTime = Date.now();

    try {
      // Check if Ollama is available
      const available = await this.checkOllamaAvailability();
      if (!available) {
        throw new Error("Ollama service not available");
      }

      // Prepare prompt for Ollama
      const prompt = this.prepareOllamaPrompt(context);

      // Call Ollama API
      const response = await fetch(`${this.config.ollamaEndpoint}/api/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama2", // or other available models
          prompt,
          stream: false,
          options: {
            temperature: 0.7,
            max_tokens: 1000,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const result = await response.json();
      const insights = this.parseOllamaResponse(result.response, "ollama");

      // Update metrics
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      this.metrics.ollama.requests++;
      this.metrics.ollama.avgResponseTime =
        (this.metrics.ollama.avgResponseTime * (this.metrics.ollama.requests - 1) + responseTime) /
        this.metrics.ollama.requests;

      // Report progress
      if (options.onProgress) {
        options.onProgress(100);
      }

      return insights;
    } catch (error) {
      this.metrics.ollama.errors++;
      throw error;
    }
  }

  // Generate insights using Gemini (Cloud)
  private async generateGeminiInsights(
    context: any,
    options: AnalysisOptions
  ): Promise<AIInsight[]> {
    const startTime = Date.now();

    try {
      // Check daily usage limits
      if (this.geminiDailyUsage >= this.geminiDailyLimit) {
        throw new Error("Daily Gemini usage limit exceeded");
      }

      // Prepare prompt for Gemini
      const prompt = this.prepareGeminiPrompt(context);

      // Call Gemini API
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${this.config.geminiApiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 1000,
              topP: 0.8,
              topK: 40,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.statusText}`);
      }

      const result = await response.json();
      const insights = this.parseGeminiResponse(result, "gemini");

      // Calculate cost and update metrics
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      const tokens = this.estimateTokens(prompt + JSON.stringify(result));
      const cost = tokens * this.geminiCostPerToken;

      this.metrics.gemini.requests++;
      this.metrics.gemini.tokens += tokens;
      this.metrics.gemini.cost += cost;
      this.metrics.gemini.avgResponseTime =
        (this.metrics.gemini.avgResponseTime * (this.metrics.gemini.requests - 1) + responseTime) /
        this.metrics.gemini.requests;

      this.geminiDailyUsage += cost;

      // Report progress
      if (options.onProgress) {
        options.onProgress(100);
      }

      return insights;
    } catch (error) {
      this.metrics.gemini.errors++;
      throw error;
    }
  }

  // Check Ollama availability
  private async checkOllamaAvailability(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.ollamaEndpoint}/api/tags`);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Prepare project context
  private prepareProjectContext(files: any[]): any {
    const fileStats = {
      total: files.length,
      byType: {} as Record<string, number>,
      bySize: {
        total: 0,
        average: 0,
        largest: 0,
      },
      byComplexity: {
        simple: 0,
        medium: 0,
        complex: 0,
      },
    };

    files.forEach((file) => {
      const ext = file.path.split(".").pop()?.toLowerCase() || "unknown";
      fileStats.byType[ext] = (fileStats.byType[ext] || 0) + 1;
      fileStats.bySize.total += file.size || 0;

      if (file.size > fileStats.bySize.largest) {
        fileStats.bySize.largest = file.size;
      }
    });

    fileStats.bySize.average = fileStats.bySize.total / files.length;

    return {
      fileStats,
      sampleFiles: files.slice(0, 10).map((f) => ({
        path: f.path,
        size: f.size,
        type: f.path.split(".").pop(),
      })),
    };
  }

  // Prepare Ollama prompt
  private prepareOllamaPrompt(context: any): string {
    return `
You are an expert code analyzer. Analyze the following project context and provide actionable insights:

Project Statistics:
- Total files: ${context.fileStats.total}
- File types: ${JSON.stringify(context.fileStats.byType, null, 2)}
- Size distribution: Total: ${context.fileStats.bySize.total} bytes, Average: ${context.fileStats.bySize.average} bytes

Sample files:
${context.sampleFiles.map((f) => `- ${f.path} (${f.type}, ${f.size} bytes)`).join("\n")}

Please provide 5-7 specific insights in the following JSON format:
{
  "insights": [
    {
      "type": "recommendation|warning|optimization|pattern",
      "title": "Brief title",
      "description": "Detailed description",
      "priority": "low|medium|high|critical",
      "confidence": 0.8,
      "actionable": true,
      "action": "Specific action to take"
    }
  ]
}

Focus on:
1. Code organization and structure
2. Potential performance issues
3. Security considerations
4. Maintainability concerns
5. Best practices violations
`;
  }

  // Prepare Gemini prompt
  private prepareGeminiPrompt(context: any): string {
    return `
You are an expert software architect and code analyst. Analyze the following project and provide comprehensive insights:

PROJECT ANALYSIS REQUEST

Project Overview:
- Total files: ${context.fileStats.total}
- File distribution: ${JSON.stringify(context.fileStats.byType, null, 2)}
- Size metrics: Total: ${context.fileStats.bySize.total} bytes, Average: ${context.fileStats.bySize.average} bytes, Largest: ${context.fileStats.bySize.largest} bytes

Sample files structure:
${context.sampleFiles.map((f) => `- ${f.path} (${f.type}, ${f.size} bytes)`).join("\n")}

ANALYSIS REQUIREMENTS:
Provide 8-10 detailed insights covering:
1. Architecture patterns and design principles
2. Code quality and maintainability issues
3. Performance optimization opportunities
4. Security vulnerabilities and best practices
5. Dependency management and modularity
6. Testing and documentation gaps
7. Scalability concerns
8. Technology stack recommendations

RESPONSE FORMAT:
Return a JSON object with this structure:
{
  "insights": [
    {
      "type": "recommendation|warning|optimization|pattern",
      "title": "Concise, actionable title",
      "description": "Detailed explanation with specific examples",
      "priority": "low|medium|high|critical",
      "confidence": 0.85,
      "actionable": true,
      "action": "Specific, executable action or recommendation"
    }
  ]
}

Each insight should be:
- Specific and actionable
- Relevant to the project context
- Prioritized by impact
- Include confidence level (0.0-1.0)
- Provide clear next steps
`;
  }

  // Parse Ollama response
  private parseOllamaResponse(response: string, source: "ollama" | "gemini"): AIInsight[] {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const insights = parsed.insights || [];

      return insights.map((insight: any, index: number) => ({
        id: `${source}-${Date.now()}-${index}`,
        type: insight.type || "recommendation",
        title: insight.title || "Untitled Insight",
        description: insight.description || "No description available",
        confidence: insight.confidence || 0.5,
        priority: insight.priority || "medium",
        actionable: insight.actionable || false,
        action: insight.action,
        source,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error("Failed to parse Ollama response:", error);
      return [];
    }
  }

  // Parse Gemini response
  private parseGeminiResponse(response: any, source: "ollama" | "gemini"): AIInsight[] {
    try {
      const content = response.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!content) {
        throw new Error("No content found in Gemini response");
      }

      return this.parseOllamaResponse(content, source);
    } catch (error) {
      console.error("Failed to parse Gemini response:", error);
      return [];
    }
  }

  // Estimate tokens (rough approximation)
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4); // Rough estimate: 1 token ≈ 4 characters
  }

  // Execute AI action
  async executeAction(action: string, files: any[]): Promise<void> {
    // This would implement the actual action execution
    // For now, we'll just log it
    console.warn("Executing AI action:", action);

    // Update user satisfaction (mock implementation)
    this.metrics.total.userSatisfaction = Math.min(1.0, this.metrics.total.userSatisfaction + 0.1);
    this.saveMetrics();
  }

  // Get usage metrics
  async getUsageMetrics(): Promise<UsageMetrics> {
    return { ...this.metrics };
  }

  // Reset metrics
  resetMetrics(): void {
    this.metrics = {
      ollama: { requests: 0, tokens: 0, avgResponseTime: 0, errors: 0 },
      gemini: { requests: 0, tokens: 0, cost: 0, avgResponseTime: 0, errors: 0 },
      total: { insights: 0, accuracy: 0, userSatisfaction: 0, cost: 0 },
    };
    this.saveMetrics();
  }

  // Get Gemini usage status
  getGeminiUsageStatus(): {
    used: number;
    limit: number;
    remaining: number;
    percentage: number;
  } {
    return {
      used: this.geminiDailyUsage,
      limit: this.geminiDailyLimit,
      remaining: Math.max(0, this.geminiDailyLimit - this.geminiDailyUsage),
      percentage: (this.geminiDailyUsage / this.geminiDailyLimit) * 100,
    };
  }

  // Check if Gemini is available
  isGeminiAvailable(): boolean {
    return this.geminiDailyUsage < this.geminiDailyLimit;
  }

  // Load metrics from storage
  private loadMetrics(): void {
    try {
      const saved = localStorage.getItem("ai-service-metrics");
      if (saved) {
        const parsed = JSON.parse(saved);
        this.metrics = { ...this.metrics, ...parsed };
      }

      const savedDailyUsage = localStorage.getItem("gemini-daily-usage");
      if (savedDailyUsage) {
        const parsed = JSON.parse(savedDailyUsage);
        if (new Date(parsed.date).toDateString() === new Date().toDateString()) {
          this.geminiDailyUsage = parsed.usage;
        }
      }
    } catch (error) {
      console.error("Failed to load metrics:", error);
    }
  }

  // Save metrics to storage
  private saveMetrics(): void {
    try {
      localStorage.setItem("ai-service-metrics", JSON.stringify(this.metrics));
      localStorage.setItem(
        "gemini-daily-usage",
        JSON.stringify({
          date: new Date().toISOString(),
          usage: this.geminiDailyUsage,
        })
      );
    } catch (error) {
      console.error("Failed to save metrics:", error);
    }
  }

  // Reset daily usage if needed
  private resetDailyUsageIfNeeded(): void {
    const saved = localStorage.getItem("gemini-daily-usage");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (new Date(parsed.date).toDateString() !== new Date().toDateString()) {
        this.geminiDailyUsage = 0;
        this.saveMetrics();
      }
    }
  }

  // Update accuracy metrics
  updateAccuracy(feedback: "positive" | "negative"): void {
    const weight = feedback === "positive" ? 0.1 : -0.05;
    this.metrics.total.accuracy = Math.max(0, Math.min(1, this.metrics.total.accuracy + weight));
    this.saveMetrics();
  }

  // Get cost projection
  getCostProjection(estimatedInsights: number): {
    ollama: number;
    gemini: number;
    recommended: string;
  } {
    const ollamaCost = 0; // Local model is free
    const geminiCost = estimatedInsights * 1000 * this.geminiCostPerToken; // Estimate 1K tokens per insight

    return {
      ollama: ollamaCost,
      gemini: geminiCost,
      recommended: geminiCost > 10 ? "ollama" : "gemini",
    };
  }
}

export default AIService;
