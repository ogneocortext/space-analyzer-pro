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
            let _ = tx.send(ScanMessage::Progress {
                percentage: 0.0,
                files: 0,
                bytes: 0,
                current_file: String::new(),
            });

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
                        current_file: progress.current_file,
                    });
                },
                &cancel_clone,
            );

            match scan_result {
                Ok(shared_result) => {
                    let duration = start.elapsed().as_secs_f64();
                    let result = ScanResult::from_shared(
                        &shared_result,
                        path.to_string_lossy().to_string(),
                        duration,
                    );

                    let _ = tx.send(ScanMessage::Progress {
                        percentage: 100.0,
                        files: 0,
                        bytes: 0,
                        current_file: String::new(),
                    });
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

    /// Process scan messages with proper error handling and resource cleanup
    pub fn process_scan_messages_safe(&mut self) {
        let receiver = self.scan_receiver.take();
        if let Some(receiver) = receiver {
            loop {
                match receiver.try_recv() {
                    Ok(message) => match message {
                        ScanMessage::Progress {
                            percentage,
                            files,
                            bytes,
                            current_file: _,
                        } => {
                            self.scan_progress = percentage;
                            self.scan_performance.update(files, bytes);
                        }
                        ScanMessage::Complete(result) => {
                            // Save to database
                            if let Some(ref db) = self.db {
                                if let Err(e) =
                                    db.save_scan(&result, self.settings.default_deep_scan)
                                {
                                    self.status_message = Some(format!(
                                        "Failed to save scan: {}",
                                        sanitize_error_message(&e.to_string())
                                    ));
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
                            } else {
                                0.0
                            };
                            self.push_notification(
                                format!(
                                    "Scan complete: {} files in {:.1}s ({:.0} files/sec)",
                                    result.total_files, elapsed, files_per_sec
                                ),
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
                    },
                    Err(mpsc::TryRecvError::Empty) => break,
                    Err(mpsc::TryRecvError::Disconnected) => break,
                }
            }

            if self.is_scanning {
                self.scan_receiver = Some(receiver);
            } else {
                self.execute_pending_workflow_actions();
            }
        }
    }

    pub(crate) fn render_scan(&mut self, ui: &mut egui::Ui) {
        // ΓöÇΓöÇ Path Selector Card ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        section_heading(ui, Some('📂'), "Scan Directory");
        card_frame(ui.style()).show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.label(egui::RichText::new("Directory:").color(colors::TEXT_SECONDARY));
                ui.add(
                    egui::TextEdit::singleline(&mut self.settings.default_scan_path)
                        .desired_width(ui.available_width() - 120.0)
                        .hint_text("Select a directory to scan..."),
                );
                if ui.button("Browse...").clicked() {
                    if let Some(path) = rfd::FileDialog::new().pick_folder() {
                        self.current_path = path.clone();
                        self.settings.default_scan_path =
                            self.current_path.to_string_lossy().to_string();
                        self.save_settings();
                    }
                }
            });
        });

        // ΓöÇΓöÇ Scan Controls Card ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        section_heading(ui, None, "Controls");
        card_frame(ui.style()).show(ui, |ui| {
            ui.horizontal(|ui| {
                ui.checkbox(&mut self.settings.default_deep_scan, "Deep Scan");

                let scan_text = if self.is_scanning {
                    "⏳ Scanning..."
                } else {
                    "▶ Start Scan"
                };
                let scan_btn =
                    egui::Button::new(egui::RichText::new(scan_text).size(13.0).strong())
                        .min_size(egui::vec2(130.0, 32.0))
                        .fill(if self.is_scanning {
                            colors::TEXT_MUTED
                        } else {
                            colors::ACCENT
                        });

                if ui.add_enabled(!self.is_scanning, scan_btn).clicked() {
                    self.start_scan();
                }

                let stop_btn = egui::Button::new(egui::RichText::new("⏹ Stop").size(13.0))
                    .min_size(egui::vec2(80.0, 32.0))
                    .fill(colors::ERROR);

                if ui.add_enabled(self.is_scanning, stop_btn).clicked() {
                    self.stop_scan();
                }

                let export_btn = egui::Button::new(egui::RichText::new("Export").size(13.0))
                    .min_size(egui::vec2(90.0, 32.0));

                if ui
                    .add_enabled(self.scan_result.is_some(), export_btn)
                    .clicked()
                {
                    self.export_results();
                }
            });
        });

        // ΓöÇΓöÇ Progress Card ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        if self.is_scanning {
            section_heading(ui, Some('⏳'), "Scanning...");
            card_frame(ui.style()).show(ui, |ui| {
                ui.add(
                    egui::ProgressBar::new(self.scan_progress / 100.0)
                        .text(format!("{:.0}%", self.scan_progress))
                        .fill(colors::ACCENT),
                );
                ui.add_space(4.0);
                ui.horizontal(|ui| {
                    ui.label(
                        egui::RichText::new(format!(
                            "⏱ {:.1}s",
                            self.scan_performance.elapsed_secs()
                        ))
                        .size(11.0)
                        .color(colors::TEXT_SECONDARY),
                    );
                    if self.scan_performance.files_per_sec > 0.0 {
                        ui.separator();
                        ui.label(
                            egui::RichText::new(format!(
                                "📂 {:.0} files/sec",
                                self.scan_performance.files_per_sec
                            ))
                            .size(11.0)
                            .color(colors::TEXT_SECONDARY),
                        );
                    }
                    if self.scan_performance.mb_per_sec > 0.0 {
                        ui.separator();
                        ui.label(
                            egui::RichText::new(format!(
                                "⚡ {:.1} MB/s",
                                self.scan_performance.mb_per_sec
                            ))
                            .size(11.0)
                            .color(colors::TEXT_SECONDARY),
                        );
                    }
                    if self.scan_performance.current_files > 0 {
                        ui.separator();
                        ui.label(
                            egui::RichText::new(format!(
                                "📄 {} files",
                                self.scan_performance.current_files
                            ))
                            .size(11.0)
                            .color(colors::TEXT_SECONDARY),
                        );
                    }
                });
            });
        }

        // ΓöÇΓöÇ Scan Results ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ
        if let Some(ref result) = self.scan_result {
            section_heading(ui, Some('📊'), "Scan Results");

            // Stats row
            ui.horizontal(|ui| {
                stat_card(
                    ui,
                    "Files",
                    &format!("{}", result.total_files),
                    colors::ACCENT,
                );
                stat_card(
                    ui,
                    "Size",
                    &formatting::format_bytes(result.total_size_bytes),
                    colors::SUCCESS,
                );
                stat_card(
                    ui,
                    "Duration",
                    &format!("{:.1}s", result.duration_secs),
                    colors::INFO,
                );
                if result.duration_secs > 0.0 {
                    stat_card(
                        ui,
                        "Speed",
                        &format!("{:.0}/s", result.total_files as f64 / result.duration_secs),
                        colors::ACCENT,
                    );
                }
                if !result.errors.is_empty() {
                    stat_card(
                        ui,
                        "Errors",
                        &result.errors.len().to_string(),
                        colors::ERROR,
                    );
                }
            });

            if !result.errors.is_empty() {
                section_heading(ui, Some('⚠'), "Scan Errors");
                card_frame(ui.style()).show(ui, |ui| {
                    egui::ScrollArea::vertical()
                        .max_height(140.0)
                        .show(ui, |ui| {
                            self.show_scan_errors(ui, result);
                        });
                });
            }

            // Visual Analysis
            section_heading(ui, Some('📊'), "File Distribution");
            card_frame(ui.style()).show(ui, |ui| {
                self.show_visual_analysis(ui, result);
            });

            // File Types
            section_heading(ui, Some('📄'), "File Types");
            card_frame(ui.style()).show(ui, |ui| {
                egui::ScrollArea::vertical()
                    .max_height(200.0)
                    .show(ui, |ui| {
                        self.show_file_types(ui, result);
                    });
            });

            // Largest Files
            section_heading(ui, Some('📦'), "Largest Files");
            card_frame(ui.style()).show(ui, |ui| {
                egui::ScrollArea::vertical()
                    .max_height(250.0)
                    .show(ui, |ui| {
                        self.show_largest_files(ui, result);
                    });
            });
        }
    }

    fn show_visual_analysis(&self, ui: &mut egui::Ui, result: &ScanResult) {
        if result.total_files == 0 {
            ui.label(
                egui::RichText::new("No files found")
                    .italics()
                    .color(colors::TEXT_MUTED),
            );
            return;
        }
        if result.file_types.is_empty() {
            ui.label(
                egui::RichText::new("No file type data available")
                    .italics()
                    .color(colors::TEXT_MUTED),
            );
            return;
        }
        let total_files = result.total_files as f64;
        let mut sorted_types: Vec<_> = result.file_types.iter().collect();
        sorted_types.sort_by(|a, b| b.1.cmp(a.1));
        for (ext, count) in sorted_types.iter().take(10) {
            let count_val = **count;
            let percentage = (count_val as f64 / total_files) * 100.0;
            let bar_pct = (percentage / 100.0) as f32;

            ui.vertical(|ui| {
                ui.horizontal(|ui| {
                    ui.label(
                        egui::RichText::new(format!(".{}", ext))
                            .monospace()
                            .color(colors::ACCENT),
                    );
                    ui.label(
                        egui::RichText::new(format!("{:.1}% ({} files)", percentage, count_val))
                            .size(11.0)
                            .color(colors::TEXT_SECONDARY),
                    );
                });
                gauge_bar(ui, bar_pct, ui.available_width(), 4.0);
            });
            ui.add_space(2.0);
        }
    }

    fn show_scan_errors(&self, ui: &mut egui::Ui, result: &ScanResult) {
        for error in result.errors.iter().take(50) {
            ui.label(egui::RichText::new(error).size(11.0).color(colors::ERROR));
        }
        if result.errors.len() > 50 {
            ui.label(
                egui::RichText::new(format!("... and {} more", result.errors.len() - 50))
                    .size(11.0)
                    .color(colors::TEXT_MUTED),
            );
        }
    }

    fn show_file_types(&self, ui: &mut egui::Ui, result: &ScanResult) {
        if result.file_types.is_empty() {
            ui.label(
                egui::RichText::new("No file types found")
                    .italics()
                    .color(colors::TEXT_MUTED),
            );
            return;
        }
        let mut sorted_types: Vec<_> = result.file_types.iter().collect();
        sorted_types.sort_by(|a, b| b.1.cmp(a.1));
        egui::Grid::new("file_types_grid")
            .num_columns(2)
            .spacing([20.0, 4.0])
            .show(ui, |ui| {
                ui.label(
                    egui::RichText::new("Extension")
                        .strong()
                        .color(colors::TEXT_SECONDARY),
                );
                ui.label(
                    egui::RichText::new("Count")
                        .strong()
                        .color(colors::TEXT_SECONDARY),
                );
                ui.end_row();
                for (ext, count) in sorted_types.iter().take(50) {
                    ui.label(
                        egui::RichText::new(format!(".{}", ext))
                            .monospace()
                            .color(colors::ACCENT),
                    );
                    ui.label(format!("{} files", count));
                    ui.end_row();
                }
            });
    }

    fn show_largest_files(&self, ui: &mut egui::Ui, result: &ScanResult) {
        if result.largest_files.is_empty() {
            ui.label(
                egui::RichText::new("No files found")
                    .italics()
                    .color(colors::TEXT_MUTED),
            );
            return;
        }
        egui::Grid::new("largest_files_grid")
            .num_columns(4)
            .spacing([20.0, 4.0])
            .show(ui, |ui| {
                ui.label(
                    egui::RichText::new("Size")
                        .strong()
                        .color(colors::TEXT_SECONDARY),
                );
                ui.label(
                    egui::RichText::new("Path")
                        .strong()
                        .color(colors::TEXT_SECONDARY),
                );
                ui.label(
                    egui::RichText::new("Actions")
                        .strong()
                        .color(colors::TEXT_SECONDARY),
                );
                ui.end_row();
                for (path, size) in &result.largest_files {
                    ui.label(
                        egui::RichText::new(formatting::format_bytes(*size)).color(colors::WARNING),
                    );
                    ui.label(path);
                    ui.horizontal(|ui| {
                        let file_path = std::path::Path::new(path);
                        if file_path.exists() {
                            if ui.small_button("Open").clicked() {
                                let _ = open::that(path);
                            }
                            if ui.small_button("Folder").clicked() {
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
}
