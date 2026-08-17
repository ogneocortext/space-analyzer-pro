//! Data models for the workflow system.
//!
//! This module contains the structs used to represent workflows,
//! executions, recommendations, and related types.

use serde::{Deserialize, Serialize};

use super::super::gui_common::ScanReport;
use super::types::*;

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

impl WorkflowExecution {
    /// Mark the workflow as completed and stamp the finish time.
    pub fn complete(&mut self) {
        self.status = ExecutionStatus::Completed;
        self.completed_at = Some(chrono::Utc::now().to_rfc3339());
        self.actions_completed = self.total_actions.max(self.actions_completed);
        self.current_action = None;
    }
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
        self.actions
            .push(WorkflowAction::FindDuplicates { paths, use_gpu });
        self
    }

    /// Add a notification action
    pub fn with_notification(
        mut self,
        title: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
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

    pub fn with_description(mut self, desc: &str) -> Self {
        self.description = desc.to_string();
        self
    }
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

/// Workflow execution context
#[derive(Debug, Default)]
pub struct WorkflowContext {
    pub scan_results: Vec<ScanReport>,
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

/// AI-powered storage insights
pub struct StorageInsights;
