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

// Re-export root-crate modules so sub-modules can reach them via super::super::X
pub(crate) use space_analyzer_pro_desktop::category;
pub(crate) use space_analyzer_pro_desktop::database;
pub(crate) use space_analyzer_pro_desktop::embedding_service;
pub(crate) use space_analyzer_pro_desktop::file_relations;
pub(crate) use space_analyzer_pro_desktop::gui_common;
pub(crate) use space_analyzer_pro_desktop::offline_ai;
pub(crate) use space_analyzer_pro_desktop::ollama;
pub(crate) use space_analyzer_pro_desktop::session_logger;
pub(crate) use space_analyzer_pro_desktop::system_monitor;
pub(crate) use space_analyzer_pro_desktop::tool_registry;
pub(crate) use space_analyzer_pro_desktop::utils;
pub(crate) use space_analyzer_pro_desktop::workflows;

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
    app_card, badge, card_frame, danger_button, danger_button_small, empty_state, gauge_bar,
    icon_text, inline_alert, labeled_gauge, primary_button, primary_button_small, secondary_button,
    secondary_button_small, section_header, section_heading, stat_card, status_badge, tiny_button,
    Tone,
};

/// Shared Tokio runtime for all async operations
fn shared_runtime() -> &'static tokio::runtime::Runtime {
    static RUNTIME: std::sync::OnceLock<tokio::runtime::Runtime> = std::sync::OnceLock::new();
    RUNTIME.get_or_init(|| tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime"))
}

#[derive(Clone)]
pub struct AiPromptState {
    pub semantic_search_query: String,
    pub cleanup_plan_question: String,
    pub pending_screenshot_path: Option<String>,
}

#[derive(Clone)]
pub struct FileActionState {
    pub thumbnail_cache: Arc<crate::thumbnails::ThumbnailCache>,
}

#[derive(Clone)]
pub struct WorkflowEditorState {
    pub editing_workflow: Option<Workflow>,
    pub show_workflow_editor: bool,
}

#[derive(Clone)]
pub struct ModelSelectionState {
    pub current_active_model: Option<String>,
    pub current_model_task: Option<String>,
}

pub struct PromptCacheState {
    pub prompt_cache: ollama::PromptCache,
    pub cache_stats_visible: bool,
}

#[derive(Clone)]
pub struct ToolRuntimeState {
    pub tool_call_depth: u32,
    pub ollama_auto_started: bool,
}

#[derive(Clone)]
pub struct WelcomeState {
    pub show_welcome: bool,
    pub startup_frame: u64,
}

#[derive(Clone)]
pub struct NotificationState {
    pub notifications: Vec<Notification>,
    pub notification_counter: u64,
}

#[derive(Clone)]
pub struct SystemState {
    pub disk_volumes: Vec<DiskVolume>,
    pub system_resources: Option<SystemResources>,
    pub gpu_info: Option<GpuInfo>,
}

/// Main GUI application structure
pub struct SpaceAnalyzerApp {
    // Navigation
    pub active_tab: AppTab,
    pub previous_tab: AppTab,

    // Scanning
    pub current_path: PathBuf,
    pub scan_result: Option<ScanResult>,
    pub is_scanning: bool,
    pub scan_progress: f32,
    pub current_scan_file: String,
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
    pub workflow_editor_state: WorkflowEditorState,

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

    pub prompt_cache_state: PromptCacheState,

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

    pub model_selection_state: ModelSelectionState,

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
    pub ai_prompt_state: AiPromptState,

    // Deduplication
    pub dedup_receiver: Option<mpsc::Receiver<String>>,
    pub is_deduplicating: bool,

    pub system_state: SystemState,

    pub tool_runtime_state: ToolRuntimeState,
    frame_counter: u64,

    pub welcome_state: WelcomeState,

    // Session Logger
    pub session_logger: session_logger::SessionLogger,

    pub notification_state: NotificationState,

    // Destructive-action impact preview (F: preview before delete)
    pub impact_preview_input: String,
    pub current_impact_report: Option<file_relations::DependencyReport>,
    pub impact_preview_open: bool,
    pub impact_preview_pending: bool,
    // File actions (move to trash, etc.)
    pub file_action_state: FileActionState,
    // Scan result filters
    pub largest_files_filter: String,

    // Disk space monitor
    pub disk_monitor: space_analyzer_pro_desktop::disk_monitor::DiskMonitorState,
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
        let ollama_enabled = settings.ollama_enabled;
        let ollama_client = if ollama_enabled {
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
            previous_tab: AppTab::Dashboard,
            current_path: PathBuf::from(&settings.default_scan_path),
            scan_result: None,
            is_scanning: false,
            scan_progress: 0.0,
            current_scan_file: String::new(),
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
            workflow_editor_state: WorkflowEditorState {
                editing_workflow: None,
                show_workflow_editor: false,
            },
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
            prompt_cache_state: PromptCacheState {
                prompt_cache: ollama::PromptCache::new(ollama::PromptCacheConfig::default()),
                cache_stats_visible: false,
            },
            discovered_models: Vec::new(),
            models_discovering: false,
            model_discovery_receiver: None,
            ollama_version: None,
            last_ollama_error: None,
            running_models: Vec::new(),
            model_selection_state: ModelSelectionState {
                current_active_model: None,
                current_model_task: None,
            },
            search_query: String::new(),
            search_results: Vec::new(),
            search_processing: false,
            search_status: String::new(),
            cached_embeddings: Vec::new(),
            embedding_scan_id: None,
            is_indexing: false,
            ai_prompt_state: AiPromptState {
                semantic_search_query: String::new(),
                cleanup_plan_question: String::new(),
                pending_screenshot_path: None,
            },
            indexing_progress: 0.0,
            embedding_receiver: None,
            search_receiver: None,
            dedup_receiver: None,
            is_deduplicating: false,
            system_state: SystemState {
                disk_volumes: Vec::new(),
                system_resources: None,
                gpu_info: None,
            },
            tool_runtime_state: ToolRuntimeState {
                tool_call_depth: 0,
                ollama_auto_started: false,
            },
            frame_counter: 0,
            welcome_state: WelcomeState {
                show_welcome: true,
                startup_frame: 0,
            },
            session_logger: session_logger::SessionLogger::new(session_logger::SessionLoggerConfig {
                log_path: PathBuf::from("space-analyzer-session.log"),
                enabled: false,
                ..Default::default()
            }),
            notification_state: NotificationState {
                notifications: Vec::new(),
                notification_counter: 0,
            },
            impact_preview_input: String::new(),
            current_impact_report: None,
            impact_preview_open: false,
            impact_preview_pending: false,
            file_action_state: FileActionState {
                thumbnail_cache: Arc::new(crate::thumbnails::ThumbnailCache::default()),
            },
            largest_files_filter: String::new(),
            disk_monitor: space_analyzer_pro_desktop::disk_monitor::DiskMonitorState::default(),
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
        app.prompt_cache_state.prompt_cache =
            ollama::PromptCache::new(app.settings.to_prompt_cache_config());

        // Initialize tool registry
        app.tool_registry = Some(ToolRegistry::new(app.scan_result.clone()));

        // Refresh system info
        app.refresh_system_info();
        if let Some(ref gpu) = app.system_state.gpu_info {
            if !gpu.available {
                let warning = "GPU warning: no NVIDIA GPU detected; GPU acceleration disabled.";
                app.status_message = Some(match app.status_message.as_ref() {
                    Some(existing) => format!("{}\n{}", existing, warning),
                    None => warning.to_string(),
                });
            }
        }

        // Check Ollama availability
        if app.ollama_client.is_some() {
            app.check_ollama();
        } else if ollama_enabled {
            let warning = "Ollama warning: AI is enabled but no Ollama client is available.";
            app.status_message = Some(match app.status_message.as_ref() {
                Some(existing) => format!("{}\n{}", existing, warning),
                None => warning.to_string(),
            });
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

        // Start background disk space monitor
        {
            let mount_point = "C:\\".to_string();
            let rx = space_analyzer_pro_desktop::disk_monitor::start_disk_monitor(
                mount_point,
                5,   // sample every 5 seconds
                100, // 100 MB threshold for significant change
            );
            app.disk_monitor.receiver = Some(rx);
            app.disk_monitor.is_running = true;
        }

        app
    }
}

impl eframe::App for SpaceAnalyzerApp {
    fn on_exit(&mut self) {
        self.save_settings();
    }
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        self.process_scan_messages_safe();
        self.process_ollama_messages();
        self.process_embedding_messages();
        self.process_search_messages();
        self.process_dedup_messages();
        self.process_ai_recommendations();
        self.process_scheduled_workflows();
        self.process_model_discovery();
        self.process_disk_monitor_messages();
        self.frame_counter = self.frame_counter.wrapping_add(1);
        self.update_model_resource_usage();
        self.refresh_system_info_throttled();

        // Remove expired notifications
        self.notification_state
            .notifications
            .retain(|n| !n.is_expired());

        // Keyboard shortcuts
        let mut shortcut_handled = false;
        ui.input(|i| {
            if i.key_pressed(egui::Key::F5) {
                if !self.is_scanning {
                    self.start_scan();
                    notifications::push_notification(
                        &mut self.notification_state.notifications,
                        &mut self.notification_state.notification_counter,
                        "Scan started",
                        NotificationLevel::Info,
                    );
                }
                shortcut_handled = true;
            }
            if i.modifiers.ctrl && i.key_pressed(egui::Key::S) {
                self.save_settings();
                notifications::push_notification(
                    &mut self.notification_state.notifications,
                    &mut self.notification_state.notification_counter,
                    "Settings saved",
                    NotificationLevel::Success,
                );
                shortcut_handled = true;
            }
            if i.modifiers.ctrl && i.key_pressed(egui::Key::N) {
                self.active_tab = AppTab::Scan;
                shortcut_handled = true;
            }
            if i.modifiers.ctrl && i.key_pressed(egui::Key::H) {
                self.active_tab = AppTab::History;
                shortcut_handled = true;
            }
            if i.modifiers.ctrl && i.key_pressed(egui::Key::D) {
                self.active_tab = AppTab::Dedup;
                shortcut_handled = true;
            }
            if i.modifiers.ctrl && i.key_pressed(egui::Key::K) {
                self.active_tab = AppTab::SmartSearch;
                shortcut_handled = true;
            }
            if i.modifiers.ctrl && i.key_pressed(egui::Key::W) {
                self.active_tab = AppTab::Workflows;
                shortcut_handled = true;
            }
            if i.modifiers.ctrl && i.key_pressed(egui::Key::A) {
                self.active_tab = AppTab::AIChat;
                shortcut_handled = true;
            }
            if i.key_pressed(egui::Key::Escape) && self.is_scanning {
                self.stop_scan();
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

        // Keep UI refreshing while splash or notifications are visible
        if self.welcome_state.show_welcome || !self.notification_state.notifications.is_empty() {
            ui.ctx().request_repaint();
        }

        // Update window title during scan
        if self.is_scanning {
            let pct = self.scan_progress;
            let title = format!("Space Analyzer Pro — Scanning... {:.0}%", pct);
            ui.ctx()
                .send_viewport_cmd(egui::ViewportCommand::Title(title));
        } else {
            let title = "Space Analyzer Pro v3.7.0 - Self-Contained";
            ui.ctx()
                .send_viewport_cmd(egui::ViewportCommand::Title(title.to_string()));
        }

        // ── Welcome splash (auto-dismisses after ~120 frames or on click) ─
        if self.welcome_state.show_welcome {
            self.welcome_state.startup_frame = self.welcome_state.startup_frame.wrapping_add(1);
            splash::render_welcome_splash(
                ui,
                self.welcome_state.startup_frame,
                &mut self.welcome_state.show_welcome,
            );
            if self.welcome_state.startup_frame > 120 {
                self.welcome_state.show_welcome = false;
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

        // ── App shell ──────────────────────────────────────────────────────
        egui::Frame::NONE
            .fill(colors::BG_HEADER)
            .stroke(egui::Stroke::new(
                1.0,
                egui::Color32::from_rgba_unmultiplied(48, 64, 98, 100),
            ))
            .inner_margin(egui::Margin::symmetric(16, 10))
            .show(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.label(
                            egui::RichText::new("Space Analyzer Pro")
                                .size(16.0)
                                .strong()
                                .color(colors::ACCENT),
                        );
                        ui.label(
                            egui::RichText::new("v3.7.0")
                                .size(10.0)
                                .color(colors::TEXT_MUTED),
                        );
                    });

                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        // AI model status
                        if self.settings.ollama_enabled && self.ollama_available {
                            ui.horizontal(|ui| {
                                ui.label(
                                    egui::RichText::new("AI Model:")
                                        .size(11.0)
                                        .color(colors::TEXT_MUTED),
                                );
                                if let Some(ref model) =
                                    self.model_selection_state.current_active_model
                                {
                                    badge(ui, model, colors::SUCCESS);
                                    if let Some(ref task) =
                                        self.model_selection_state.current_model_task
                                    {
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
                        }
                    });
                });
            });

        // ── Tab bar ─────────────────────────────────────────────────────
        egui::Frame::NONE
            .fill(colors::BG_HEADER)
            .inner_margin(egui::Margin::symmetric(12, 2))
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
                            AppTab::Dedup,
                            AppTab::System,
                            AppTab::Settings,
                        ] {
                            let selected = self.active_tab == tab;
                            let tab_text = tab.to_string();

                            let icon = match tab {
                                AppTab::Dashboard => icons::DASHBOARD,
                                AppTab::Scan => icons::SCAN,
                                AppTab::History => icons::HISTORY,
                                AppTab::SmartSearch => icons::SMART_SEARCH,
                                AppTab::Workflows => icons::WORKFLOWS,
                                AppTab::AIChat => icons::AI_CHAT,
                                AppTab::Dedup => icons::DEDUP,
                                AppTab::System => icons::SYSTEM,
                                AppTab::Settings => icons::SETTINGS,
                            };

                            let label = format!("{} {}", icon, tab_text);

                            let fill = if selected {
                                colors::accent_soft()
                            } else {
                                egui::Color32::TRANSPARENT
                            };

                            let stroke = if selected {
                                egui::Stroke::new(
                                    1.5,
                                    egui::Color32::from_rgba_unmultiplied(112, 173, 255, 120),
                                )
                            } else {
                                egui::Stroke::NONE
                            };

                            let text_color = if selected {
                                colors::ACCENT
                            } else {
                                colors::TEXT_MUTED
                            };

                            let btn = egui::Button::new(
                                egui::RichText::new(label).size(12.0).color(text_color),
                            )
                            .fill(fill)
                            .stroke(stroke)
                            .corner_radius(egui::CornerRadius::same(6))
                            .min_size(egui::vec2(0.0, 30.0));

                            if ui.add(btn).clicked() {
                                if self.active_tab == AppTab::Settings && tab != AppTab::Settings {
                                    self.save_settings();
                                }
                                self.previous_tab = self.active_tab;
                                self.active_tab = tab;
                            }
                        }
                    });
                });
            });
        ui.separator();

        // ── Status message ────────────────────────────────────────────────
        if let Some(ref msg) = self.status_message {
            let is_error =
                msg.contains("failed") || msg.contains("Error") || msg.contains("Failed");
            let is_warning = msg.contains("warning") || msg.contains("Warning");
            let tone = if is_error {
                Tone::Danger
            } else if is_warning {
                Tone::Warning
            } else {
                Tone::Success
            };

            let msg_clone = msg.clone();
            egui::Frame::NONE
                .fill(tone.soft_bg())
                .corner_radius(egui::CornerRadius::same(8))
                .inner_margin(egui::Margin::symmetric(12, 8))
                .show(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.label(
                            egui::RichText::new(if is_error {
                                icons::ERROR
                            } else if is_warning {
                                icons::WARNING
                            } else {
                                icons::CHECK
                            })
                            .size(14.0)
                            .color(tone.text())
                            .strong(),
                        );
                        ui.label(
                            egui::RichText::new(&msg_clone)
                                .size(12.0)
                                .color(tone.text()),
                        );
                    });

                    if is_error || is_warning {
                        ui.horizontal(|ui| {
                            if (msg_clone.contains("Scan") || msg_clone.contains("scan"))
                                && tiny_button(ui, "Retry Scan").clicked()
                            {
                                self.start_scan();
                            }
                            if (msg_clone.contains("Ollama")
                                || msg_clone.contains("AI")
                                || msg_clone.contains("ollama"))
                                && tiny_button(ui, "Retry Connection").clicked()
                            {
                                self.ollama_available = false;
                                self.ollama_checking = false;
                                self.ollama_receiver = None;
                                self.check_ollama();
                            }
                            if (msg_clone.contains("Database")
                                || msg_clone.contains("database")
                                || msg_clone.contains("db"))
                                && tiny_button(ui, "Re-init DB").clicked()
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
                            if tiny_button(ui, "Dismiss").clicked() {
                                self.status_message = None;
                            }
                        });
                    } else {
                        if tiny_button(ui, "Dismiss").clicked() {
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
            AppTab::Dedup => self.render_dedup(ui),
            AppTab::System => self.render_system(ui),
            AppTab::Settings => self.render_settings(ui),
        });

        // Toast notifications (rendered on top of everything)
        notifications::render_impact_preview(
            ui,
            &mut self.impact_preview_open,
            &mut self.impact_preview_input,
            &mut self.current_impact_report,
        );
        notifications::render_notifications(ui, &self.notification_state.notifications);
    }
}

impl SpaceAnalyzerApp {
    /// Push a toast notification
    pub fn push_notification(&mut self, message: impl Into<String>, level: NotificationLevel) {
        notifications::push_notification(
            &mut self.notification_state.notifications,
            &mut self.notification_state.notification_counter,
            message,
            level,
        );
    }

    /// Process messages from the background disk space monitor
    pub fn process_disk_monitor_messages(&mut self) {
        // Collect messages first to avoid borrow issues
        let messages: Vec<_> = if let Some(ref rx) = self.disk_monitor.receiver {
            std::iter::from_fn(|| rx.try_recv().ok()).collect()
        } else {
            return;
        };

        for msg in messages {
            match msg {
                space_analyzer_pro_desktop::disk_monitor::DiskMonitorMessage::SnapshotRecorded {
                    mount_point,
                    available_bytes,
                    used_bytes,
                    usage_percent,
                } => {
                    self.disk_monitor
                        .snapshots
                        .push(space_analyzer_pro_desktop::disk_monitor::SnapshotEntry {
                            mount_point,
                            timestamp: chrono::Utc::now().to_rfc3339(),
                            available_bytes,
                            used_bytes,
                            usage_percent,
                        });
                    // Keep last 30 minutes of snapshots in memory (360 at 5s intervals)
                    if self.disk_monitor.snapshots.len() > 360 {
                        self.disk_monitor
                            .snapshots
                            .drain(..self.disk_monitor.snapshots.len() - 360);
                    }
                }
                space_analyzer_pro_desktop::disk_monitor::DiskMonitorMessage::SignificantChange {
                    mount_point,
                    delta_bytes,
                    top_processes,
                } => {
                    let sign = if delta_bytes > 0 { "+" } else { "" };
                    let mb = (delta_bytes as f64 / 1024.0 / 1024.0).abs();
                    self.push_notification(
                        format!("Disk C: {}{:.1}MB — checking what changed", sign, mb),
                        types::NotificationLevel::Warning,
                    );
                    self.disk_monitor.last_change = Some(space_analyzer_pro_desktop::disk_monitor::SignificantChange {
                        mount_point,
                        delta_bytes,
                        top_processes,
                        timestamp: chrono::Utc::now().to_rfc3339(),
                    });
                }
            }
        }
    }
}

pub fn run_gui() -> Result<(), eframe::Error> {
    run_gui_with_tab(None)
}

/// Build the application window icon from the embedded 256x256 RGBA asset.
fn app_icon() -> Option<egui::IconData> {
    let rgba: &[u8] = include_bytes!("../../../assets/icon/icon-256.rgba");
    Some(egui::IconData {
        rgba: rgba.to_vec(),
        width: 256,
        height: 256,
    })
}

pub fn run_gui_with_tab(initial_tab: Option<&str>) -> Result<(), eframe::Error> {
    let mut viewport = egui::ViewportBuilder::default()
        .with_inner_size([1400.0, 900.0])
        .with_title("Space Analyzer Pro v3.7.0 - Self-Contained")
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
                    "dedup" | "deduplicate" | "duplicates" => AppTab::Dedup,
                    "system" => AppTab::System,
                    "settings" => AppTab::Settings,
                    _ => AppTab::Dashboard,
                };
            }
            Ok(Box::new(app))
        }),
    )
}
