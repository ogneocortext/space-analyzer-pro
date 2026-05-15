use eframe::egui;
use crate::types::*;
use crate::scanner::{FileScanner, get_system_info};
use crate::theme::{self, palette};
use crate::ollama_cuda::{CudaOllamaClient, MlTools};
use gpu_compute::device::GpuInfo;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::path::Path;
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
enum ViewTemplate {
    Summary,
    FileTypes,
    SizeAudit,
    Organize,
    Cleanup,
}

impl ViewTemplate {
    fn all() -> &'static [(ViewTemplate, &'static str)] {
        &[
            (ViewTemplate::Summary, "Standard Summary"),
            (ViewTemplate::FileTypes, "File Types Report"),
            (ViewTemplate::SizeAudit, "Size Audit"),
            (ViewTemplate::Organize, "Organization Planner"),
            (ViewTemplate::Cleanup, "Cleanup Review"),
        ]
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct ScanRecord {
    path: String,
    file_name: String,
    scanned_at: String,
    total_files: u64,
    total_size: u64,
    total_dirs: u64,
    duration_ms: u64,
}

#[derive(Clone)]
struct ConfirmAction {
    message: String,
    action_type: ConfirmType,
}

#[derive(Clone, PartialEq)]
enum ConfirmType {
    DeleteFile { path: String },
    DeleteMultiple { paths: Vec<String>, count: usize },
    OrganizeFile { source: String, destination: String },
}

pub struct SpaceAnalyzerApp {
    // Core
    scanner: FileScanner,
    cancel_flag: Arc<AtomicBool>,

    // Current scan
    analysis: Option<DirectoryAnalysis>,
    is_scanning: bool,
    scan_progress: ScanProgress,
    error_message: Option<String>,
    progress_rx: Option<std::sync::mpsc::Receiver<ScanProgress>>,
    analysis_rx: Option<std::sync::mpsc::Receiver<Result<DirectoryAnalysis, String>>>,

    // Settings
    settings: AppSettings,
    system_info: SystemInfo,
    active_tab: Tab,
    selected_directory: String,
    current_path: String,

    // Charts
    charts_dirty: bool,
    chart_show_by_size: bool,

    // Scan history
    scan_history: Vec<ScanRecord>,
    selected_history_index: Option<usize>,

    // View template
    active_template: ViewTemplate,

    // File management
    confirm: Option<ConfirmAction>,
    file_list_scroll: f32,
    
    // Search and filter
    search_query: String,
    filter_extension: String,
    filter_min_size: u64,
    filter_max_size: u64,
    
    // Sorting
    sort_column: crate::types::SortColumn,
    sort_direction: crate::types::SortDir,
    
    // Pagination
    files_per_page: usize,
    current_page: usize,
    
    // Directory tree
    expanded_dirs: std::collections::HashSet<String>,
    
    // Error display
    show_errors: bool,

    // Persistence
    save_path: Option<String>,

    // Scan timing
    scan_start_time: Option<std::time::Instant>,

    // CUDA Ollama integration
    ollama_client: CudaOllamaClient,
    ml_tools: MlTools,
    ml_response: Option<String>,
    ml_processing: bool,
    ml_result_rx: Option<std::sync::mpsc::Receiver<String>>,
    
    // AI Chat interface
    chat_messages: Vec<(String, String)>, // (user_message, ai_response)
    chat_input: String,
    chat_processing: bool,
    chat_result_rx: Option<std::sync::mpsc::Receiver<String>>,
    
    // Model discovery info
    discovered_models: Vec<ollama_cuda::OllamaModelInfo>,
    last_model_selected: String,
    last_selection_reason: String,
    
    // GPU acceleration info
    gpu_info: GpuInfo,
}

#[derive(Debug, Clone, PartialEq)]
enum Tab {
    Dashboard,
    Files,
    Charts,
    History,
    CudaBenchmark,
    Settings,
    About,
}

fn slugify(s: &str) -> String {
    s.chars().map(|c| if c.is_alphanumeric() || c == '-' || c == '_' || c == '.' { c } else { '_' }).collect()
}

fn format_bytes(bytes: u64) -> String {
    const UNITS: &[&str] = &["B", "KB", "MB", "GB", "TB"];
    let mut size = bytes as f64;
    let mut i = 0;
    while size >= 1024.0 && i < UNITS.len() - 1 { size /= 1024.0; i += 1; }
    if i == 0 { format!("{} {}", bytes, UNITS[i]) } else { format!("{:.2} {}", size, UNITS[i]) }
}

fn results_dir() -> std::path::PathBuf {
    let dir = std::path::PathBuf::from("scan_results");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

fn save_scan_v2(analysis: &DirectoryAnalysis) -> String {
    let ts = chrono::Local::now();
    let path_slug = slugify(&Path::new(&analysis.path).file_name().map(|n| n.to_string_lossy()).unwrap_or(std::borrow::Cow::Borrowed("root")));
    let file_name = format!("scan_{}_{}.json", ts.format("%Y-%m-%d_%H-%M-%S"), path_slug);

    let mut categories: HashMap<String, serde_json::Value> = HashMap::new();
    let mut extension_stats: HashMap<String, serde_json::Value> = HashMap::new();
    for (ext, count) in &analysis.file_types {
        let size: u64 = analysis.largest_files.iter().filter(|f| f.extension == *ext).map(|f| f.size).sum();
        let cat = categorize_ext(ext);
        categories.entry(cat.to_string()).or_insert_with(|| serde_json::json!({"count": 0, "size": 0}));
        if let Some(obj) = categories.get_mut(&cat.to_string()) {
            let c = obj["count"].as_u64().unwrap_or(0) + count;
            let s = obj["size"].as_u64().unwrap_or(0) + size;
            *obj = serde_json::json!({"count": c, "size": s});
        }
        extension_stats.insert(ext.clone(), serde_json::json!({"count": count, "size": size}));
    }

    let files: Vec<serde_json::Value> = analysis.largest_files.iter().map(|f| {
        serde_json::json!({
            "name": f.name, "path": f.path,
            "size": {"bytes": f.size, "formatted": format_bytes(f.size), "on_disk": null},
            "extension": f.extension, "category": categorize_ext(&f.extension),
            "timestamps": {"created": null, "modified": f.modified, "accessed": null},
            "file_hash": null, "is_hard_link": false,
            "attributes": {"is_readonly": false, "is_hidden": false, "is_system": false, "has_ads": false,
                "ads_count": 0, "is_compressed": false, "compressed_size": null, "is_sparse": false,
                "is_reparse_point": false, "reparse_tag": null, "owner": null}
        })
    }).collect();

    let output = serde_json::json!({
        "schema_version": "2.0",
        "generated_at": ts.to_rfc3339(),
        "scanner_version": "space-analyzer-native/1.0.0",
        "scan_config": {"path": analysis.path, "max_files": 0, "include_hidden": false, "follow_symlinks": false, "json_progress": false},
        "summary": {"total_files": analysis.total_files, "total_size": analysis.total_size,
            "scan_duration_ms": analysis.analysis_time_ms, "files_scanned_per_second": 0, "bytes_scanned_per_second": 0},
        "file_analysis": {"files": files, "categories": categories, "extension_stats": extension_stats,
            "duplicate_groups": [], "duplicate_count": 0, "duplicate_size": 0,
            "hard_link_count": 0, "hard_link_savings": 0, "apparent_size": analysis.total_size},
        "performance": {"scan_duration_ms": analysis.analysis_time_ms, "files_per_second": 0, "bytes_per_second": 0,
            "memory_peak_mb": null, "memory_current_mb": null, "disk_reads": null, "disk_bytes_read": null,
            "cache_hits": null, "cache_misses": null, "cpu_usage_percent": null, "thread_count": null,
            "io_wait_time_ms": null, "system_load_average": null},
        "issues": {"errors": analysis.errors, "warnings": []}
    });

    let path = results_dir().join(&file_name);
    if let Ok(json) = serde_json::to_string_pretty(&output) {
        let _ = std::fs::write(&path, &json);
    }

    file_name
}

fn load_scan_history() -> Vec<ScanRecord> {
    let dir = results_dir();
    let mut records = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if entry.path().extension().map(|e| e == "json").unwrap_or(false) {
                if let Ok(content) = std::fs::read_to_string(entry.path()) {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                        let summary = &json["summary"];
                        let scan_config = &json["scan_config"];
                        records.push(ScanRecord {
                            path: scan_config["path"].as_str().unwrap_or("").to_string(),
                            file_name: entry.file_name().to_string_lossy().to_string(),
                            scanned_at: json["generated_at"].as_str().unwrap_or("").to_string(),
                            total_files: summary["total_files"].as_u64().unwrap_or(0),
                            total_size: summary["total_size"].as_u64().unwrap_or(0),
                            total_dirs: 0,
                            duration_ms: summary["scan_duration_ms"].as_u64().unwrap_or(0),
                        });
                    }
                }
            }
        }
    }
    records.sort_by(|a, b| b.scanned_at.cmp(&a.scanned_at));
    records
}

fn load_scan_file(file_name: &str) -> Option<DirectoryAnalysis> {
    let path = results_dir().join(file_name);
    let content = std::fs::read_to_string(path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    let fa = &json["file_analysis"];

    let total_files = json["summary"]["total_files"].as_u64().unwrap_or(0);
    let total_size = json["summary"]["total_size"].as_u64().unwrap_or(0);
    let analysis_time_ms = json["summary"]["scan_duration_ms"].as_u64().unwrap_or(0);
    let scan_path = json["scan_config"]["path"].as_str().unwrap_or("").to_string();

    let mut file_types: HashMap<String, u64> = HashMap::new();
    if let Some(ext_stats) = fa["extension_stats"].as_object() {
        for (ext, stats) in ext_stats {
            file_types.insert(ext.clone(), stats["count"].as_u64().unwrap_or(0));
        }
    }

    let mut size_distribution = HashMap::new();
    let mut largest_files = Vec::new();
    if let Some(files) = fa["files"].as_array() {
        for f in files {
            let size = f["size"]["bytes"].as_u64().unwrap_or(0);
            let bucket = size_bucket_str(size);
            *size_distribution.entry(bucket).or_insert(0u64) += 1;

            if largest_files.len() < 100 {
                largest_files.push(FileInfo {
                    path: f["path"].as_str().unwrap_or("").to_string(),
                    name: f["name"].as_str().unwrap_or("").to_string(),
                    size,
                    modified: f["timestamps"]["modified"].as_str().map(|s| s.to_string()),
                    file_type: "file".to_string(),
                    extension: f["extension"].as_str().unwrap_or("").to_string(),
                });
            }
        }
        largest_files.sort_by(|a, b| b.size.cmp(&a.size));
        largest_files.truncate(100);
    }

    Some(DirectoryAnalysis {
        path: scan_path,
        total_files,
        total_directories: 0,
        total_size,
        analysis_time_ms,
        file_types,
        size_distribution,
        largest_files,
        empty_directories: Vec::new(),
        errors: Vec::new(),
    })
}

fn size_bucket_str(size: u64) -> String {
    if size == 0 { "0 B".into() }
    else if size < 1024 { "< 1 KB".into() }
    else if size < 10 * 1024 { "1-10 KB".into() }
    else if size < 100 * 1024 { "10-100 KB".into() }
    else if size < 1024 * 1024 { "100 KB-1 MB".into() }
    else if size < 10 * 1024 * 1024 { "1-10 MB".into() }
    else if size < 100 * 1024 * 1024 { "10-100 MB".into() }
    else if size < 1024 * 1024 * 1024 { "100 MB-1 GB".into() }
    else { "> 1 GB".into() }
}

pub fn categorize_ext(ext: &str) -> &'static str {
    match ext {
        "md" | "txt" | "doc" | "docx" | "pdf" | "rtf" => "Documents",
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "svg" | "ico" | "webp" => "Images",
        "mp4" | "avi" | "mkv" | "mov" | "wmv" | "flv" => "Video",
        "mp3" | "wav" | "flac" | "ogg" | "aac" | "wma" => "Audio",
        "zip" | "tar" | "gz" | "7z" | "rar" | "bz2" | "xz" => "Archives",
        "rs" | "py" | "js" | "ts" | "java" | "c" | "cpp" | "h" | "go" | "rb" => "Code",
        "html" | "css" | "scss" | "less" | "jsx" | "tsx" | "vue" => "Web",
        "json" | "xml" | "yaml" | "yml" | "toml" | "ini" | "cfg" => "Config",
        "exe" | "dll" | "so" | "dylib" | "bin" => "Binary",
        _ => "Other",
    }
}

impl SpaceAnalyzerApp {
    pub fn new() -> Self {
        let history = load_scan_history();
        let ollama_client = CudaOllamaClient::auto();
        let ml_tools = MlTools::new();
        let gpu_info = GpuInfo::detect();
        
        Self {
            scanner: FileScanner::new(),
            cancel_flag: Arc::new(AtomicBool::new(false)),
            analysis: None,
            is_scanning: false,
            scan_progress: ScanProgress {
                files_scanned: 0,
                directories_scanned: 0,
                total_size: 0,
                percentage: 0.0,
                completed: false,
                current_file: String::new(),
            },
            error_message: None,
            progress_rx: None,
            analysis_rx: None,
            settings: AppSettings::default(),
            system_info: get_system_info(),
            active_tab: Tab::Dashboard,
            selected_directory: String::new(),
            current_path: String::new(),
            charts_dirty: false,
            chart_show_by_size: false,
            scan_history: history,
            selected_history_index: None,
            active_template: ViewTemplate::Summary,
            confirm: None,
            file_list_scroll: 0.0,
            search_query: String::new(),
            filter_extension: String::from("all"),
            filter_min_size: 0,
            filter_max_size: u64::MAX,
            sort_column: crate::types::SortColumn::Size,
            sort_direction: crate::types::SortDir::Descending,
            files_per_page: 50,
            current_page: 0,
            expanded_dirs: std::collections::HashSet::new(),
            show_errors: false,
            save_path: None,
            scan_start_time: None,
            ollama_client,
            ml_tools,
            ml_response: None,
            ml_processing: false,
            ml_result_rx: None,
            chat_messages: Vec::new(),
            chat_input: String::new(),
            chat_processing: false,
            chat_result_rx: None,
            discovered_models: Vec::new(),
            last_model_selected: String::from("auto-select"),
            last_selection_reason: String::new(),
            gpu_info,
        }
    }

    fn start_scan(&mut self, _ctx: egui::Context, path: String) {
        if self.is_scanning { return; }
        self.is_scanning = true;
        self.selected_directory.clone_from(&path);
        self.error_message = None;
        self.cancel_flag.store(false, Ordering::Relaxed);
        self.scan_start_time = Some(std::time::Instant::now());
        self.scan_progress = ScanProgress {
            files_scanned: 0,
            directories_scanned: 0,
            total_size: 0,
            percentage: 0.0,
            completed: false,
            current_file: String::new(),
        };

        let cancel_flag = self.cancel_flag.clone();
        let (progress_tx, progress_rx) = std::sync::mpsc::channel();
        let (analysis_tx, analysis_rx) = std::sync::mpsc::channel();

        self.progress_rx = Some(progress_rx);
        self.analysis_rx = Some(analysis_rx);

        let scan_path = path.clone();
        std::thread::spawn(move || {
            let scanner = FileScanner::new();
            let options = shared_scanner::ScanOptions::default();
            let result = scanner.scan_directory_sync(&scan_path, options);

            if let Ok(scan_result) = result {
                let progress = ScanProgress {
                    files_scanned: scan_result.total_files,
                    directories_scanned: scan_result.total_directories,
                    total_size: scan_result.total_size,
                    percentage: 100.0,
                    completed: true,
                    current_file: "Complete".to_string(),
                };
                let _ = progress_tx.send(progress);

                let analysis = DirectoryAnalysis {
                    path: scan_path.clone(),
                    total_files: scan_result.total_files,
                    total_directories: scan_result.total_directories,
                    total_size: scan_result.total_size,
                    analysis_time_ms: 0, // Set by main thread after receiving
                    file_types: scan_result.file_types,
                    extension_sizes: scan_result.extension_sizes,
                    size_distribution: scan_result.size_distribution,
                    largest_files: scan_result.largest_files,
                    empty_directories: scan_result.empty_directories,
                    errors: scan_result.errors,
                    subdirectories: scan_result.subdirectories,
                };
                let _ = analysis_tx.send(Ok(analysis));
            } else {
                let _ = analysis_tx.send(Err(result.unwrap_err().to_string()));
            }
        });
    }

    fn cancel_scan(&mut self) { self.cancel_flag.store(true, Ordering::Relaxed); }

    fn show_confirmation(&mut self, ctx: &egui::Context) {
        let Some(ref action) = self.confirm else { return };

        let mut open = true;
        let action_type = action.action_type.clone();
        let message = action.message.clone();

        egui::Window::new("Confirm Action")
            .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
            .open(&mut open)
            .show(ctx, |ui| {
                theme::heading(ui, "Destructive Operation");
                ui.separator();
                ui.label(&message);

                let details = match &action_type {
                    ConfirmType::DeleteFile { path } => Some(format!("File: {}", path)),
                    ConfirmType::DeleteMultiple { paths: _, count } => Some(format!("{} files selected", count)),
                    ConfirmType::OrganizeFile { source, destination } => Some(format!("Move:\n  {}\n  ->  {}", source, destination)),
                };
                if let Some(d) = details { ui.label(d); }

                ui.separator();
                ui.horizontal(|ui| {
                    if theme::btn_primary(ui, "Cancel").clicked() {
                        self.confirm = None;
                    }
                    match &action_type {
                        ConfirmType::DeleteFile { .. } | ConfirmType::DeleteMultiple { .. } => {
                            if theme::btn_danger(ui, "Delete").clicked() {
                                self.execute_confirmed_action();
                                self.confirm = None;
                            }
                        }
                        ConfirmType::OrganizeFile { .. } => {
                            if theme::btn_success(ui, "Move File").clicked() {
                                self.execute_confirmed_action();
                                self.confirm = None;
                            }
                        }
                    }
                });
            });
        if !open { self.confirm = None; }
    }

    fn execute_confirmed_action(&mut self) {
        let action = match self.confirm.clone() { Some(a) => a, None => return };

        match action.action_type {
            ConfirmType::DeleteFile { path } => {
                let size_to_subtract = self.analysis.as_ref()
                    .and_then(|a| a.largest_files.iter().find(|f| f.path == path).map(|f| f.size))
                    .unwrap_or(0);

                if std::fs::remove_file(&path).is_ok() {
                    if let Some(ref mut analysis) = self.analysis {
                        analysis.largest_files.retain(|f| f.path != path);
                        analysis.total_files = analysis.total_files.saturating_sub(1);
                        analysis.total_size = analysis.total_size.saturating_sub(size_to_subtract);
                    }
                } else {
                    self.error_message = Some(format!("Failed to delete: {}", path));
                }
            }
            ConfirmType::DeleteMultiple { paths, .. } => {
                let sizes: std::collections::HashMap<String, u64> = self.analysis.as_ref()
                    .map(|a| a.largest_files.iter().map(|f| (f.path.clone(), f.size)).collect())
                    .unwrap_or_default();

                let mut deleted = 0u64;
                let mut size_freed = 0u64;
                for p in &paths {
                    if std::fs::remove_file(p).is_ok() {
                        deleted += 1;
                        size_freed += sizes.get(p).copied().unwrap_or(0);
                    }
                }
                if let Some(ref mut analysis) = self.analysis {
                    analysis.largest_files.retain(|f| !paths.contains(&f.path));
                    analysis.total_files = analysis.total_files.saturating_sub(deleted);
                    analysis.total_size = analysis.total_size.saturating_sub(size_freed);
                }
                self.save_path = Some(format!("Deleted {} files ({} freed)", deleted, format_bytes(size_freed)));
            }
            ConfirmType::OrganizeFile { source, destination } => {
                if let Some(parent) = Path::new(&destination).parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                if std::fs::rename(&source, &destination).is_ok() {
                    if let Some(ref mut analysis) = self.analysis {
                        for f in &mut analysis.largest_files {
                            if f.path == source { f.path.clone_from(&destination); break; }
                        }
                    }
                } else {
                    self.error_message = Some(format!("Failed to move: {}", source));
                }
            }
        }
    }

    fn show_dashboard(&mut self, ui: &mut egui::Ui) {
        theme::heading(ui, "Space Analyzer Pro");
        ui.add_space(4.0);

        ui.horizontal(|ui| {
            if theme::btn_success(ui, "Select Directory").clicked() {
                if let Some(path) = rfd::FileDialog::new().pick_folder() {
                    let p = path.to_string_lossy().to_string();
                    self.selected_directory.clone_from(&p);
                    self.start_scan(ui.ctx().clone(), p);
                }
            }
            if self.is_scanning { let _ = theme::btn_danger(ui, "Cancel").clicked().then(|| self.cancel_scan()); }
            if theme::btn_primary(ui, "Refresh").clicked() { self.system_info = get_system_info(); }
        });

        ui.add_space(8.0);

        if self.is_scanning {
            theme::section(ui, "Scan Progress", |ui| {
                ui.add(egui::ProgressBar::new(self.scan_progress.percentage / 100.0).show_percentage().desired_width(300.0));
                ui.label(format!("{} files, {} dirs - {}",
                    self.scan_progress.files_scanned, self.scan_progress.directories_scanned,
                    format_bytes(self.scan_progress.total_size)));
            });
        }

        if let Some(a) = &self.analysis {
            theme::section(ui, &format!("Last Scan: {}", Path::new(&a.path).file_name().unwrap_or_default().to_string_lossy()), |ui| {
                ui.horizontal(|ui| {
                    theme::metric(ui, "Files", a.total_files);
                    theme::metric(ui, "Dirs", a.total_directories);
                    theme::metric(ui, "Size", format_bytes(a.total_size));
                    theme::metric(ui, "Time", format!("{} ms", a.analysis_time_ms));
                });
                let avg = if a.total_files > 0 { a.total_size / a.total_files } else { 0 };
                ui.label(format!("Avg: {} | Types: {} | Empty dirs: {}",
                    format_bytes(avg), a.file_types.len(), a.empty_directories.len()));
            });
        }

        theme::section(ui, "System", |ui| {
            let mem_used = self.system_info.total_memory - self.system_info.available_memory;
            theme::metric(ui, "OS", &self.system_info.os);
            theme::metric(ui, "CPU", format!("{} cores", self.system_info.cpu_cores));
            theme::metric(ui, "Memory", format!("{} / {}", format_bytes(mem_used), format_bytes(self.system_info.total_memory)));
        });

        // GPU Acceleration Status
        if self.gpu_info.available {
            theme::section(ui, "GPU Acceleration", |ui| {
                ui.horizontal(|ui| {
                    ui.colored_label(palette::SUCCESS, "CUDA Available");
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        ui.label(format!("{} ({:.0} MB)", self.gpu_info.device_name, self.gpu_info.total_memory_mb as f32));
                    });
                });
                ui.label(format!("Compute: {} | CUDA: {}", self.gpu_info.compute_capability, self.gpu_info.cuda_version));
                ui.add_space(4.0);
                ui.horizontal(|ui| {
                    ui.label("Hashing:");
                    ui.colored_label(palette::ACCENT_CYAN, "GPU-accelerated (batch processing)");
                });
                ui.horizontal(|ui| {
                    ui.label("ML Training:");
                    ui.colored_label(palette::ACCENT_CYAN, "GPU-accelerated (matrix ops)");
                });
                ui.horizontal(|ui| {
                    ui.label("Scan Processing:");
                    ui.colored_label(palette::ACCENT_CYAN, "GPU-accelerated (histograms, sorting, categorization)");
                });
            });
        } else {
            theme::section(ui, "GPU Acceleration", |ui| {
                ui.horizontal(|ui| {
                    ui.colored_label(palette::WARNING, "No GPU detected");
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if ui.button("Retry Detection").clicked() {
                            self.gpu_info = GpuInfo::detect();
                        }
                    });
                });
                ui.label("Using CPU-optimized implementations (rayon parallelism)");
                ui.label("Scan post-processing, hashing, and ML all use multi-threaded CPU fallbacks");
            });
        }
    }

    fn show_files_tab(&mut self, ui: &mut egui::Ui) {
        ui.heading("File Browser");
        ui.separator();

        ui.horizontal(|ui| {
            if ui.button("Select Directory").clicked() {
                if let Some(path) = rfd::FileDialog::new().pick_folder() {
                    let p = path.to_string_lossy().to_string();
                    self.selected_directory.clone_from(&p);
                    self.start_scan(ui.ctx().clone(), p);
                }
            }
            egui::ComboBox::from_label("View")
                .selected_text(ViewTemplate::all().iter().find(|(t, _)| *t == self.active_template).map(|(_, n)| *n).unwrap_or(""))
                .show_ui(ui, |ui| {
                    for (t, n) in ViewTemplate::all() {
                        if ui.selectable_label(self.active_template == *t, *n).clicked() { self.active_template = t.clone(); }
                    }
                });
        });

        if self.analysis.is_none() { ui.vertical_centered(|ui| { ui.add_space(60.0); ui.label("Run a scan first"); }); return; }

        ui.separator();

        match self.active_template {
            ViewTemplate::Summary => self.render_summary(ui),
            ViewTemplate::FileTypes => self.render_file_types(ui),
            ViewTemplate::SizeAudit => self.render_size_audit(ui),
            ViewTemplate::Organize => self.render_organize(ui),
            ViewTemplate::Cleanup => self.render_cleanup(ui),
        }

        if let Some(ref save) = self.save_path.clone() {
            ui.add_space(8.0);
            ui.horizontal(|ui| {
                ui.colored_label(palette::SUCCESS, save);
                if ui.button("Dismiss").clicked() { self.save_path = None; }
            });
        }
    }

    fn render_summary(&mut self, ui: &mut egui::Ui) {
        let a = self.analysis.as_ref().unwrap();
        theme::section(ui, "Scan Overview", |ui| {
            egui::Grid::new("summary_grid").num_columns(2).striped(true).show(ui, |ui| {
                theme::metric(ui, "Path", &a.path);
                ui.end_row();
                theme::metric(ui, "Total files", a.total_files);
                ui.end_row();
                theme::metric(ui, "Directories", a.total_directories);
                ui.end_row();
                theme::metric(ui, "Total size", format_bytes(a.total_size));
                ui.end_row();
                theme::metric(ui, "File types", a.file_types.len());
                ui.end_row();
                theme::metric(ui, "Empty dirs", a.empty_directories.len());
                ui.end_row();
                theme::metric(ui, "Scan duration", format!("{} ms", a.analysis_time_ms));
                ui.end_row();
                let avg = if a.total_files > 0 { a.total_size / a.total_files } else { 0 };
                theme::metric(ui, "Avg file size", format_bytes(avg));
                ui.end_row();
                let dpd = if a.total_directories > 0 { a.total_files as f64 / a.total_directories as f64 } else { 0.0 };
                theme::metric(ui, "Files per dir", format!("{:.1}", dpd));
                ui.end_row();
                if !a.errors.is_empty() {
                    ui.colored_label(palette::WARNING, format!("Errors: {}", a.errors.len()));
                    if ui.small_button(if self.show_errors { "Hide" } else { "Show" }).clicked() {
                        self.show_errors = !self.show_errors;
                    }
                    ui.end_row();
                }
            });
        });

        // Error details
        if self.show_errors && !a.errors.is_empty() {
            ui.add_space(8.0);
            theme::section(ui, &format!("Error Details ({} errors)", a.errors.len()), |ui| {
                egui::ScrollArea::vertical().max_height(200.0).show(ui, |ui| {
                    for (i, err) in a.errors.iter().enumerate() {
                        ui.horizontal(|ui| {
                            ui.colored_label(palette::WARNING, format!("[{}]", i + 1));
                            ui.label(err);
                        });
                    }
                });
            });
        }

        // Directory tree view
        if !a.subdirectories.is_empty() {
            ui.add_space(8.0);
            theme::section(ui, "Space by Directory", |ui| {
                ui.label("Top-level directories sorted by size:");
                ui.add_space(4.0);
                
                let max_dir_size = a.subdirectories.first().map(|d| d.total_size).unwrap_or(1);
                for dir in &a.subdirectories {
                    let frac = dir.total_size as f64 / max_dir_size as f64;
                    let is_expanded = self.expanded_dirs.contains(&dir.path);
                    
                    ui.horizontal(|ui| {
                        let expand_btn = ui.small_button(if is_expanded { "▼" } else { "▶" });
                        if expand_btn.clicked() {
                            if is_expanded {
                                self.expanded_dirs.remove(&dir.path);
                            } else {
                                self.expanded_dirs.insert(dir.path.clone());
                            }
                        }
                        
                        ui.label(format!("{}", dir.name));
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            ui.label(format!("{} files, {}", dir.file_count, format_bytes(dir.total_size)));
                        });
                    });
                    
                    // Progress bar
                    ui.add(egui::ProgressBar::new(frac as f32)
                        .fill(if frac > 0.5 { palette::ERROR } else { palette::ACCENT_BLUE })
                        .desired_width(ui.available_width()));
                    
                    // Expanded details
                    if is_expanded {
                        ui.indent(&dir.path, |ui| {
                            ui.label(format!("Files: {} | Subdirs: {}", dir.file_count, dir.dir_count));
                            if dir.largest_file_size > 0 {
                                ui.label(format!("Largest file: {}", format_bytes(dir.largest_file_size)));
                            }
                            let pct = dir.total_size as f64 / a.total_size.max(1) as f64 * 100.0;
                            ui.label(format!("Share of total: {:.1}%", pct));
                        });
                    }
                    
                    ui.add_space(2.0);
                }
            });
        }

        ui.add_space(8.0);
        theme::section(ui, "Size Distribution", |ui| {
            let total = a.total_files.max(1);
            for (bucket, count) in &a.size_distribution {
                let pct = *count as f64 / total as f64 * 100.0;
                ui.horizontal(|ui| {
                    ui.label(format!("{}: ", bucket));
                    ui.add(egui::ProgressBar::new(*count as f32 / total as f32)
                        .fill(palette::ACCENT_BLUE).desired_width(200.0));
                    ui.label(format!("{} ({:.1}%)", count, pct));
                });
            }
        });
    }

    fn render_file_types(&self, ui: &mut egui::Ui) {
        let a = self.analysis.as_ref().unwrap();
        theme::heading(ui, "File Types by Category");

        let mut by_category: HashMap<&str, Vec<(&String, &u64, &u64)>> = HashMap::new();
        for (ext, count) in &a.file_types {
            let cat = categorize_ext(ext);
            let size = a.extension_sizes.get(ext).copied().unwrap_or(0);
            by_category.entry(cat).or_default().push((ext, count, &size));
        }

        let total = a.total_files.max(1);
        let all_cats: Vec<&str> = by_category.keys().filter(|c| **c != "Other").copied().collect();
        for cat in all_cats {
            if let Some(exts) = by_category.get(cat) {
                let cat_count: u64 = exts.iter().map(|(_, c, _)| **c).sum();
                let cat_size: u64 = exts.iter().map(|(_, _, s)| **s).sum();
                theme::section(ui, &format!("{}  ({} files, {})", cat, cat_count, format_bytes(cat_size)), |ui| {
                    for (ext, count, size) in exts {
                        let pct = **count as f64 / total as f64 * 100.0;
                        let size_pct = *size as f64 / a.total_size.max(1) as f64 * 100.0;
                        ui.horizontal(|ui| {
                            ui.label(format!(".{}", ext));
                            ui.add(egui::ProgressBar::new(**count as f32 / total as f32).desired_width(100.0));
                            ui.label(format!("{} files ({:.1}%)", count, pct));
                            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                                ui.label(format!("{} ({:.1}%)", format_bytes(**size), size_pct));
                            });
                        });
                    }
                });
                ui.add_space(4.0);
            }
        }
        if let Some(exts) = by_category.get("Other") {
            let cat_count: u64 = exts.iter().map(|(_, c, _)| **c).sum();
            let cat_size: u64 = exts.iter().map(|(_, _, s)| **s).sum();
            theme::section(ui, &format!("Other  ({} files, {})", cat_count, format_bytes(cat_size)), |ui| {
                for (ext, count, size) in exts {
                    let pct = **count as f64 / total as f64 * 100.0;
                    let size_pct = *size as f64 / a.total_size.max(1) as f64 * 100.0;
                    ui.horizontal(|ui| {
                        ui.label(format!(".{}", ext));
                        ui.add(egui::ProgressBar::new(**count as f32 / total as f32).desired_width(100.0));
                        ui.label(format!("{} files ({:.1}%)", count, pct));
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            ui.label(format!("{} ({:.1}%)", format_bytes(**size), size_pct));
                        });
                    });
                }
            });
        }
    }

    fn render_size_audit(&mut self, ui: &mut egui::Ui) {
        let a = self.analysis.as_ref().unwrap();
        theme::heading(ui, "Largest Files");

        if a.largest_files.is_empty() { ui.label("No files found."); return; }

        // Search and filter bar
        ui.horizontal(|ui| {
            ui.label("Search:");
            ui.add(egui::TextEdit::singleline(&mut self.search_query)
                .hint_text("Filter by name or extension...")
                .desired_width(200.0));
            
            ui.label("Extension:");
            egui::ComboBox::from_id_salt("ext_filter")
                .selected_text(&self.filter_extension)
                .show_ui(ui, |ui| {
                    ui.selectable_value(&mut self.filter_extension, "all".to_string(), "All");
                    let mut exts: Vec<_> = a.file_types.keys().collect();
                    exts.sort();
                    for ext in exts.take(20) {
                        ui.selectable_value(&mut self.filter_extension, ext.clone(), format!(".{}", ext));
                    }
                });
            
            ui.label("Per page:");
            egui::ComboBox::from_id_salt("page_size")
                .selected_text(self.files_per_page.to_string())
                .show_ui(ui, |ui| {
                    for size in &[25, 50, 100, 250] {
                        if ui.selectable_label(self.files_per_page == *size, size.to_string()).clicked() {
                            self.files_per_page = *size;
                            self.current_page = 0;
                        }
                    }
                });
            
            if ui.button("Reset Filters").clicked() {
                self.search_query.clear();
                self.filter_extension = "all".to_string();
                self.current_page = 0;
            }
        });
        
        ui.add_space(4.0);

        // Filter and sort files
        let mut filtered: Vec<&FileInfo> = a.largest_files.iter()
            .filter(|f| {
                if !self.search_query.is_empty() {
                    let q = self.search_query.to_lowercase();
                    if !f.name.to_lowercase().contains(&q) && !f.extension.to_lowercase().contains(&q) {
                        return false;
                    }
                }
                if self.filter_extension != "all" && f.extension != self.filter_extension {
                    return false;
                }
                true
            })
            .collect();

        // Sort
        filtered.sort_by(|a, b| {
            let ord = match self.sort_column {
                crate::types::SortColumn::Name => a.name.cmp(&b.name),
                crate::types::SortColumn::Size => a.size.cmp(&b.size),
                crate::types::SortColumn::Extension => a.extension.cmp(&b.extension),
                crate::types::SortColumn::Modified => a.modified.cmp(&b.modified),
            };
            match self.sort_direction {
                crate::types::SortDir::Ascending => ord,
                crate::types::SortDir::Descending => ord.reverse(),
            }
        });

        let total_filtered = filtered.len();
        let total_pages = (total_filtered + self.files_per_page - 1) / self.files_per_page;
        let start = self.current_page * self.files_per_page;
        let end = (start + self.files_per_page).min(total_filtered);
        let page_items = &filtered[start..end.min(filtered.len())];

        theme::section(ui, &format!("Showing {}-{} of {} files", start + 1, end.min(total_filtered), total_filtered), |ui| {
            egui::ScrollArea::vertical().max_height(500.0).show(ui, |ui| {
                egui::Grid::new("size_audit_grid").num_columns(6).striped(true).show(ui, |ui| {
                    // Sortable column headers
                    let sort_indicator = |col: crate::types::SortColumn| -> &'static str {
                        if self.sort_column == col {
                            if self.sort_direction == crate::types::SortDir::Ascending { " ▲" } else { " ▼" }
                        } else { "" }
                    };
                    
                    if ui.button(format!("#{}", sort_indicator(crate::types::SortColumn::Name))).clicked() {
                        if self.sort_column == crate::types::SortColumn::Name {
                            self.sort_direction = match self.sort_direction {
                                crate::types::SortDir::Ascending => crate::types::SortDir::Descending,
                                crate::types::SortDir::Descending => crate::types::SortDir::Ascending,
                            };
                        } else {
                            self.sort_column = crate::types::SortColumn::Name;
                            self.sort_direction = crate::types::SortDir::Ascending;
                        }
                    }
                    if ui.button(format!("File Name{}", sort_indicator(crate::types::SortColumn::Name))).clicked() {
                        if self.sort_column == crate::types::SortColumn::Name {
                            self.sort_direction = match self.sort_direction {
                                crate::types::SortDir::Ascending => crate::types::SortDir::Descending,
                                crate::types::SortDir::Descending => crate::types::SortDir::Ascending,
                            };
                        } else {
                            self.sort_column = crate::types::SortColumn::Name;
                            self.sort_direction = crate::types::SortDir::Ascending;
                        }
                    }
                    if ui.button(format!("Ext{}", sort_indicator(crate::types::SortColumn::Extension))).clicked() {
                        if self.sort_column == crate::types::SortColumn::Extension {
                            self.sort_direction = match self.sort_direction {
                                crate::types::SortDir::Ascending => crate::types::SortDir::Descending,
                                crate::types::SortDir::Descending => crate::types::SortDir::Ascending,
                            };
                        } else {
                            self.sort_column = crate::types::SortColumn::Extension;
                            self.sort_direction = crate::types::SortDir::Ascending;
                        }
                    }
                    if ui.button(format!("Size{}", sort_indicator(crate::types::SortColumn::Size))).clicked() {
                        if self.sort_column == crate::types::SortColumn::Size {
                            self.sort_direction = match self.sort_direction {
                                crate::types::SortDir::Ascending => crate::types::SortDir::Descending,
                                crate::types::SortDir::Descending => crate::types::SortDir::Ascending,
                            };
                        } else {
                            self.sort_column = crate::types::SortColumn::Size;
                            self.sort_direction = crate::types::SortDir::Descending;
                        }
                    }
                    ui.label("Bar");
                    ui.label("Actions");
                    ui.end_row();
                    
                    let max_sz = filtered.first().map(|f| f.size).unwrap_or(1);
                    for (i, f) in page_items.iter().enumerate() {
                        let rc = if i % 2 == 0 { palette::BG_ELEVATED } else { palette::BG_SURFACE };
                        ui.colored_label(rc, (start + i + 1).to_string());
                        
                        // File name with tooltip showing full path
                        ui.horizontal(|ui| {
                            let name_label = ui.colored_label(rc, &f.name);
                            name_label.on_hover_text(&f.path);
                        });
                        
                        ui.colored_label(rc, format!(".{}", f.extension));
                        ui.colored_label(rc, format_bytes(f.size));
                        
                        let frac = f.size as f64 / max_sz as f64;
                        let bar_color = if frac > 0.5 { palette::ERROR } else { palette::ACCENT_BLUE };
                        ui.add(egui::ProgressBar::new(frac as f32).fill(bar_color).desired_width(80.0));
                        
                        // Actions: Open folder
                        ui.horizontal(|ui| {
                            if ui.small_button("📁").clicked() {
                                if let Some(parent) = std::path::Path::new(&f.path).parent() {
                                    let _ = open::that(parent);
                                }
                            }
                        });
                        
                        ui.end_row();
                    }
                });
            });
        });

        // Pagination controls
        if total_pages > 1 {
            ui.add_space(8.0);
            ui.horizontal(|ui| {
                if ui.button("◀ Prev").clicked() && self.current_page > 0 {
                    self.current_page -= 1;
                }
                ui.label(format!("Page {} of {}", self.current_page + 1, total_pages));
                if ui.button("Next ▶").clicked() && self.current_page < total_pages - 1 {
                    self.current_page += 1;
                }
            });
        }
    }

    fn render_organize(&mut self, ui: &mut egui::Ui) {
        let a = self.analysis.as_ref().unwrap();
        theme::heading(ui, "Organization Planner");
        theme::sub_heading(ui, "Move files into categorized folders by type.");
        ui.add_space(8.0);

        if a.largest_files.is_empty() { ui.label("No files to organize."); return; }

        let categories = ["Documents", "Images", "Video", "Audio", "Archives", "Code", "Web", "Config", "Other"];
        let mut cat_files: HashMap<&str, Vec<&FileInfo>> = HashMap::new();
        for f in &a.largest_files {
            let cat = categorize_ext(&f.extension);
            cat_files.entry(cat).or_default().push(f);
        }

        egui::ScrollArea::vertical().max_height(500.0).show(ui, |ui| {
            for cat in &categories {
                let files = match cat_files.get(cat) { Some(f) => f, None => continue };
                ui.colored_label(palette::ACCENT_PURPLE, format!("{} ({} files)", cat, files.len()));
                for f in files.iter().take(20) {
                    ui.horizontal(|ui| {
                        ui.label(format!("  {}", f.name));
                        if ui.button("Move").clicked() {
                            if let Some(dest) = rfd::FileDialog::new().set_title(&format!("Move to folder for {}", cat)).pick_folder() {
                                let dest_path = dest.join(&f.name);
                                self.confirm = Some(ConfirmAction {
                                    message: format!("Move '{}' to '{}'?", f.name, dest.to_string_lossy()),
                                    action_type: ConfirmType::OrganizeFile { source: f.path.clone(), destination: dest_path.to_string_lossy().to_string() },
                                });
                            }
                        }
                        if ui.button("🗑").clicked() {
                            self.confirm = Some(ConfirmAction {
                                message: format!("Permanently delete '{}' ({}). This cannot be undone.", f.name, format_bytes(f.size)),
                                action_type: ConfirmType::DeleteFile { path: f.path.clone() },
                            });
                        }
                    });
                }
                if files.len() > 20 { ui.label(format!("  ... and {} more", files.len() - 20)); }
            }
        });
    }

    fn render_cleanup(&mut self, ui: &mut egui::Ui) {
        let a = self.analysis.as_ref().unwrap();
        theme::heading(ui, "Cleanup Review");

        let large_threshold = 100 * 1024 * 1024;
        let candidates: Vec<&FileInfo> = a.largest_files.iter().filter(|f| f.size >= large_threshold).collect();

        if candidates.is_empty() {
            ui.label("No large files found (threshold: 100 MB).");
        } else {
            let total_waste: u64 = candidates.iter().map(|f| f.size).sum();
            theme::section(ui, &format!("Large Files ({} found, {} recyclable)", candidates.len(), format_bytes(total_waste)), |ui| {
                egui::ScrollArea::vertical().max_height(400.0).show(ui, |ui| {
                    for (i, f) in candidates.iter().enumerate() {
                        let rc = if i % 2 == 0 { palette::BG_ELEVATED } else { palette::BG_SURFACE };
                        ui.horizontal(|ui| {
                            ui.colored_label(rc, &f.name);
                            ui.colored_label(palette::WARNING, format_bytes(f.size));
                            ui.label(f.modified.as_deref().unwrap_or(""));
                            if theme::btn_danger(ui, "Delete").clicked() {
                                self.confirm = Some(ConfirmAction {
                                    message: format!("Permanently delete '{}' ({}). Confirm?", f.name, format_bytes(f.size)),
                                    action_type: ConfirmType::DeleteFile { path: f.path.clone() },
                                });
                            }
                        });
                    }
                });
            });

            ui.add_space(8.0);
            theme::section(ui, "Bulk Actions", |ui| {
                ui.horizontal(|ui| {
                    if theme::btn_danger(ui, "Delete All Listed").clicked() {
                        let paths: Vec<String> = candidates.iter().map(|f| f.path.clone()).collect();
                        let count = paths.len();
                        self.confirm = Some(ConfirmAction {
                            message: format!("Delete ALL {} large files ({}). This cannot be undone.", count, format_bytes(total_waste)),
                            action_type: ConfirmType::DeleteMultiple { paths, count },
                        });
                    }
                    if theme::btn_primary(ui, "Move to Archive Folder").clicked() {
                        if let Some(dest) = rfd::FileDialog::new().set_title("Select archive folder").pick_folder() {
                            let mut moved = 0u64;
                            let mut saved = 0u64;
                            for f in &candidates {
                                let target = dest.join(&f.name);
                                if std::fs::rename(&f.path, &target).is_ok() { moved += 1; saved += f.size; }
                            }
                            if moved > 0 {
                                self.save_path = Some(format!("Moved {} files ({}) to archive", moved, format_bytes(saved)));
                                if let Some(ref mut analysis) = self.analysis {
                                    analysis.largest_files.retain(|f| !candidates.iter().any(|c| c.path == f.path));
                                    analysis.total_files = analysis.total_files.saturating_sub(moved);
                                    analysis.total_size = analysis.total_size.saturating_sub(saved);
                                }
                            }
                        }
                    }
                });
            });
        }
    }

    fn show_history(&mut self, ui: &mut egui::Ui) {
        theme::heading(ui, "Scan History");
        theme::sub_heading(ui, "Past scans stored in scan_results/ for AI orchestration system access.");
        ui.add_space(8.0);

        if let Err(e) = std::fs::create_dir_all("scan_results") {
            ui.colored_label(egui::Color32::RED, format!("Cannot access scan_results/: {}", e));
            return;
        }

        ui.horizontal(|ui| {
            if theme::btn_primary(ui, "Refresh List").clicked() { self.scan_history = load_scan_history(); }
            if let Some(idx) = self.selected_history_index {
                if idx < self.scan_history.len() {
                    if theme::btn_success(ui, "Load Selected").clicked() {
                        if let Some(a) = load_scan_file(&self.scan_history[idx].file_name) {
                            self.analysis = Some(a);
                            self.active_tab = Tab::Files;
                            self.active_template = ViewTemplate::Summary;
                        }
                    }
                    if theme::btn_danger(ui, "Delete Selected Record").clicked() {
                        let path = results_dir().join(&self.scan_history[idx].file_name);
                        let _ = std::fs::remove_file(&path);
                        self.scan_history.remove(idx);
                        self.selected_history_index = None;
                    }
                }
            }
        });

        if self.scan_history.is_empty() {
            ui.colored_label(palette::TEXT_MUTED, "No scan history found. Run a scan to populate.");
            return;
        }

        theme::section(ui, &format!("{} past scans", self.scan_history.len()), |ui| {
            egui::ScrollArea::vertical().max_height(400.0).show(ui, |ui| {
                for (i, record) in self.scan_history.iter().enumerate() {
                    let selected = self.selected_history_index == Some(i);
                    let rc = if selected { palette::BG_ACTIVE }
                        else if i % 2 == 0 { palette::BG_ELEVATED }
                        else { palette::BG_SURFACE };

                    let resp = egui::Frame::NONE.fill(rc).show(ui, |ui| {
                        ui.horizontal(|ui| {
                            ui.selectable_label(selected, &record.file_name);
                            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                                ui.label(format_bytes(record.total_size));
                                ui.label(record.total_files.to_string());
                                ui.label(&record.scanned_at[..19].replace("T", " "));
                            });
                        });
                    });

                    if resp.response.clicked() {
                        self.selected_history_index = if selected { None } else { Some(i) };
                    }
                }
            });
        });

        if let Some(latest) = self.scan_history.first() {
            ui.add_space(8.0);
            theme::section(ui, "AI Orchestration Feed", |ui| {
                theme::metric(ui, "Latest file", format!("scan_results/{}", latest.file_name));
                theme::metric(ui, "Orchestrator", "orchestrator/src/orchestrator.py");
                theme::metric(ui, "Unified AI", "ai-service/app/main.py (port 5000)");
                theme::metric(ui, "Endpoints", "/predict/*, /categorizer/*, /ollama/*");
            });
        }
    }

    fn show_settings(&mut self, ui: &mut egui::Ui) {
        theme::heading(ui, "Settings");

        theme::section(ui, "Preferences", |ui| {
            ui.horizontal(|ui| {
                ui.label("Theme:");
                egui::ComboBox::from_label("")
                    .selected_text(format!("{:?}", self.settings.theme))
                    .show_ui(ui, |ui| {
                        ui.selectable_value(&mut self.settings.theme, AppTheme::Light, "Light");
                        ui.selectable_value(&mut self.settings.theme, AppTheme::Dark, "Dark");
                        ui.selectable_value(&mut self.settings.theme, AppTheme::System, "System");
                    });
            });
            ui.checkbox(&mut self.settings.show_hidden_files, "Scan hidden files and directories");
            ui.checkbox(&mut self.settings.auto_save, "Auto-save results to scan_results/ (for AI system)");
            ui.horizontal(|ui| {
                ui.label("Max file preview size:");
                ui.add(egui::Slider::new(&mut self.settings.max_file_preview_size, 1024..=10*1024*1024).suffix(" bytes"));
            });
        });

        ui.add_space(8.0);
        theme::section(ui, "Storage", |ui| {
            theme::metric(ui, "History", format!("{} scans in scan_results/", self.scan_history.len()));
            if theme::btn_primary(ui, "Open scan_results Folder").clicked() { let _ = open::that("scan_results"); }
        });
    }

    fn show_cuda_benchmark(&mut self, ui: &mut egui::Ui) {
        theme::heading(ui, "AI Chat & Model Selection");
        theme::sub_heading(ui, "Dynamic model selection from your local Ollama models");

        // ── Discovered Models ──
        if self.discovered_models.is_empty() {
            self.discovered_models = self.ml_tools.list_models();
        }

        if !self.discovered_models.is_empty() {
            theme::section(ui, &format!("🧠 {} Models Available", self.discovered_models.len()), |ui| {
                egui::ScrollArea::vertical().max_height(120.0).show(ui, |ui| {
                    for m in &self.discovered_models {
                        let size_mb = m.size_bytes as f64 / 1_048_576.0;
                        let caps = ollama_cuda::detect_capabilities(&m.name, m.size_bytes);
                        let tags: Vec<&str> = [
                            if caps.is_coding_model { Some("code") } else { None },
                            if caps.is_vision_model { Some("vision") } else { None },
                            if caps.is_reasoning_model { Some("reason") } else { None },
                            if caps.is_small_fast { Some("fast") } else { None },
                        ].into_iter().flatten().collect();
                        let tag_str = if tags.is_empty() { "general" } else { &tags.join(", ") };
                        
                        ui.horizontal(|ui| {
                            ui.label(format!("{} ({:.0} MB)", m.name, size_mb));
                            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                                ui.colored_label(palette::TEXT_MUTED, format!("[{}]", tag_str));
                            });
                        });
                    }
                });
                
                ui.add_space(4.0);
                if theme::btn_primary(ui, "Refresh Models").clicked() {
                    if let Ok(models) = self.ml_tools.client().refresh_models() {
                        self.discovered_models = models;
                    }
                }
            });
        } else {
            theme::section(ui, "⚠️ No Models Found", |ui| {
                ui.label("Cannot connect to Ollama. Make sure Ollama is running at localhost:11434");
                ui.add_space(4.0);
                if theme::btn_primary(ui, "Retry").clicked() {
                    self.discovered_models = self.ml_tools.list_models();
                }
            });
        }

        ui.add_space(8.0);

        // ── Last Selection Info ──
        if !self.last_model_selected.is_empty() && self.last_model_selected != "auto-select" {
            theme::section(ui, "🎯 Last Model Selected", |ui| {
                ui.horizontal(|ui| {
                    ui.colored_label(palette::ACCENT_CYAN, "Model:");
                    ui.label(&self.last_model_selected);
                });
                if !self.last_selection_reason.is_empty() {
                    ui.horizontal(|ui| {
                        ui.colored_label(palette::TEXT_MUTED, "Reason:");
                        ui.label(&self.last_selection_reason);
                    });
                }
            });
            ui.add_space(8.0);
        }

        // ── AI Chat ──
        theme::section(ui, "AI Chat", |ui| {
            ui.label("Chat uses auto-selected model based on task type and complexity");
            ui.add_space(8.0);
            
            // Chat history
            egui::ScrollArea::vertical().max_height(300.0).show(ui, |ui| {
                for (user_msg, ai_response) in &self.chat_messages {
                    ui.horizontal(|ui| {
                        ui.colored_label(palette::ACCENT_BLUE, "You:");
                        ui.label(user_msg);
                    });
                    ui.horizontal(|ui| {
                        ui.colored_label(palette::SUCCESS, "AI:");
                        ui.label(ai_response);
                    });
                    ui.add_space(4.0);
                }
                
                if self.chat_processing {
                    ui.spinner();
                    ui.label("AI is thinking...");
                }
            });

            ui.add_space(8.0);
            
            // Chat input
            ui.horizontal(|ui| {
                ui.add(egui::TextEdit::singleline(&mut self.chat_input)
                    .hint_text("Ask the AI agent anything...")
                    .desired_width(f32::INFINITY));
                
                if theme::btn_primary(ui, "Send").clicked() {
                    if !self.chat_input.trim().is_empty() {
                        self.send_chat_message();
                    }
                }
                
                if ui.button("Clear").clicked() {
                    self.chat_messages.clear();
                }
            });
        });

        ui.add_space(16.0);
        theme::section(ui, "Quick Benchmark", |ui| {
            ui.label("Run a quick benchmark to compare CUDA vs non-CUDA performance");
            ui.add_space(8.0);
            
            if theme::btn_primary(ui, "Run CUDA Benchmark").clicked() {
                self.run_cuda_benchmark("cuda");
            }
            if ui.button("Run Non-CUDA Benchmark").clicked() {
                self.run_cuda_benchmark("non-cuda");
            }
        });

        ui.add_space(16.0);
        theme::section(ui, "Configuration", |ui| {
            ui.horizontal(|ui| {
                ui.label("Environment:");
                ui.label(if self.is_cuda_available() { "CUDA Available" } else { "Non-CUDA" });
            });
            ui.horizontal(|ui| {
                ui.label("GPU Layers:");
                ui.label("-1 (all layers on GPU)");
            });
            ui.horizontal(|ui| {
                ui.label("Context Size:");
                ui.label("4096 (auto-scales to 8192 for complex tasks)");
            });
            ui.horizontal(|ui| {
                ui.label("Model Selection:");
                ui.label("Automatic (based on task type, complexity, performance)");
            });
        });

        ui.add_space(16.0);
        theme::section(ui, "ML Tools", |ui| {
            ui.label("Preconfigured AI tools — model selected automatically per task");
            ui.add_space(8.0);
            
            if self.ml_processing {
                ui.spinner();
                ui.label(format!("Processing with {}...", self.last_model_selected));
            } else {
                ui.horizontal(|ui| {
                    if theme::btn_primary(ui, "Analyze File Organization").clicked() {
                        self.run_ml_tool("analyze_organization");
                    }
                    if ui.button("Generate Cleanup Recommendations").clicked() {
                        self.run_ml_tool("cleanup_recommendations");
                    }
                });
                ui.add_space(4.0);
                ui.horizontal(|ui| {
                    if theme::btn_primary(ui, "Categorize Files").clicked() {
                        self.run_ml_tool("categorize_files");
                    }
                    if ui.button("Generate Summary").clicked() {
                        self.run_ml_tool("generate_summary");
                    }
                });
            }

            if let Some(ref response) = self.ml_response.clone() {
                ui.add_space(8.0);
                theme::section(ui, "AI Response", |ui| {
                    egui::ScrollArea::vertical().max_height(200.0).show(ui, |ui| {
                        ui.label(response);
                    });
                    if ui.button("Clear").clicked() {
                        self.ml_response = None;
                    }
                });
            }
        });

        ui.add_space(16.0);
        theme::section(ui, "Recent Results", |ui| {
            self.show_benchmark_results(ui);
        });

        ui.add_space(16.0);
        theme::section(ui, "How Model Selection Works", |ui| {
            ui.label("• Simple questions → smallest/fastest model");
            ui.label("• Code tasks → coding-optimized models");
            ui.label("• Analysis → reasoning/large models");
            ui.label("• Complex prompts (200+ words) → larger context models");
            ui.label("• Recently-used models get a warmth bonus (still in VRAM)");
            ui.label("• Performance data learned over time (tokens/sec tracked)");
        });
    }

    fn is_cuda_available(&self) -> bool {
        std::env::var("CUDA_VISIBLE_DEVICES").is_ok() 
            || std::env::var("CUDA_HOME").is_ok()
            || std::env::var("NVIDIA_VISIBLE_DEVICES").is_ok()
    }

    fn run_cuda_benchmark(&mut self, environment: &str) {
        let env = environment.to_string();
        std::thread::spawn(move || {
            let _ = std::process::Command::new("python")
                .arg("scripts/ollama_cuda_benchmark.py")
                .arg("--quick")
                .arg("--environment")
                .arg(&env)
                .current_dir(std::env::current_dir().unwrap())
                .spawn();
        });
    }

    fn run_ml_tool(&mut self, tool: &str) {
        self.ml_processing = true;
        self.ml_response = None;
        
        let tool = tool.to_string();
        let analysis = self.analysis.clone();
        
        let (tx, rx) = std::sync::mpsc::channel();
        self.ml_result_rx = Some(rx);
        
        std::thread::spawn(move || {
            let ml_tools = MlTools::new();
            let result = match tool.as_str() {
                "analyze_organization" => {
                    if let Some(ref a) = analysis {
                        let files: Vec<String> = a.largest_files.iter().take(20).map(|f| f.name.clone()).collect();
                        ml_tools.analyze_file_organization(&files)
                    } else {
                        Err("No analysis available. Run a scan first.".to_string())
                    }
                }
                "cleanup_recommendations" => {
                    if let Some(ref a) = analysis {
                        let files: Vec<String> = a.largest_files.iter().take(20).map(|f| f.name.clone()).collect();
                        ml_tools.generate_cleanup_recommendations(&files)
                    } else {
                        Err("No analysis available. Run a scan first.".to_string())
                    }
                }
                "categorize_files" => {
                    if let Some(ref a) = analysis {
                        let files: Vec<String> = a.largest_files.iter().take(20).map(|f| f.name.clone()).collect();
                        ml_tools.categorize_files(&files)
                    } else {
                        Err("No analysis available. Run a scan first.".to_string())
                    }
                }
                "generate_summary" => {
                    if let Some(ref a) = analysis {
                        let analysis_json = serde_json::to_string_pretty(&a).unwrap_or_default();
                        ml_tools.generate_summary(&analysis_json)
                    } else {
                        Err("No analysis available. Run a scan first.".to_string())
                    }
                }
                _ => Err("Unknown tool".to_string()),
            };
            
            let response = match result {
                Ok(r) => r,
                Err(e) => format!("Error: {}", e),
            };
            
            let _ = tx.send(response);
        });
    }

    fn send_chat_message(&mut self) {
        let message = self.chat_input.clone();
        self.chat_input.clear();
        
        if message.trim().is_empty() {
            return;
        }
        
        // Add user message to chat history immediately
        self.chat_messages.push((message.clone(), "Thinking...".to_string()));
        self.chat_processing = true;
        
        let (tx, rx) = std::sync::mpsc::channel();
        self.chat_result_rx = Some(rx);
        
        let client = self.ml_tools.client().clone();
        
        std::thread::spawn(move || {
            let result = client.generate(&message);
            
            let (response, model, reason) = match result {
                Ok(r) => (r.response.clone(), r.model.clone(), r.selection_reason.unwrap_or_default()),
                Err(e) => (format!("Error: {}", e), "error".to_string(), String::new()),
            };
            
            let _ = tx.send((response, model, reason));
        });
    }

    fn show_benchmark_results(&mut self, ui: &mut egui::Ui) {
        let results_dir = std::path::PathBuf::from("benchmark_results");
        if !results_dir.exists() {
            ui.colored_label(palette::TEXT_MUTED, "No benchmark results found. Run a benchmark to populate.");
            return;
        }

        let mut results: Vec<std::path::PathBuf> = std::fs::read_dir(&results_dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| p.extension().map(|e| e == "md").unwrap_or(false))
            .collect();
        
        results.sort();
        results.reverse();

        if results.is_empty() {
            ui.colored_label(palette::TEXT_MUTED, "No benchmark reports found.");
            return;
        }

        egui::ScrollArea::vertical().max_height(300.0).show(ui, |ui| {
            for result in results.iter().take(10) {
                let file_name = result.file_name().unwrap_or(&std::ffi::OsStr::new("")).to_string_lossy().to_string();
                let resp = egui::Frame::NONE.fill(palette::BG_ELEVATED).show(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.label(&file_name);
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            if ui.button("View").clicked() {
                                let _ = open::that(result);
                            }
                        });
                    });
                });
                let _ = resp;
            }
        });
    }

    fn show_about(&mut self, ui: &mut egui::Ui) {
        theme::heading(ui, "Space Analyzer Pro");
        theme::sub_heading(ui, "Version 1.0.0 — Native Edition");

        theme::section(ui, "Features", |ui| {
            ui.label("- Directory scanning with live progress & cancellation");
            ui.label("- Size distribution analysis (9 buckets)");
            ui.label("- File type categorization (10 categories)");
            ui.label("- Scan history with AI-compatible JSON output");
            ui.label("- 5 view templates: Summary, Types, Size Audit, Organize, Cleanup");
            ui.label("- File management: delete (with confirmation), organize/move");
            ui.label("- CUDA benchmark for Ollama optimization");
            ui.label("- Charts & visualizations (plotters)");
            ui.label("- System info: OS, CPU, memory, drives");
            ui.label("- Auto-save to scan_results/ for AI orchestration pipeline");
        });

        theme::section(ui, "Tech Stack", |ui| {
            ui.label("Built with Rust, egui 0.34, walkdir, plotters, sysinfo");
        });
    }

    fn show_charts(&mut self, ui: &mut egui::Ui) {
        theme::heading(ui, "Interactive Charts");
        theme::sub_heading(ui, "Hover for details, click bars to filter");
        ui.add_space(8.0);

        let has_data = self.analysis.is_some() || !self.system_info.drives.is_empty();
        if !has_data { ui.label("Run a scan to see charts."); return; }

        // Toggle for file types chart
        ui.horizontal(|ui| {
            ui.label("File Types:");
            ui.selectable_value(&mut self.chart_show_by_size, false, "By Count");
            ui.selectable_value(&mut self.chart_show_by_size, true, "By Size");
        });
        ui.add_space(4.0);

        egui::ScrollArea::vertical().show(ui, |ui| {
            // File Types Chart
            if let Some(a) = &self.analysis {
                let chart_result = crate::charts::file_types_chart(
                    ui, &a.file_types, &a.extension_sizes, a.total_files, self.chart_show_by_size,
                );
                if let Some(ext) = chart_result.clicked_bar {
                    self.active_tab = Tab::Files;
                    self.filter_extension = ext;
                    self.search_query.clear();
                    self.current_page = 0;
                }
                ui.add_space(16.0);

                // Largest Files Chart
                let chart_result = crate::charts::largest_files_chart(ui, &a.largest_files);
                if let Some(path) = chart_result.clicked_bar {
                    // Open containing folder when clicking a file bar
                    if let Some(parent) = std::path::Path::new(&path).parent() {
                        let _ = open::that(parent);
                    }
                }
                ui.add_space(16.0);
            }

            // Drive Usage Chart
            let chart_result = crate::charts::drives_chart(ui, &self.system_info.drives);
            if let Some(mount) = chart_result.clicked_bar {
                let _ = open::that(&mount);
            }
        });
    }
}

impl eframe::App for SpaceAnalyzerApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        // Drain progress
        if let Some(ref rx) = self.progress_rx {
            while let Ok(p) = rx.try_recv() { self.scan_progress = p; ctx.request_repaint(); }
        }

        // Check completion
        if let Some(ref rx) = self.analysis_rx {
            if let Ok(result) = rx.try_recv() {
                match result {
                    Ok(mut a) => {
                        a.analysis_time_ms = self.scan_start_time.map(|t| t.elapsed().as_millis() as u64).unwrap_or(0);
                        if self.settings.auto_save {
                            let file = save_scan_v2(&a);
                            self.save_path = Some(format!("Saved: scan_results/{}", file));
                            self.scan_history = load_scan_history();
                        }
                        self.analysis = Some(a);
                        self.is_scanning = false;
                        self.current_page = 0; // Reset pagination
                        self.search_query.clear(); // Reset filters
                    }
                    Err(e) => {
                        self.error_message = Some(e);
                        self.is_scanning = false;
                    }
                }
                ctx.request_repaint();
            }
        }

        // Check ML tool results
        if let Some(ref rx) = self.ml_result_rx {
            if let Ok(result) = rx.try_recv() {
                self.ml_response = Some(result);
                self.ml_processing = false;
                ctx.request_repaint();
            }
        }

        // Check chat results
        if let Some(ref rx) = self.chat_result_rx {
            if let Ok((result, model, reason)) = rx.try_recv() {
                // Update the last message's AI response
                if let Some((_, ai_response)) = self.chat_messages.last_mut() {
                    *ai_response = result;
                }
                
                self.last_model_selected = model;
                self.last_selection_reason = reason;
                self.chat_processing = false;
                ctx.request_repaint();
            }
        }

        // Confirmation dialog overlay
        self.show_confirmation(ctx);

        // Menu
        egui::TopBottomPanel::top("menu").show(ctx, |ui| {
            egui::menu::bar(ui, |ui| {
                ui.menu_button("File", |ui| {
                    if ui.button("Select Directory").clicked() {
                        if let Some(path) = rfd::FileDialog::new().pick_folder() {
                            let p = path.to_string_lossy().to_string();
                            self.selected_directory.clone_from(&p);
                            self.start_scan(ctx.clone(), p);
                        }
                        ui.close_menu();
                    }
                    if ui.button("Exit").clicked() { std::process::exit(0); }
                });
                ui.menu_button("View", |ui| {
                    if ui.button("Dashboard").clicked() { self.active_tab = Tab::Dashboard; ui.close_menu(); }
                    if ui.button("File Browser").clicked() { self.active_tab = Tab::Files; ui.close_menu(); }
                    if ui.button("Charts").clicked() { self.active_tab = Tab::Charts; ui.close_menu(); }
                    if ui.button("History").clicked() { self.active_tab = Tab::History; ui.close_menu(); }
                    if ui.button("CUDA Benchmark").clicked() { self.active_tab = Tab::CudaBenchmark; ui.close_menu(); }
                    if ui.button("Settings").clicked() { self.active_tab = Tab::Settings; ui.close_menu(); }
                    if ui.button("About").clicked() { self.active_tab = Tab::About; ui.close_menu(); }
                });
                ui.menu_button("Tools", |ui| {
                    if ui.button("Refresh System Info").clicked() { self.system_info = get_system_info(); ui.close_menu(); }
                    if ui.button("Clear Scan Data").clicked() { self.analysis = None; ui.close_menu(); }
                });
            });
        });

        // Main content
        egui::CentralPanel::default().show(ctx, |ui| {
            ui.horizontal(|ui| {
                ui.selectable_value(&mut self.active_tab, Tab::Dashboard, "Dashboard");
                ui.selectable_value(&mut self.active_tab, Tab::Files, "Files");
                ui.selectable_value(&mut self.active_tab, Tab::Charts, "Charts");
                ui.selectable_value(&mut self.active_tab, Tab::History, "History");
                ui.selectable_value(&mut self.active_tab, Tab::CudaBenchmark, "CUDA Benchmark");
                ui.selectable_value(&mut self.active_tab, Tab::Settings, "Settings");
                ui.selectable_value(&mut self.active_tab, Tab::About, "About");
            });
            ui.separator();
            match self.active_tab {
                Tab::Dashboard => self.show_dashboard(ui),
                Tab::Files => self.show_files_tab(ui),
                Tab::Charts => self.show_charts(ui),
                Tab::History => self.show_history(ui),
                Tab::CudaBenchmark => self.show_cuda_benchmark(ui),
                Tab::Settings => self.show_settings(ui),
                Tab::About => self.show_about(ui),
            }
            if let Some(e) = &self.error_message {
                ui.separator();
                ui.colored_label(egui::Color32::RED, format!("Error: {}", e));
            }
        });

        // Status bar
        egui::TopBottomPanel::bottom("status").show(ctx, |ui| {
            ui.horizontal(|ui| {
                if self.is_scanning {
                    ui.spinner();
                    ui.label(format!("Scanning: {} files, {} dirs", self.scan_progress.files_scanned, self.scan_progress.directories_scanned));
                } else if let Some(a) = &self.analysis {
                    ui.label(format!("{} files, {}", a.total_files, format_bytes(a.total_size)));
                } else {
                    ui.label("Ready");
                }
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    let mu = self.system_info.total_memory - self.system_info.available_memory;
                    ui.label(format!("Mem: {} / {}", format_bytes(mu), format_bytes(self.system_info.total_memory)));
                });
            });
        });
    }
}
