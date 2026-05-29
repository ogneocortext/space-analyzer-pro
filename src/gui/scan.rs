use super::*;

impl SpaceAnalyzerApp {
    pub fn start_scan(&mut self) {
        if self.is_scanning {
            return;
        }
        self.is_scanning = true;
        self.scan_progress = 0.0;
        self.scan_result = None;
        self.status_message = None;
        self.scan_performance.start();

        let path = self.current_path.clone();
        let deep = self.settings.default_deep_scan;
        let max_depth = self.settings.max_scan_depth;
        let gpu_acceleration = self.settings.gpu_acceleration;
        let cuda_enabled = self.settings.cuda_enabled;
        let cancel_flag = Arc::new(AtomicBool::new(false));
        self.cancel_flag = Some(cancel_flag.clone());
        let (tx, rx) = mpsc::channel();
        self.scan_receiver = Some(rx);

        std::thread::spawn(move || {
            let _ = tx.send(ScanMessage::Progress { percentage: 0.0, files: 0, bytes: 0 });

            let start = std::time::Instant::now();
            let scanner = FileScanner::new();
            let options = if deep {
                ScanOptions::deep()
            } else {
                ScanOptions {
                    max_depth: Some(max_depth as usize),
                    ..Default::default()
                }
            };
            let options = ScanOptions {
                gpu_acceleration,
                cuda_enabled,
                ..options
            };

            let cancel_clone = cancel_flag.clone();
            let tx_clone = tx.clone();

            let scan_result = scanner.scan_with_progress_sync(
                path.to_str().unwrap_or("."),
                options,
                move |progress: ScanProgress| {
                    let _ = tx_clone.send(ScanMessage::Progress {
                        percentage: progress.percentage,
                        files: progress.files_scanned,
                        bytes: progress.total_size,
                    });
                },
                &cancel_clone,
            );

            match scan_result {
                Ok(shared_result) => {
                    let duration = start.elapsed().as_secs_f64();
                    let result = ScanResult::from_shared(&shared_result, path.to_string_lossy().to_string(), duration);

                    let _ = tx.send(ScanMessage::Progress { percentage: 100.0, files: 0, bytes: 0 });
                    let _ = tx.send(ScanMessage::Complete(result));
                }
                Err(e) => {
                    let _ = tx.send(ScanMessage::Error(format!("Scan failed: {}", e)));
                }
            }
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
                    ScanMessage::Progress { percentage, files, bytes } => {
                        self.scan_progress = percentage;
                        self.scan_performance.update(files, bytes);
                    }
                    ScanMessage::Complete(result) => {
                        // Save to database
                        if let Some(ref db) = self.db {
                            if let Err(e) = db.save_scan(&result, self.settings.default_deep_scan) {
                                self.status_message = Some(format!("Failed to save scan: {}", sanitize_error_message(&e.to_string())));
                            }
                            self.scan_history = db.get_scan_history(50).unwrap_or_default();
                        }
                        
                        self.scan_result = Some(result.clone());
                        self.is_scanning = false;
                        self.scan_receiver = None;
                        self.cancel_flag = None;
                        self.tool_registry = Some(ToolRegistry::new(Some(result.clone())));
                        self.generate_ai_recommendations();

                        let elapsed = self.scan_performance.elapsed_secs();
                        let files_per_sec = if elapsed > 0.0 {
                            result.total_files as f64 / elapsed
                        } else { 0.0 };
                        self.push_notification(
                            format!("Scan complete: {} files in {:.1}s ({:.0} files/sec)",
                                result.total_files, elapsed, files_per_sec),
                            super::NotificationLevel::Success,
                        );
                        self.scan_performance.reset();

                        // Mark active workflow as completed and persist
                        let completed_execution = self.active_workflow.as_mut().map(|exec| {
                            exec.complete();
                            exec.clone()
                        });
                        if let Some(exec) = completed_execution {
                            self.save_workflow_execution_to_db(&exec);
                        }
                        // Start embedding index if enabled
                        if self.settings.embedding_enabled && self.ollama_client.is_some() {
                            self.start_embedding_index();
                        }
                    }
                    ScanMessage::Error(error) => {
                        self.status_message = Some(error.clone());
                        self.is_scanning = false;
                        self.cancel_flag = None;
                        self.scan_performance.reset();
                        self.push_notification(
                            format!("Scan failed: {}", error),
                            super::NotificationLevel::Error,
                        );
                    }
                }
            }
            if self.is_scanning {
                self.scan_receiver = Some(receiver);
            } else {
                self.execute_pending_workflow_actions();
            }
        }
    }

    fn show_visual_analysis(&self, ui: &mut egui::Ui, result: &ScanResult) {
        ui.label("File distribution:");
        if result.total_files == 0 {
            ui.label("No files found.");
            return;
        }
        if result.file_types.is_empty() {
            ui.label("No file type data available.");
            return;
        }
        let total_files = result.total_files as f64;
        let mut sorted_types: Vec<_> = result.file_types.iter().collect();
        sorted_types.sort_by(|a, b| b.1.cmp(a.1));
        for (ext, count) in sorted_types.iter().take(10) {
            let count_val = **count;
            let percentage = (count_val as f64 / total_files) * 100.0;
            let bar_length = (percentage / 100.0 * 30.0).max(1.0) as usize;
            let bar = "\u{2588}".repeat(bar_length);
            ui.monospace(format!("{:<8} {:5.1}% |{}| ({})", 
                format!(".{}", ext), percentage, bar, count_val));
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
        egui::Grid::new("largest_files_grid").num_columns(4).show(ui, |ui| {
            ui.strong("Size");
            ui.strong("Path");
            ui.strong("Actions");
            ui.end_row();
            for (path, size) in &result.largest_files {
                ui.label(formatting::format_bytes(*size));
                ui.label(path);
                ui.horizontal(|ui| {
                    let file_path = std::path::Path::new(path);
                    if file_path.exists() {
                        if ui.small_button("Open").clicked() {
                            let _ = open::that(path);
                        }
                        if ui.small_button("Location").clicked() {
                            if let Some(parent) = file_path.parent() {
                                let _ = open::that(parent);
                            }
                        }
                    }
                });
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
            ui.checkbox(&mut self.settings.default_deep_scan, "Deep Scan");
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
            // Performance metrics
            ui.horizontal(|ui| {
                ui.small(format!("⏱ {:.1}s", self.scan_performance.elapsed_secs()));
                if self.scan_performance.files_per_sec > 0.0 {
                    ui.separator();
                    ui.small(format!("📁 {:.0} files/sec", self.scan_performance.files_per_sec));
                }
                if self.scan_performance.mb_per_sec > 0.0 {
                    ui.separator();
                    ui.small(format!("💾 {:.1} MB/s", self.scan_performance.mb_per_sec));
                }
                if self.scan_performance.current_files > 0 {
                    ui.separator();
                    ui.small(format!("📄 {} files", self.scan_performance.current_files));
                }
            });
        }
    }

    pub(crate) fn render_scan(&mut self, ui: &mut egui::Ui) {
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
                ui.separator();
                ui.label(format!("Size: {}", formatting::format_bytes(result.total_size_bytes)));
                ui.separator();
                ui.label(format!("Time: {:.1}s", result.duration_secs));
                if result.duration_secs > 0.0 {
                    ui.separator();
                    ui.label(format!("Speed: {:.0} files/sec",
                        result.total_files as f64 / result.duration_secs));
                }
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
}
