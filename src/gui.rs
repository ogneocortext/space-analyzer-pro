//! Space Analyzer Pro - GUI Application
//! 
//! This is the main and only GUI implementation for Space Analyzer Pro.
//! It provides a clean, functional interface for disk space analysis.

mod gui_common;

use eframe::egui::{self, Widget};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::mpsc;
use gui_common::{ScanResult, formatting};

/// Scan message type for GUI communication
#[derive(Debug, Clone)]
pub enum ScanMessage {
    Progress(f32),
    Complete(ScanResult),
    Error(String),
}

/// Main GUI application structure
pub struct SpaceAnalyzerApp {
    current_path: PathBuf,
    scan_result: Option<ScanResult>,
    is_scanning: bool,
    scan_progress: f32,
    scan_receiver: Option<mpsc::Receiver<ScanMessage>>,
    cancel_flag: Option<Arc<AtomicBool>>,
    deep_scan: bool,
    status_message: Option<String>,
}

impl Default for SpaceAnalyzerApp {
    fn default() -> Self {
        Self {
            current_path: std::env::current_dir().unwrap_or_default(),
            scan_result: None,
            is_scanning: false,
            scan_progress: 0.0,
            scan_receiver: None,
            cancel_flag: None,
            deep_scan: false,
            status_message: None,
        }
    }
}

impl SpaceAnalyzerApp {
    /// Start a directory scan with real progress and cancellation
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

            // Estimate total entries for progress calculation
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

            // Perform actual scan with progress updates
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

    /// Stop the current scan
    pub fn stop_scan(&mut self) {
        if let Some(ref flag) = self.cancel_flag {
            flag.store(true, Ordering::Relaxed);
        }
        self.is_scanning = false;
        self.scan_receiver = None;
        self.cancel_flag = None;
        self.status_message = Some("Scan cancelled".to_string());
    }

    /// Process scan messages from the receiver
    pub fn process_scan_messages(&mut self) {
        let receiver = self.scan_receiver.take();
        if let Some(receiver) = receiver {
            while let Ok(message) = receiver.try_recv() {
                match message {
                    ScanMessage::Progress(progress) => {
                        self.scan_progress = progress;
                    }
                    ScanMessage::Complete(result) => {
                        self.scan_result = Some(result);
                        self.is_scanning = false;
                        self.scan_progress = 1.0;
                        self.cancel_flag = None;
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

    /// Export scan results to JSON
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

    /// Show visual analysis with file type distribution
    pub fn show_visual_analysis(&self, ui: &mut egui::Ui, result: &ScanResult) {
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
                let bar = "█".repeat(bar_length);
                ui.monospace(format!("{:<8} {:5.1}% |{}| ({})", 
                    format!(".{}", ext), 
                    percentage, 
                    bar, 
                    count_val
                ));
            }
        } else {
            ui.label("No file types found.");
        }
    }

    /// Show file types in a grid
    pub fn show_file_types(&self, ui: &mut egui::Ui, result: &ScanResult) {
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

    /// Show largest files in a grid
    pub fn show_largest_files(&self, ui: &mut egui::Ui, result: &ScanResult) {
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

    /// Show basic scan results summary
    pub fn show_basic_results(&self, ui: &mut egui::Ui, result: &ScanResult) {
        ui.horizontal(|ui| {
            ui.label(format!("Files: {}", result.total_files));
            ui.label(format!("Size: {}", formatting::format_bytes(result.total_size_bytes)));
            ui.label(format!("Time: {:.1}s", result.duration_secs));
        });
    }

    /// Show path selection controls
    pub fn show_path_controls(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            ui.label("Directory:");
            if ui.button("Browse...").clicked() {
                if let Some(path) = rfd::FileDialog::new()
                    .pick_folder()
                {
                    self.current_path = path;
                }
            }
            ui.label(self.current_path.display().to_string());
        });
    }

    /// Show scan control buttons
    pub fn show_scan_controls(&mut self, ui: &mut egui::Ui) {
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

    /// Show scan summary with file count and statistics
    pub fn show_scan_summary(&self, ui: &mut egui::Ui, result: &ScanResult) {
        ui.horizontal(|ui| {
            ui.label(format!("Total Files: {}", result.total_files));
            ui.label(format!("Total Size: {}", formatting::format_bytes(result.total_size_bytes)));
            ui.label(format!("Scan Duration: {:.1}s", result.duration_secs));
        });
        
        ui.separator();
        ui.label("Scan Statistics:");
        ui.horizontal(|ui| {
            ui.label("Files/Second:");
            ui.label(if result.duration_secs > 0.0 {
                format!("{:.1}", result.total_files as f64 / result.duration_secs)
            } else {
                "N/A".to_string()
            });
        });
        
        ui.horizontal(|ui| {
            ui.label("Average File Size:");
            ui.label(if result.total_files > 0 {
                formatting::format_bytes(result.total_size_bytes / result.total_files as u64)
            } else {
                "0 B".to_string()
            });
        });
    }

    /// Show progress bar when scanning
    pub fn show_progress(&self, ui: &mut egui::Ui) {
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
}

impl eframe::App for SpaceAnalyzerApp {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        self.process_scan_messages();

        ui.heading("Space Analyzer Pro");
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

            self.show_basic_results(ui, result);
            ui.separator();

            self.show_scan_summary(ui, result);
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
}

fn main() -> Result<(), eframe::Error> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default().with_inner_size([1000.0, 800.0]),
        ..Default::default()
    };

    eframe::run_native(
        "Space Analyzer Pro",
        options,
        Box::new(|_cc| Ok(Box::new(SpaceAnalyzerApp::default()))),
    )
}
