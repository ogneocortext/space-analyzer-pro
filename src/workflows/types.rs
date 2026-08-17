//! Shared type definitions for the workflow system.
//!
//! This module contains the enums used throughout workflows:
//! categories, triggers, actions, export formats, execution status,
//! and recommendation types.

use serde::{Deserialize, Serialize};

/// Workflow categories for different use cases
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum WorkflowCategory {
    /// System maintenance and cleanup
    Maintenance,
    /// Storage optimization and analysis
    Optimization,
    /// File organization and deduplication
    Organization,
    /// System monitoring and alerting
    Monitoring,
    /// Custom user-defined workflows
    Custom,
}

impl std::fmt::Display for WorkflowCategory {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            WorkflowCategory::Maintenance => write!(f, "Maintenance"),
            WorkflowCategory::Optimization => write!(f, "Optimization"),
            WorkflowCategory::Organization => write!(f, "Organization"),
            WorkflowCategory::Monitoring => write!(f, "Monitoring"),
            WorkflowCategory::Custom => write!(f, "Custom"),
        }
    }
}

/// Trigger type for workflow automation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WorkflowTrigger {
    /// Manual trigger (user initiated)
    Manual,
    /// Scheduled (cron-like expression)
    Scheduled(String),
    /// On low disk space threshold
    LowDiskSpace { threshold_percent: u8 },
    /// On file system change
    FileSystemChange,
    /// On startup
    OnStartup,
}

/// Action to perform during a workflow
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WorkflowAction {
    /// Scan directory with specific options
    Scan {
        path: String,
        deep: bool,
        min_size: Option<u64>,
    },
    /// Find duplicate files
    FindDuplicates { paths: Vec<String>, use_gpu: bool },
    /// Analyze storage predictions
    PredictStorage { days_ahead: usize },
    /// Generate cleanup recommendations
    GenerateRecommendations,
    /// Export analysis results
    Export {
        format: ExportFormat,
        path: Option<String>,
    },
    /// Send notification
    Notify { title: String, message: String },
    /// Run AI analysis via Ollama
    AIAnalyze { prompt: String },
}

/// Export format options
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ExportFormat {
    Json,
    Csv,
    Html,
    Pdf,
}

/// Workflow execution status
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ExecutionStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

impl std::fmt::Display for ExecutionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ExecutionStatus::Pending => write!(f, "Pending"),
            ExecutionStatus::Running => write!(f, "Running"),
            ExecutionStatus::Completed => write!(f, "Completed"),
            ExecutionStatus::Failed => write!(f, "Failed"),
            ExecutionStatus::Cancelled => write!(f, "Cancelled"),
        }
    }
}

/// Recommendation priority levels
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum RecommendationPriority {
    Low,
    Medium,
    High,
    Critical,
}

/// Recommendation category
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum RecommendationCategory {
    Storage,
    Performance,
    Organization,
    Security,
}

/// Recommended action type
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum RecommendationAction {
    Cleanup,
    Review,
    Optimize,
    Archive,
}
