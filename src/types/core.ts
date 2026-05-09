/**
 * Core type definitions for Space Analyzer
 * Essential types used across the application
 */

// Base entity interface
export interface BaseEntity {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  createdAt: Date;
  updatedAt: Date;
}

// File system entity
export interface FileEntity extends BaseEntity {
  extension?: string;
  category?: string;
  modified?: string;
  accessed?: string;
  permissions?: string;
  isDirectory?: boolean;
  parent?: string;
  children?: FileEntity[];
  hash?: string;
  checksum?: string;
}

// Analysis result interfaces
export interface AnalysisResult {
  id: string;
  path: string;
  duration: number;
  fileCount: number;
  totalSize: number;
  categories: Record<string, { count: number; size: number }>;
  insights: AIInsight[];
  errors: AnalysisError[];
  metadata: {
    scanner: string;
    version: string;
    timestamp: Date;
    performance: PerformanceMetrics;
  };
}

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
  metadata?: Record<string, any>;
}

export interface AnalysisError {
  id: string;
  type: "file_access" | "permission" | "corruption" | "timeout" | "memory" | "network";
  message: string;
  path?: string;
  timestamp: Date;
  severity: "low" | "medium" | "high" | "critical";
  recoverable: boolean;
}

// Performance monitoring
export interface PerformanceMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    average: number;
  };
  disk: {
    readSpeed: number;
    writeSpeed: number;
    spaceAvailable: number;
  };
  network: {
    latency: number;
    bandwidth: number;
  };
  render: {
    fps: number;
    frameTime: number;
    drawCalls: number;
    triangles: number;
  };
  timestamp: Date;
}

// Configuration interfaces
export interface AppConfig {
  theme: "light" | "dark" | "system";
  language: string;
  autoSave: boolean;
  notifications: NotificationConfig;
  privacy: PrivacyConfig;
  performance: PerformanceConfig;
  ai: AIConfig;
}

export interface NotificationConfig {
  enabled: boolean;
  position: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  duration: number;
  maxVisible: number;
  sound: boolean;
  desktop: boolean;
}

export interface PrivacyConfig {
  analytics: boolean;
  crashReporting: boolean;
  dataCollection: boolean;
  localProcessing: boolean;
}

export interface PerformanceConfig {
  maxMemoryUsage: number;
  enableGPUAcceleration: boolean;
  maxFileSize: number;
  cacheSize: number;
  enableOptimization: boolean;
}

export interface AIConfig {
  backend: "auto" | "ollama" | "google" | "python";
  maxInsights: number;
  confidence: number;
  enableLearning: boolean;
  rateLimiting: boolean;
}

// Event interfaces
export interface BaseEvent {
  id: string;
  timestamp: Date;
  source: string;
  version: string;
}

export interface SystemEvent extends BaseEvent {
  type: "service_registered" | "service_shutdown" | "memory_warning" | "performance_warning";
  data: Record<string, any>;
}

export interface UserEvent extends BaseEvent {
  type: "file_selected" | "analysis_started" | "settings_changed" | "theme_changed";
  userId?: string;
  sessionId: string;
  data: Record<string, any>;
}

export interface AnalysisEvent extends BaseEvent {
  type: "analysis_started" | "analysis_progress" | "analysis_completed" | "analysis_error";
  analysisId: string;
  data: {
    path?: string;
    progress?: number;
    result?: AnalysisResult;
    error?: AnalysisError;
  };
}

export interface AIEvent extends BaseEvent {
  type: "ai_analysis_started" | "ai_analysis_completed" | "ai_backend_changed" | "ai_insight_generated";
  aiSessionId: string;
  data: {
    backend?: string;
    insights?: AIInsight[];
    files?: any[];
    options?: Record<string, any>;
  };
}

// Service interfaces
export interface ServiceStatus {
  name: string;
  version: string;
  status: "healthy" | "unhealthy" | "initializing" | "disabled";
  lastCheck: Date;
  metrics: Record<string, number>;
  dependencies: string[];
  features: string[];
}

export interface ServiceDependency {
  name: string;
  version: string;
  optional: boolean;
  reason?: string;
}

// Utility types
export interface ProgressInfo {
  current: number;
  total: number;
  percentage: number;
  message?: string;
  eta?: number;
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  type: string;
  modified: Date;
  created: Date;
  permissions: string;
  isDirectory: boolean;
}

export interface CategorySummary {
  name: string;
  count: number;
  size: number;
  percentage: number;
  color: string;
  icon: string;
  averageSize: number;
  largestFile: FileInfo;
}

// Error types
export interface AppError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  stack?: string;
  context?: string;
  recoverable: boolean;
  userFriendlyMessage?: string;
}

// Export type for backward compatibility
export type {
  BaseEntity,
  FileEntity,
  AnalysisResult,
  AIInsight,
  AnalysisError,
  PerformanceMetrics,
  AppConfig,
  NotificationConfig,
  PrivacyConfig,
  PerformanceConfig,
  AIConfig,
  BaseEvent,
  SystemEvent,
  UserEvent,
  AnalysisEvent,
  AIEvent,
  ServiceStatus,
  ServiceDependency,
  ProgressInfo,
  FileInfo,
  CategorySummary,
  AppError
}