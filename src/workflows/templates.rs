//! Preconfigured workflow templates.
//!
//! This module contains the `WorkflowTemplates` struct with factory
//! methods for common workflow patterns.

use super::models::Workflow;

/// Preconfigured workflow templates
pub struct WorkflowTemplates;

impl WorkflowTemplates {
    /// Weekly system cleanup workflow
    pub fn weekly_cleanup() -> Workflow {
        Workflow::new(
            "weekly-cleanup",
            "Weekly System Cleanup",
            crate::workflows::types::WorkflowCategory::Maintenance,
        )
        .with_scan(".", true)
        .with_find_duplicates(vec![".".to_string()], true)
        .with_notification(
            "Weekly Cleanup Complete",
            "Scan and duplicate analysis finished. Check the results.",
        )
        .with_trigger(crate::workflows::types::WorkflowTrigger::Scheduled(
            "0 0 * * 1".to_string(),
        ))
        .set_enabled(false)
    }

    /// Large file finder workflow
    pub fn large_files_finder() -> Workflow {
        Workflow::new(
            "large-files",
            "Large Files Finder",
            crate::workflows::types::WorkflowCategory::Optimization,
        )
        .with_scan(".", true)
        .with_description("Identifies files larger than 100MB for review and potential cleanup.")
    }

    /// Disk space monitor workflow
    pub fn disk_space_monitor() -> Workflow {
        Workflow::new(
            "disk-monitor",
            "Disk Space Monitor",
            crate::workflows::types::WorkflowCategory::Monitoring,
        )
        .with_scan(".", false)
        .with_trigger(crate::workflows::types::WorkflowTrigger::LowDiskSpace {
            threshold_percent: 90,
        })
        .with_notification("Low Disk Space Alert", "Available disk space is below 10%.")
        .set_enabled(false)
    }

    /// Development environment cleanup
    pub fn dev_environment_cleanup() -> Workflow {
        Workflow::new(
            "dev-cleanup",
            "Development Environment Cleanup",
            crate::workflows::types::WorkflowCategory::Organization,
        )
        .with_scan("./node_modules", false)
        .with_scan("./target", false)
        .with_scan("./.git", false)
        .with_description(
            "Cleans common development directories: node_modules, build artifacts, git objects.",
        )
    }

    /// Project archive analyzer
    pub fn project_archive_analysis() -> Workflow {
        Workflow::new(
            "archive-analysis",
            "Project Archive Analysis",
            crate::workflows::types::WorkflowCategory::Organization,
        )
        .with_scan("./archive", true)
        .with_find_duplicates(vec!["./archive".to_string()], true)
        .with_description("Analyzes project archives for duplicates and organizational issues.")
    }

    /// Startup scan workflow
    pub fn startup_scan() -> Workflow {
        Workflow::new(
            "startup-scan",
            "Startup Scan",
            crate::workflows::types::WorkflowCategory::Monitoring,
        )
        .with_scan(".", false)
        .with_trigger(crate::workflows::types::WorkflowTrigger::OnStartup)
        .with_description("Quick scan on application startup to show recent changes.")
        .set_enabled(false)
    }

    /// AI-powered analysis workflow
    pub fn ai_powered_analysis() -> Workflow {
        Workflow::new(
            "ai-analysis",
            "AI-Powered Analysis",
            crate::workflows::types::WorkflowCategory::Optimization,
        )
        .with_scan(".", true)
        .with_ai_analysis(
            "Analyze these scan results and recommend the top 3 actions to free up disk space.",
        )
        .with_description(
            "Runs a deep scan and uses local AI to provide intelligent cleanup recommendations.",
        )
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
