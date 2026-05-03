/**
 * Analysis Bridge Types
 * Shared type definitions for all modules
 */

export interface FileSize {
  bytes: number;
  formatted: string;
  on_disk?: number;
}

export interface FileTimestamps {
  created?: string;
  modified: string;
  accessed?: string;
}

export interface FileAttributes {
  is_readonly: boolean;
  is_hidden: boolean;
  is_system: boolean;
  has_ads?: boolean;
  ads_count?: number;
  is_compressed?: boolean;
  compressed_size?: number;
  is_sparse?: boolean;
  is_reparse_point?: boolean;
  reparse_tag?: number;
  owner?: string;
}

export interface FileInfo {
  name: string;
  size: FileSize;
  path: string;
  extension: string;
  category: string;
  timestamps: FileTimestamps;
  file_hash?: string;
  is_hard_link: boolean;
  attributes: FileAttributes;
}

export interface ScanConfig {
  path: string;
  max_files: number;
  include_hidden: boolean;
  follow_symlinks: boolean;
  json_progress: boolean;
}

export interface SummaryStats {
  total_files: number;
  total_size: number;
  categories: Record<string, number>;
  extensions: Record<string, number>;
}

export interface PerformanceMetrics {
  scan_duration_ms: number;
  files_per_second: number;
  bytes_per_second: number;
  memory_peak_mb: number;
  disk_reads: number;
  cache_hits: number;
  cache_misses: number;
  cpu_usage_percent: number;
  io_wait_time: number;
}

export interface AnalysisProgress {
  analysisId: string;
  files: number;
  percentage: number;
  currentFile: string;
  completed: boolean;
  totalSize?: number;
}

export interface AnalysisResult {
  totalFiles: number;
  totalSize: number;
  fileAnalysis: {
    files: FileInfo[];
    summary: SummaryStats;
    categories: Record<string, FileInfo[]>;
    extensionStats: Record<string, { count: number; size: number }>;
    duplicateGroups: Array<{
      files: FileInfo[];
      size: number;
      hash: string;
    }>;
    duplicateCount: number;
    duplicateSize: number;
    hardLinkCount: number;
    hardLinkSavings: number;
    apparentSize: number;
  };
  performance: PerformanceMetrics;
  insights: Array<{
    type: string;
    title: string;
    description: string;
    priority: string;
  }>;
  aiAnalysis: {
    summary: string;
    recommendations: string[];
    insights: string[];
  } | null;
  metadata: {
    analysisId: string;
    timestamp: string;
    path: string;
    version: string;
  };
}

export interface AnalysisOptions {
  ai?: boolean;
  media?: boolean;
  useOllama?: boolean;
  forceRescan?: boolean;
  force?: boolean;
  noCache?: boolean;
}

export interface BackendResponse {
  success: boolean;
  analysisId?: string;
  taskId?: string;
  serviceMetadata?: {
    analysisId?: string;
  };
  result?: AnalysisResult;
  error?: string;
  message?: string;
  status?: string;
}

export interface AnalysisRequest {
  directoryPath: string;
  options: AnalysisOptions;
}

export interface ErrorContext {
  analysisId?: string;
  endpoint?: string;
  statusCode?: number;
  timestamp?: string;
  userAction?: string;
}

export interface BridgeError extends Error {
  code?: string;
  context?: ErrorContext;
  retryable?: boolean;
}

export interface ModuleConfig {
  timeout?: number;
  retries?: number;
  delay?: number;
}

// Event types for SSE
export interface SSEProgressEvent {
  analysisId: string;
  files: number;
  percentage: number;
  currentFile: string;
  status: string;
  completed: boolean;
  totalSize?: number;
  result?: AnalysisResult;
  error?: string;
}

// Health check types
export interface HealthCheckResult {
  ok: boolean;
  error?: string;
  timestamp?: string;
  uptime?: number;
  memory?: any;
  analyses?: {
    active: number;
    completed: number;
  };
  database?: {
    connected: boolean;
  };
}

// Analysis state types
export type AnalysisStatus = 'idle' | 'starting' | 'analyzing' | 'complete' | 'error' | 'cancelled';

export interface AnalysisState {
  id: string;
  status: AnalysisStatus;
  progress: number;
  directoryPath: string;
  startTime?: number;
  endTime?: number;
  filesScanned?: number;
  bytesScanned?: number;
  currentFile?: string;
  error?: string;
  result?: AnalysisResult;
}
