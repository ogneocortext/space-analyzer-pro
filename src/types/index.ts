/**
 * Unified type exports for Space Analyzer
 * Consolidates all type definitions into clean, organized exports
 */

// Core types
export * from "./core";

// Domain-specific types
export * from "./ai-integration";
export * from "./enhanced";
export * from "./frontend";

// Legacy exports for backward compatibility
export type { FileData, CategoryData, NeuralViewProps } from "./index.d";

// Re-export commonly used interfaces
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
  AppError,
} from "./core";
