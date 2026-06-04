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
            let _ = db.clear_all_embeddings();
            let _ = db.clear_history();
            self.scan_history.clear();
            self.cached_embeddings.clear();
            self.embedding_scan_id = None;
        }
    }

    pub(crate) fn render_history(&mut self, ui: &mut egui::Ui) {
        ui.heading("Scan History");
        ui.separator();

        ui.horizontal(|ui| {
            if self.selected_history_id.is_some() && ui.button("← Back to List").clicked() {
                self.selected_history_id = None;
            }
            if ui.button("Refresh").clicked() {
                self.load_history();
            }
            if !self.scan_history.is_empty() && ui.button("Clear All").clicked() {
                self.clear_all_history();
                self.selected_history_id = None;
            }
        });
        ui.separator();

        if let Some(selected_id) = self.selected_history_id {
            self.render_history_detail(ui, selected_id);
        } else if self.scan_history.is_empty() {
            ui.label("No scan history. Run a scan to start tracking.");
        } else {
            let mut delete_id: Option<i64> = None;
            let mut view_id: Option<i64> = None;
            egui::ScrollArea::vertical().show(ui, |ui| {
                for record in &self.scan_history {
                    ui.horizontal(|ui| {
                        ui.vertical(|ui| {
                            ui.label(
                                egui::RichText::new(format!(
                                    "{} - {} files, {:.2} MB",
                                    record.path, record.total_files, record.total_size_mb
                                ))
                                .strong(),
                            );
                            ui.small(format!("{} (deep: {})", record.timestamp, record.deep_scan));
                        });
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            if ui.small_button("View").clicked() {
                                view_id = Some(record.id);
                            }
                            if ui.small_button("X").clicked() {
                                delete_id = Some(record.id);
                            }
                        });
                    });
                    ui.separator();
                }

                // Model Info Panel
                if self.ollama_available && !self.discovered_models.is_empty() {
                    let current_model = &self.settings.ollama_model;
                    if let Some(model_info) = self
                        .discovered_models
                        .iter()
                        .find(|m| m.name == *current_model)
                    {
                        let header_label = if let Some((cp, _)) = icons::model() {
                            format!(
                                "{} Model: {} - {}",
                                icon_char(cp),
                                model_info.name,
                                model_info.recommended_for
                            )
                        } else {
                            format!(
                                "[AI] Model: {} - {}",
                                model_info.name, model_info.recommended_for
                            )
                        };
                        egui::CollapsingHeader::new(&header_label)
                            .default_open(false)
                            .show(ui, |ui| {
                                ui.horizontal(|ui| {
                                    ui.small(format!("Size: {}", model_info.size));
                                    if !model_info.vram_requirement.is_empty() {
                                        ui.small(format!("VRAM: {}", model_info.vram_requirement));
                                    }
                                });
                                if !model_info.capabilities.is_empty() {
                                    ui.horizontal_wrapped(|ui| {
                                        ui.small("Capabilities:");
                                        for cap in &model_info.capabilities {
                                            if let Some((cp, fam)) = icons::check() {
                                                ui.add(egui::Label::new(icon_text(
                                                    cp,
                                                    fam,
                                                    12.0,
                                                    egui::Color32::GREEN,
                                                )));
                                                ui.small(cap);
                                            } else {
                                                ui.small(format!("[OK] {}", cap));
                                            }
                                        }
                                    });
                                }
                                if let Some(tps) = model_info.performance_metrics.tokens_per_second
                                {
                                    ui.small(format!("Speed: {:.1} tokens/s", tps));
                                }
                                if let Some(ftt) =
                                    model_info.performance_metrics.time_to_first_token_ms
                                {
                                    ui.small(format!("First token: {:.0}ms", ftt));
                                }
                                if !model_info.tooltip.is_empty() {
                                    ui.small(&model_info.tooltip);
                                }
                            });
                        ui.separator();
                    }
                }
            });
            if let Some(id) = view_id {
                self.selected_history_id = Some(id);
            }
            if let Some(id) = delete_id {
                self.delete_history_record(id);
            }
        }
    }

    fn render_history_detail(&mut self, ui: &mut egui::Ui, id: i64) {
        if let Some(ref db) = self.db {
            if let Ok(Some(record)) = db.get_scan_by_id(id) {
                ui.heading(format!("Scan: {}", record.path));
                ui.horizontal(|ui| {
                    ui.label(format!("Files: {}", record.total_files));
                    ui.label(format!("Size: {:.2} MB", record.total_size_mb));
                    ui.label(format!("Duration: {:.1}s", record.duration_secs));
                    ui.label(format!("Deep scan: {}", record.deep_scan));
                });
                ui.small(&record.timestamp);
                ui.separator();

                // File types
                if let Ok(file_types) = serde_json::from_str::<
                    std::collections::HashMap<String, usize>,
                >(&record.file_types_json)
                {
                    if !file_types.is_empty() {
                        ui.collapsing("File Types", |ui| {
                            let mut sorted: Vec<_> = file_types.iter().collect();
                            sorted.sort_by(|a, b| b.1.cmp(a.1));
                            egui::Grid::new("history_file_types")
                                .num_columns(2)
                                .show(ui, |ui| {
                                    for (ext, count) in sorted.iter().take(50) {
                                        ui.label(format!(".{}", ext));
                                        ui.label(format!("{} files", count));
                                        ui.end_row();
                                    }
                                });
                        });
                    }
                }

                // Largest files
                if let Ok(largest) =
                    serde_json::from_str::<Vec<(String, u64)>>(&record.largest_files_json)
                {
                    if !largest.is_empty() {
                        ui.collapsing("Largest Files", |ui| {
                            egui::Grid::new("history_largest_files")
                                .num_columns(2)
                                .show(ui, |ui| {
                                    for (path, size) in largest.iter().take(50) {
                                        ui.label(formatting::format_bytes(*size));
                                        ui.label(path);
                                        ui.end_row();
                                    }
                                });
                        });
                    }
                }
            } else {
                ui.label("Scan record not found.");
            }
        }
    }
}
