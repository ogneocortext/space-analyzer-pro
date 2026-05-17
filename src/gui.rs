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

mod ai_skills;
mod database;
mod gui_common;
mod ollama_client;
mod system_monitor;
mod workflows;

use eframe::egui::{self, Widget};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::mpsc;
use gui_common::{ScanResult, formatting};
use workflows::{Workflow, WorkflowTemplates, StorageInsights, AIRecommendation, RecommendationPriority, WorkflowAction, WorkflowExecution, ExecutionStatus};
use database::{Database, AppSettings, ScanHistoryRecord};
use ollama_client::OllamaClient;
use system_monitor::{SystemMonitor, DiskVolume, SystemResources, GpuInfo};

/// Scan message type for GUI communication
#[derive(Debug, Clone)]
pub enum ScanMessage {
    Progress(f32),
    Complete(ScanResult),
    Error(String),
}

/// Tab views for the main application
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum AppTab {
    Dashboard,
    Scan,
    History,
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
            AppTab::Workflows => write!(f, "Workflows"),
            AppTab::AIChat => write!(f, "AI Assistant"),
            AppTab::System => write!(f, "System"),
            AppTab::Settings => write!(f, "Settings"),
        }
    }
}

/// Chat message for AI assistant
#[derive(Debug, Clone)]
struct ChatMessage {
    role: String,
    content: String,
}

/// Main GUI application structure
pub struct SpaceAnalyzerApp {
    // Navigation
    active_tab: AppTab,
    
    // Scanning
    current_path: PathBuf,
    scan_result: Option<ScanResult>,
    is_scanning: bool,
    scan_progress: f32,
    scan_receiver: Option<mpsc::Receiver<ScanMessage>>,
    cancel_flag: Option<Arc<AtomicBool>>,
    deep_scan: bool,
    status_message: Option<String>,
    
    // Database
    db: Option<Database>,
    scan_history: Vec<ScanHistoryRecord>,
    
    // Settings
    settings: AppSettings,
    
    // Workflows
    workflows: Vec<Workflow>,
    active_workflow: Option<WorkflowExecution>,
    workflow_to_run: Option<String>,
    
    // AI
    ai_recommendations: Vec<AIRecommendation>,
    ollama_client: Option<OllamaClient>,
    ollama_available: bool,
    ollama_checking: bool,
    chat_messages: Vec<ChatMessage>,
    chat_input: String,
    chat_processing: bool,
    
    // System
    disk_volumes: Vec<DiskVolume>,
    system_resources: Option<SystemResources>,
    gpu_info: Option<GpuInfo>,
    
    // UI state
    show_workflow_panel: bool,
    show_ai_panel: bool,
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
            Some(OllamaClient::new(&settings.ollama_url, &settings.ollama_model))
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
            deep_scan: settings.default_deep_scan,
            status_message: None,
            db: None,
            scan_history: Vec::new(),
            settings,
            workflows: templates,
            active_workflow: None,
            workflow_to_run: None,
            ai_recommendations: Vec::new(),
            ollama_client,
            ollama_available: false,
            ollama_checking: false,
            chat_messages: vec![
                ChatMessage {
                    role: "assistant".to_string(),
                    content: "Hello! I'm your local AI storage assistant. Run a scan first, then ask me questions about your disk usage.".to_string(),
                }
            ],
            chat_input: String::new(),
            chat_processing: false,
            disk_volumes: Vec::new(),
            system_resources: None,
            gpu_info: None,
            show_workflow_panel: false,
            show_ai_panel: false,
        };

        // Initialize database
        match Database::default_open() {
            Ok(db) => {
                app.settings = db.load_settings();
                app.scan_history = db.get_scan_history(50).unwrap_or_default();
                app.db = Some(db);
            }
            Err(e) => {
                app.status_message = Some(format!("Database warning: {}. Running without persistence.", e));
            }
        }

        // Refresh system info
        app.refresh_system_info();
        
        // Check Ollama availability
        if app.ollama_client.is_some() {
            app.check_ollama();
        }

        app
    }
}

impl SpaceAnalyzerApp {
    // ========== SCANNING ==========
    
    pub fn start_scan(&mut self) {
        if self.is_scanning {
            return;
        }
        self.is_scanning = true;
        self.scan_progress = 0.0;
        self.scan_result = None;
        self.status_message = None;

        let path = self.current_path.clone();
        let deep = self.deep_scan;
        let cancel_flag = Arc::new(AtomicBool::new(false));
        self.cancel_flag = Some(cancel_flag.clone());
        let (tx, rx) = mpsc::channel();
        self.scan_receiver = Some(rx);

        std::thread::spawn(move || {
            let _ = tx.send(ScanMessage::Progress(0.0));

            let mut total_estimate = 0u64;
            let mut estimate_walker = walkdir::WalkDir::new(&path);
            if !deep {
                estimate_walker = estimate_walker.max_depth(5);
            }
            for _entry in estimate_walker.into_iter().filter_map(|e| e.ok()) {
                if cancel_flag.load(Ordering::Relaxed) {
                    let _ = tx.send(ScanMessage::Error("Scan cancelled".to_string()));
                    return;
                }
                total_estimate += 1;
                if total_estimate > 50000 {
                    break;
                }
            }

            let mut processed = 0u64;
            let start = std::time::Instant::now();

            let mut walker = walkdir::WalkDir::new(&path);
            if !deep {
                walker = walker.max_depth(5);
            }

            let mut total_files = 0usize;
            let mut total_size = 0u64;
            let mut file_types = std::collections::HashMap::new();
            let mut largest_files: Vec<(String, u64)> = Vec::new();

            for entry in walker.into_iter().filter_map(|e| e.ok()) {
                if cancel_flag.load(Ordering::Relaxed) {
                    let _ = tx.send(ScanMessage::Error("Scan cancelled".to_string()));
                    return;
                }

                let entry_path = entry.path();
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_file() {
                        let size = metadata.len();
                        total_files += 1;
                        total_size += size;

                        if let Some(ext) = entry_path.extension().and_then(|e| e.to_str()) {
                            let ext_lower = ext.to_lowercase();
                            *file_types.entry(ext_lower).or_insert(0) += 1;
                        }

                        if largest_files.len() < 10 || size > largest_files.last().map(|(_, s)| *s).unwrap_or(0) {
                            largest_files.push((entry_path.to_string_lossy().to_string(), size));
                            largest_files.sort_by(|a, b| b.1.cmp(&a.1));
                            largest_files.truncate(10);
                        }
                    }
                }

                processed += 1;
                if processed % 500 == 0 && total_estimate > 0 {
                    let pct = ((processed as f32 / total_estimate as f32) * 95.0).min(95.0);
                    let _ = tx.send(ScanMessage::Progress(pct));
                }
            }

            let duration = start.elapsed().as_secs_f64();
            let mut result = ScanResult::new();
            result.total_files = total_files;
            result.total_size_bytes = total_size;
            result.total_size_mb = total_size as f64 / (1024.0 * 1024.0);
            result.duration_secs = duration;
            result.file_types = file_types;
            result.largest_files = largest_files;
            result.path = path.to_string_lossy().to_string();

            let _ = tx.send(ScanMessage::Progress(100.0));
            let _ = tx.send(ScanMessage::Complete(result));
        });
    }

    pub fn stop_scan(&mut self) {
        if let Some(ref flag) = self.cancel_flag {
            flag.store(true, Ordering::Relaxed);
        }
        self.is_scanning = false;
        self.scan_receiver = None;
        self.cancel_flag = None;
        self.status_message = Some("Scan cancelled".to_string());
    }

    pub fn process_scan_messages(&mut self) {
        let receiver = self.scan_receiver.take();
        if let Some(receiver) = receiver {
            while let Ok(message) = receiver.try_recv() {
                match message {
                    ScanMessage::Progress(progress) => {
                        self.scan_progress = progress;
                    }
                    ScanMessage::Complete(result) => {
                        // Save to database
                        if let Some(ref db) = self.db {
                            if let Err(e) = db.save_scan(&result, self.deep_scan) {
                                self.status_message = Some(format!("Failed to save scan: {}", e));
                            }
                            self.scan_history = db.get_scan_history(50).unwrap_or_default();
                        }
                        
                        self.scan_result = Some(result);
                        self.is_scanning = false;
                        self.scan_progress = 1.0;
                        self.cancel_flag = None;
                        self.generate_ai_recommendations();
                    }
                    ScanMessage::Error(error) => {
                        self.status_message = Some(error);
                        self.is_scanning = false;
                        self.cancel_flag = None;
                    }
                }
            }
            if self.is_scanning {
                self.scan_receiver = Some(receiver);
            }
        }
    }

    // ========== DATABASE ==========

    fn load_history(&mut self) {
        if let Some(ref db) = self.db {
            self.scan_history = db.get_scan_history(50).unwrap_or_default();
        }
    }

    fn delete_history_record(&mut self, id: i64) {
        if let Some(ref db) = self.db {
            let _ = db.delete_scan(id);
            self.scan_history = db.get_scan_history(50).unwrap_or_default();
        }
    }

    fn clear_all_history(&mut self) {
        if let Some(ref db) = self.db {
            let _ = db.clear_history();
            self.scan_history.clear();
        }
    }

    // ========== SETTINGS ==========

    fn save_settings(&mut self) {
        if let Some(ref db) = self.db {
            let _ = db.save_all_settings(&self.settings);
        }
    }

    // ========== WORKFLOWS ==========

    pub fn run_workflow(&mut self, workflow_id: &str) {
        if let Some(index) = self.workflows.iter().position(|w| w.id == workflow_id) {
            let workflow = &self.workflows[index];
            let execution = workflow.start_execution();
            self.active_workflow = Some(execution);
            
            for action in &workflow.actions {
                if let WorkflowAction::Scan { path, deep, .. } = action {
                    self.current_path = PathBuf::from(path);
                    self.deep_scan = *deep;
                    self.start_scan();
                    break;
                }
            }
        }
    }

    // ========== AI ==========

    pub fn generate_ai_recommendations(&mut self) {
        if let Some(ref result) = self.scan_result {
            self.ai_recommendations = StorageInsights::generate_recommendations(result);
        } else {
            self.ai_recommendations.clear();
        }
    }

    fn check_ollama(&mut self) {
        self.ollama_checking = true;
        if let Some(ref client) = self.ollama_client {
            let client = client.clone();
            let rt = tokio::runtime::Runtime::new().ok();
            if let Some(rt) = rt {
                self.ollama_available = rt.block_on(async { client.is_available().await });
            }
        }
        self.ollama_checking = false;
    }

    fn send_chat_message(&mut self) {
        if self.chat_input.is_empty() || self.chat_processing {
            return;
        }

        let user_message = self.chat_input.clone();
        self.chat_messages.push(ChatMessage {
            role: "user".to_string(),
            content: user_message.clone(),
        });
        self.chat_input.clear();
        self.chat_processing = true;

        if let Some(ref client) = self.ollama_client {
            let client = client.clone();
            let context = if let Some(ref result) = self.scan_result {
                format!(
                    "Path: {}\nFiles: {}\nTotal Size: {} MB\nFile Types: {:?}",
                    result.path, result.total_files, result.total_size_mb, result.file_types
                )
            } else {
                "No scan results available.".to_string()
            };

            let rt = tokio::runtime::Runtime::new().ok();
            if let Some(rt) = rt {
                let response = rt.block_on(async {
                    client.answer_question(&user_message, &context).await
                });

                match response {
                    Ok(reply) => {
                        self.chat_messages.push(ChatMessage {
                            role: "assistant".to_string(),
                            content: reply,
                        });
                    }
                    Err(e) => {
                        self.chat_messages.push(ChatMessage {
                            role: "assistant".to_string(),
                            content: format!("Error: {}. Make sure Ollama is running.", e),
                        });
                    }
                }
            }
        } else {
            self.chat_messages.push(ChatMessage {
                role: "assistant".to_string(),
                content: "Ollama is not enabled. Enable it in Settings to use AI features.".to_string(),
            });
        }

        self.chat_processing = false;
    }

    // ========== SYSTEM ==========

    fn refresh_system_info(&mut self) {
        self.disk_volumes = SystemMonitor::get_disk_volumes();
        self.system_resources = Some(SystemMonitor::get_system_resources());
        self.gpu_info = Some(SystemMonitor::detect_gpu());
    }

    // ========== EXPORT ==========

    pub fn export_results(&self) {
        if let Some(ref result) = self.scan_result {
            if let Some(path) = rfd::FileDialog::new()
                .add_filter("JSON", &["json"])
                .save_file()
            {
                if let Ok(json_content) = serde_json::to_string_pretty(result) {
                    let _ = std::fs::write(path, json_content);
                }
            }
        }
    }

    // ========== UI HELPERS ==========

    fn show_visual_analysis(&self, ui: &mut egui::Ui, result: &ScanResult) {
        ui.label("File distribution:");
        if result.total_files == 0 {
            ui.label("No files found.");
            return;
        }
        if !result.file_types.is_empty() {
            let total_files = result.total_files as f64;
            let mut sorted_types: Vec<_> = result.file_types.iter().collect();
            sorted_types.sort_by(|a, b| b.1.cmp(a.1));
            for (ext, count) in sorted_types.iter().take(10) {
                let count_val = **count;
                let percentage = (count_val as f64 / total_files) * 100.0;
                let bar_length = (percentage / 100.0 * 30.0) as usize;
                let bar = "\u{2588}".repeat(bar_length);
                ui.monospace(format!("{:<8} {:5.1}% |{}| ({})", 
                    format!(".{}", ext), percentage, bar, count_val));
            }
        }
    }

    fn show_file_types(&self, ui: &mut egui::Ui, result: &ScanResult) {
        if result.file_types.is_empty() {
            ui.label("No file types found.");
            return;
        }
        let mut sorted_types: Vec<_> = result.file_types.iter().collect();
        sorted_types.sort_by(|a, b| b.1.cmp(a.1));
        egui::Grid::new("file_types_grid").num_columns(2).show(ui, |ui| {
            for (ext, count) in sorted_types.iter().take(50) {
                ui.label(format!(".{}", ext));
                ui.label(format!("{} files", count));
                ui.end_row();
            }
        });
    }

    fn show_largest_files(&self, ui: &mut egui::Ui, result: &ScanResult) {
        if result.largest_files.is_empty() {
            ui.label("No files found.");
            return;
        }
        egui::Grid::new("largest_files_grid").num_columns(2).show(ui, |ui| {
            for (path, size) in &result.largest_files {
                ui.label(formatting::format_bytes(*size));
                ui.label(path);
                ui.end_row();
            }
        });
    }

    fn show_path_controls(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            ui.label("Directory:");
            if ui.button("Browse...").clicked() {
                if let Some(path) = rfd::FileDialog::new().pick_folder() {
                    self.current_path = path;
                    self.settings.default_scan_path = self.current_path.to_string_lossy().to_string();
                    self.save_settings();
                }
            }
            ui.label(self.current_path.display().to_string());
        });
    }

    fn show_scan_controls(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            ui.checkbox(&mut self.deep_scan, "Deep Scan");
            if ui.add_enabled(!self.is_scanning, egui::Button::new("Scan")).clicked() {
                self.start_scan();
            }
            if ui.add_enabled(self.is_scanning, egui::Button::new("Stop")).clicked() {
                self.stop_scan();
            }
            if ui.add_enabled(self.scan_result.is_some(), egui::Button::new("Export")).clicked() {
                self.export_results();
            }
        });
    }

    fn show_progress(&self, ui: &mut egui::Ui) {
        if self.is_scanning {
            ui.separator();
            ui.horizontal(|ui| {
                ui.label("Progress:");
                egui::ProgressBar::new(self.scan_progress / 100.0)
                    .show_percentage()
                    .ui(ui);
            });
        }
    }

    // ========== TAB RENDERERS ==========

    fn render_dashboard(&mut self, ui: &mut egui::Ui) {
        ui.heading("Space Analyzer Pro v3.2.0");
        ui.label("Self-contained disk space analysis with embedded database and AI.");
        ui.separator();

        // Quick stats
        ui.horizontal(|ui| {
            if let Some(ref result) = self.scan_result {
                ui.label(format!("Last scan: {} files, {}", result.total_files, formatting::format_bytes(result.total_size_bytes)));
            } else {
                ui.label("No scans yet. Go to the Scan tab to begin.");
            }
        });

        ui.horizontal(|ui| {
            ui.label(format!("Scan history: {} records", self.scan_history.len()));
            if let Some(ref gpu) = self.gpu_info {
                if gpu.available {
                    ui.label(format!("GPU: {}", gpu.name.as_deref().unwrap_or("Unknown")));
                } else {
                    ui.label("GPU: Not detected (using CPU)");
                }
            }
        });

        ui.separator();

        // Quick actions
        ui.heading("Quick Actions");
        ui.horizontal(|ui| {
            if ui.button("Scan Now").clicked() {
                self.active_tab = AppTab::Scan;
                self.start_scan();
            }
            if ui.button("View History").clicked() {
                self.active_tab = AppTab::History;
            }
            if ui.button("Run Workflow").clicked() {
                self.active_tab = AppTab::Workflows;
            }
            if ui.button("AI Assistant").clicked() {
                self.active_tab = AppTab::AIChat;
            }
        });

        // AI recommendations preview
        if !self.ai_recommendations.is_empty() {
            ui.separator();
            ui.heading("AI Insights");
            for rec in self.ai_recommendations.iter().take(3) {
                let color = match rec.priority {
                    RecommendationPriority::Critical => egui::Color32::RED,
                    RecommendationPriority::High => egui::Color32::from_rgb(255, 165, 0),
                    RecommendationPriority::Medium => egui::Color32::YELLOW,
                    RecommendationPriority::Low => egui::Color32::LIGHT_GRAY,
                };
                ui.label(egui::RichText::new(&rec.title).color(color));
                ui.label(&rec.description);
                ui.separator();
            }
        }
    }

    fn render_scan(&mut self, ui: &mut egui::Ui) {
        ui.heading("Directory Scan");
        ui.separator();
        self.show_path_controls(ui);
        ui.separator();
        self.show_scan_controls(ui);
        self.show_progress(ui);
        ui.separator();

        if let Some(ref msg) = self.status_message {
            ui.colored_label(egui::Color32::RED, msg);
            ui.separator();
        }

        if let Some(ref result) = self.scan_result {
            ui.heading("Scan Results");
            ui.horizontal(|ui| {
                ui.label(format!("Files: {}", result.total_files));
                ui.label(format!("Size: {}", formatting::format_bytes(result.total_size_bytes)));
                ui.label(format!("Time: {:.1}s", result.duration_secs));
            });
            ui.separator();

            ui.collapsing("Visual Analysis", |ui| {
                egui::ScrollArea::vertical().show(ui, |ui| {
                    self.show_visual_analysis(ui, result);
                });
            });
            ui.collapsing("File Types", |ui| {
                egui::ScrollArea::vertical().show(ui, |ui| {
                    self.show_file_types(ui, result);
                });
            });
            ui.collapsing("Largest Files", |ui| {
                egui::ScrollArea::vertical().show(ui, |ui| {
                    self.show_largest_files(ui, result);
                });
            });
        }
    }

    fn render_history(&mut self, ui: &mut egui::Ui) {
        ui.heading("Scan History");
        ui.separator();

        ui.horizontal(|ui| {
            if ui.button("Refresh").clicked() {
                self.load_history();
            }
            if !self.scan_history.is_empty() && ui.button("Clear All").clicked() {
                self.clear_all_history();
            }
        });
        ui.separator();

        if self.scan_history.is_empty() {
            ui.label("No scan history. Run a scan to start tracking.");
        } else {
            let mut delete_id: Option<i64> = None;
            egui::ScrollArea::vertical().show(ui, |ui| {
                for record in &self.scan_history {
                    ui.horizontal(|ui| {
                        ui.vertical(|ui| {
                            ui.label(format!("{} - {} files, {} MB", 
                                record.path, record.total_files, record.total_size_mb));
                            ui.label(format!("{} (deep: {})", record.timestamp, record.deep_scan));
                        });
                        if ui.small_button("X").clicked() {
                            delete_id = Some(record.id);
                        }
                    });
                    ui.separator();
                }
            });
            if let Some(id) = delete_id {
                self.delete_history_record(id);
            }
        }
    }

    fn render_workflows(&mut self, ui: &mut egui::Ui) {
        ui.heading("Automation Workflows");
        ui.separator();

        if let Some(ref execution) = self.active_workflow {
            ui.horizontal(|ui| {
                let status_color = match execution.status {
                    ExecutionStatus::Running => egui::Color32::YELLOW,
                    ExecutionStatus::Completed => egui::Color32::GREEN,
                    ExecutionStatus::Failed => egui::Color32::RED,
                    _ => egui::Color32::GRAY,
                };
                ui.label(egui::RichText::new(format!("{}: {}", execution.workflow_name, execution.status)).color(status_color));
                if execution.status == ExecutionStatus::Running {
                    ui.label(format!("{}/{} actions", execution.actions_completed, execution.total_actions));
                }
            });
            ui.separator();
        }

        let mut run_workflow_id: Option<String> = None;
        for workflow in &self.workflows {
            ui.horizontal(|ui| {
                ui.vertical(|ui| {
                    ui.label(egui::RichText::new(&workflow.name).strong());
                    ui.label(&workflow.description);
                    ui.label(format!("Category: {} | Actions: {}", workflow.category, workflow.actions.len()));
                });
                if ui.button("Run").clicked() {
                    run_workflow_id = Some(workflow.id.clone());
                }
            });
            ui.separator();
        }
        if let Some(id) = run_workflow_id {
            self.run_workflow(&id);
        }
    }

    fn render_ai_chat(&mut self, ui: &mut egui::Ui) {
        ui.heading("AI Storage Assistant");
        ui.horizontal(|ui| {
            if self.ollama_available {
                ui.label(egui::RichText::new("Ollama: Connected").color(egui::Color32::GREEN));
            } else if self.ollama_checking {
                ui.label("Ollama: Checking...");
            } else {
                ui.label(egui::RichText::new("Ollama: Not available (using local analysis)").color(egui::Color32::YELLOW));
            }
        });
        ui.separator();

        // Chat messages
        egui::ScrollArea::vertical().show(ui, |ui| {
            for msg in &self.chat_messages {
                let is_user = msg.role == "user";
                let color = if is_user { egui::Color32::LIGHT_BLUE } else { egui::Color32::LIGHT_GREEN };
                ui.horizontal(|ui| {
                    ui.label(egui::RichText::new(if is_user { "You" } else { "AI" }).color(color).strong());
                });
                ui.label(&msg.content);
                ui.separator();
            }
            if self.chat_processing {
                ui.label("AI is thinking...");
            }
        });

        // Input
        ui.horizontal(|ui| {
            let response = ui.add(egui::TextEdit::singleline(&mut self.chat_input)
                .desired_width(f32::INFINITY)
                .hint_text("Ask about your disk usage..."));
            if (response.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter))) ||
               ui.button("Send").clicked() {
                self.send_chat_message();
            }
        });
    }

    fn render_system(&mut self, ui: &mut egui::Ui) {
        ui.heading("System Monitor");
        ui.separator();

        if ui.button("Refresh").clicked() {
            self.refresh_system_info();
        }
        ui.separator();

        // CPU & Memory
        if let Some(ref resources) = self.system_resources {
            ui.label(format!("CPU Usage: {:.1}%", resources.cpu_percent));
            ui.add(egui::ProgressBar::new(resources.cpu_percent / 100.0).show_percentage());
            ui.label(format!("Memory: {} / {} ({:.1}%)",
                system_monitor::format_bytes(resources.memory_used_bytes),
                system_monitor::format_bytes(resources.memory_total_bytes),
                resources.memory_percent));
            ui.add(egui::ProgressBar::new(resources.memory_percent / 100.0).show_percentage());
            ui.separator();
        }

        // Disk volumes
        ui.heading("Disk Volumes");
        for volume in &self.disk_volumes {
            ui.label(format!("{} ({}) - {:.1}% used",
                volume.mount_point,
                system_monitor::format_bytes(volume.total_bytes),
                volume.usage_percent));
            ui.add(egui::ProgressBar::new(volume.usage_percent / 100.0).show_percentage());
        }
        ui.separator();

        // GPU
        if let Some(ref gpu) = self.gpu_info {
            ui.heading("GPU");
            if gpu.available {
                ui.label(egui::RichText::new(format!("{} (VRAM: {})", 
                    gpu.name.as_deref().unwrap_or("Unknown"),
                    gpu.vram_bytes.map(|b| system_monitor::format_bytes(b)).unwrap_or("Unknown".to_string())
                )).color(egui::Color32::GREEN));
            } else {
                ui.label(egui::RichText::new("No NVIDIA GPU detected. Using CPU fallback.").color(egui::Color32::YELLOW));
            }
        }
    }

    fn render_settings(&mut self, ui: &mut egui::Ui) {
        ui.heading("Settings");
        ui.separator();

        ui.heading("Scan Settings");
        ui.checkbox(&mut self.settings.default_deep_scan, "Default to Deep Scan");
        ui.horizontal(|ui| {
            ui.label("Max Scan Depth:");
            ui.add(egui::DragValue::new(&mut self.settings.max_scan_depth).range(1..=20));
        });
        ui.horizontal(|ui| {
            ui.label("Large File Threshold (MB):");
            ui.add(egui::DragValue::new(&mut self.settings.large_file_threshold_mb).range(1..=10000));
        });
        ui.separator();

        ui.heading("AI Settings (Ollama)");
        ui.checkbox(&mut self.settings.ollama_enabled, "Enable Ollama AI");
        if self.settings.ollama_enabled {
            ui.horizontal(|ui| {
                ui.label("Ollama URL:");
                ui.text_edit_singleline(&mut self.settings.ollama_url);
            });
            ui.horizontal(|ui| {
                ui.label("Model:");
                ui.text_edit_singleline(&mut self.settings.ollama_model);
            });
            if ui.button("Test Connection").clicked() {
                self.ollama_client = Some(OllamaClient::new(&self.settings.ollama_url, &self.settings.ollama_model));
                self.check_ollama();
            }
        }
        ui.separator();

        ui.heading("GPU Settings");
        ui.checkbox(&mut self.settings.gpu_acceleration, "Enable GPU Acceleration");
        ui.separator();

        if ui.button("Save Settings").clicked() {
            self.save_settings();
            self.status_message = Some("Settings saved.".to_string());
        }
    }
}

impl eframe::App for SpaceAnalyzerApp {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        self.process_scan_messages();

        // Top menu bar
        ui.horizontal(|ui| {
            ui.heading("Space Analyzer Pro");
            ui.separator();
            for tab in [AppTab::Dashboard, AppTab::Scan, AppTab::History, AppTab::Workflows, AppTab::AIChat, AppTab::System, AppTab::Settings] {
                let selected = self.active_tab == tab;
                let btn = ui.selectable_label(selected, tab.to_string());
                if btn.clicked() {
                    self.active_tab = tab;
                }
            }
        });
        ui.separator();

        // Status message
        if let Some(ref msg) = self.status_message {
            ui.colored_label(egui::Color32::YELLOW, msg);
            ui.separator();
        }

        // Main content
        egui::ScrollArea::vertical().show(ui, |ui| {
            match self.active_tab {
                AppTab::Dashboard => self.render_dashboard(ui),
                AppTab::Scan => self.render_scan(ui),
                AppTab::History => self.render_history(ui),
                AppTab::Workflows => self.render_workflows(ui),
                AppTab::AIChat => self.render_ai_chat(ui),
                AppTab::System => self.render_system(ui),
                AppTab::Settings => self.render_settings(ui),
            }
        });
    }
}

fn main() -> Result<(), eframe::Error> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([1400.0, 900.0])
            .with_title("Space Analyzer Pro v3.2.0 - Self-Contained"),
        ..Default::default()
    };

    eframe::run_native(
        "Space Analyzer Pro",
        options,
        Box::new(|_cc| Ok(Box::new(SpaceAnalyzerApp::default()))),
    )
}
