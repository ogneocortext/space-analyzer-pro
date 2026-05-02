/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

import { stateManager } from "./StateManager";
import { DebugLogger } from "./DebugLogger";

export interface ComprehensiveAnalysisResult {
  metadata: {
    timestamp: string;
    analyzers_run: string[];
    project_path: string;
    total_files: number;
  };
  results: {
    [analyzerName: string]: any;
  };
}

export interface AnalysisConfig {
  projectPath: string;
  selectedAnalyzers: string[];
  outputFormat: "json" | "text";
  saveResults?: string;
  progress: boolean;
  verbose: boolean;
  allowSimulation?: boolean; // Allow fallback to simulated data if real analysis unavailable
}

export interface CodeQualityResult {
  success: boolean;
  projectPath: string;
  timestamp: string;
  dataSource: "real" | "simulated";
  toolsUsed: string[];
  summary: {
    totalFiles: number;
    totalIssues: number;
    errors: number;
    warnings: number;
    fixable: number;
    score: number;
  };
  analysis: {
    eslint?: {
      status: string;
      summary: {
        total: number;
        errors: number;
        warnings: number;
        fixable: number;
        filesAnalyzed: number;
      };
      issues: Array<{
        file: string;
        line: number;
        column: number;
        rule: string;
        message: string;
        severity: "error" | "warning";
        category: string;
        fixable: boolean;
      }>;
      score: number;
    };
    complexity?: {
      status: string;
      summary: {
        totalFunctions: number;
        averageComplexity: number;
        highComplexity: number;
        veryHighComplexity: number;
      };
    };
  };
  duration: number;
  error?: string;
}

export interface ToolsStatus {
  success: boolean;
  tools: {
    eslint: boolean;
    typescript: boolean;
    security: boolean;
    complexity: boolean;
  };
  installCommands: Record<string, string>;
}

class ComprehensiveAnalysisService {
  private logger = DebugLogger.getInstance();
  private baseUrl = "/api";
  private lastResult: CodeQualityResult | null = null;

  /**
   * Check if analysis tools are available
   */
  async checkToolsStatus(): Promise<ToolsStatus> {
    try {
      const response = await fetch(`${this.baseUrl}/analysis/tools-status`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      this.logger.error("ComprehensiveAnalysisService", "Failed to check tools status", error);
      return {
        success: false,
        tools: { eslint: false, typescript: false, security: false, complexity: false },
        installCommands: {},
      };
    }
  }

  /**
   * Install analysis tools (returns install commands)
   */
  async getInstallCommands(tools?: string[]): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/analysis/install-tools`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tools }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const result = await response.json();
      return result.commands || [];
    } catch (error) {
      this.logger.error("ComprehensiveAnalysisService", "Failed to get install commands", error);
      return [
        "npm install --save-dev eslint",
        "npm install --save-dev typescript @typescript-eslint/parser @typescript-eslint/eslint-plugin",
      ];
    }
  }

  /**
   * Start comprehensive analysis - tries real API first, falls back to simulation if allowed
   */
  async startAnalysis(
    config: AnalysisConfig,
    onProgress?: (progress: any) => void
  ): Promise<CodeQualityResult> {
    this.logger.info("ComprehensiveAnalysisService", "Starting comprehensive analysis", config);

    // Try real code quality analysis first
    try {
      const realResult = await this.runRealAnalysis(config, onProgress);
      if (realResult.success) {
        this.lastResult = realResult;
        (stateManager as any).set("comprehensiveAnalysisResult", realResult);
        return realResult;
      }
    } catch (error) {
      this.logger.warn(
        "ComprehensiveAnalysisService",
        "Real analysis failed, checking fallback options",
        error
      );
    }

    // Only simulate if explicitly allowed
    if (config.allowSimulation) {
      this.logger.info("ComprehensiveAnalysisService", "Falling back to simulated analysis");
      const simulatedResult = await this.simulateAnalysis(config, onProgress);
      this.lastResult = simulatedResult;
      (stateManager as any).set("comprehensiveAnalysisResult", simulatedResult);
      return simulatedResult;
    }

    // Return error state with tools status
    const toolsStatus = await this.checkToolsStatus();
    const errorResult: CodeQualityResult = {
      success: false,
      projectPath: config.projectPath,
      timestamp: new Date().toISOString(),
      dataSource: "real",
      toolsUsed: [],
      summary: {
        totalFiles: 0,
        totalIssues: 0,
        errors: 0,
        warnings: 0,
        fixable: 0,
        score: 0,
      },
      analysis: {},
      duration: 0,
      error: toolsStatus.tools.eslint
        ? "Analysis failed - check server logs"
        : "ESLint not installed. Run: npm install --save-dev eslint",
    };

    this.lastResult = errorResult;
    return errorResult;
  }

  /**
   * Run real code quality analysis via API
   */
  private async runRealAnalysis(
    config: AnalysisConfig,
    onProgress?: (progress: any) => void
  ): Promise<CodeQualityResult> {
    this.logger.info("ComprehensiveAnalysisService", "Running real code quality analysis");

    if (onProgress) {
      onProgress({ step: "Initializing analysis tools...", percentage: 10 });
    }

    const response = await fetch(`${this.baseUrl}/analysis/code-quality`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectPath: config.projectPath }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const apiResult = await response.json();

    if (onProgress) {
      onProgress({ step: "Processing results...", percentage: 100 });
    }

    // Transform API result to CodeQualityResult format
    return {
      success: apiResult.success,
      projectPath: apiResult.projectPath,
      timestamp: apiResult.timestamp,
      dataSource: "real",
      toolsUsed: apiResult.toolsUsed || [],
      summary: apiResult.summary || {
        totalFiles: 0,
        totalIssues: 0,
        errors: 0,
        warnings: 0,
        fixable: 0,
        score: apiResult.analysis?.eslint?.score || 0,
      },
      analysis: apiResult.analysis || {},
      duration: apiResult.duration || 0,
      error: apiResult.error,
    };
  }

  /**
   * Analyze a single file
   */
  async analyzeFile(filePath: string): Promise<CodeQualityResult> {
    this.logger.info("ComprehensiveAnalysisService", "Analyzing single file", { filePath });

    try {
      const response = await fetch(
        `${this.baseUrl}/analysis/file?path=${encodeURIComponent(filePath)}`
      );
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      return {
        success: result.success,
        projectPath: filePath,
        timestamp: new Date().toISOString(),
        dataSource: "real",
        toolsUsed: result.eslint ? ["eslint"] : [],
        summary: {
          totalFiles: 1,
          totalIssues: result.eslint?.summary?.total || 0,
          errors: result.eslint?.summary?.errors || 0,
          warnings: result.eslint?.summary?.warnings || 0,
          fixable: result.eslint?.summary?.fixable || 0,
          score: result.eslint?.score || 0,
        },
        analysis: {
          eslint: result.eslint,
          complexity: result.complexity,
        },
        duration: 0,
      };
    } catch (error) {
      this.logger.error("ComprehensiveAnalysisService", "Single file analysis failed", error);
      return {
        success: false,
        projectPath: filePath,
        timestamp: new Date().toISOString(),
        dataSource: "real",
        toolsUsed: [],
        summary: { totalFiles: 0, totalIssues: 0, errors: 0, warnings: 0, fixable: 0, score: 0 },
        analysis: {},
        duration: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async simulateAnalysis(
    config: AnalysisConfig,
    onProgress?: (progress: any) => void
  ): Promise<CodeQualityResult> {
    this.logger.warn("ComprehensiveAnalysisService", "⚠️ Using SIMULATED analysis data", config);

    // Simulate progress
    const steps = [
      { step: "Initializing analyzers...", percentage: 10 },
      { step: "Scanning files...", percentage: 30 },
      { step: "Running ESLint...", percentage: 60 },
      { step: "Analyzing complexity...", percentage: 80 },
      { step: "Generating results...", percentage: 100 },
    ];

    for (const progress of steps) {
      if (onProgress) {
        onProgress({
          step: progress.step,
          percentage: progress.percentage,
          currentAnalyzer: "Simulated",
          dataSource: "simulated",
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Generate simulated results with realistic patterns (NOT random)
    const totalFiles = 150;
    const errorRate = 0.05; // 5% error rate
    const warningRate = 0.15; // 15% warning rate

    const totalIssues = Math.floor(totalFiles * (errorRate + warningRate));
    const errors = Math.floor(totalFiles * errorRate);
    const warnings = totalIssues - errors;
    const fixable = Math.floor(warnings * 0.7); // 70% of warnings are auto-fixable

    // Generate simulated issues with realistic patterns
    const simulatedIssues = [];
    const commonIssues = [
      { rule: "semi", message: "Missing semicolon", category: "style", severity: "error" },
      {
        rule: "quotes",
        message: "Strings must use doublequote",
        category: "style",
        severity: "error",
      },
      {
        rule: "no-unused-vars",
        message: "'foo' is assigned but never used",
        category: "best-practices",
        severity: "warning",
      },
      {
        rule: "no-console",
        message: "Unexpected console statement",
        category: "best-practices",
        severity: "warning",
      },
      {
        rule: "indent",
        message: "Expected indentation of 2 spaces",
        category: "style",
        severity: "error",
      },
    ];

    for (let i = 0; i < totalIssues; i++) {
      const issueTemplate = commonIssues[i % commonIssues.length];
      simulatedIssues.push({
        file: `/src/components/${i % 20}/File${i}.js`,
        line: 10 + (i % 50),
        column: 1 + (i % 10),
        rule: issueTemplate.rule,
        message: issueTemplate.message,
        severity: i < errors ? "error" : "warning",
        category: issueTemplate.category,
        fixable: i >= errors && i < errors + fixable,
      });
    }

    const mockResult: CodeQualityResult = {
      success: true,
      projectPath: config.projectPath,
      timestamp: new Date().toISOString(),
      dataSource: "simulated", // ⚠️ Clearly marked as simulated
      toolsUsed: ["simulated-eslint"],
      summary: {
        totalFiles,
        totalIssues,
        errors,
        warnings,
        fixable,
        score: Math.max(0, 100 - errors * 5 - warnings),
      },
      analysis: {
        eslint: {
          status: "completed",
          summary: {
            total: totalIssues,
            errors,
            warnings,
            fixable,
            filesAnalyzed: totalFiles,
          },
          issues: simulatedIssues,
          score: Math.max(0, 100 - errors * 5 - warnings),
        },
        complexity: {
          status: "completed",
          summary: {
            totalFunctions: 45,
            averageComplexity: 4.2,
            highComplexity: 3,
            veryHighComplexity: 0,
          },
        },
      },
      duration: 2500, // 2.5 seconds
    };

    return mockResult;
  }

  private generateMockAnalyzerResult(analyzerId: string): any {
    const baseResult = {
      status: "completed",
      issues_found: Math.floor(Math.random() * 20),
      score: Math.random() * 100,
      analyzed_files: Math.floor(Math.random() * 500) + 50,
    };

    switch (analyzerId) {
      case "dependency":
        return {
          ...baseResult,
          dependencies: Math.floor(Math.random() * 200) + 50,
          circular_dependencies: Math.floor(Math.random() * 5),
          external_dependencies: Math.floor(Math.random() * 100) + 20,
        };

      case "security":
        return {
          ...baseResult,
          vulnerabilities: Math.floor(Math.random() * 10),
          critical_issues: Math.floor(Math.random() * 3),
          security_score: Math.random() * 100,
        };

      case "performance":
        return {
          ...baseResult,
          bottlenecks: Math.floor(Math.random() * 15),
          optimization_opportunities: Math.floor(Math.random() * 25),
          performance_score: Math.random() * 100,
        };

      case "quality":
        return {
          ...baseResult,
          code_smells: Math.floor(Math.random() * 30),
          technical_debt: Math.floor(Math.random() * 50),
          maintainability_index: Math.random() * 100,
        };

      default:
        return baseResult;
    }
  }

  async getAnalysisResult(): Promise<ComprehensiveAnalysisResult | null> {
    try {
      const result = (stateManager as any).get("comprehensiveAnalysisResult");
      return result || null;
    } catch (error) {
      this.logger.error("ComprehensiveAnalysisService", "Failed to get analysis result", error);
      return null;
    }
  }

  async exportResults(format: "json" | "csv" | "pdf"): Promise<Blob> {
    const result = await this.getAnalysisResult();

    if (!result) {
      throw new Error("No analysis result available to export");
    }

    switch (format) {
      case "json":
        return new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });

      case "csv":
        return this.generateCSV(result);

      case "pdf":
        // For now, return JSON as PDF generation would require additional libraries
        return new Blob([JSON.stringify(result, null, 2)], { type: "application/pdf" });

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private generateCSV(result: ComprehensiveAnalysisResult): Blob {
    const headers = ["Analyzer", "Status", "Issues Found", "Score", "Files Analyzed"];
    const rows = [headers.join(",")];

    Object.entries(result.results).forEach(([analyzerName, analyzerResult]: [string, any]) => {
      const row = [
        analyzerName,
        analyzerResult.status || "N/A",
        analyzerResult.issues_found || 0,
        analyzerResult.score || 0,
        analyzerResult.analyzed_files || 0,
      ];
      rows.push(row.join(","));
    });

    return new Blob([rows.join("\n")], { type: "text/csv" });
  }

  generateCommand(config: AnalysisConfig): string {
    const analyzers = config.selectedAnalyzers.join(",");
    let command = `bin\\space-analyzer-cli.exe analyze "${config.projectPath}"`;
    command += ` --format ${config.outputFormat}`;
    if (config.progress) command += " --progress";
    if (config.verbose) command += " --verbose";
    if (config.saveResults) command += ` --output "${config.saveResults}"`;
    return command;
  }
}

export const comprehensiveAnalysisService = new ComprehensiveAnalysisService();
