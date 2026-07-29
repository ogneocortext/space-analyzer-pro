use super::*;

impl SpaceAnalyzerApp {
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
            self.cached_embeddings.clear();
            self.embedding_scan_id = None;
        }
    }

    fn export_scan_json(&self, record: &ScanHistoryRecord) {
        let json = serde_json::json!({
            "id": record.id,
            "path": record.path,
            "total_files": record.total_files,
            "total_size_bytes": record.total_size_bytes,
            "total_size_mb": record.total_size_mb,
            "duration_secs": record.duration_secs,
            "file_types": record.file_types_json,
            "extension_sizes": record.extension_sizes_json,
            "top_directories": record.top_directories_json,
            "largest_files": record.largest_files_json,
            "deep_scan": record.deep_scan,
            "potential_cleanup_bytes": record.potential_cleanup_bytes,
            "timestamp": record.timestamp,
        });
        let content = serde_json::to_string_pretty(&json).unwrap_or_default();
        if let Some(path) = rfd::FileDialog::new()
            .set_title("Export Scan as JSON")
            .add_filter("JSON", &["json"])
            .save_file()
        {
            if let Err(e) = std::fs::write(&path, content) {
                eprintln!("Failed to export scan JSON: {}", e);
            }
        }
    }

    fn export_scan_csv(&self, record: &ScanHistoryRecord) {
        let mut csv = String::from("field,value\n");
        csv.push_str(&format!("id,{}\n", record.id));
        csv.push_str(&format!("path,{}\n", record.path));
        csv.push_str(&format!("total_files,{}\n", record.total_files));
        csv.push_str(&format!("total_size_bytes,{}\n", record.total_size_bytes));
        csv.push_str(&format!("total_size_mb,{}\n", record.total_size_mb));
        csv.push_str(&format!("duration_secs,{}\n", record.duration_secs));
        csv.push_str(&format!("deep_scan,{}\n", record.deep_scan));
        csv.push_str(&format!("potential_cleanup_bytes,{}\n", record.potential_cleanup_bytes));
        csv.push_str(&format!("timestamp,{}\n", record.timestamp));
        if let Ok(file_types) = serde_json::from_str::<std::collections::HashMap<String, usize>>(&record.file_types_json) {
            for (ext, count) in file_types {
                csv.push_str(&format!("file_type_.{},{}\n", ext, count));
            }
        }
        if let Ok(largest) = serde_json::from_str::<Vec<(String, u64)>>(&record.largest_files_json) {
            for (path, size) in largest {
                csv.push_str(&format!("largest_file,\"{}|{}\"\n", path, size));
            }
        }
        if let Some(path) = rfd::FileDialog::new()
            .set_title("Export Scan as CSV")
            .add_filter("CSV", &["csv"])
            .save_file()
        {
            if let Err(e) = std::fs::write(&path, csv) {
                eprintln!("Failed to export scan CSV: {}", e);
            }
        }
    }

    pub(crate) fn render_history(&mut self, ui: &mut egui::Ui) {
        // ── Toolbar ─────────────────────────────────────────────────
        section_heading(ui, Some('📋'), "Scan History");
        card_frame(ui.style()).show(ui, |ui| {
            ui.horizontal(|ui| {
                if self.selected_history_id.is_some() && ui.button("← Back to List").clicked() {
                    self.selected_history_id = None;
                }
                if ui.button("🔄 Refresh").clicked() {
                    self.load_history();
                }
                if !self.scan_history.is_empty() {
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if ui
                            .add(
                                egui::Button::new(
                                    egui::RichText::new("Clear All").color(colors::ERROR),
                                )
                                .fill(colors::ERROR.linear_multiply(0.15)),
                            )
                            .clicked()
                        {
                            self.clear_all_history();
                            self.selected_history_id = None;
                        }
                    });
                }
            });
        });

        // ── Content ─────────────────────────────────────────────────
        if let Some(selected_id) = self.selected_history_id {
            self.render_history_detail(ui, selected_id);
        } else if self.scan_history.is_empty() {
            card_frame(ui.style()).show(ui, |ui| {
                ui.vertical_centered(|ui| {
                    ui.add_space(20.0);
                    ui.label(
                        egui::RichText::new("No scan history yet")
                            .size(16.0)
                            .color(colors::TEXT_MUTED),
                    );
                    ui.label(
                        egui::RichText::new("Run a scan to start tracking your disk usage")
                            .color(colors::TEXT_SECONDARY),
                    );
                    ui.add_space(20.0);
                });
            });
        } else {
            let mut delete_id: Option<i64> = None;
            let mut view_id: Option<i64> = None;
            let mut export_json_id: Option<i64> = None;
            let mut export_csv_id: Option<i64> = None;

            egui::ScrollArea::vertical().show(ui, |ui| {
                for record in &self.scan_history {
                    card_frame(ui.style()).show(ui, |ui| {
                        ui.horizontal(|ui| {
                            ui.vertical(|ui| {
                                ui.label(
                                    egui::RichText::new(&record.path)
                                        .strong()
                                        .color(colors::TEXT_PRIMARY),
                                );
                                ui.horizontal(|ui| {
                                    badge(
                                        ui,
                                        &format!("{} files", record.total_files),
                                        colors::ACCENT,
                                    );
                                    badge(
                                        ui,
                                        &format!("{:.2} MB", record.total_size_mb),
                                        colors::SUCCESS,
                                    );
                                    if record.deep_scan {
                                        badge(ui, "Deep", colors::WARNING);
                                    }
                                });
                                ui.label(
                                    egui::RichText::new(&record.timestamp)
                                        .size(10.0)
                                        .color(colors::TEXT_MUTED),
                                );
                            });
                            ui.with_layout(
                                egui::Layout::right_to_left(egui::Align::Center),
                                |ui| {
                                    if ui.small_button("Export JSON").clicked() {
                                        export_json_id = Some(record.id);
                                    }
                                    if ui.small_button("Export CSV").clicked() {
                                        export_csv_id = Some(record.id);
                                    }
                                    if ui.small_button("View").clicked() {
                                        view_id = Some(record.id);
                                    }
                                    if ui
                                        .add(
                                            egui::Button::new(
                                                egui::RichText::new("×").color(colors::ERROR),
                                            )
                                            .fill(colors::ERROR.linear_multiply(0.15)),
                                        )
                                        .clicked()
                                    {
                                        delete_id = Some(record.id);
                                    }
                                },
                            );
                        });
                    });
                }
            });

            if let Some(id) = view_id {
                self.selected_history_id = Some(id);
            }
            if let Some(id) = delete_id {
                self.delete_history_record(id);
            }
            if let Some(id) = export_json_id {
                if let Some(record) = self.scan_history.iter().find(|r| r.id == id) {
                    self.export_scan_json(record);
                }
            }
            if let Some(id) = export_csv_id {
                if let Some(record) = self.scan_history.iter().find(|r| r.id == id) {
                    self.export_scan_csv(record);
                }
            }
        }
    }

    fn render_history_detail(&mut self, ui: &mut egui::Ui, id: i64) {
        if let Some(ref db) = self.db {
            if let Ok(Some(record)) = db.get_scan_by_id(id) {
                // Stats row
                ui.horizontal(|ui| {
                    stat_card(
                        ui,
                        "Files",
                        &format!("{}", record.total_files),
                        colors::ACCENT,
                    );
                    stat_card(
                        ui,
                        "Size",
                        &format!("{:.2} MB", record.total_size_mb),
                        colors::SUCCESS,
                    );
                    stat_card(
                        ui,
                        "Duration",
                        &format!("{:.1}s", record.duration_secs),
                        colors::INFO,
                    );
                    badge(
                        ui,
                        if record.deep_scan {
                            "Deep Scan"
                        } else {
                            "Quick Scan"
                        },
                        if record.deep_scan {
                            colors::WARNING
                        } else {
                            colors::TEXT_SECONDARY
                        },
                    );
                });

                // Export buttons
                ui.horizontal(|ui| {
                    if ui.small_button("📥 Export JSON").clicked() {
                        self.export_scan_json(&record);
                    }
                    if ui.small_button("📥 Export CSV").clicked() {
                        self.export_scan_csv(&record);
                    }
                });
                ui.add_space(4.0);

                // Analyze with AI button
                if self.ollama_client.is_some()
                    && self.ollama_available
                    && ui
                        .add_sized(
                            egui::vec2(120.0, 24.0),
                            egui::Button::new(egui::RichText::new("Analyze with AI").size(11.0)),
                        )
                        .clicked()
                {
                    let scan_info = format!(
                        "Analyze this historical scan and compare it to typical disk usage patterns.                          Path: {}\nTotal files: {}\nTotal size: {:.2} MB\nTimestamp: {}\n\n                         What does this scan tell you about the storage situation at this location?                          Are there any unusual patterns or recommendations for this path?",
                        record.path, record.total_files, record.total_size_mb, record.timestamp
                    );
                    self.chat_input = scan_info;
                    self.active_tab = AppTab::AIChat;
                }

                ui.label(
                    egui::RichText::new(&record.timestamp)
                        .size(11.0)
                        .color(colors::TEXT_MUTED),
                );
                ui.add_space(8.0);

                // File types
                if let Ok(file_types) = serde_json::from_str::<
                    std::collections::HashMap<String, usize>,
                >(&record.file_types_json)
                {
                    if !file_types.is_empty() {
                        section_heading(ui, Some('📄'), "File Types");
                        card_frame(ui.style()).show(ui, |ui| {
                            egui::ScrollArea::vertical()
                                .max_height(200.0)
                                .show(ui, |ui| {
                                    let mut sorted: Vec<_> = file_types.iter().collect();
                                    sorted.sort_by(|a, b| b.1.cmp(a.1));
                                    egui::Grid::new("history_file_types")
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
                                            for (ext, count) in sorted.iter().take(50) {
                                                ui.label(
                                                    egui::RichText::new(format!(".{}", ext))
                                                        .monospace()
                                                        .color(colors::ACCENT),
                                                );
                                                ui.label(format!("{} files", count));
                                                ui.end_row();
                                            }
                                        });
                                });
                        });
                    }
                }

                // Largest files
                if let Ok(largest) =
                    serde_json::from_str::<Vec<(String, u64)>>(&record.largest_files_json)
                {
                    if !largest.is_empty() {
                        section_heading(ui, Some('📦'), "Largest Files");
                        card_frame(ui.style()).show(ui, |ui| {
                            egui::ScrollArea::vertical()
                                .max_height(200.0)
                                .show(ui, |ui| {
                                    egui::Grid::new("history_largest_files")
                                        .num_columns(2)
                                        .spacing([20.0, 4.0])
                                        .show(ui, |ui| {
                                            for (path, size) in largest.iter().take(50) {
                                                ui.label(
                                                    egui::RichText::new(formatting::format_bytes(
                                                        *size,
                                                    ))
                                                    .color(colors::WARNING),
                                                );
                                                ui.label(path);
                                                ui.end_row();
                                            }
                                        });
                                });
                        });
                    }
                }
            } else {
                ui.label(egui::RichText::new("Scan record not found").color(colors::TEXT_MUTED));
            }
        }
    }
}
