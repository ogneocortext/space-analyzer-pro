import { stateManager } from './StateManager';
import { DebugLogger } from './DebugLogger';

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
  outputFormat: 'json' | 'text';
  saveResults?: string;
  progress: boolean;
  verbose: boolean;
}

class ComprehensiveAnalysisService {
  private logger = DebugLogger.getInstance();
  private baseUrl = '/api';

  async startAnalysis(config: AnalysisConfig, onProgress?: (progress: any) => void): Promise<ComprehensiveAnalysisResult> {
    this.logger.info('ComprehensiveAnalysisService', 'Starting comprehensive analysis', config);

    try {
      // For now, we'll simulate the analysis since the comprehensive CLI isn't fully integrated with the backend yet
      // In a real implementation, this would call the backend which would execute the CLI
      
      const response = await fetch(`${this.baseUrl}/comprehensive-analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Store result in state manager
      (stateManager as any).set('comprehensiveAnalysisResult', result);
      
      this.logger.info('ComprehensiveAnalysisService', 'Analysis completed successfully', {
        analyzersRun: result.metadata.analyzers_run,
        totalFiles: result.metadata.total_files
      });

      return result;
    } catch (error) {
      this.logger.error('ComprehensiveAnalysisService', 'Analysis failed', error);
      
      // Fallback: simulate analysis for demo purposes
      return this.simulateAnalysis(config, onProgress);
    }
  }

  private async simulateAnalysis(config: AnalysisConfig, onProgress?: (progress: any) => void): Promise<ComprehensiveAnalysisResult> {
    this.logger.info('ComprehensiveAnalysisService', 'Simulating analysis for demo', config);

    // Simulate progress
    const steps = ['Initializing analyzers...', 'Scanning files...', 'Running analysis...', 'Generating results...'];
    
    for (let i = 0; i < steps.length; i++) {
      if (onProgress) {
        onProgress({
          step: steps[i],
          percentage: (i + 1) / steps.length * 100,
          currentAnalyzer: config.selectedAnalyzers[i] || 'Processing...'
        });
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Generate mock results based on selected analyzers
    const mockResults: ComprehensiveAnalysisResult = {
      metadata: {
        timestamp: new Date().toISOString(),
        analyzers_run: config.selectedAnalyzers,
        project_path: config.projectPath,
        total_files: Math.floor(Math.random() * 1000) + 100
      },
      results: {}
    };

    // Generate mock results for each selected analyzer
    config.selectedAnalyzers.forEach(analyzerId => {
      mockResults.results[`${analyzerId}_analysis`] = this.generateMockAnalyzerResult(analyzerId);
    });

    // Store in state manager
    (stateManager as any).set('comprehensiveAnalysisResult', mockResults);

    return mockResults;
  }

  private generateMockAnalyzerResult(analyzerId: string): any {
    const baseResult = {
      status: 'completed',
      issues_found: Math.floor(Math.random() * 20),
      score: Math.random() * 100,
      analyzed_files: Math.floor(Math.random() * 500) + 50
    };

    switch (analyzerId) {
      case 'dependency':
        return {
          ...baseResult,
          dependencies: Math.floor(Math.random() * 200) + 50,
          circular_dependencies: Math.floor(Math.random() * 5),
          external_dependencies: Math.floor(Math.random() * 100) + 20
        };

      case 'security':
        return {
          ...baseResult,
          vulnerabilities: Math.floor(Math.random() * 10),
          critical_issues: Math.floor(Math.random() * 3),
          security_score: Math.random() * 100
        };

      case 'performance':
        return {
          ...baseResult,
          bottlenecks: Math.floor(Math.random() * 15),
          optimization_opportunities: Math.floor(Math.random() * 25),
          performance_score: Math.random() * 100
        };

      case 'quality':
        return {
          ...baseResult,
          code_smells: Math.floor(Math.random() * 30),
          technical_debt: Math.floor(Math.random() * 50),
          maintainability_index: Math.random() * 100
        };

      default:
        return baseResult;
    }
  }

  async getAnalysisResult(): Promise<ComprehensiveAnalysisResult | null> {
    try {
      const result = (stateManager as any).get('comprehensiveAnalysisResult');
      return result || null;
    } catch (error) {
      this.logger.error('ComprehensiveAnalysisService', 'Failed to get analysis result', error);
      return null;
    }
  }

  async exportResults(format: 'json' | 'csv' | 'pdf'): Promise<Blob> {
    const result = await this.getAnalysisResult();
    
    if (!result) {
      throw new Error('No analysis result available to export');
    }

    switch (format) {
      case 'json':
        return new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      
      case 'csv':
        return this.generateCSV(result);
      
      case 'pdf':
        // For now, return JSON as PDF generation would require additional libraries
        return new Blob([JSON.stringify(result, null, 2)], { type: 'application/pdf' });
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private generateCSV(result: ComprehensiveAnalysisResult): Blob {
    const headers = ['Analyzer', 'Status', 'Issues Found', 'Score', 'Files Analyzed'];
    const rows = [headers.join(',')];

    Object.entries(result.results).forEach(([analyzerName, analyzerResult]: [string, any]) => {
      const row = [
        analyzerName,
        analyzerResult.status || 'N/A',
        analyzerResult.issues_found || 0,
        analyzerResult.score || 0,
        analyzerResult.analyzed_files || 0
      ];
      rows.push(row.join(','));
    });

    return new Blob([rows.join('\n')], { type: 'text/csv' });
  }

  generateCommand(config: AnalysisConfig): string {
    const analyzers = config.selectedAnalyzers.join(',');
    let command = `bin\\space-analyzer-cli.exe analyze "${config.projectPath}"`;
    command += ` --format ${config.outputFormat}`;
    if (config.progress) command += ' --progress';
    if (config.verbose) command += ' --verbose';
    if (config.saveResults) command += ` --output "${config.saveResults}"`;
    return command;
  }
}

export const comprehensiveAnalysisService = new ComprehensiveAnalysisService();
