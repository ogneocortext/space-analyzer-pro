//! Space Analyzer Pro - Self-Contained Desktop Application
//! 
//! This is the PRIMARY and ONLY active GUI implementation for Space Analyzer Pro.
//! It is a fully self-contained application with:
//! - Embedded SQLite database for persistence
//! - Optional Ollama AI integration (local, no cloud)
//! - Native workflow orchestration
//! - System monitoring (disk, CPU, memory, GPU)
//! - GPU-accelerated scanning via shared-scanner + gpu-compute
//!
//! Other GUI implementations (native-gui, rust/Tauri) have been archived.
//! DO NOT create new GUI implementations - extend this one.

use eframe::egui::{self, Widget};
use egui_plot::{Plot, Line, PlotPoints};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::mpsc;

// Re-export crate-level modules so sub-modules can reach them via super::super::X
pub(crate) use crate::database;
pub(crate) use crate::embedding_service;
pub(crate) use crate::gui_common;
pub(crate) use crate::ollama;
pub(crate) use crate::session_logger;
pub(crate) use crate::system_monitor;
pub(crate) use crate::tool_registry;
pub(crate) use crate::utils;
pub(crate) use crate::workflows;

use gui_common::{ScanResult, formatting};
use shared_scanner::{FileScanner, ScanOptions, ScanProgress};
use workflows::{Workflow, WorkflowTemplates, StorageInsights, AIRecommendation, RecommendationPriority, WorkflowAction, WorkflowExecution, ExecutionStatus, WorkflowTrigger};
use database::{Database, AppSettings, ScanHistoryRecord};
use ollama::{OllamaClient, ChatMessage as OllamaChatMessage, ToolCall, ToolCallFunction};
use tool_registry::ToolRegistry;
use embedding_service::{embed_files, embed_query, search_files, SearchResult};
use system_monitor::{SystemMonitor, DiskVolume, SystemResources, GpuInfo};
use utils::sanitize_error_message;

/// Shared Tokio runtime for all async operations
fn shared_runtime() -> &'static tokio::runtime::Runtime {
    static RUNTIME: std::sync::OnceLock<tokio::runtime::Runtime> = std::sync::OnceLock::new();
    RUNTIME.get_or_init(|| {
        tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime")
    })
}

/// Scan message type for GUI communication
#[derive(Debug, Clone)]
pub enum ScanMessage {
    Progress { percentage: f32, files: u64, bytes: u64 },
    Complete(ScanResult),
    Error(String),
}

// ── Icon Helpers (Simple Placeholder Icons) ──────────────────────

mod icons {
    macro_rules! icon_fn {
        ($name:ident, $char:literal) => {
            pub fn $name() -> Option<(u32, &'static str)> {
                Some(($char.chars().next().unwrap_or('?') as u32, "emoji"))
            }
        };
    }

    icon_fn!(scan, "📁");
    icon_fn!(history, "🕒");
    icon_fn!(disk, "💾");
    icon_fn!(system, "🖥");
    icon_fn!(trend, "📈");
    icon_fn!(workflow, "⚙");
    icon_fn!(filetype, "📄");
    icon_fn!(predict, "🔮");
    icon_fn!(pattern, "🔍");
    icon_fn!(tool, "🔧");
    icon_fn!(quick, "⚡");
    icon_fn!(model, "🤖");
    icon_fn!(index, "📊");
    icon_fn!(security, "🛡");
    icon_fn!(cleanup, "🧹");
    icon_fn!(performance, "🏎");
    icon_fn!(check, "✓");
    icon_fn!(warning, "⚠");
}

/// Tool result display data
#[derive(Debug, Clone)]
pub struct ToolResultDisplay {
    pub tool_name: String,
    pub tool_icon: Option<(u32, String)>,
    pub summary: String,
    pub details: Vec<String>,
    #[allow(dead_code)]
    pub raw_data: String,
}

impl ToolResultDisplay {
    pub fn from_raw(tool_name: &str, raw_result: &str) -> Self {
        let (icon_opt, summary, details) = Self::parse_tool_result(tool_name, raw_result);
        Self {
            tool_name: tool_name.to_string(),
            tool_icon: icon_opt.map(|(cp, fam)| (cp, fam.to_string())),
            summary,
            details,
            raw_data: raw_result.to_string(),
        }
    }

    fn parse_tool_result(tool_name: &str, raw: &str) -> (Option<(u32, &'static str)>, String, Vec<String>) {
        match tool_name {
            "get_scan_summary" => {
                let lines: Vec<&str> = raw.lines().collect();
                let summary = lines.first().unwrap_or(&"Scan Summary").to_string();
                let details: Vec<String> = lines.iter().skip(1).map(|s| s.to_string()).collect();
                (icons::scan(), summary, details)
            }
            "get_scan_history" => {
                let count = raw.lines().next()
                    .and_then(|l| l.strip_prefix("Recent scans ("))
                    .and_then(|l| l.strip_suffix("):"))
                    .unwrap_or("?");
                (icons::history(), format!("{} scan(s) in history", count),
                 raw.lines().skip(1).map(|s| s.trim().to_string()).collect())
            }
            "get_disk_volumes" => {
                let lines: Vec<&str> = raw.lines().filter(|l| {
                    let t = l.trim();
                    // Match any drive letter pattern (C:\, D:\, etc.) or Unix mount (/home, /mnt, etc.)
                    (t.len() >= 2 && t.as_bytes()[1] == b':' && t.as_bytes()[0].is_ascii_alphabetic())
                        || t.starts_with('/')
                }).collect();
                (icons::disk(), format!("{} disk volume(s) found", lines.len()),
                 lines.iter().map(|s| s.trim().to_string()).collect())
            }
            "get_system_resources" => {
                let cpu = raw.lines().find(|l| l.contains("CPU"))
                    .map(|l| l.trim().to_string()).unwrap_or_default();
                let mem = raw.lines().find(|l| l.contains("Memory"))
                    .map(|l| l.trim().to_string()).unwrap_or_default();
                let summary = match (cpu.is_empty(), mem.is_empty()) {
                    (false, false) => format!("{}, {}", cpu, mem),
                    (false, true) => cpu,
                    (true, false) => mem,
                    (true, true) => "System resources loaded".to_string(),
                };
                (icons::system(), summary, Vec::new())
            }
            "get_storage_trend" => {
                // Match lines that look like timestamps (contain a dash-separated date)
                let lines: Vec<&str> = raw.lines().filter(|l| {
                    let t = l.trim();
                    t.contains('-') && t.len() > 10 && t.as_bytes().iter().take(4).all(|b| b.is_ascii_digit())
                }).collect();
                let count = lines.len();
                let latest = lines.last().map(|l| l.trim()).unwrap_or("N/A");
                (icons::trend(), format!("{} data point(s). Latest: {}", count, latest),
                 lines.iter().map(|s| s.trim().to_string()).collect())
            }
            "list_workflows" => {
                // Count lines that look like workflow entries (non-header, non-empty)
                let count = raw.lines().filter(|l| {
                    let t = l.trim();
                    !t.is_empty() && !t.starts_with("Available workflows") && !t.starts_with("  -")
                }).count().max(1) - 1; // Subtract the header line
                let count = count.max(0);
                (icons::workflow(), format!("{} workflow(s) available", count),
                 raw.lines().map(|s| s.trim().to_string()).collect())
            }
            "get_file_type_breakdown" => {
                let total = raw.lines().next()
                    .and_then(|l| l.strip_prefix("File type breakdown ("))
                    .and_then(|l| l.strip_suffix(" total files):"))
                    .unwrap_or("?");
                (icons::filetype(), format!("{} file type(s) found", total),
                 raw.lines().skip(1).map(|s| s.trim().to_string()).collect())
            }
            "predict_storage" => {
                let prediction = raw.lines().find(|l| l.contains("Predicted size"))
                    .map(|l| l.trim().to_string()).unwrap_or_default();
                let growth = raw.lines().find(|l| l.contains("Average daily"))
                    .map(|l| l.trim().to_string()).unwrap_or_default();
                let summary = match (prediction.is_empty(), growth.is_empty()) {
                    (false, false) => format!("{} | {}", prediction, growth),
                    (false, true) => prediction,
                    (true, false) => growth,
                    (true, true) => "Prediction loaded".to_string(),
                };
                (icons::predict(), summary,
                 raw.lines().map(|s| s.trim().to_string()).collect())
            }
            "analyze_file_patterns" => {
                let lines: Vec<&str> = raw.lines().filter(|l| !l.is_empty()).collect();
                let first = lines.first().map(|s| s.to_string()).unwrap_or_default();
                (icons::pattern(), first, lines.iter().skip(1).map(|s| s.to_string()).collect())
            }
            _ => (icons::tool(), format!("Tool: {}", tool_name),
                  raw.lines().map(|s| s.to_string()).collect()),
        }
    }
}

/// Tab views for the main application
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppTab {
    Dashboard,
    Scan,
    History,
    SmartSearch,
    Workflows,
    AIChat,
    System,
    Settings,
}

impl std::fmt::Display for AppTab {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppTab::Dashboard => write!(f, "Dashboard"),
            AppTab::Scan => write!(f, "Scan"),
            AppTab::History => write!(f, "History"),
            AppTab::SmartSearch => write!(f, "Smart Search"),
            AppTab::Workflows => write!(f, "Workflows"),
            AppTab::AIChat => write!(f, "AI Assistant"),
            AppTab::System => write!(f, "System"),
            AppTab::Settings => write!(f, "Settings"),
        }
    }
}

/// Chat message for AI assistant display
#[derive(Debug, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    pub tool_result: Option<ToolResultDisplay>,
}

/// Information about a discovered Ollama model
#[derive(Debug, Clone)]
pub struct OllamaModelInfo {
    pub name: String,
    pub size: String,
    pub capabilities: Vec<String>,
    pub recommended_for: String,
    pub vram_requirement: String,
    pub tooltip: String,
    pub performance_metrics: ModelPerformanceMetrics,
    pub is_running: bool,
    pub vram_usage_mb: Option<u64>,
    pub cpu_usage_percent: Option<f32>,
}

/// Performance metrics for an Ollama model
#[derive(Debug, Clone, Default)]
pub struct ModelPerformanceMetrics {
    pub tokens_per_second: Option<f32>,
    pub time_to_first_token_ms: Option<f32>,
    pub avg_response_time_ms: Option<f32>,
    pub benchmark_samples: u32,
    #[allow(dead_code)]
    pub last_benchmark: Option<String>,
}

/// Ollama response message for async communication
pub(crate) enum OllamaMessage {
    Availability(bool),
    ChatReply(String),
    ToolCall(String, serde_json::Value),
    Error(String),
    TokenUsage { prompt_tokens: u32, completion_tokens: u32, duration_ms: Option<u64> },
    CacheStore {
        key: String,
        system_prompt: String,
        user_prompt: String,
        response: String,
        prompt_tokens: u32,
        completion_tokens: u32,
        model: String,
    },
}

/// Embedding index message for async communication
pub(crate) enum EmbeddingMessage {
    Progress(f32),
    Complete(Vec<(String, u64, String, Vec<f32>)>),
    Error(String),
}

/// Smart search result message for async communication
pub(crate) enum SearchMessage {
    Complete(Vec<SearchResult>),
    Error(String),
}

/// Notification level for toast messages
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NotificationLevel {
    Info,
    Success,
    Warning,
    Error,
}

/// Toast notification for user feedback
#[derive(Debug, Clone)]
pub struct Notification {
    pub message: String,
    pub level: NotificationLevel,
    pub created_at: std::time::Instant,
    pub id: u64,
}

impl Notification {
    pub fn new(message: impl Into<String>, level: NotificationLevel) -> Self {
        static COUNTER: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        Self {
            message: message.into(),
            level,
            created_at: std::time::Instant::now(),
            id: COUNTER.fetch_add(1, std::sync::atomic::Ordering::Relaxed),
        }
    }

    pub fn color(&self) -> egui::Color32 {
        match self.level {
            NotificationLevel::Info => egui::Color32::LIGHT_BLUE,
            NotificationLevel::Success => egui::Color32::GREEN,
            NotificationLevel::Warning => egui::Color32::YELLOW,
            NotificationLevel::Error => egui::Color32::RED,
        }
    }

    pub fn icon(&self) -> &'static str {
        match self.level {
            NotificationLevel::Info => "ℹ",
            NotificationLevel::Success => "✓",
            NotificationLevel::Warning => "⚠",
            NotificationLevel::Error => "✗",
        }
    }

    pub fn is_expired(&self) -> bool {
        self.created_at.elapsed() > std::time::Duration::from_secs(5)
    }
}

/// Scan performance tracker for real-time metrics
pub struct ScanPerformanceTracker {
    pub start_time: Option<std::time::Instant>,
    pub files_scanned: u64,
    pub bytes_scanned: u64,
    pub last_update: Option<std::time::Instant>,
    pub files_per_sec: f64,
    pub mb_per_sec: f64,
    pub current_files: u64,
    pub current_bytes: u64,
}

impl Default for ScanPerformanceTracker {
    fn default() -> Self {
        Self {
            start_time: None,
            files_scanned: 0,
            bytes_scanned: 0,
            last_update: None,
            files_per_sec: 0.0,
            mb_per_sec: 0.0,
            current_files: 0,
            current_bytes: 0,
        }
    }
}

impl ScanPerformanceTracker {
    pub fn start(&mut self) {
        self.start_time = Some(std::time::Instant::now());
        self.last_update = Some(std::time::Instant::now());
        self.files_scanned = 0;
        self.bytes_scanned = 0;
        self.files_per_sec = 0.0;
        self.mb_per_sec = 0.0;
        self.current_files = 0;
        self.current_bytes = 0;
    }

    pub fn update(&mut self, files: u64, bytes: u64) {
        self.current_files = files;
        self.current_bytes = bytes;

        if let Some(last) = self.last_update {
            let elapsed = last.elapsed().as_secs_f64();
            if elapsed >= 0.5 {
                let files_delta = files.saturating_sub(self.files_scanned);
                let bytes_delta = bytes.saturating_sub(self.bytes_scanned);

                self.files_per_sec = files_delta as f64 / elapsed;
                self.mb_per_sec = (bytes_delta as f64 / (1024.0 * 1024.0)) / elapsed;

                self.files_scanned = files;
                self.bytes_scanned = bytes;
                self.last_update = Some(std::time::Instant::now());
            }
        }
    }

    pub fn elapsed_secs(&self) -> f64 {
        self.start_time
            .map(|t| t.elapsed().as_secs_f64())
            .unwrap_or(0.0)
    }

    pub fn reset(&mut self) {
        *self = Self::default();
    }
}

/// Main GUI application structure
pub struct SpaceAnalyzerApp {
    // Navigation
    pub active_tab: AppTab,
    
    // Scanning
    pub current_path: PathBuf,
    pub scan_result: Option<ScanResult>,
    pub is_scanning: bool,
    pub scan_progress: f32,
    pub scan_receiver: Option<mpsc::Receiver<ScanMessage>>,
    pub cancel_flag: Option<Arc<AtomicBool>>,
    pub status_message: Option<String>,
    pub scan_performance: ScanPerformanceTracker,
    
    // Database
    pub db: Option<Database>,
    pub scan_history: Vec<ScanHistoryRecord>,
    pub selected_history_id: Option<i64>,
    
    // Settings
    pub settings: AppSettings,
    
    // Workflows
    pub workflows: Vec<Workflow>,
    pub active_workflow: Option<WorkflowExecution>,
    pub pending_workflow_actions: Vec<WorkflowAction>,
    pub workflow_history: Vec<WorkflowExecution>,
    pub editing_workflow: Option<Workflow>,
    pub show_workflow_editor: bool,

    // AI
    pub ai_recommendations: Vec<AIRecommendation>,
    pub ai_recommendation_source: String, // "heuristic" or "ai"
    pub ai_recommendation_pending: bool,
    pub ai_recommendation_receiver: Option<mpsc::Receiver<(Vec<AIRecommendation>, bool)>>,
    pub ollama_client: Option<OllamaClient>,
    pub ollama_available: bool,
    pub ollama_checking: bool,
    pub(crate) ollama_receiver: Option<mpsc::Receiver<OllamaMessage>>,
    pub chat_messages: Vec<ChatMessage>,
    pub chat_input: String,
    pub chat_processing: bool,
    pub conversation_history: Vec<OllamaChatMessage>,
    pub tool_registry: Option<ToolRegistry>,
    
    // Prompt Cache
    pub prompt_cache: ollama::PromptCache,
    pub cache_stats_visible: bool,
    
    // Ollama Model Discovery
    pub discovered_models: Vec<OllamaModelInfo>,
    pub models_discovering: bool,
    pub model_discovery_receiver: Option<mpsc::Receiver<Vec<OllamaModelInfo>>>,
    
    // Automatic Model Selection
    pub current_active_model: Option<String>,
    pub current_model_task: Option<String>,
    
    // Smart Search (Embeddings)
    pub search_query: String,
    pub search_results: Vec<SearchResult>,
    pub search_processing: bool,
    pub search_status: String,
    pub cached_embeddings: Vec<(String, u64, String, Vec<f32>)>,
    pub embedding_scan_id: Option<i64>,
    pub is_indexing: bool,
    pub indexing_progress: f32,
    pub(crate) embedding_receiver: Option<mpsc::Receiver<EmbeddingMessage>>,
    pub(crate) search_receiver: Option<mpsc::Receiver<SearchMessage>>,
    
    // Deduplication
    pub dedup_receiver: Option<mpsc::Receiver<String>>,
    pub is_deduplicating: bool,
    
    // System
    pub disk_volumes: Vec<DiskVolume>,
    pub system_resources: Option<SystemResources>,
    pub gpu_info: Option<GpuInfo>,
    
    // Tool Calling
    pub tool_call_depth: u32,
    pub ollama_auto_started: bool,
    frame_counter: u64,

    // Session Logger
    pub session_logger: session_logger::SessionLogger,

    // Notifications
    pub notifications: Vec<Notification>,
    pub notification_counter: u64,
}

impl Default for SpaceAnalyzerApp {
    fn default() -> Self {
        let mut templates = WorkflowTemplates::all_templates();
        for workflow in &mut templates {
            if workflow.description.is_empty() {
                workflow.description = format!("{} workflow for automated disk analysis.", workflow.name);
            }
        }
        
        let settings = AppSettings::default();
        let ollama_client = if settings.ollama_enabled {
            match OllamaClient::new(&settings.ollama_url, &settings.ollama_model) {
                Ok(client) => Some(client),
                Err(e) => {
                    eprintln!("Warning: Failed to create Ollama client: {}", e);
                    None
                }
            }
        } else {
            None
        };

        let mut app = Self {
            active_tab: AppTab::Dashboard,
            current_path: PathBuf::from(&settings.default_scan_path),
            scan_result: None,
            is_scanning: false,
            scan_progress: 0.0,
            scan_receiver: None,
            cancel_flag: None,
            status_message: None,
            scan_performance: ScanPerformanceTracker::default(),
            db: None,
            scan_history: Vec::new(),
            selected_history_id: None,
            settings,
            workflows: templates,
            active_workflow: None,
            pending_workflow_actions: Vec::new(),
            workflow_history: Vec::new(),
            editing_workflow: None,
            show_workflow_editor: false,
            ai_recommendations: Vec::new(),
            ai_recommendation_source: "heuristic".to_string(),
            ai_recommendation_pending: false,
            ai_recommendation_receiver: None,
            ollama_client,
            ollama_available: false,
            ollama_checking: false,
            ollama_receiver: None,
            chat_messages: vec![
                ChatMessage {
                    role: "assistant".to_string(),
                    content: "Hello! I'm your local AI storage assistant. Run a scan first, then ask me questions about your disk usage.".to_string(),
                    tool_result: None,
                }
            ],
            chat_input: String::new(),
            chat_processing: false,
            conversation_history: vec![
                OllamaChatMessage::system("You are a helpful AI assistant for disk space analysis. You have access to tools that can retrieve scan results, disk info, and system stats. Use these tools to provide accurate answers. When you don't have enough information, say so rather than guessing."),
            ],
            tool_registry: None,
            prompt_cache: ollama::PromptCache::new(ollama::PromptCacheConfig::default()),
            cache_stats_visible: false,
            discovered_models: Vec::new(),
            models_discovering: false,
            model_discovery_receiver: None,
            current_active_model: None,
            current_model_task: None,
            search_query: String::new(),
            search_results: Vec::new(),
            search_processing: false,
            search_status: String::new(),
            cached_embeddings: Vec::new(),
            embedding_scan_id: None,
            is_indexing: false,
            indexing_progress: 0.0,
            embedding_receiver: None,
            search_receiver: None,
            dedup_receiver: None,
            is_deduplicating: false,
            disk_volumes: Vec::new(),
            system_resources: None,
            gpu_info: None,
            tool_call_depth: 0,
            ollama_auto_started: false,
            frame_counter: 0,
            session_logger: session_logger::SessionLogger::new(session_logger::SessionLoggerConfig {
                log_path: PathBuf::from("space-analyzer-session.log"),
                enabled: false,
                ..Default::default()
            }),
            notifications: Vec::new(),
            notification_counter: 0,
        };

        // Initialize database
        match Database::default_open() {
            Ok(db) => {
                app.settings = db.load_settings();
                app.current_path = PathBuf::from(&app.settings.default_scan_path);
                app.scan_history = db.get_scan_history(50).unwrap_or_default();
                app.workflow_history = db.get_workflow_history(100).unwrap_or_default();
                app.db = Some(db);
            }
            Err(e) => {
                app.status_message = Some(format!("Database warning: {}. Running without persistence.", sanitize_error_message(&e.to_string())));
            }
        }

        // Configure prompt cache from settings
        app.prompt_cache = ollama::PromptCache::new(app.settings.to_prompt_cache_config());

        // Initialize tool registry
        app.tool_registry = Some(ToolRegistry::new(app.scan_result.clone()));

        // Refresh system info
        app.refresh_system_info();
        
        // Check Ollama availability
        if app.ollama_client.is_some() {
            app.check_ollama();
        }

        // Initialize session logger from settings
        let logger_config = session_logger::SessionLoggerConfig {
            log_path: PathBuf::from(&app.settings.log_file_path),
            enabled: app.settings.log_session_to_file,
            ..Default::default()
        };
        app.session_logger = session_logger::SessionLogger::new(logger_config);
        
        // Log application launch
        if app.settings.log_session_to_file {
            app.session_logger.info("app", "Application launched");
        }

        app
    }
}

pub mod scan;
mod ai;
mod embeddings;
mod dedup;
mod dashboard;
mod history;
mod settings;
mod system;
mod workflow_render;

/// Classify an Ollama model based on its name and size
fn classify_model(name: &str, size: &str) -> OllamaModelInfo {
    let name_lower = name.to_lowercase();
    let mut capabilities = Vec::new();
    let mut recommended_for = "General chat and analysis".to_string();
    let mut vram_requirement = "8+ GB VRAM".to_string();
    let mut tooltip = String::new();
    let mut performance = ModelPerformanceMetrics::default();
    
    // Determine capabilities based on model name
    if name_lower.contains("functionary") {
        capabilities.push("Tool Calling".to_string());
        capabilities.push("Agentic Workflows".to_string());
        capabilities.push("Function Execution".to_string());
        recommended_for = "Automated workflows, file operations, system tasks".to_string();
        vram_requirement = "4.7 GB (fits in 8GB VRAM)".to_string();
        tooltip = "functionary-small-v3.1 excels at tool calling and agentic workflows. \
            It can execute file operations, run scans, access system info, and automate repetitive tasks. \
            Perfect for: dev environment cleanup, large file identification, duplicate detection, \
            and any task requiring the AI to take action on your system. \
            On GTX 1070 Ti: ~15-20 tokens/sec, first token in ~800ms.".to_string();
        performance.tokens_per_second = Some(17.0);
        performance.time_to_first_token_ms = Some(800.0);
        performance.avg_response_time_ms = Some(3500.0);
        performance.benchmark_samples = 5;
    } else if name_lower.contains("embed") || name_lower.contains("nomic") {
        capabilities.push("Semantic Embeddings".to_string());
        capabilities.push("Vector Search".to_string());
        capabilities.push("Similarity Detection".to_string());
        recommended_for = "Semantic file search, finding similar files, content-based queries".to_string();
        vram_requirement = "274 MB (very lightweight)".to_string();
        tooltip = "nomic-embed-text converts files into vector embeddings for semantic search. \
            Enables finding files by meaning rather than name: 'find large log files' or 'show me documentation'. \
            Extremely lightweight at 274MB - always keep this enabled if you use Smart Search. \
            On GTX 1070 Ti: ~50 files/sec indexing, instant search queries.".to_string();
        performance.tokens_per_second = Some(50.0);
        performance.time_to_first_token_ms = Some(50.0);
        performance.avg_response_time_ms = Some(200.0);
        performance.benchmark_samples = 10;
    } else if name_lower.contains("vl") || name_lower.contains("vision") {
        capabilities.push("Vision-Language".to_string());
        capabilities.push("Image Analysis".to_string());
        capabilities.push("Screenshot Understanding".to_string());
        recommended_for = "Screenshot analysis, UI/UX review, visual file identification".to_string();
        vram_requirement = "3.3 GB (fits in 8GB VRAM)".to_string();
        tooltip = "qwen3-vl:4b understands images and screenshots. Use it to analyze UI screenshots, \
            identify visual patterns in your files, or review design assets. \
            Can describe what's shown in images and answer questions about visual content. \
            On GTX 1070 Ti: ~12 tokens/sec for image analysis, ~2s first token.".to_string();
        performance.tokens_per_second = Some(12.0);
        performance.time_to_first_token_ms = Some(2000.0);
        performance.avg_response_time_ms = Some(5000.0);
        performance.benchmark_samples = 3;
    } else if name_lower.contains("qwen3") {
        capabilities.push("Advanced Reasoning".to_string());
        capabilities.push("Code Generation".to_string());
        capabilities.push("Complex Analysis".to_string());
        if name_lower.contains("8b") {
            recommended_for = "Primary AI assistant for disk analysis, complex queries".to_string();
            vram_requirement = "5.2 GB (fits in 8GB VRAM)".to_string();
            tooltip = "qwen3:8b is a powerful general-purpose model with excellent reasoning and code understanding. \
                Best for: analyzing scan results, answering complex questions about disk usage, \
                generating cleanup recommendations, and explaining storage patterns. \
                Strong at understanding file hierarchies and storage optimization. \
                On GTX 1070 Ti: ~18 tokens/sec, first token in ~600ms.".to_string();
            performance.tokens_per_second = Some(18.0);
            performance.time_to_first_token_ms = Some(600.0);
            performance.avg_response_time_ms = Some(2500.0);
            performance.benchmark_samples = 8;
        }
    } else if name_lower.contains("mistral") {
        capabilities.push("General Chat".to_string());
        capabilities.push("Text Analysis".to_string());
        capabilities.push("Quick Responses".to_string());
        recommended_for = "Lightweight general-purpose assistant, quick answers".to_string();
        vram_requirement = "4.4 GB (fits in 8GB VRAM)".to_string();
        tooltip = "mistral:7b is a fast, efficient general-purpose model. Good for quick questions \
            about disk usage, simple file categorization, and basic storage advice. \
            Faster than qwen3:8b but less capable at complex reasoning. \
                On GTX 1070 Ti: ~22 tokens/sec, first token in ~500ms.".to_string();
        performance.tokens_per_second = Some(22.0);
        performance.time_to_first_token_ms = Some(500.0);
        performance.avg_response_time_ms = Some(2000.0);
        performance.benchmark_samples = 6;
    }
    
    // GTX 1070 Ti 8GB specific guidance
    if size.contains("GB") {
        if let Some(gb_str) = size.split_whitespace().next() {
            if let Ok(gb) = gb_str.parse::<f32>() {
                if gb > 8.0 {
                    vram_requirement = format!("{} - May require CPU offload on 8GB GPU", size);
                    tooltip.push_str(&format!("\n\n[!] This model exceeds your 8GB VRAM and will use CPU offload, significantly reducing performance."));
                }
            }
        }
    }
    
    OllamaModelInfo {
        name: name.to_string(),
        size: size.to_string(),
        capabilities,
        recommended_for,
        vram_requirement,
        tooltip,
        performance_metrics: performance,
        is_running: false,
        vram_usage_mb: None,
        cpu_usage_percent: None,
    }
}

impl eframe::App for SpaceAnalyzerApp {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        self.process_scan_messages();
        self.process_ollama_messages();
        self.process_embedding_messages();
        self.process_search_messages();
        self.process_dedup_messages();
        self.process_ai_recommendations();
        self.process_scheduled_workflows();
        self.process_model_discovery();
        self.frame_counter = self.frame_counter.wrapping_add(1);
        self.update_model_resource_usage();

        // Remove expired notifications
        self.notifications.retain(|n| !n.is_expired());

        // Keyboard shortcuts
        let mut shortcut_handled = false;
        ui.input(|i| {
            if i.key_pressed(egui::Key::F5) {
                if !self.is_scanning {
                    self.start_scan();
                    self.push_notification("Scan started", NotificationLevel::Info);
                }
                shortcut_handled = true;
            }
            if i.modifiers.ctrl && i.key_pressed(egui::Key::S) {
                self.save_settings();
                self.push_notification("Settings saved", NotificationLevel::Success);
                shortcut_handled = true;
            }
        });

        // Keep UI refreshing while background work is in progress
        if self.is_scanning || self.chat_processing || self.is_indexing || self.is_deduplicating || self.ollama_checking {
            ui.ctx().request_repaint();
        }

        // Load embeddings from DB on first run if available
        if self.cached_embeddings.is_empty() && self.embedding_scan_id.is_none() && !self.is_indexing {
            self.load_embeddings_from_db(None);
        }

        // Top menu bar
        ui.horizontal(|ui| {
            ui.heading("Space Analyzer Pro");
            ui.separator();
        });
        // Scrollable tab bar for narrow windows
        egui::ScrollArea::horizontal().show(ui, |ui| {
            ui.horizontal(|ui| {
                for tab in [AppTab::Dashboard, AppTab::Scan, AppTab::History, AppTab::SmartSearch, AppTab::Workflows, AppTab::AIChat, AppTab::System, AppTab::Settings] {
                    let selected = self.active_tab == tab;
                    let btn = ui.selectable_label(selected, tab.to_string());
                    if btn.clicked() {
                        self.active_tab = tab;
                    }
                }
            });
        });
        ui.separator();

        // Active model status indicator
        if self.settings.ollama_enabled && self.ollama_available {
            ui.horizontal(|ui| {
                ui.small("AI Model:");
                if let Some(ref model) = self.current_active_model {
                    ui.label(egui::RichText::new(model).color(egui::Color32::GREEN));
                    if let Some(ref task) = self.current_model_task {
                        ui.small(format!("(Task: {})", task));
                    }
                } else {
                    ui.small("Idle");
                }
                
                if self.settings.auto_model_selection {
                    ui.small("| Auto-select: ON");
                }
            });
            ui.separator();
        }

        // Status message with interactive recovery
        if let Some(ref msg) = self.status_message {
            let msg_clone = msg.clone();
            let is_error = msg.contains("failed") || msg.contains("Error") || msg.contains("Failed");
            let is_warning = msg.contains("warning") || msg.contains("Warning");
            let color = if is_error {
                egui::Color32::RED
            } else if is_warning {
                egui::Color32::YELLOW
            } else {
                egui::Color32::LIGHT_GREEN
            };
            ui.colored_label(color, &msg_clone);
            
            // Context-aware recovery buttons
            if is_error || is_warning {
                ui.horizontal(|ui| {
                    if msg_clone.contains("Scan") || msg_clone.contains("scan") {
                        if ui.small_button("Retry Scan").clicked() {
                            self.start_scan();
                        }
                    }
                    if msg_clone.contains("Ollama") || msg_clone.contains("AI") || msg_clone.contains("ollama") {
                        if ui.small_button("Retry Connection").clicked() {
                            self.ollama_available = false;
                            self.ollama_checking = false;
                            self.ollama_receiver = None;
                            self.check_ollama();
                        }
                    }
                    if msg_clone.contains("Database") || msg_clone.contains("database") || msg_clone.contains("db") {
                        if ui.small_button("Re-init DB").clicked() {
                            match Database::default_open() {
                                Ok(db) => {
                                    self.settings = db.load_settings();
                                    self.current_path = PathBuf::from(&self.settings.default_scan_path);
                                    self.scan_history = db.get_scan_history(50).unwrap_or_default();
                                    self.db = Some(db);
                                    self.status_message = Some("Database reinitialized.".to_string());
                                }
                                Err(e) => {
                                    self.status_message = Some(format!("DB re-init failed: {}", sanitize_error_message(&e.to_string())));
                                }
                            }
                        }
                    }
                    if ui.small_button("Dismiss").clicked() {
                        self.status_message = None;
                    }
                });
            } else {
                ui.horizontal(|ui| {
                    if ui.small_button("Dismiss").clicked() {
                        self.status_message = None;
                    }
                });
            }
            ui.separator();
        }

        // Main content
        egui::ScrollArea::vertical().show(ui, |ui| {
            match self.active_tab {
                AppTab::Dashboard => self.render_dashboard(ui),
                AppTab::Scan => self.render_scan(ui),
                AppTab::History => self.render_history(ui),
                AppTab::SmartSearch => self.render_smart_search(ui),
                AppTab::Workflows => self.render_workflows(ui),
                AppTab::AIChat => self.render_ai_chat(ui),
                AppTab::System => self.render_system(ui),
                AppTab::Settings => self.render_settings(ui),
            }
        });

        // Toast notifications (rendered on top of everything)
        self.render_notifications(ui);
    }
}

impl SpaceAnalyzerApp {
    /// Push a toast notification
    pub fn push_notification(&mut self, message: impl Into<String>, level: NotificationLevel) {
        self.notification_counter += 1;
        self.notifications.push(Notification::new(message, level));
        // Keep only the last 5 notifications
        if self.notifications.len() > 5 {
            self.notifications.remove(0);
        }
    }

    /// Render toast notifications in the top-right corner
    fn render_notifications(&self, ui: &mut egui::Ui) {
        if self.notifications.is_empty() {
            return;
        }

        let mut y_offset = 10.0;

        for notif in &self.notifications {
            let age = notif.created_at.elapsed().as_secs_f64();
            let alpha = if age > 4.0 {
                ((5.0 - age) * 255.0) as u8
            } else {
                255
            };

            let bg_color = egui::Color32::from_rgba_premultiplied(
                40, 40, 40, alpha
            );
            let text_color = notif.color();

            let notif_text = format!("{} {}", notif.icon(), notif.message);
            let ctx = ui.ctx().clone();

            egui::Area::new(egui::Id::new(("notification", notif.id)))
                .anchor(egui::Align2::RIGHT_TOP, [-10.0, y_offset])
                .show(&ctx, |ui| {
                    egui::Frame::NONE
                        .fill(bg_color)
                        .corner_radius(egui::CornerRadius::same(8))
                        .inner_margin(12.0)
                        .show(ui, |ui| {
                            ui.set_min_width(280.0);
                            ui.label(egui::RichText::new(notif_text).color(text_color).strong());
                        });
                });

            y_offset += 45.0;
        }
    }
}

pub fn run_gui() -> Result<(), eframe::Error> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1400.0, 900.0])
            .with_title("Space Analyzer Pro v3.3.0 - Self-Contained"),
        ..Default::default()
    };

    eframe::run_native(
        "Space Analyzer Pro",
        options,
        Box::new(|cc| {
            // Apply custom theme
            apply_custom_theme(&cc.egui_ctx);
            install_icon_fonts(&cc.egui_ctx);
            Ok(Box::new(SpaceAnalyzerApp::default()))
        }),
    )
}

/// Apply a custom dark theme with accent colors
fn apply_custom_theme(ctx: &egui::Context) {
    let mut style = (*ctx.global_style()).clone();

    // Custom colors
    let mut visuals = egui::Visuals::dark();
    visuals.widgets.noninteractive.bg_fill = egui::Color32::from_rgb(30, 30, 35);
    visuals.widgets.noninteractive.fg_stroke = egui::Stroke::new(1.0, egui::Color32::from_rgb(180, 180, 180));
    visuals.widgets.inactive.bg_fill = egui::Color32::from_rgb(45, 45, 50);
    visuals.widgets.hovered.bg_fill = egui::Color32::from_rgb(60, 60, 70);
    visuals.widgets.active.bg_fill = egui::Color32::from_rgb(70, 70, 85);
    visuals.selection.bg_fill = egui::Color32::from_rgb(50, 100, 150);
    visuals.selection.stroke = egui::Stroke::new(1.0, egui::Color32::from_rgb(100, 180, 255));
    visuals.extreme_bg_color = egui::Color32::from_rgb(20, 20, 25);
    visuals.faint_bg_color = egui::Color32::from_rgb(25, 25, 30);
    visuals.window_fill = egui::Color32::from_rgb(35, 35, 40);
    visuals.window_stroke = egui::Stroke::new(1.0, egui::Color32::from_rgb(60, 60, 70));

    style.visuals = visuals;

    // Spacing
    style.spacing.item_spacing = egui::vec2(8.0, 4.0);
    style.spacing.window_margin = egui::Margin::same(12);
    style.spacing.button_padding = egui::vec2(8.0, 4.0);

    // Rounding
    style.visuals.widgets.noninteractive.corner_radius = egui::CornerRadius::same(4);
    style.visuals.widgets.inactive.corner_radius = egui::CornerRadius::same(4);
    style.visuals.widgets.hovered.corner_radius = egui::CornerRadius::same(6);
    style.visuals.widgets.active.corner_radius = egui::CornerRadius::same(6);

    ctx.set_global_style(style);
}

#[allow(dead_code)]
fn install_icon_fonts(_ctx: &egui::Context) {
    // Icons are bundled via iconflow crate at compile time — no runtime font installation needed
}

/// Create a RichText icon from emoji character
fn icon_text(codepoint: u32, _family: &str, size: f32, color: egui::Color32) -> egui::RichText {
    let glyph = char::from_u32(codepoint).unwrap_or('?');
    egui::RichText::new(glyph.to_string())
        .size(size)
        .color(color)
}

/// Get just the icon character as a string
fn icon_char(codepoint: u32) -> char {
    char::from_u32(codepoint).unwrap_or('?')
}
