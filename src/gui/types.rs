use eframe::egui;

use crate::gui_common::ScanResult;
use crate::ollama;

/// Scan message type for GUI communication
#[derive(Debug, Clone)]
pub enum ScanMessage {
    Progress {
        percentage: f32,
        files: u64,
        bytes: u64,
        current_file: String,
    },
    Complete(ScanResult),
    Error(String),
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

#[derive(Debug, Clone)]
pub struct FileAction {
    pub path: String,
    pub action: FileActionType,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FileActionType {
    MoveToTrash,
    Delete,
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
    pub thinking: Option<String>,
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
    /// Legacy availability variant (boolean only). Kept for backward
    /// compatibility with any external code that may still construct it;
    /// the in-tree `check_ollama` now sends `AvailabilityDetailed` instead.
    #[allow(dead_code)]
    Availability(bool),
    /// Result of an availability probe that also reports the server version
    /// (Ollama 0.30+). The version is `None` when the server doesnt expose
    /// `/api/version` (older than ~0.4.10) or when the probe failed.
    AvailabilityDetailed {
        available: bool,
        version: Option<String>,
        error: Option<String>,
    },
    ChatReply {
        content: String,
        thinking: Option<String>,
    },
    ToolCall(String, serde_json::Value),
    Error(String),
    TokenUsage {
        prompt_tokens: u32,
        completion_tokens: u32,
        duration_ms: Option<u64>,
    },
    CacheStore {
        key: String,
        system_prompt: String,
        user_prompt: String,
        response: String,
        prompt_tokens: u32,
        completion_tokens: u32,
        model: String,
    },
    /// Result of a model-discovery query.
    ModelDiscovery {
        models: Vec<OllamaModelInfo>,
        running: Vec<ollama::RunningModel>,
        version: Option<String>,
        error: Option<String>,
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
    Complete(Vec<crate::embedding_service::SearchResult>),
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
