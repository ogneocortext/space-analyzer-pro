//! Issue reporting for flow test detected problems

use crate::flow_test::DetectedIssue;
use serde_json;
use std::fs;
use std::path::PathBuf;

/// Issue reporter that collects and saves detected issues
pub struct IssueReporter {
    report_path: PathBuf,
    issues: Vec<DetectedIssue>,
}

impl IssueReporter {
    pub fn new(report_path: &PathBuf) -> Self {
        if let Some(parent) = report_path.parent() {
            fs::create_dir_all(parent).ok();
        }
        
        Self {
            report_path: report_path.clone(),
            issues: Vec::new(),
        }
    }

    /// Report a new issue
    pub fn report_issue(&mut self, issue: &DetectedIssue) {
        self.issues.push(issue.clone());
        println!("[ISSUE] {} - {}: {}", issue.severity, issue.id, issue.title);
    }

    /// Save all issues to the report file
    pub fn save_report(&self, issues: &[DetectedIssue]) {
        let report = serde_json::json!({
            "report_generated": chrono::Utc::now().to_rfc3339(),
            "total_issues": issues.len(),
            "issues": issues,
        });
        
        let json = serde_json::to_string_pretty(&report).unwrap_or_else(|e| {
            format!("{{\"error\": \"Failed to serialize report: {}\"}}", e)
        });
        
        fs::write(&self.report_path, json).unwrap_or_else(|e| {
            eprintln!("Failed to write issue report to {}: {}", self.report_path.display(), e);
        });
        
        println!("[ISSUE REPORT] Saved {} issues to {}", issues.len(), self.report_path.display());
    }

}
