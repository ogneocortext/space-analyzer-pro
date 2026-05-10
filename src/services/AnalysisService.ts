/**
 * Analysis Service - Handles shared analysis logic and data processing
 * Extracted from analysis components for better separation of concerns
 */

import { useDebugLogger } from '../utils/DebugUtils';
import { formatFileSize, FileTypeDetector, FilePathUtils } from '../utils/FileUtils';

const logger = useDebugLogger('AnalysisService');

export interface AnalysisConfig {
  projectPath: string;
  selectedAnalyzers: string[];
  maxDepth: number;
  includeHidden: boolean;
  followSymlinks: boolean;
  enableAI: boolean;
  analysisType: 'quick' | 'standard' | 'comprehensive';
}

export interface AnalysisResult {
  id: string;
  timestamp: Date;
  config: AnalysisConfig;
  stats: AnalysisStats;
  files: AnalyzedFile[];
  insights: AnalysisInsight[];
  recommendations: AnalysisRecommendation[];
  performance: AnalysisPerformance;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  error?: string;
}

export interface AnalysisStats {
  totalFiles: number;
  totalSize: number;
  directories: number;
  codeFiles: number;
  mediaFiles: number;
  duplicateFiles: number;
  largeFiles: number;
  oldFiles: number;
  avgFileSize: number;
  maxFileSize: number;
  fileTypes: Record<string, number>;
  depthDistribution: Record<string, number>;
}

export interface AnalyzedFile {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  category: string;
  extension: string;
  isDirectory: boolean;
  depth: number;
  lastModified?: Date;
  permissions?: string;
  hardLinks?: number;
  duplicates?: string[];
  metadata?: Record<string, any>;
}

export interface AnalysisInsight {
  id: string;
  type: 'performance' | 'organization' | 'security' | 'storage' | 'code_quality';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  impact: string;
  files: string[];
  metadata?: Record<string, any>;
}

export interface AnalysisRecommendation {
  id: string;
  title: string;
  description: string;
  category: 'cleanup' | 'optimization' | 'security' | 'organization';
  priority: 'low' | 'medium' | 'high';
  effort: 'easy' | 'medium' | 'hard';
  impact: string;
  action: string;
  files: string[];
}

export interface AnalysisPerformance {
  duration: number;
  filesPerSecond: number;
  memoryUsage: number;
  cpuUsage: number;
  diskIO: number;
  networkIO?: number;
}

export interface AnalyzerDefinition {
  id: string;
  name: string;
  description: string;
  category: 'code' | 'security' | 'performance' | 'storage' | 'general';
  icon: string;
  enabled: boolean;
  config?: Record<string, any>;
  dependencies?: string[];
}

/**
 * Analysis Service Class
 */
export class AnalysisService {
  private static instance: AnalysisService;
  private activeAnalysis: AnalysisResult | null = null;
  private analysisHistory: AnalysisResult[] = [];
  private availableAnalyzers: AnalyzerDefinition[] = [];

  static getInstance(): AnalysisService {
    if (!AnalysisService.instance) {
      AnalysisService.instance = new AnalysisService();
    }
    return AnalysisService.instance;
  }

  constructor() {
    this.initializeAnalyzers();
  }

  /**
   * Initialize available analyzers
   */
  private initializeAnalyzers(): void {
    this.availableAnalyzers = [
      {
        id: 'code-structure',
        name: 'Code Structure Analyzer',
        description: 'Analyzes code organization, dependencies, and architecture',
        category: 'code',
        icon: 'Code',
        enabled: true,
        config: { maxDepth: 10, includeTests: true },
      },
      {
        id: 'security-scan',
        name: 'Security Scanner',
        description: 'Scans for security vulnerabilities and sensitive data',
        category: 'security',
        icon: 'Shield',
        enabled: true,
        config: { scanDepth: 5, includePatterns: ['.key', '.pem', '.password'] },
      },
      {
        id: 'performance-audit',
        name: 'Performance Auditor',
        description: 'Analyzes performance bottlenecks and optimization opportunities',
        category: 'performance',
        icon: 'Zap',
        enabled: true,
        config: { thresholdSize: 1024 * 1024, maxDepth: 8 },
      },
      {
        id: 'duplicate-finder',
        name: 'Duplicate File Finder',
        description: 'Finds duplicate files by content and name',
        category: 'storage',
        icon: 'Copy',
        enabled: true,
        config: { algorithm: 'sha256', minSize: 1024 },
      },
      {
        id: 'size-analyzer',
        name: 'Size Analyzer',
        description: 'Analyzes file size distribution and large files',
        category: 'storage',
        icon: 'Database',
        enabled: true,
        config: { largeFileThreshold: 100 * 1024 * 1024 },
      },
      {
        id: 'dependency-mapper',
        name: 'Dependency Mapper',
        description: 'Maps project dependencies and imports',
        category: 'code',
        icon: 'GitBranch',
        enabled: true,
        config: { includeDevDependencies: true },
      },
      {
        id: 'timestamp-analyzer',
        name: 'Timestamp Analyzer',
        description: 'Analyzes file timestamps and access patterns',
        category: 'general',
        icon: 'Clock',
        enabled: true,
        config: { oldFileThreshold: 365 * 24 * 60 * 60 * 1000 },
      },
      {
        id: 'hard-link-analyzer',
        name: 'Hard Link Analyzer',
        description: 'Analyzes hard links and file system links',
        category: 'storage',
        icon: 'Link',
        enabled: true,
        config: { followLinks: false },
      },
    ];
  }

  /**
   * Get available analyzers
   */
  getAvailableAnalyzers(): AnalyzerDefinition[] {
    return [...this.availableAnalyzers];
  }

  /**
   * Get analyzer by ID
   */
  getAnalyzer(id: string): AnalyzerDefinition | null {
    return this.availableAnalyzers.find(analyzer => analyzer.id === id) || null;
  }

  /**
   * Get analyzers by category
   */
  getAnalyzersByCategory(category: string): AnalyzerDefinition[] {
    return this.availableAnalyzers.filter(analyzer => analyzer.category === category);
  }

  /**
   * Start analysis
   */
  async startAnalysis(config: AnalysisConfig): Promise<AnalysisResult> {
    try {
      logger.info('Starting analysis', { config });
      
      const analysis: AnalysisResult = {
        id: `analysis-${Date.now()}`,
        timestamp: new Date(),
        config,
        stats: this.createEmptyStats(),
        files: [],
        insights: [],
        recommendations: [],
        performance: this.createEmptyPerformance(),
        status: 'running',
      };

      this.activeAnalysis = analysis;
      
      // Simulate analysis process
      const startTime = Date.now();
      
      // Run selected analyzers
      for (const analyzerId of config.selectedAnalyzers) {
        const analyzer = this.getAnalyzer(analyzerId);
        if (analyzer && analyzer.enabled) {
          await this.runAnalyzer(analysis, analyzer);
        }
      }
      
      // Generate insights and recommendations
      this.generateInsights(analysis);
      this.generateRecommendations(analysis);
      
      // Calculate performance metrics
      analysis.performance.duration = Date.now() - startTime;
      analysis.performance.filesPerSecond = analysis.stats.totalFiles / (analysis.performance.duration / 1000);
      
      analysis.status = 'completed';
      this.analysisHistory.push(analysis);
      
      logger.info('Analysis completed', { 
        analysisId: analysis.id,
        duration: analysis.performance.duration,
        filesAnalyzed: analysis.stats.totalFiles,
      });
      
      return analysis;
      
    } catch (error) {
      logger.error('Analysis failed', error);
      
      if (this.activeAnalysis) {
        this.activeAnalysis.status = 'failed';
        this.activeAnalysis.error = error instanceof Error ? error.message : 'Unknown error';
      }
      
      throw error;
    }
  }

  /**
   * Run individual analyzer
   */
  private async runAnalyzer(analysis: AnalysisResult, analyzer: AnalyzerDefinition): Promise<void> {
    try {
      logger.info('Running analyzer', { analyzerId: analyzer.id, name: analyzer.name });
      
      switch (analyzer.id) {
        case 'code-structure':
          await this.runCodeStructureAnalyzer(analysis, analyzer.config);
          break;
        case 'security-scan':
          await this.runSecurityScanner(analysis, analyzer.config);
          break;
        case 'performance-audit':
          await this.runPerformanceAuditor(analysis, analyzer.config);
          break;
        case 'duplicate-finder':
          await this.runDuplicateFinder(analysis, analyzer.config);
          break;
        case 'size-analyzer':
          await this.runSizeAnalyzer(analysis, analyzer.config);
          break;
        case 'dependency-mapper':
          await this.runDependencyMapper(analysis, analyzer.config);
          break;
        case 'timestamp-analyzer':
          await this.runTimestampAnalyzer(analysis, analyzer.config);
          break;
        case 'hard-link-analyzer':
          await this.runHardLinkAnalyzer(analysis, analyzer.config);
          break;
        default:
          logger.warn('Unknown analyzer', { analyzerId: analyzer.id });
      }
      
    } catch (error) {
      logger.error('Analyzer failed', { analyzerId: analyzer.id, error });
      throw error;
    }
  }

  /**
   * Run code structure analyzer
   */
  private async runCodeStructureAnalyzer(analysis: AnalysisResult, config: any): Promise<void> {
    // Simulate code structure analysis
    const codeFiles = analysis.files.filter(file => 
      FileTypeDetector.isCode(file.extension)
    );
    
    analysis.stats.codeFiles = codeFiles.length;
    
    // Add code-specific insights
    if (codeFiles.length > 1000) {
      analysis.insights.push({
        id: 'code-many-files',
        type: 'code_quality',
        title: 'Large Codebase Detected',
        description: `Found ${codeFiles.length} code files. Consider modularization.`,
        severity: 'medium',
        impact: 'Maintainability may be affected by large codebase size',
        files: codeFiles.slice(0, 10).map(f => f.id),
      });
    }
  }

  /**
   * Run security scanner
   */
  private async runSecurityScanner(analysis: AnalysisResult, config: any): Promise<void> {
    // Simulate security scanning
    const sensitiveFiles = analysis.files.filter(file => 
      file.name.toLowerCase().includes('key') ||
      file.name.toLowerCase().includes('password') ||
      file.name.toLowerCase().includes('secret') ||
      file.extension.toLowerCase() === 'pem'
    );
    
    if (sensitiveFiles.length > 0) {
      analysis.insights.push({
        id: 'security-sensitive-files',
        type: 'security',
        title: 'Sensitive Files Detected',
        description: `Found ${sensitiveFiles.length} potentially sensitive files`,
        severity: 'high',
        impact: 'Security risk if not properly protected',
        files: sensitiveFiles.map(f => f.id),
      });
    }
  }

  /**
   * Run performance auditor
   */
  private async runPerformanceAuditor(analysis: AnalysisResult, config: any): Promise<void> {
    // Simulate performance analysis
    const largeFiles = analysis.files.filter(file => 
      file.size > (config.thresholdSize || 1024 * 1024)
    );
    
    analysis.stats.largeFiles = largeFiles.length;
    analysis.stats.maxFileSize = Math.max(...analysis.files.map(f => f.size));
    
    if (largeFiles.length > 0) {
      analysis.insights.push({
        id: 'performance-large-files',
        type: 'performance',
        title: 'Large Files Impact Performance',
        description: `Found ${largeFiles.length} files over ${formatFileSize(config.thresholdSize)}`,
        severity: 'medium',
        impact: 'Large files may slow down file operations',
        files: largeFiles.slice(0, 10).map(f => f.id),
      });
    }
  }

  /**
   * Run duplicate finder
   */
  private async runDuplicateFinder(analysis: AnalysisResult, config: any): Promise<void> {
    // Simulate duplicate detection
    const fileGroups: Record<string, AnalyzedFile[]> = {};
    
    analysis.files.forEach(file => {
      const key = `${file.name}_${file.size}`;
      if (!fileGroups[key]) {
        fileGroups[key] = [];
      }
      fileGroups[key].push(file);
    });
    
    const duplicateGroups = Object.values(fileGroups).filter(group => group.length > 1);
    const duplicateFiles = duplicateGroups.flat();
    
    analysis.stats.duplicateFiles = duplicateFiles.length;
    
    if (duplicateGroups.length > 0) {
      analysis.insights.push({
        id: 'storage-duplicates',
        type: 'storage',
        title: 'Duplicate Files Found',
        description: `Found ${duplicateGroups.length} groups of duplicate files`,
        severity: 'medium',
        impact: 'Duplicate files waste storage space',
        files: duplicateFiles.slice(0, 10).map(f => f.id),
      });
    }
  }

  /**
   * Run size analyzer
   */
  private async runSizeAnalyzer(analysis: AnalysisResult, config: any): Promise<void> {
    // Calculate size statistics
    const totalSize = analysis.files.reduce((sum, file) => sum + file.size, 0);
    analysis.stats.totalSize = totalSize;
    analysis.stats.avgFileSize = totalSize / analysis.files.length;
    
    // Analyze file type distribution
    const fileTypes: Record<string, number> = {};
    analysis.files.forEach(file => {
      const ext = file.extension || 'no-extension';
      fileTypes[ext] = (fileTypes[ext] || 0) + 1;
    });
    analysis.stats.fileTypes = fileTypes;
  }

  /**
   * Run dependency mapper
   */
  private async runDependencyMapper(analysis: AnalysisResult, config: any): Promise<void> {
    // Simulate dependency analysis
    const packageFiles = analysis.files.filter(file => 
      file.name === 'package.json' || 
      file.name === 'requirements.txt' ||
      file.name === 'Cargo.toml' ||
      file.name === 'pom.xml'
    );
    
    if (packageFiles.length > 0) {
      analysis.insights.push({
        id: 'code-dependencies',
        type: 'code_quality',
        title: 'Package Files Found',
        description: `Found ${packageFiles.length} package/dependency files`,
        severity: 'low',
        impact: 'Dependencies should be regularly updated',
        files: packageFiles.map(f => f.id),
      });
    }
  }

  /**
   * Run timestamp analyzer
   */
  private async runTimestampAnalyzer(analysis: AnalysisResult, config: any): Promise<void> {
    // Simulate timestamp analysis
    const now = Date.now();
    const oldFileThreshold = config.oldFileThreshold || (365 * 24 * 60 * 60 * 1000);
    
    const oldFiles = analysis.files.filter(file => 
      file.lastModified && (now - file.lastModified.getTime()) > oldFileThreshold
    );
    
    analysis.stats.oldFiles = oldFiles.length;
    
    if (oldFiles.length > analysis.files.length * 0.3) {
      analysis.insights.push({
        id: 'organization-old-files',
        type: 'organization',
        title: 'Many Old Files',
        description: `${oldFiles.length} files not modified in over a year`,
        severity: 'medium',
        impact: 'Consider archiving old files',
        files: oldFiles.slice(0, 10).map(f => f.id),
      });
    }
  }

  /**
   * Run hard link analyzer
   */
  private async runHardLinkAnalyzer(analysis: AnalysisResult, config: any): Promise<void> {
    // Simulate hard link analysis
    const filesWithLinks = analysis.files.filter(file => 
      file.hardLinks && file.hardLinks > 1
    );
    
    if (filesWithLinks.length > 0) {
      analysis.insights.push({
        id: 'storage-hard-links',
        type: 'storage',
        title: 'Hard Links Detected',
        description: `Found ${filesWithLinks.length} files with hard links`,
        severity: 'low',
        impact: 'Hard links can save space but may complicate management',
        files: filesWithLinks.map(f => f.id),
      });
    }
  }

  /**
   * Generate insights from analysis results
   */
  private generateInsights(analysis: AnalysisResult): void {
    // Generate additional insights based on analysis results
    const insights = [...analysis.insights];
    
    // Directory depth insight
    const maxDepth = Math.max(...analysis.files.map(f => f.depth));
    if (maxDepth > 10) {
      insights.push({
        id: 'organization-deep-structure',
        type: 'organization',
        title: 'Deep Directory Structure',
        description: `Maximum directory depth is ${maxDepth} levels`,
        severity: 'medium',
        impact: 'Deep structures may be hard to navigate',
        files: [],
      });
    }
    
    analysis.insights = insights;
  }

  /**
   * Generate recommendations from analysis results
   */
  private generateRecommendations(analysis: AnalysisResult): void {
    const recommendations: AnalysisRecommendation[] = [];
    
    // Cleanup recommendations
    if (analysis.stats.duplicateFiles > 0) {
      recommendations.push({
        id: 'cleanup-duplicates',
        title: 'Remove Duplicate Files',
        description: `Remove ${analysis.stats.duplicateFiles} duplicate files to save space`,
        category: 'cleanup',
        priority: 'high',
        effort: 'easy',
        impact: `Save up to ${formatFileSize(analysis.stats.totalSize * 0.1)}`,
        action: 'Use duplicate finder tool to remove duplicates',
        files: [],
      });
    }
    
    if (analysis.stats.largeFiles > 0) {
      recommendations.push({
        id: 'optimization-compress',
        title: 'Compress Large Files',
        description: `Compress ${analysis.stats.largeFiles} large files to save space`,
        category: 'optimization',
        priority: 'medium',
        effort: 'medium',
        impact: `Save up to ${formatFileSize(analysis.stats.totalSize * 0.2)}`,
        action: 'Use compression tools for large files',
        files: [],
      });
    }
    
    if (analysis.stats.oldFiles > 0) {
      recommendations.push({
        id: 'organization-archive',
        title: 'Archive Old Files',
        description: `Archive ${analysis.stats.oldFiles} old files to external storage`,
        category: 'organization',
        priority: 'medium',
        effort: 'easy',
        impact: 'Free up local storage space',
        action: 'Move files older than 1 year to archive',
        files: [],
      });
    }
    
    analysis.recommendations = recommendations;
  }

  /**
   * Get active analysis
   */
  getActiveAnalysis(): AnalysisResult | null {
    return this.activeAnalysis;
  }

  /**
   * Get analysis history
   */
  getAnalysisHistory(): AnalysisResult[] {
    return [...this.analysisHistory];
  }

  /**
   * Get analysis by ID
   */
  getAnalysis(id: string): AnalysisResult | null {
    return this.analysisHistory.find(analysis => analysis.id === id) || null;
  }

  /**
   * Cancel active analysis
   */
  cancelAnalysis(): boolean {
    if (this.activeAnalysis && this.activeAnalysis.status === 'running') {
      this.activeAnalysis.status = 'cancelled';
      this.activeAnalysis = null;
      logger.info('Analysis cancelled');
      return true;
    }
    return false;
  }

  /**
   * Delete analysis from history
   */
  deleteAnalysis(id: string): boolean {
    const index = this.analysisHistory.findIndex(analysis => analysis.id === id);
    if (index !== -1) {
      this.analysisHistory.splice(index, 1);
      logger.info('Analysis deleted', { analysisId: id });
      return true;
    }
    return false;
  }

  /**
   * Clear analysis history
   */
  clearHistory(): void {
    this.analysisHistory = [];
    this.activeAnalysis = null;
    logger.info('Analysis history cleared');
  }

  /**
   * Export analysis results
   */
  exportAnalysis(id: string, format: 'json' | 'csv' | 'pdf' = 'json'): string {
    const analysis = this.getAnalysis(id);
    if (!analysis) {
      throw new Error('Analysis not found');
    }
    
    switch (format) {
      case 'json':
        return JSON.stringify(analysis, null, 2);
      case 'csv':
        return this.exportToCSV(analysis);
      case 'pdf':
        throw new Error('PDF export not implemented yet');
      default:
        throw new Error('Unsupported export format');
    }
  }

  /**
   * Export analysis to CSV
   */
  private exportToCSV(analysis: AnalysisResult): string {
    const headers = ['Name', 'Path', 'Size', 'Type', 'Extension', 'Last Modified'];
    const rows = analysis.files.map(file => [
      file.name,
      file.path,
      file.size.toString(),
      file.type,
      file.extension,
      file.lastModified?.toISOString() || '',
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Helper methods
   */
  private createEmptyStats(): AnalysisStats {
    return {
      totalFiles: 0,
      totalSize: 0,
      directories: 0,
      codeFiles: 0,
      mediaFiles: 0,
      duplicateFiles: 0,
      largeFiles: 0,
      oldFiles: 0,
      avgFileSize: 0,
      maxFileSize: 0,
      fileTypes: {},
      depthDistribution: {},
    };
  }

  private createEmptyPerformance(): AnalysisPerformance {
    return {
      duration: 0,
      filesPerSecond: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      diskIO: 0,
    };
  }
}

// Export singleton instance
export const analysisService = AnalysisService.getInstance();