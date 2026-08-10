use super::*;

impl SpaceAnalyzerApp {
    pub fn start_scan(&mut self) {
        if self.is_scanning {
            return;
        }
        let path = PathBuf::from(&self.settings.default_scan_path);
        if path.as_os_str().is_empty() {
            self.status_message = Some("Select a folder to enable scanning.".to_string());
            return;
        }
        if !path.exists() {
            self.status_message = Some(format!("Path does not exist: {}", path.display()));
            return;
        }
        self.is_scanning = true;
        self.scan_progress = 0.0;
        self.scan_result = None;
        self.status_message = None;
        self.scan_performance.start();
        self.current_path = path.clone();

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
                    let _ = tx.send(ScanMessage::Complete(Box::new(result)));
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
                            current_file,
                        } => {
                            self.scan_progress = percentage;
                            self.scan_performance.update(files, bytes, current_file);
                        }
                        ScanMessage::Complete(result) => {
                            if let Some(ref db) = self.db {
                                if let Err(e) = db.save_scan(
                                    &result,
                                    self.settings.default_deep_scan,
                                    false,
                                    self.settings.max_scan_depth,
                                ) {
                                    self.status_message = Some(format!(
                                        "Failed to save scan: {}",
                                        sanitize_error_message(&e.to_string())
                                    ));
                                }
                                self.scan_history = db.get_scan_history(50).unwrap_or_default();
                            }

                            self.scan_result = Some(*result.clone());
                            self.is_scanning = false;
                            self.cancel_flag = None;
                            self.tool_registry = Some(ToolRegistry::new(Some(*result.clone())));
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

                            let completed_execution = self.active_workflow.as_mut().map(|exec| {
                                exec.complete();
                                exec.clone()
                            });
                            if let Some(exec) = completed_execution {
                                self.save_workflow_execution_to_db(&exec);
                            }
                            if self.settings.embedding_enabled && self.ollama_client.is_some() {
                                self.start_embedding_index();
                            }
                            self.scan_receiver = None;
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
                            self.scan_receiver = None;
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
        ui.vertical(|ui| {
            ui.horizontal(|ui| {
                ui.vertical(|ui| {
                    ui.label(
                        egui::RichText::new("Scan a location")
                            .text_style(egui::TextStyle::Name("PageTitle".into()))
                            .color(colors::TEXT_PRIMARY),
                    );
                    ui.add_space(4.0);
                    ui.label(
                        egui::RichText::new(
                            "Choose a folder or drive to identify what is using your storage.",
                        )
                        .color(colors::TEXT_SECONDARY)
                        .small(),
                    );
                });
            });
            ui.add_space(12.0);

            // Scan target
            section_header(ui, Some(icons::FOLDER), "Scan target");
            app_card(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.label(egui::RichText::new("Directory:").color(colors::TEXT_SECONDARY));
                    ui.add(
                        egui::TextEdit::singleline(&mut self.settings.default_scan_path)
                            .desired_width(ui.available_width() - 140.0)
                            .hint_text("Select a directory to scan..."),
                    );
                    if secondary_button(ui, "Browse...").clicked() {
                        if let Some(path) = rfd::FileDialog::new().pick_folder() {
                            self.current_path = path.clone();
                            self.settings.default_scan_path =
                                self.current_path.to_string_lossy().to_string();
                            self.save_settings();
                        }
                    }
                });
            });
            ui.add_space(10.0);

            // Scan options
            section_header(ui, Some(icons::SLIDERS), "Scan options");
            app_card(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.checkbox(&mut self.settings.default_deep_scan, "Deep scan");
                    ui.label(
                        egui::RichText::new(
                            "Includes nested folders and richer metadata. It may take longer.",
                        )
                        .size(12.0)
                        .color(colors::TEXT_SECONDARY),
                    );
                });
            });
            ui.add_space(12.0);

            // Actions
            ui.horizontal(|ui| {
                let scan_text = if self.is_scanning {
                    "Scanning..."
                } else if self.settings.default_scan_path.trim().is_empty() {
                    "Select a folder to enable scanning"
                } else {
                    "Start scan"
                };

                let can_scan =
                    !self.is_scanning && !self.settings.default_scan_path.trim().is_empty();
                let scan_btn =
                    egui::Button::new(egui::RichText::new(scan_text).size(14.0).strong())
                        .fill(if can_scan {
                            colors::ACCENT
                        } else {
                            colors::TEXT_MUTED
                        })
                        .corner_radius(egui::CornerRadius::same(8))
                        .min_size(egui::vec2(160.0, 40.0));

                if ui.add_enabled(can_scan, scan_btn).clicked() {
                    self.start_scan();
                }

                if !can_scan && !self.is_scanning {
                    ui.add_space(8.0);
                    ui.horizontal(|ui| {
                        ui.colored_label(
                            colors::WARNING,
                            "Select a folder or volume to enable scanning.",
                        );
                    });
                }

                ui.add_space(4.0);

                let stop_btn = egui::Button::new(egui::RichText::new("Stop").size(14.0).strong())
                    .fill(colors::ERROR)
                    .corner_radius(egui::CornerRadius::same(8))
                    .min_size(egui::vec2(100.0, 40.0));

                if ui.add_enabled(self.is_scanning, stop_btn).clicked() {
                    self.stop_scan();
                }

                let export_btn =
                    egui::Button::new(egui::RichText::new("Export results").size(13.0))
                        .fill(colors::SURFACE_2)
                        .stroke(egui::Stroke::new(1.0, colors::CARD_BORDER))
                        .corner_radius(egui::CornerRadius::same(8))
                        .min_size(egui::vec2(130.0, 40.0));

                if ui
                    .add_enabled(self.scan_result.is_some(), export_btn)
                    .clicked()
                {
                    self.export_results();
                }
            });
            ui.add_space(8.0);

            // Progress
            if self.is_scanning {
                section_header(ui, Some(icons::HOURGLASS), "Scanning...");
                app_card(ui, |ui| {
                    ui.add(
                        egui::ProgressBar::new(self.smoothed_scan_progress)
                            .text(format!("{:.0}%", self.scan_progress))
                            .desired_height(14.0)
                            .fill(colors::ACCENT),
                    );
                    ui.add_space(8.0);
                    ui.horizontal(|ui| {
                        ui.label(
                            egui::RichText::new(format!(
                                "{} {:.1}s",
                                icons::TIMER,
                                self.scan_performance.elapsed_secs()
                            ))
                            .size(12.0)
                            .color(colors::TEXT_SECONDARY),
                        );
                        if self.scan_performance.files_per_sec > 0.0 {
                            ui.separator();
                            ui.label(
                                egui::RichText::new(format!(
                                    "{} {:.0} files/sec",
                                    icons::FOLDER,
                                    self.scan_performance.files_per_sec
                                ))
                                .size(12.0)
                                .color(colors::TEXT_SECONDARY),
                            );
                        }
                        if self.scan_performance.mb_per_sec > 0.0 {
                            ui.separator();
                            ui.label(
                                egui::RichText::new(format!(
                                    "{} {:.1} MB/s",
                                    icons::TREND,
                                    self.scan_performance.mb_per_sec
                                ))
                                .size(12.0)
                                .color(colors::TEXT_SECONDARY),
                            );
                        }
                        if self.scan_performance.current_files > 0 {
                            ui.separator();
                            ui.label(
                                egui::RichText::new(format!(
                                    "{} {} files",
                                    icons::PACKAGE,
                                    self.scan_performance.current_files
                                ))
                                .size(12.0)
                                .color(colors::TEXT_SECONDARY),
                            );
                        }
                    });
                    if !self.scan_performance.current_file.is_empty() {
                        ui.add_space(6.0);
                        ui.horizontal(|ui| {
                            ui.label(
                                egui::RichText::new("Current:")
                                    .size(12.0)
                                    .color(colors::TEXT_SECONDARY),
                            );
                            ui.label(
                                egui::RichText::new(&self.scan_performance.current_file)
                                    .size(12.0)
                                    .monospace()
                                    .color(colors::TEXT_PRIMARY),
                            );
                        });
                    }
                });
                ui.add_space(10.0);
            }

            // Scan results
            if let Some(result) = self.scan_result.clone() {
                section_header(ui, Some(icons::CHART_BAR), "Scan results");

                ui.add_space(4.0);
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
                    stat_card(ui, "Dirs", &format!("{}", result.total_dirs), colors::INFO);
                    if result.total_files > 0 {
                        let avg = result.total_size_bytes / result.total_files as u64;
                        stat_card(
                            ui,
                            "Avg Size",
                            &formatting::format_bytes(avg),
                            colors::WARNING,
                        );
                    }
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
                        stat_card(
                            ui,
                            "Throughput",
                            &format!(
                                "{:.1} MB/s",
                                result.total_size_bytes as f64
                                    / (1024.0 * 1024.0)
                                    / result.duration_secs
                            ),
                            colors::SUCCESS,
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

                ui.add_space(8.0);

                if !result.errors.is_empty() {
                    section_header(ui, Some(icons::WARNING), "Scan errors");
                    app_card(ui, |ui| {
                        egui::ScrollArea::vertical()
                            .max_height(120.0)
                            .show(ui, |ui| {
                                self.show_scan_errors(ui, &result);
                            });
                    });
                    ui.add_space(6.0);
                }

                section_header(ui, Some(icons::CHART_BAR), "File distribution");
                app_card(ui, |ui| {
                    self.show_visual_analysis(ui, &result);
                });
                ui.add_space(6.0);

                section_header(ui, Some(icons::FILETYPE), "File types");
                app_card(ui, |ui| {
                    egui::ScrollArea::vertical()
                        .max_height(160.0)
                        .show(ui, |ui| {
                            self.show_file_types(ui, &result);
                        });
                });
                ui.add_space(6.0);

                if !result.category_sizes.is_empty() {
                    section_header(ui, Some(icons::FOLDER), "Storage by category");
                    app_card(ui, |ui| {
                        self.show_categories(ui, &result);
                    });
                    ui.add_space(6.0);
                }

                if !result.empty_dirs.is_empty() {
                    section_header(ui, Some(icons::FOLDER), "Empty directories");
                    app_card(ui, |ui| {
                        egui::ScrollArea::vertical()
                            .max_height(120.0)
                            .show(ui, |ui| {
                                ui.label(
                                    egui::RichText::new(format!(
                                        "{} empty directories found",
                                        result.empty_dirs.len()
                                    ))
                                    .size(12.0)
                                    .color(colors::TEXT_SECONDARY),
                                );
                                ui.add_space(4.0);
                                for dir in result.empty_dirs.iter().take(20) {
                                    ui.label(
                                        egui::RichText::new(dir)
                                            .size(11.0)
                                            .monospace()
                                            .color(colors::TEXT_MUTED),
                                    );
                                }
                                if result.empty_dirs.len() > 20 {
                                    ui.label(
                                        egui::RichText::new(format!(
                                            "... and {} more",
                                            result.empty_dirs.len() - 20
                                        ))
                                        .size(11.0)
                                        .color(colors::TEXT_MUTED),
                                    );
                                }
                            });
                    });
                    ui.add_space(6.0);
                }

                section_header(ui, Some(icons::PACKAGE), "Largest files");
                app_card(ui, |ui| {
                    egui::ScrollArea::vertical()
                        .max_height(200.0)
                        .show(ui, |ui| {
                            self.show_largest_files(ui, &result);
                        });
                });
            }
        });
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
            .num_columns(4)
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
                ui.label(
                    egui::RichText::new("Size")
                        .strong()
                        .color(colors::TEXT_SECONDARY),
                );
                ui.label(
                    egui::RichText::new("Share")
                        .strong()
                        .color(colors::TEXT_SECONDARY),
                );
                ui.end_row();
                for (ext, count) in sorted_types.iter().take(50) {
                    let ext_size = result.extension_sizes.get(*ext).copied().unwrap_or(0);
                    let pct = if result.total_size_bytes > 0 {
                        (ext_size as f64 / result.total_size_bytes as f64) * 100.0
                    } else {
                        0.0
                    };
                    ui.label(
                        egui::RichText::new(format!(".{}", ext))
                            .monospace()
                            .color(colors::ACCENT),
                    );
                    ui.label(format!("{} files", count));
                    ui.label(formatting::format_bytes(ext_size));
                    ui.label(format!("{:.1}%", pct));
                    ui.end_row();
                }
            });
    }

    fn show_categories(&self, ui: &mut egui::Ui, result: &ScanResult) {
        if result.category_sizes.is_empty() {
            ui.label(
                egui::RichText::new("No category data available")
                    .italics()
                    .color(colors::TEXT_MUTED),
            );
            return;
        }
        let mut sorted: Vec<_> = result.category_sizes.iter().collect();
        sorted.sort_by(|a, b| b.1.cmp(a.1));
        egui::Grid::new("categories_grid")
            .num_columns(3)
            .spacing([20.0, 4.0])
            .show(ui, |ui| {
                ui.label(
                    egui::RichText::new("Category")
                        .strong()
                        .color(colors::TEXT_SECONDARY),
                );
                ui.label(
                    egui::RichText::new("Size")
                        .strong()
                        .color(colors::TEXT_SECONDARY),
                );
                ui.label(
                    egui::RichText::new("Share")
                        .strong()
                        .color(colors::TEXT_SECONDARY),
                );
                ui.end_row();
                for (cat, size) in sorted.iter().take(10) {
                    let pct = if result.total_size_bytes > 0 {
                        (**size as f64 / result.total_size_bytes as f64) * 100.0
                    } else {
                        0.0
                    };
                    ui.label(egui::RichText::new(*cat).color(colors::ACCENT));
                    ui.label(formatting::format_bytes(**size));
                    ui.label(format!("{:.1}%", pct));
                    ui.end_row();
                }
            });
    }

    fn show_largest_files(&mut self, ui: &mut egui::Ui, result: &ScanResult) {
        if result.largest_files.is_empty() {
            ui.label(
                egui::RichText::new("No files found")
                    .italics()
                    .color(colors::TEXT_MUTED),
            );
            return;
        }

        ui.horizontal(|ui| {
            ui.label(egui::RichText::new("Filter:").color(colors::TEXT_SECONDARY));
            ui.add(
                egui::TextEdit::singleline(&mut self.largest_files_filter)
                    .hint_text("Filter by filename or path...")
                    .desired_width(240.0),
            );
            if !self.largest_files_filter.is_empty() && tiny_button(ui, "Clear").clicked() {
                self.largest_files_filter.clear();
            }
        });
        ui.add_space(4.0);

        let filter_lower = self.largest_files_filter.to_lowercase();
        let filtered_files: Vec<_> = result
            .largest_files
            .iter()
            .filter(|file| {
                filter_lower.is_empty() || file.path.to_lowercase().contains(&filter_lower)
            })
            .collect();

        if filtered_files.is_empty() {
            ui.label(
                egui::RichText::new("No matching files")
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
                for file in filtered_files {
                    ui.label(
                        egui::RichText::new(formatting::format_bytes(file.size))
                            .color(colors::WARNING),
                    );
                    ui.label(&file.path);
                    ui.horizontal(|ui| {
                        let file_path = std::path::Path::new(&file.path);
                        if file_path.exists() {
                            if tiny_button(ui, "Open").clicked() {
                                let _ = open::that(&file.path);
                            }
                            if tiny_button(ui, "Folder").clicked() {
                                if let Some(parent) = file_path.parent() {
                                    let _ = open::that(parent);
                                }
                            }
                        }
                        if tiny_button(ui, "Preview").clicked() {
                            self.impact_preview_input = file.path.clone();
                            self.impact_preview_open = true;
                            self.current_impact_report = None;
                        }
                    });
                    ui.end_row();
                }
            });
    }
}
