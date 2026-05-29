//! Interactive User Flow Testing Harness for Space Analyzer Pro
//!
//! This module provides a non-destructive testing framework that:
//! - Launches the application in the background
//! - Triggers read-only user flow events
//! - Logs all interactions to structured JSON
//! - Detects hidden problems and anomalies
//! - Creates issue reports for later resolution
//!
//! SAFETY: No destructive actions are performed without explicit user permission.
//! All file operations are read-only during automated testing.

pub mod logger;
pub mod scenarios;
pub mod issue_reporter;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Instant;

/// Represents a single test event in the flow
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowEvent {
    pub timestamp: String,
    pub event_type: FlowEventType,
    pub component: String,
    pub description: String,
    pub data: Option<serde_json::Value>,
    pub duration_ms: Option<u64>,
    pub success: bool,
    pub error: Option<String>,
}

/// Types of flow events
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FlowEventType {
    AppLaunch,
    AppShutdown,
    ScanStart,
    ScanProgress,
    ScanComplete,
    ScanError,
    SettingsChange,
    SettingsLoad,
    SettingsSave,
    WorkflowTrigger,
    WorkflowComplete,
    WorkflowError,
    AIChatRequest,
    AIChatResponse,
    AIChatError,
    SmartSearchQuery,
    SmartSearchResults,
    SmartSearchError,
    HistoryLoad,
    HistoryDrillDown,
    SystemInfoRefresh,
    GPUStatusCheck,
    OllamaStatusCheck,
    EmbeddingIndexStart,
    EmbeddingIndexComplete,
    EmbeddingIndexError,
    DedupScanStart,
    DedupScanComplete,
    DedupScanError,
    FileOperationPreview,
    ErrorRecoveryAttempt,
    ErrorRecoverySuccess,
    ErrorRecoveryFailure,
    UIRender,
    TabSwitch,
    Custom(String),
}

impl std::fmt::Display for FlowEventType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FlowEventType::AppLaunch => write!(f, "app_launch"),
            FlowEventType::AppShutdown => write!(f, "app_shutdown"),
            FlowEventType::ScanStart => write!(f, "scan_start"),
            FlowEventType::ScanProgress => write!(f, "scan_progress"),
            FlowEventType::ScanComplete => write!(f, "scan_complete"),
            FlowEventType::ScanError => write!(f, "scan_error"),
            FlowEventType::SettingsChange => write!(f, "settings_change"),
            FlowEventType::SettingsLoad => write!(f, "settings_load"),
            FlowEventType::SettingsSave => write!(f, "settings_save"),
            FlowEventType::WorkflowTrigger => write!(f, "workflow_trigger"),
            FlowEventType::WorkflowComplete => write!(f, "workflow_complete"),
            FlowEventType::WorkflowError => write!(f, "workflow_error"),
            FlowEventType::AIChatRequest => write!(f, "ai_chat_request"),
            FlowEventType::AIChatResponse => write!(f, "ai_chat_response"),
            FlowEventType::AIChatError => write!(f, "ai_chat_error"),
            FlowEventType::SmartSearchQuery => write!(f, "smart_search_query"),
            FlowEventType::SmartSearchResults => write!(f, "smart_search_results"),
            FlowEventType::SmartSearchError => write!(f, "smart_search_error"),
            FlowEventType::HistoryLoad => write!(f, "history_load"),
            FlowEventType::HistoryDrillDown => write!(f, "history_drill_down"),
            FlowEventType::SystemInfoRefresh => write!(f, "system_info_refresh"),
            FlowEventType::GPUStatusCheck => write!(f, "gpu_status_check"),
            FlowEventType::OllamaStatusCheck => write!(f, "ollama_status_check"),
            FlowEventType::EmbeddingIndexStart => write!(f, "embedding_index_start"),
            FlowEventType::EmbeddingIndexComplete => write!(f, "embedding_index_complete"),
            FlowEventType::EmbeddingIndexError => write!(f, "embedding_index_error"),
            FlowEventType::DedupScanStart => write!(f, "dedup_scan_start"),
            FlowEventType::DedupScanComplete => write!(f, "dedup_scan_complete"),
            FlowEventType::DedupScanError => write!(f, "dedup_scan_error"),
            FlowEventType::FileOperationPreview => write!(f, "file_operation_preview"),
            FlowEventType::ErrorRecoveryAttempt => write!(f, "error_recovery_attempt"),
            FlowEventType::ErrorRecoverySuccess => write!(f, "error_recovery_success"),
            FlowEventType::ErrorRecoveryFailure => write!(f, "error_recovery_failure"),
            FlowEventType::UIRender => write!(f, "ui_render"),
            FlowEventType::TabSwitch => write!(f, "tab_switch"),
            FlowEventType::Custom(name) => write!(f, "custom:{}", name),
        }
    }
}

/// Represents a detected issue during flow testing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedIssue {
    pub id: String,
    pub severity: IssueSeverity,
    pub category: String,
    pub component: String,
    pub title: String,
    pub description: String,
    pub reproduction_steps: Vec<String>,
    pub expected_behavior: String,
    pub actual_behavior: String,
    pub evidence: Vec<String>,
    pub timestamp: String,
    pub auto_generated: bool,
}

/// Severity levels for detected issues
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IssueSeverity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

impl std::fmt::Display for IssueSeverity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            IssueSeverity::Critical => write!(f, "CRITICAL"),
            IssueSeverity::High => write!(f, "HIGH"),
            IssueSeverity::Medium => write!(f, "MEDIUM"),
            IssueSeverity::Low => write!(f, "LOW"),
            IssueSeverity::Info => write!(f, "INFO"),
        }
    }
}

/// Test scenario definition
#[derive(Debug, Clone)]
pub struct TestScenario {
    pub name: String,
    pub description: String,
    pub steps: Vec<TestStep>,
    #[allow(dead_code)]
    pub expected_outcomes: Vec<String>,
    #[allow(dead_code)]
    pub is_destructive: bool,
    #[allow(dead_code)]
    pub requires_permission: bool,
}

/// Individual test step
#[derive(Debug, Clone)]
pub struct TestStep {
    pub action: String,
    pub component: String,
    pub parameters: HashMap<String, String>,
    #[allow(dead_code)]
    pub timeout_ms: u64,
    pub is_read_only: bool,
}

/// Test results summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestSummary {
    pub scenario_name: String,
    pub start_time: String,
    pub end_time: String,
    pub total_duration_ms: u64,
    pub total_events: usize,
    pub successful_events: usize,
    pub failed_events: usize,
    pub issues_detected: usize,
    pub issues: Vec<DetectedIssue>,
    pub status: TestStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TestStatus {
    Passed,
    Failed,
    Warning,
    Skipped,
    PermissionDenied,
}

/// Configuration for the flow test harness
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowTestConfig {
    pub log_file_path: PathBuf,
    pub issue_report_path: PathBuf,
    pub test_directories: Vec<PathBuf>,
    pub max_scan_depth: u32,
    pub timeout_per_scenario_ms: u64,
    pub allow_destructive_actions: bool,
    pub require_permission_for_destructive: bool,
    pub ollama_test_enabled: bool,
    pub gpu_test_enabled: bool,
    pub embedding_test_enabled: bool,
}

impl Default for FlowTestConfig {
    fn default() -> Self {
        Self {
            log_file_path: PathBuf::from("flow-test-log.json"),
            issue_report_path: PathBuf::from("flow-test-issues.json"),
            test_directories: vec![
                PathBuf::from("."),
                PathBuf::from("src"),
                PathBuf::from("tests"),
            ],
            max_scan_depth: 5,
            timeout_per_scenario_ms: 30_000,
            allow_destructive_actions: false,
            require_permission_for_destructive: true,
            ollama_test_enabled: true,
            gpu_test_enabled: true,
            embedding_test_enabled: true,
        }
    }
}

/// Main flow test harness
pub struct FlowTestHarness {
    pub config: FlowTestConfig,
    pub logger: logger::FlowLogger,
    pub issue_reporter: issue_reporter::IssueReporter,
    pub events: Vec<FlowEvent>,
    pub issues: Vec<DetectedIssue>,
    pub issue_counter: u32,
    start_time: Option<Instant>,
}

impl FlowTestHarness {
    pub fn new(config: FlowTestConfig) -> Self {
        let logger = logger::FlowLogger::new(&config.log_file_path);
        let issue_reporter = issue_reporter::IssueReporter::new(&config.issue_report_path);
        
        Self {
            config,
            logger,
            issue_reporter,
            events: Vec::new(),
            issues: Vec::new(),
            issue_counter: 0,
            start_time: None,
        }
    }

    /// Start the test session
    pub fn start_session(&mut self) {
        self.start_time = Some(Instant::now());
        self.log_event(FlowEvent {
            timestamp: chrono::Utc::now().to_rfc3339(),
            event_type: FlowEventType::AppLaunch,
            component: "flow_test".to_string(),
            description: "Flow test session started".to_string(),
            data: None,
            duration_ms: None,
            success: true,
            error: None,
        });
    }

    /// End the test session and generate reports
    pub fn end_session(&mut self) {
        let duration = self.start_time.map(|t| t.elapsed().as_millis() as u64).unwrap_or(0);
        
        self.log_event(FlowEvent {
            timestamp: chrono::Utc::now().to_rfc3339(),
            event_type: FlowEventType::AppShutdown,
            component: "flow_test".to_string(),
            description: format!("Flow test session ended. Duration: {}ms", duration),
            data: Some(serde_json::json!({
                "total_events": self.events.len(),
                "issues_detected": self.issues.len(),
            })),
            duration_ms: Some(duration),
            success: true,
            error: None,
        });

        self.logger.flush();
        self.issue_reporter.save_report(&self.issues);
    }

    /// Log a flow event
    pub fn log_event(&mut self, event: FlowEvent) {
        self.events.push(event.clone());
        self.logger.log_event(&event);
    }

    /// Detect and report an issue
    pub fn detect_issue(&mut self, issue: DetectedIssue) {
        self.issues.push(issue.clone());
        self.issue_reporter.report_issue(&issue);
    }

    /// Create a new issue ID
    pub fn next_issue_id(&mut self) -> String {
        self.issue_counter += 1;
        format!("FLOW-{:03}", self.issue_counter)
    }

    /// Check if destructive actions are allowed
    pub fn can_perform_destructive_action(&self, action_description: &str) -> bool {
        if !self.config.allow_destructive_actions {
            return false;
        }
        
        if self.config.require_permission_for_destructive {
            // In automated mode, always deny destructive actions
            // Manual testing would prompt the user
            println!("[FLOW TEST] Destructive action blocked (requires manual permission): {}", action_description);
            return false;
        }
        
        true
    }

    /// Run a read-only test scenario
    pub async fn run_read_only_scenario(&mut self, scenario: &TestScenario) -> TestSummary {
        let start_time = chrono::Utc::now();
        let scenario_start = Instant::now();
        let mut successful = 0;
        let mut failed = 0;
        let issues_before = self.issues.len();

        println!("[FLOW TEST] Running scenario: {}", scenario.name);
        println!("[FLOW TEST] Description: {}", scenario.description);

        for step in &scenario.steps {
            if !step.is_read_only && !self.can_perform_destructive_action(&step.action) {
                println!("[FLOW TEST] Skipping destructive step: {}", step.action);
                continue;
            }

            let step_start = Instant::now();
            let result = self.execute_step(step).await;
            let duration = step_start.elapsed().as_millis() as u64;

            if result.success {
                successful += 1;
            } else {
                failed += 1;
            }

            self.log_event(FlowEvent {
                timestamp: chrono::Utc::now().to_rfc3339(),
                event_type: FlowEventType::Custom(format!("scenario_step:{}", scenario.name)),
                component: step.component.clone(),
                description: step.action.clone(),
                data: Some(serde_json::json!({
                    "parameters": step.parameters,
                    "duration_ms": duration,
                })),
                duration_ms: Some(duration),
                success: result.success,
                error: result.error,
            });

            // Check timeout
            if scenario_start.elapsed().as_millis() as u64 > self.config.timeout_per_scenario_ms {
                println!("[FLOW TEST] Scenario timeout: {}", scenario.name);
                break;
            }
        }

        let total_duration = scenario_start.elapsed().as_millis() as u64;
        let issues_detected = self.issues.len() - issues_before;

        let status = if failed == 0 {
            TestStatus::Passed
        } else if issues_detected > 0 {
            TestStatus::Warning
        } else {
            TestStatus::Failed
        };

        TestSummary {
            scenario_name: scenario.name.clone(),
            start_time: start_time.to_rfc3339(),
            end_time: chrono::Utc::now().to_rfc3339(),
            total_duration_ms: total_duration,
            total_events: successful + failed,
            successful_events: successful,
            failed_events: failed,
            issues_detected,
            issues: self.issues[issues_before..].to_vec(),
            status,
        }
    }

    /// Execute a single test step
    async fn execute_step(&mut self, step: &TestStep) -> StepResult {
        println!("[FLOW TEST] Executing: {} on {}", step.action, step.component);
        
        // This is where we would integrate with the actual app
        // For now, we simulate the step execution
        match step.component.as_str() {
            "scanner" => self.execute_scan_step(step).await,
            "settings" => self.execute_settings_step(step).await,
            "workflows" => self.execute_workflow_step(step).await,
            "ai_chat" => self.execute_ai_chat_step(step).await,
            "smart_search" => self.execute_smart_search_step(step).await,
            "history" => self.execute_history_step(step).await,
            "system" => self.execute_system_step(step).await,
            "gpu" => self.execute_gpu_step(step).await,
            "ollama" => self.execute_ollama_step(step).await,
            _ => StepResult {
                success: false,
                error: Some(format!("Unknown component: {}", step.component)),
            },
        }
    }

    async fn execute_scan_step(&mut self, step: &TestStep) -> StepResult {
        // Simulate scan step - in real implementation, this would interact with the actual scanner
        let path = step.parameters.get("path").cloned().unwrap_or_else(|| ".".to_string());
        
        // Check if path exists
        if !std::path::Path::new(&path).exists() {
            return StepResult {
                success: false,
                error: Some(format!("Path does not exist: {}", path)),
            };
        }

        // Simulate scan
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        StepResult {
            success: true,
            error: None,
        }
    }

    async fn execute_settings_step(&mut self, _step: &TestStep) -> StepResult {
        // Simulate settings step
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        
        StepResult {
            success: true,
            error: None,
        }
    }

    async fn execute_workflow_step(&mut self, _step: &TestStep) -> StepResult {
        // Simulate workflow step
        tokio::time::sleep(tokio::time::Duration::from_millis(200)).await;
        
        StepResult {
            success: true,
            error: None,
        }
    }

    async fn execute_ai_chat_step(&mut self, _step: &TestStep) -> StepResult {
        if !self.config.ollama_test_enabled {
            return StepResult {
                success: true,
                error: Some("Ollama testing disabled".to_string()),
            };
        }

        // Check Ollama availability
        match reqwest::get("http://localhost:11434/api/tags").await {
            Ok(resp) => {
                if resp.status().is_success() {
                    StepResult {
                        success: true,
                        error: None,
                    }
                } else {
                    StepResult {
                        success: false,
                        error: Some(format!("Ollama returned status: {}", resp.status())),
                    }
                }
            }
            Err(e) => StepResult {
                success: false,
                error: Some(format!("Ollama not available: {}", e)),
            },
        }
    }

    async fn execute_smart_search_step(&mut self, _step: &TestStep) -> StepResult {
        if !self.config.embedding_test_enabled {
            return StepResult {
                success: true,
                error: Some("Embedding testing disabled".to_string()),
            };
        }

        // Simulate smart search
        tokio::time::sleep(tokio::time::Duration::from_millis(150)).await;
        
        StepResult {
            success: true,
            error: None,
        }
    }

    async fn execute_history_step(&mut self, _step: &TestStep) -> StepResult {
        // Simulate history step
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        
        StepResult {
            success: true,
            error: None,
        }
    }

    async fn execute_system_step(&mut self, _step: &TestStep) -> StepResult {
        // Simulate system info refresh
        tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
        
        StepResult {
            success: true,
            error: None,
        }
    }

    async fn execute_gpu_step(&mut self, _step: &TestStep) -> StepResult {
        if !self.config.gpu_test_enabled {
            return StepResult {
                success: true,
                error: Some("GPU testing disabled".to_string()),
            };
        }

        // Check GPU availability via nvidia-smi
        let output = tokio::process::Command::new("nvidia-smi")
            .output()
            .await;

        match output {
            Ok(out) => {
                if out.status.success() {
                    StepResult {
                        success: true,
                        error: None,
                    }
                } else {
                    StepResult {
                        success: false,
                        error: Some("nvidia-smi failed".to_string()),
                    }
                }
            }
            Err(_) => StepResult {
                success: false,
                error: Some("nvidia-smi not found".to_string()),
            },
        }
    }

    async fn execute_ollama_step(&mut self, _step: &TestStep) -> StepResult {
        if !self.config.ollama_test_enabled {
            return StepResult {
                success: true,
                error: Some("Ollama testing disabled".to_string()),
            };
        }

        // Check Ollama availability
        match reqwest::get("http://localhost:11434/api/tags").await {
            Ok(resp) => {
                if resp.status().is_success() {
                    StepResult {
                        success: true,
                        error: None,
                    }
                } else {
                    StepResult {
                        success: false,
                        error: Some(format!("Ollama returned status: {}", resp.status())),
                    }
                }
            }
            Err(e) => StepResult {
                success: false,
                error: Some(format!("Ollama not available: {}", e)),
            },
        }
    }
}

/// Result of executing a test step
#[derive(Debug, Clone)]
pub struct StepResult {
    pub success: bool,
    pub error: Option<String>,
}

/// Helper macro for creating HashMaps
#[macro_export]
macro_rules! hashmap {
    ($( $key: expr => $val: expr ),* $(,)?) => {{
         #[allow(unused_mut)]
         let mut map = ::std::collections::HashMap::new();
         $( map.insert($key, $val); )*
         map
    }};
}
