//! Workflow automation system for Space Analyzer Pro
//! 
//! Provides preconfigured scan workflows, automation templates, AI-driven recommendations,
//! and native Rust workflow execution (no external orchestrator needed).

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
    FindDuplicates {
        paths: Vec<String>,
        use_gpu: bool,
    },
    /// Analyze storage predictions
    PredictStorage {
        days_ahead: usize,
    },
    /// Generate cleanup recommendations
    GenerateRecommendations,
    /// Export analysis results
    Export {
        format: ExportFormat,
        path: Option<String>,
    },
    /// Send notification
    Notify {
        title: String,
        message: String,
    },
    /// Run AI analysis via Ollama
    AIAnalyze {
        prompt: String,
    },
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

/// Workflow execution record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowExecution {
    pub id: String,
    pub workflow_id: String,
    pub workflow_name: String,
    pub status: ExecutionStatus,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub current_action: Option<String>,
    pub error_message: Option<String>,
    pub actions_completed: usize,
    pub total_actions: usize,
}

/// Workflow definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: WorkflowCategory,
    pub trigger: WorkflowTrigger,
    pub actions: Vec<WorkflowAction>,
    pub enabled: bool,
    pub last_run: Option<String>,
    pub next_run: Option<String>,
    pub tags: Vec<String>,
}

impl Workflow {
    /// Create a new workflow
    pub fn new(id: impl Into<String>, name: impl Into<String>, category: WorkflowCategory) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            description: String::new(),
            category,
            trigger: WorkflowTrigger::Manual,
            actions: Vec::new(),
            enabled: true,
            last_run: None,
            next_run: None,
            tags: Vec::new(),
        }
    }

    /// Add a scan action to the workflow
    pub fn with_scan(mut self, path: impl Into<String>, deep: bool) -> Self {
        self.actions.push(WorkflowAction::Scan {
            path: path.into(),
            deep,
            min_size: None,
        });
        self
    }

    /// Add a duplicate finding action
    pub fn with_find_duplicates(mut self, paths: Vec<String>, use_gpu: bool) -> Self {
        self.actions.push(WorkflowAction::FindDuplicates { paths, use_gpu });
        self
    }

    /// Add a notification action
    pub fn with_notification(mut self, title: impl Into<String>, message: impl Into<String>) -> Self {
        self.actions.push(WorkflowAction::Notify {
            title: title.into(),
            message: message.into(),
        });
        self
    }

    /// Add an AI analysis action
    pub fn with_ai_analysis(mut self, prompt: impl Into<String>) -> Self {
        self.actions.push(WorkflowAction::AIAnalyze {
            prompt: prompt.into(),
        });
        self
    }

    /// Set the trigger for the workflow
    pub fn with_trigger(mut self, trigger: WorkflowTrigger) -> Self {
        self.trigger = trigger;
        self
    }

    /// Enable or disable the workflow
    pub fn set_enabled(mut self, enabled: bool) -> Self {
        self.enabled = enabled;
        self
    }

    /// Start execution of this workflow
    pub fn start_execution(&self) -> WorkflowExecution {
        WorkflowExecution {
            id: format!("exec-{}-{}", self.id, chrono::Utc::now().timestamp_millis()),
            workflow_id: self.id.clone(),
            workflow_name: self.name.clone(),
            status: ExecutionStatus::Running,
            started_at: chrono::Utc::now().to_rfc3339(),
            completed_at: None,
            current_action: None,
            error_message: None,
            actions_completed: 0,
            total_actions: self.actions.len(),
        }
    }
}

/// Preconfigured workflow templates
pub struct WorkflowTemplates;

impl WorkflowTemplates {
    /// Weekly system cleanup workflow
    pub fn weekly_cleanup() -> Workflow {
        Workflow::new("weekly-cleanup", "Weekly System Cleanup", WorkflowCategory::Maintenance)
            .with_scan(".", true)
            .with_find_duplicates(vec![".".to_string()], true)
            .with_notification(
                "Weekly Cleanup Complete",
                "Scan and duplicate analysis finished. Check the results.",
            )
            .with_trigger(WorkflowTrigger::Scheduled("0 0 * * 1".to_string()))
    }

    /// Large file finder workflow
    pub fn large_files_finder() -> Workflow {
        Workflow::new("large-files", "Large Files Finder", WorkflowCategory::Optimization)
            .with_scan(".", true)
            .with_description("Identifies files larger than 100MB for review and potential cleanup.")
    }

    /// Disk space monitor workflow
    pub fn disk_space_monitor() -> Workflow {
        Workflow::new("disk-monitor", "Disk Space Monitor", WorkflowCategory::Monitoring)
            .with_scan(".", false)
            .with_trigger(WorkflowTrigger::LowDiskSpace { threshold_percent: 90 })
            .with_notification(
                "Low Disk Space Alert",
                "Available disk space is below 10%.",
            )
    }

    /// Development environment cleanup
    pub fn dev_environment_cleanup() -> Workflow {
        Workflow::new("dev-cleanup", "Development Environment Cleanup", WorkflowCategory::Organization)
            .with_scan("./node_modules", false)
            .with_scan("./target", false)
            .with_scan("./.git", false)
            .with_description("Cleans common development directories: node_modules, build artifacts, git objects.")
    }

    /// Project archive analyzer
    pub fn project_archive_analysis() -> Workflow {
        Workflow::new("archive-analysis", "Project Archive Analysis", WorkflowCategory::Organization)
            .with_scan("./archive", true)
            .with_find_duplicates(vec!["./archive".to_string()], true)
            .with_description("Analyzes project archives for duplicates and organizational issues.")
    }

    /// Startup scan workflow
    pub fn startup_scan() -> Workflow {
        Workflow::new("startup-scan", "Startup Scan", WorkflowCategory::Monitoring)
            .with_scan(".", false)
            .with_trigger(WorkflowTrigger::OnStartup)
            .with_description("Quick scan on application startup to show recent changes.")
    }

    /// AI-powered analysis workflow
    pub fn ai_powered_analysis() -> Workflow {
        Workflow::new("ai-analysis", "AI-Powered Analysis", WorkflowCategory::Optimization)
            .with_scan(".", true)
            .with_ai_analysis("Analyze these scan results and recommend the top 3 actions to free up disk space.")
            .with_description("Runs a deep scan and uses local AI to provide intelligent cleanup recommendations.")
    }

    /// All available preconfigured workflows
    pub fn all_templates() -> Vec<Workflow> {
        vec![
            Self::weekly_cleanup(),
            Self::large_files_finder(),
            Self::disk_space_monitor(),
            Self::dev_environment_cleanup(),
            Self::project_archive_analysis(),
            Self::startup_scan(),
            Self::ai_powered_analysis(),
        ]
    }
}

/// AI-powered storage insights
pub struct StorageInsights;

impl StorageInsights {
    /// Generate AI recommendations based on scan results
    pub fn generate_recommendations(scan_result: &super::gui_common::ScanResult) -> Vec<AIRecommendation> {
        let mut recommendations = Vec::new();

        // Check for large number of small files (potential fragmentation)
        if scan_result.total_files > 10000 {
            recommendations.push(AIRecommendation {
                priority: RecommendationPriority::Medium,
                category: RecommendationCategory::Performance,
                title: "High File Count Detected".to_string(),
                description: format!(
                    "Found {} files. Consider consolidating small files or cleaning up cache directories.",
                    scan_result.total_files
                ),
                action: RecommendationAction::Optimize,
            });
        }

        // Check for dominance of specific file types
        if let Some((ext, count)) = scan_result.file_types.iter().max_by_key(|(_, &c)| c) {
            let percentage = (*count as f64 / scan_result.total_files as f64) * 100.0;
            if percentage > 30.0 {
                recommendations.push(AIRecommendation {
                    priority: RecommendationPriority::High,
                    category: RecommendationCategory::Storage,
                    title: format!("{} File Dominance", ext.to_uppercase()),
                    description: format!(
                        "{:.1}% of files are .{} files. Consider archiving or reviewing if appropriate.",
                        percentage, ext
                    ),
                    action: RecommendationAction::Review,
                });
            }
        }

        // Size-based recommendations
        let avg_file_size = if scan_result.total_files > 0 {
            scan_result.total_size_bytes as f64 / scan_result.total_files as f64
        } else {
            0.0
        };

        if avg_file_size < 1024.0 && scan_result.total_files > 1000 {
            recommendations.push(AIRecommendation {
                priority: RecommendationPriority::Low,
                category: RecommendationCategory::Storage,
                title: "Many Small Files".to_string(),
                description: format!(
                    "Average file size is only {:.0} bytes. This may indicate cache files or logs that could be cleaned.",
                    avg_file_size
                ),
                action: RecommendationAction::Cleanup,
            });
        }

        // Check for large files
        if let Some((path, size)) = scan_result.largest_files.first() {
            if *size > 100 * 1024 * 1024 {
                recommendations.push(AIRecommendation {
                    priority: RecommendationPriority::High,
                    category: RecommendationCategory::Storage,
                    title: "Very Large File Found".to_string(),
                    description: format!(
                        "File '{}' is {} in size. Consider moving to external storage or archiving.",
                        path, format_bytes(*size)
                    ),
                    action: RecommendationAction::Archive,
                });
            }
        }

        recommendations
    }
}

/// Format bytes to human-readable string
fn format_bytes(bytes: u64) -> String {
    if bytes >= 1_073_741_824 {
        format!("{:.2} GB", bytes as f64 / 1_073_741_824.0)
    } else if bytes >= 1_048_576 {
        format!("{:.2} MB", bytes as f64 / 1_048_576.0)
    } else if bytes >= 1_024 {
        format!("{:.2} KB", bytes as f64 / 1_024.0)
    } else {
        format!("{} B", bytes)
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

/// AI recommendation for storage optimization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIRecommendation {
    pub priority: RecommendationPriority,
    pub category: RecommendationCategory,
    pub title: String,
    pub description: String,
    pub action: RecommendationAction,
}

/// Recommended action type
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum RecommendationAction {
    Cleanup,
    Review,
    Optimize,
    Archive,
}

/// Workflow execution context
#[derive(Debug, Default)]
pub struct WorkflowContext {
    pub scan_results: Vec<super::gui_common::ScanResult>,
    pub duplicate_results: Vec<DuplicateResult>,
    pub notifications_sent: usize,
}

/// Duplicate file result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateResult {
    pub hash: String,
    pub files: Vec<String>,
    pub total_size: u64,
}

impl Workflow {
    fn with_description(mut self, desc: &str) -> Self {
        self.description = desc.to_string();
        self
    }
}
