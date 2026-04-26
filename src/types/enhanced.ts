/**
 * Enhanced TypeScript interfaces and types for Space Analyzer
 * Based on AI model recommendations for better type safety and performance
 */

// Enhanced File Analysis Types
export interface EnhancedFileAnalysis {
  id: string;
  name: string;
  path: string;
  size: number;
  type: 'file' | 'directory';
  extension?: string;
  mimeType?: string;
  lastModified: Date;
  permissions: {
    readable: boolean;
    writable: boolean;
    executable: boolean;
  };
  content?: {
    text?: string;
    binary?: boolean;
    encoding?: string;
    lines?: number;
  };
  metadata: {
    hash?: string;
    checksum?: string;
    version?: string;
    tags?: string[];
    category?: FileCategory;
  };
  aiAnalysis?: {
    complexity?: number;
    dependencies?: string[];
    security?: SecurityAnalysis;
    optimization?: OptimizationSuggestions;
    duplicates?: DuplicateInfo[];
  };
}

export interface FileCategory {
  name: string;
  description: string;
  extensions: string[];
  icon: string;
  color: string;
}

export interface SecurityAnalysis {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  vulnerabilities: SecurityVulnerability[];
  recommendations: string[];
  score: number; // 0-100
}

export interface SecurityVulnerability {
  id: string;
  type: 'injection' | 'xss' | 'path-traversal' | 'code-execution' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location?: {
    file: string;
    line?: number;
    column?: number;
  };
  cwe?: string; // Common Weakness Enumeration
}

export interface OptimizationSuggestions {
  performance: PerformanceOptimization[];
  security: SecurityOptimization[];
  storage: StorageOptimization[];
  overallScore: number; // 0-100
}

export interface PerformanceOptimization {
  id: string;
  type: 'caching' | 'lazy-loading' | 'code-splitting' | 'compression' | 'other';
  impact: 'low' | 'medium' | 'high';
  description: string;
  estimatedGain?: string;
  implementation?: string;
}

export interface SecurityOptimization {
  id: string;
  type: 'input-validation' | 'authentication' | 'authorization' | 'encryption' | 'other';
  impact: 'low' | 'medium' | 'high';
  description: string;
  implementation?: string;
}

export interface StorageOptimization {
  id: string;
  type: 'compression' | 'deduplication' | 'archival' | 'cleanup' | 'other';
  impact: 'low' | 'medium' | 'high';
  description: string;
  estimatedSpaceSaved?: string;
}

export interface DuplicateInfo {
  originalFile: string;
  duplicateFiles: string[];
  totalSize: number;
  potentialSavings: number;
  similarity: number; // 0-1
}

// Enhanced Analysis Result Types
export interface EnhancedAnalysisResult {
  id: string;
  timestamp: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: {
    percentage: number;
    currentFile?: string;
    stage: AnalysisStage;
    estimatedTimeRemaining?: number;
  };
  summary: AnalysisSummary;
  files: EnhancedFileAnalysis[];
  dependencies: DependencyGraph;
  insights: AIInsights;
  recommendations: Recommendation[];
  performance: PerformanceMetrics;
}

export interface AnalysisStage {
  id: string;
  name: string;
  description: string;
  progress: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface AnalysisSummary {
  totalFiles: number;
  totalDirectories: number;
  totalSize: number;
  largestFile: {
    name: string;
    path: string;
    size: number;
  };
  fileTypes: Record<string, { count: number; size: number }>;
  categories: Record<string, { count: number; size: number }>;
  duplicates: {
    count: number;
    totalSize: number;
    potentialSavings: number;
  };
  security: {
    vulnerabilities: number;
    riskScore: number;
    highRiskFiles: string[];
  };
  performance: {
    optimizationScore: number;
    recommendations: number;
    estimatedImprovements: string;
  };
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  circularDependencies: CircularDependency[];
  missingDependencies: MissingDependency[];
}

export interface DependencyNode {
  id: string;
  name: string;
  path: string;
  type: 'file' | 'package' | 'module';
  language: string;
  size: number;
  complexity?: number;
  maintainability?: number;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'require' | 'dynamic-import' | 'other';
  strength: number; // 0-1
  line?: number;
}

export interface CircularDependency {
  cycle: string[];
  severity: 'low' | 'medium' | 'high';
  description: string;
  impact: string;
}

export interface MissingDependency {
  dependency: string;
  requiredBy: string[];
  type: 'npm' | 'python' | 'system' | 'other';
  version?: string;
}

export interface AIInsights {
  codeQuality: CodeQualityMetrics;
  patterns: CodePattern[];
  anomalies: CodeAnomaly[];
  suggestions: string[];
  summary: string;
  confidence: number; // 0-1
}

export interface CodeQualityMetrics {
  maintainability: number; // 0-100
  complexity: number; // 0-100
  readability: number; // 0-100
  testability: number; // 0-100
  documentation: number; // 0-100
  overall: number; // 0-100
}

export interface CodePattern {
  id: string;
  name: string;
  type: 'design-pattern' | 'anti-pattern' | 'idiom' | 'best-practice';
  description: string;
  locations: Array<{
    file: string;
    line?: number;
    column?: number;
  }>;
  confidence: number; // 0-1
}

export interface CodeAnomaly {
  id: string;
  type: 'dead-code' | 'unused-variable' | 'inconsistent-style' | 'potential-bug' | 'other';
  description: string;
  severity: 'low' | 'medium' | 'high';
  locations: Array<{
    file: string;
    line?: number;
    column?: number;
  }>;
  confidence: number; // 0-1
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: 'performance' | 'security' | 'storage' | 'maintainability' | 'other';
  impact: 'low' | 'medium' | 'high';
  priority: number; // 1-10
  effort: 'low' | 'medium' | 'high';
  implementation?: string;
  estimatedBenefit?: string;
  dependencies?: string[];
}

export interface PerformanceMetrics {
  analysisTime: number; // in milliseconds
  filesProcessed: number;
  memoryUsage: {
    peak: number; // in bytes
    average: number; // in bytes
  };
  cpuUsage: {
    peak: number; // percentage
    average: number; // percentage
  };
  throughput: {
    filesPerSecond: number;
    bytesPerSecond: number;
  };
}

// Enhanced Component Props with PropTypes
export interface EnhancedComponentProps {
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  testId?: string;
  'aria-label'?: string;
  'aria-describedby'?: string;
  'aria-labelledby'?: string;
}

// Enhanced Event Types
export interface EnhancedFileEvent {
  type: 'select' | 'upload' | 'delete' | 'move' | 'rename' | 'analyze';
  file: EnhancedFileAnalysis;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface EnhancedAnalysisEvent {
  type: 'start' | 'progress' | 'complete' | 'error' | 'cancel';
  analysisId: string;
  progress?: number;
  stage?: string;
  error?: string;
  timestamp: Date;
}

// Utility Types for Performance
export interface MemoizedComponent<T = {}> {
  (props: T): React.ReactElement;
  displayName?: string;
}

export type OptimizedCallback<T extends any[] = []> = (...args: T) => void;

// Enhanced Error Types
export interface EnhancedError extends Error {
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context?: Record<string, any>;
  timestamp: Date;
  recoverable: boolean;
  suggestions?: string[];
}

// Configuration Types
export interface EnhancedConfig {
  analysis: {
    maxFileSize: number;
    excludedPaths: string[];
    includedExtensions: string[];
    parallelProcessing: boolean;
    cacheResults: boolean;
  };
  ai: {
    enabled: boolean;
    model: string;
    confidence: number;
    maxTokens: number;
  };
  performance: {
    enableProfiling: boolean;
    cacheSize: number;
    batchSize: number;
  };
  security: {
    enableScanning: boolean;
    strictMode: boolean;
    reportLevel: 'all' | 'warnings' | 'errors';
  };
}
