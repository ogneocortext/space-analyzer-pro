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

use eframe::egui::{self};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Arc;

// Re-export crate-level modules so sub-modules can reach them via super::super::X
pub(crate) use crate::category;
pub(crate) use crate::database;
pub(crate) use crate::embedding_service;
pub(crate) use crate::file_relations;
pub(crate) use crate::gui_common;
pub(crate) use crate::offline_ai;
pub(crate) use crate::ollama;
pub(crate) use crate::session_logger;
pub(crate) use crate::system_monitor;
pub(crate) use crate::tool_registry;
pub(crate) use crate::utils;
pub(crate) use crate::workflows;

use database::{AppSettings, Database, ScanHistoryRecord};
use embedding_service::{embed_files, embed_query, search_files, SearchResult};
use gui_common::{formatting, ScanResult};
use ollama::{ChatMessage as OllamaChatMessage, OllamaClient, ToolCall, ToolCallFunction};
use shared_scanner::{FileScanner, ScanOptions, ScanProgress};
use system_monitor::{DiskVolume, GpuInfo, SystemMonitor, SystemResources};
use tool_registry::ToolRegistry;
use utils::sanitize_error_message;
use workflows::{
    AIRecommendation, ExecutionStatus, RecommendationPriority, StorageInsights, Workflow,
    WorkflowAction, WorkflowExecution, WorkflowTemplates, WorkflowTrigger,
};

// Sub-modules
mod ai;
pub mod colors;
mod dashboard;
mod dedup;
mod embeddings;
mod history;
pub mod icons;
mod model_classifier;
mod notifications;
pub mod scan;
mod settings;
mod splash;
pub mod system;
mod theme;
pub mod tool_result_parser;
mod ui_helpers;
pub mod workflow_render;

pub(crate) use model_classifier::classify_model;

// Re-export types for sub-modules
pub use types::*;
mod types;

// Re-export UI helpers
pub use ui_helpers::{
    badge, card_frame, gauge_bar, icon_char, icon_text, labeled_gauge, section_heading, stat_card,
};

/// Shared Tokio runtime for all async operations
fn shared_runtime() -> &'static tokio::runtime::Runtime {
    static RUNTIME: std::sync::OnceLock<tokio::runtime::Runtime> = std::sync::OnceLock::new();
    RUNTIME.get_or_init(|| tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime"))
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
    pub(crate) model_discovery_receiver: Option<mpsc::Receiver<OllamaMessage>>,
    /// Ollama server version reported by `/api/version` (e.g. "0.30.5").
    /// `None` if the server is offline or doesn't expose the endpoint.
    pub ollama_version: Option<String>,
    /// Last error from the discovery / availability probes. Cleared on a
    /// successful probe. Surfaced in the UI so the user knows why the model
    /// list is empty.
    pub last_ollama_error: Option<String>,
    /// Currently running models reported by `/api/ps` (size, vram, expiry).
    /// Used by the System tab to show real (not estimated) VRAM usage.
    pub running_models: Vec<ollama::RunningModel>,

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

    // AI Tools Panel (v3.5.0+) — capability-driven quick buttons
    pub semantic_search_query: String,
    pub cleanup_plan_question: String,
    pub pending_screenshot_path: Option<String>,

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

    // Welcome splash
    pub show_welcome: bool,
    pub startup_frame: u64,

    // Session Logger
    pub session_logger: session_logger::SessionLogger,

    // Notifications
    pub notifications: Vec<Notification>,
    pub notification_counter: u64,

    // Destructive-action impact preview (F: preview before delete)
    pub impact_preview_input: String,
    pub current_impact_report: Option<file_relations::DependencyReport>,
    pub impact_preview_open: bool,
    pub impact_preview_pending: bool,
    // Thumbnail cache for image preview
    pub thumbnail_cache: Arc<crate::thumbnails::ThumbnailCache>,
    // File actions (move to trash, etc.)
    pub pending_file_action: Option<FileAction>,
    pub file_action_confirm_open: bool,
}

impl Default for SpaceAnalyzerApp {
    fn default() -> Self {
        let mut templates = WorkflowTemplates::all_templates();
        for workflow in &mut templates {
            if workflow.description.is_empty() {
                workflow.description =
                    format!("{} workflow for automated disk analysis.", workflow.name);
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
                    thinking: None,
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
            ollama_version: None,
            last_ollama_error: None,
            running_models: Vec::new(),
            current_active_model: None,
            current_model_task: None,
            search_query: String::new(),
            search_results: Vec::new(),
            search_processing: false,
            search_status: String::new(),
            cached_embeddings: Vec::new(),
            embedding_scan_id: None,
            is_indexing: false,
            semantic_search_query: String::new(),
            cleanup_plan_question: String::new(),
            pending_screenshot_path: None,
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
            show_welcome: true,
            startup_frame: 0,
            session_logger: session_logger::SessionLogger::new(session_logger::SessionLoggerConfig {
                log_path: PathBuf::from("space-analyzer-session.log"),
                enabled: false,
                ..Default::default()
            }),
            notifications: Vec::new(),
            notification_counter: 0,
            impact_preview_input: String::new(),
            current_impact_report: None,
            impact_preview_open: false,
            impact_preview_pending: false,
            thumbnail_cache: Arc::new(crate::thumbnails::ThumbnailCache::default()),
            pending_file_action: None,
            file_action_confirm_open: false,
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
                app.status_message = Some(format!(
                    "Database warning: {}. Running without persistence.",
                    sanitize_error_message(&e.to_string())
                ));
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
                    notifications::push_notification(
                        &mut self.notifications,
                        &mut self.notification_counter,
                        "Scan started",
                        NotificationLevel::Info,
                    );
                }
                shortcut_handled = true;
            }
            if i.modifiers.ctrl && i.key_pressed(egui::Key::S) {
                self.save_settings();
                notifications::push_notification(
                    &mut self.notifications,
                    &mut self.notification_counter,
                    "Settings saved",
                    NotificationLevel::Success,
                );
                shortcut_handled = true;
            }
        });

        // Keep UI refreshing while background work is in progress
        if self.is_scanning
            || self.chat_processing
            || self.is_indexing
            || self.is_deduplicating
            || self.ollama_checking
        {
            ui.ctx().request_repaint();
        }

        // ── Welcome splash (auto-dismisses after ~120 frames or on click) ─
        if self.show_welcome {
            self.startup_frame = self.startup_frame.wrapping_add(1);
            splash::render_welcome_splash(ui, self.startup_frame, &mut self.show_welcome);
            if self.startup_frame > 120 {
                self.show_welcome = false;
            }
            return;
        }

        // Load embeddings from DB on first run if available
        if self.cached_embeddings.is_empty()
            && self.embedding_scan_id.is_none()
            && !self.is_indexing
        {
            self.load_embeddings_from_db(None);
        }

        // ── Top bar ──────────────────────────────────────────────────────
        egui::Frame::NONE
            .fill(colors::CARD_BG)
            .stroke(egui::Stroke::new(1.0, colors::CARD_BORDER))
            .inner_margin(egui::Margin::symmetric(16, 8))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.label(
                        egui::RichText::new("Space Analyzer Pro")
                            .size(18.0)
                            .strong()
                            .color(colors::ACCENT),
                    );
                    ui.separator();
                    ui.label(
                        egui::RichText::new("v3.4.0")
                            .size(11.0)
                            .color(colors::TEXT_MUTED),
                    );
                });
            });

        // ── Tab bar ─────────────────────────────────────────────────────
        egui::Frame::NONE
            .fill(colors::CARD_BG)
            .inner_margin(egui::Margin::symmetric(12, 4))
            .show(ui, |ui| {
                egui::ScrollArea::horizontal().show(ui, |ui| {
                    ui.horizontal(|ui| {
                        for tab in [
                            AppTab::Dashboard,
                            AppTab::Scan,
                            AppTab::History,
                            AppTab::SmartSearch,
                            AppTab::Workflows,
                            AppTab::AIChat,
                            AppTab::System,
                            AppTab::Settings,
                        ] {
                            let selected = self.active_tab == tab;
                            let tab_text = tab.to_string();

                            // Tab icon mapping
                            let icon = match tab {
                                AppTab::Dashboard => "📊",
                                AppTab::Scan => "🔍",
                                AppTab::History => "📋",
                                AppTab::SmartSearch => "🧠",
                                AppTab::Workflows => "⚙",
                                AppTab::AIChat => "🤖",
                                AppTab::System => "🖥",
                                AppTab::Settings => "⚙",
                            };

                            let label = format!("{} {}", icon, tab_text);
                            let text_color = if selected {
                                egui::Color32::WHITE
                            } else {
                                colors::TEXT_SECONDARY
                            };
                            let bg = if selected {
                                colors::ACCENT
                            } else {
                                egui::Color32::TRANSPARENT
                            };
                            let stroke = if selected {
                                egui::Stroke::NONE
                            } else {
                                egui::Stroke::new(0.5, colors::CARD_BORDER)
                            };

                            let btn = egui::Button::new(
                                egui::RichText::new(label).size(12.0).color(text_color),
                            )
                            .fill(bg)
                            .stroke(stroke)
                            .corner_radius(egui::CornerRadius::same(6))
                            .min_size(egui::vec2(0.0, 28.0));

                            if ui.add(btn).clicked() {
                                self.active_tab = tab;
                            }
                        }
                    });
                });
            });
        ui.separator();

        // ── Active model status indicator ────────────────────────────────
        if self.settings.ollama_enabled && self.ollama_available {
            egui::Frame::NONE
                .fill(colors::CARD_BG)
                .inner_margin(egui::Margin::symmetric(16, 4))
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.label(
                            egui::RichText::new("AI Model:")
                                .size(11.0)
                                .color(colors::TEXT_MUTED),
                        );
                        if let Some(ref model) = self.current_active_model {
                            badge(ui, model, colors::SUCCESS);
                            if let Some(ref task) = self.current_model_task {
                                ui.label(
                                    egui::RichText::new(format!("for {}", task))
                                        .size(11.0)
                                        .color(colors::TEXT_SECONDARY)
                                        .italics(),
                                );
                            }
                        } else {
                            ui.label(
                                egui::RichText::new("Idle")
                                    .size(11.0)
                                    .color(colors::TEXT_MUTED),
                            );
                        }

                        if self.settings.auto_model_selection {
                            badge(ui, "Auto-select", colors::ACCENT_DIM);
                        }
                    });
                });
        }

        // ── Status message with interactive recovery ────────────────────
        if let Some(ref msg) = self.status_message {
            let msg_clone = msg.clone();
            let is_error =
                msg.contains("failed") || msg.contains("Error") || msg.contains("Failed");
            let is_warning = msg.contains("warning") || msg.contains("Warning");
            let (bg, icon_char) = if is_error {
                (colors::ERROR.linear_multiply(0.15), "✗")
            } else if is_warning {
                (colors::WARNING.linear_multiply(0.15), "⚠")
            } else {
                (colors::SUCCESS.linear_multiply(0.15), "✓")
            };
            let text_color = if is_error {
                colors::ERROR
            } else if is_warning {
                colors::WARNING
            } else {
                colors::SUCCESS
            };

            egui::Frame::NONE
                .fill(bg)
                .corner_radius(egui::CornerRadius::same(8))
                .inner_margin(egui::Margin::symmetric(12, 8))
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.label(
                            egui::RichText::new(icon_char)
                                .size(14.0)
                                .color(text_color)
                                .strong(),
                        );
                        ui.label(egui::RichText::new(&msg_clone).size(12.0).color(text_color));
                    });

                    // Context-aware recovery buttons
                    if is_error || is_warning {
                        ui.horizontal(|ui| {
                            if (msg_clone.contains("Scan") || msg_clone.contains("scan"))
                                && ui.small_button("Retry Scan").clicked()
                            {
                                self.start_scan();
                            }
                            if (msg_clone.contains("Ollama")
                                || msg_clone.contains("AI")
                                || msg_clone.contains("ollama"))
                                && ui.small_button("Retry Connection").clicked()
                            {
                                self.ollama_available = false;
                                self.ollama_checking = false;
                                self.ollama_receiver = None;
                                self.check_ollama();
                            }
                            if (msg_clone.contains("Database")
                                || msg_clone.contains("database")
                                || msg_clone.contains("db"))
                                && ui.small_button("Re-init DB").clicked()
                            {
                                match Database::default_open() {
                                    Ok(db) => {
                                        self.settings = db.load_settings();
                                        self.current_path =
                                            PathBuf::from(&self.settings.default_scan_path);
                                        self.scan_history =
                                            db.get_scan_history(50).unwrap_or_default();
                                        self.db = Some(db);
                                        self.status_message =
                                            Some("Database reinitialized.".to_string());
                                    }
                                    Err(e) => {
                                        self.status_message = Some(format!(
                                            "DB re-init failed: {}",
                                            sanitize_error_message(&e.to_string())
                                        ));
                                    }
                                }
                            }
                            if ui.small_button("Dismiss").clicked() {
                                self.status_message = None;
                            }
                        });
                    } else {
                        if ui.small_button("Dismiss").clicked() {
                            self.status_message = None;
                        }
                    }
                });
        }

        // Main content
        egui::ScrollArea::vertical().show(ui, |ui| match self.active_tab {
            AppTab::Dashboard => self.render_dashboard(ui),
            AppTab::Scan => self.render_scan(ui),
            AppTab::History => self.render_history(ui),
            AppTab::SmartSearch => self.render_smart_search(ui),
            AppTab::Workflows => self.render_workflows(ui),
            AppTab::AIChat => self.render_ai_chat(ui),
            AppTab::System => self.render_system(ui),
            AppTab::Settings => self.render_settings(ui),
        });

        // Toast notifications (rendered on top of everything)
        notifications::render_file_action_confirm(
            ui,
            &mut self.file_action_confirm_open,
            &mut self.pending_file_action,
            &mut self.notifications,
            &mut self.notification_counter,
        );
        notifications::render_notifications(ui, &self.notifications);
    }
}

impl SpaceAnalyzerApp {
    /// Push a toast notification
    pub fn push_notification(&mut self, message: impl Into<String>, level: NotificationLevel) {
        notifications::push_notification(
            &mut self.notifications,
            &mut self.notification_counter,
            message,
            level,
        );
    }
}

pub fn run_gui() -> Result<(), eframe::Error> {
    run_gui_with_tab(None)
}

/// Build the application window icon from the embedded 256x256 RGBA asset.
fn app_icon() -> Option<egui::IconData> {
    let rgba: &[u8] = include_bytes!("../../assets/icon/icon-256.rgba");
    Some(egui::IconData {
        rgba: rgba.to_vec(),
        width: 256,
        height: 256,
    })
}

pub fn run_gui_with_tab(initial_tab: Option<&str>) -> Result<(), eframe::Error> {
    let mut viewport = egui::ViewportBuilder::default()
        .with_inner_size([1400.0, 900.0])
        .with_title("Space Analyzer Pro v3.4.0 - Self-Contained")
        .with_app_id("space-analyzer-pro")
        .with_icon(app_icon().unwrap_or_else(|| egui::IconData {
            rgba: vec![],
            width: 0,
            height: 0,
        }));

    #[cfg(target_os = "windows")]
    {
        viewport = viewport.with_decorations(true);
    }

    let options = eframe::NativeOptions {
        viewport,
        ..Default::default()
    };

    let tab = initial_tab.map(|s| s.to_string());

    eframe::run_native(
        "Space Analyzer Pro",
        options,
        Box::new(|cc| {
            theme::apply_custom_theme(&cc.egui_ctx);
            theme::install_icon_fonts(&cc.egui_ctx);
            let mut app = SpaceAnalyzerApp::default();
            if let Some(ref tab_name) = tab {
                app.active_tab = match tab_name.to_lowercase().as_str() {
                    "scan" => AppTab::Scan,
                    "history" => AppTab::History,
                    "smart_search" | "smart search" | "search" => AppTab::SmartSearch,
                    "workflows" | "workflow" => AppTab::Workflows,
                    "ai_chat" | "ai chat" | "chat" | "ai" | "ai assistant" | "ai_assistant"
                    | "assistant" => AppTab::AIChat,
                    "system" => AppTab::System,
                    "settings" => AppTab::Settings,
                    _ => AppTab::Dashboard,
                };
            }
            Ok(Box::new(app))
        }),
    )
}
