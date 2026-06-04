use super::*;
use egui_plot::{CoordinatesFormatter, Corner, HLine, Legend, Line, Plot, PlotPoints};

impl SpaceAnalyzerApp {
    pub(crate) fn render_dashboard(&mut self, ui: &mut egui::Ui) {
        ui.heading("Space Analyzer Pro v3.3.0");
        ui.label("Self-contained disk space analysis with embedded database and AI.");
        ui.separator();

        // ── Quick Stats ─────────────────────────────────────────────
        ui.horizontal(|ui| {
            if let Some(ref result) = self.scan_result {
                ui.label(
                    egui::RichText::new(format!(
                        "Last scan: {} files, {}",
                        result.total_files,
                        formatting::format_bytes(result.total_size_bytes)
                    ))
                    .strong(),
                );
            } else {
                ui.label(egui::RichText::new("No scans yet. Go to Scan tab to begin.").italics());
            }
            ui.separator();
            ui.label(format!("History: {} records", self.scan_history.len()));
            if let Some(ref result) = self.scan_result {
                let threshold = self.settings.large_file_threshold_mb * 1024 * 1024;
                let large_count = result
                    .largest_files
                    .iter()
                    .filter(|(_, size)| *size > threshold)
                    .count();
                if large_count > 0 {
                    ui.separator();
                    ui.label(
                        egui::RichText::new(format!(
                            "Large files (>{}MB): {}",
                            self.settings.large_file_threshold_mb, large_count
                        ))
                        .color(egui::Color32::from_rgb(255, 180, 100)),
                    );
                }
            }
            if let Some(ref gpu) = self.gpu_info {
                ui.separator();
                if gpu.available {
                    ui.label(format!("GPU: {}", gpu.name.as_deref().unwrap_or("Unknown")));
                } else {
                    ui.small("GPU: CPU only");
                }
            }
        });

        // ── Quick Actions ───────────────────────────────────────────
        ui.horizontal(|ui| {
            if ui
                .add_enabled(!self.is_scanning, egui::Button::new("📁 Scan Now"))
                .clicked()
            {
                self.active_tab = AppTab::Scan;
                self.start_scan();
            }
            if ui.button("📋 History").clicked() {
                self.active_tab = AppTab::History;
            }
            if ui.button("⚙ Workflows").clicked() {
                self.active_tab = AppTab::Workflows;
            }
            if ui.button("🤖 AI Assistant").clicked() {
                self.active_tab = AppTab::AIChat;
            }
        });

        // ── File Categories (from most recent scan) ─────────────────────
        if let Some(ref result) = self.scan_result {
            ui.separator();
            ui.heading("📁 File Categories");
            let categories = category::categorize_files(&result.file_types);
            let total: usize = categories.values().sum();
            if total == 0 {
                ui.small("No categorized files in last scan.");
            } else {
                let mut sorted: Vec<(&String, &usize)> = categories.iter().collect();
                sorted.sort_by(|a, b| b.1.cmp(a.1));
                for (cat, count) in sorted.iter().take(8) {
                    let (r, g, b) = category::category_color(cat);
                    let pct = if total > 0 {
                        (**count as f64 / total as f64) * 100.0
                    } else {
                        0.0
                    };
                    ui.horizontal(|ui| {
                        ui.colored_label(egui::Color32::from_rgb(r, g, b), format!("{:>12}", cat));
                        ui.label(format!("{} files ({:.1}%)", count, pct));
                    });
                }
            }
        }

        // ── Bloat Candidates (heuristic offline AI) ─────────────────────
        if let Some(ref result) = self.scan_result {
            ui.separator();
            ui.heading("🧹 Bloat Candidates");
            let classifier = offline_ai::FilePatternClassifier::new();
            let mut flagged: Vec<(String, String, usize)> = Vec::new();
            for (ext, count) in &result.file_types {
                if let Some(rule) = classifier.classify_file(ext, 0) {
                    flagged.push((ext.clone(), rule.name.clone(), *count));
                }
            }
            if flagged.is_empty() {
                ui.small(egui::RichText::new("No bloat patterns matched.").italics());
            } else {
                for (ext, name, count) in flagged.iter().take(5) {
                    ui.horizontal(|ui| {
                        ui.colored_label(egui::Color32::YELLOW, format!(".{}", ext));
                        ui.label(format!("{} — {} file(s)", name, count));
                    });
                }
            }
        }

        // ── Destructive-Action Preview (F) ──────────────────────────────
        ui.separator();
        ui.heading("🔍 Destructive-Action Preview");
        ui.horizontal(|ui| {
            ui.label("File path:");
            ui.add(
                egui::TextEdit::singleline(&mut self.impact_preview_input)
                    .hint_text("e.g. C:\\path\\to\\file.txt")
                    .desired_width(450.0),
            );
            if ui.button("Preview Impact").clicked() {
                let path = self.impact_preview_input.trim().to_string();
                if !path.is_empty() {
                    let report = file_relations::analyze_file_dependencies(&path);
                    self.current_impact_report = Some(report);
                    self.impact_preview_open = true;
                } else {
                    self.push_notification("Enter a file path first", NotificationLevel::Warning);
                }
            }
            if ui.button("From Scan").clicked() {
                if let Some(ref result) = self.scan_result {
                    if let Some((path, _)) = result.largest_files.first() {
                        self.impact_preview_input = path.clone();
                    } else {
                        self.push_notification(
                            "No files in current scan",
                            NotificationLevel::Warning,
                        );
                    }
                } else {
                    self.push_notification("Run a scan first", NotificationLevel::Warning);
                }
            }
        });
        ui.small(
            "See hardlinks, symlinks, sibling files, and an impact assessment before deleting or moving.",
        );

        // ── Impact Preview Modal ────────────────────────────────────────
        if self.impact_preview_open {
            let report_clone = self.current_impact_report.clone();
            if let Some(report) = report_clone {
                let mut open = self.impact_preview_open;
                egui::Window::new("🔍 Destructive-Action Impact Preview")
                    .open(&mut open)
                    .resizable(true)
                    .default_size([720.0, 540.0])
                    .show(ui.ctx(), |ui| {
                        ui.heading(format!("Target: {}", report.target_path));
                        if !report.target_exists {
                            ui.colored_label(egui::Color32::RED, "❌ File does not exist");
                            return;
                        }
                        if report.target_is_dir {
                            ui.colored_label(
                                egui::Color32::YELLOW,
                                "⚠ Target is a directory, not a file",
                            );
                            return;
                        }
                        ui.horizontal(|ui| {
                            ui.label(format!(
                                "Size: {}",
                                formatting::format_bytes(report.target_size)
                            ));
                            ui.separator();
                            ui.label(format!("Modified: {}", report.target_modified));
                        });
                        if report.is_symlink {
                            ui.colored_label(
                                egui::Color32::LIGHT_BLUE,
                                format!(
                                    "🔗 Symlink → {}",
                                    report.symlink_target.as_deref().unwrap_or("?")
                                ),
                            );
                        }
                        if report.hardlink_count > 0 {
                            ui.colored_label(
                                egui::Color32::from_rgb(255, 180, 100),
                                format!(
                                    "🔗 {} potential duplicate(s) found (same size + modified time)",
                                    report.hardlink_count
                                ),
                            );
                        }
                        ui.separator();
                        ui.label(egui::RichText::new(&report.summary).strong());
                        ui.separator();
                        egui::ScrollArea::vertical()
                            .max_height(320.0)
                            .show(ui, |ui| {
                                if !report.same_stem_files.is_empty() {
                                    ui.heading("Same-name files (different extension):");
                                    for f in report.same_stem_files.iter().take(20) {
                                        ui.label(format!(
                                            "  {} ({})",
                                            f.path,
                                            formatting::format_bytes(f.size)
                                        ));
                                    }
                                }
                                if !report.symlink_sources.is_empty() {
                                    ui.heading("Symlinks pointing to this file:");
                                    for f in &report.symlink_sources {
                                        ui.label(format!("  {}", f.path));
                                    }
                                }
                                if !report.sibling_files.is_empty() {
                                    ui.heading("Sibling files (first 20):");
                                    for f in report.sibling_files.iter().take(20) {
                                        ui.label(format!("  {} — {}", f.path, f.relation));
                                    }
                                }
                                if report.total_related == 0 {
                                    ui.small(
                                        "No related files detected — this file appears isolated.",
                                    );
                                }
                            });
                    });
                self.impact_preview_open = open;
            } else {
                self.impact_preview_open = false;
            }
        }

        // ── System Resources (always visible) ───────────────────────
        ui.separator();
        ui.heading("System Resources");
        if let Some(ref sys) = self.system_resources {
            ui.horizontal(|ui| {
                // CPU
                let cpu_color = self.status_color(sys.cpu_percent, 50.0, 80.0);
                ui.vertical(|ui| {
                    ui.label(egui::RichText::new("CPU").strong());
                    ui.add(
                        egui::ProgressBar::new(sys.cpu_percent / 100.0)
                            .text(format!("{:.1}%", sys.cpu_percent))
                            .fill(cpu_color),
                    );
                });
                ui.add_space(10.0);
                // Memory
                let mem_color = self.status_color(sys.memory_percent, 60.0, 80.0);
                ui.vertical(|ui| {
                    ui.label(egui::RichText::new("Memory").strong());
                    ui.add(
                        egui::ProgressBar::new(sys.memory_percent / 100.0)
                            .text(format!(
                                "{:.1}% ({}/{})",
                                sys.memory_percent,
                                formatting::format_bytes(sys.memory_used_bytes),
                                formatting::format_bytes(sys.memory_total_bytes)
                            ))
                            .fill(mem_color),
                    );
                });
            });
        } else {
            ui.small("Loading system info...");
        }

        // ── Disk Volumes (always visible) ───────────────────────────
        if !self.disk_volumes.is_empty() {
            ui.separator();
            ui.heading("Disk Volumes");
            for vol in &self.disk_volumes {
                let usage_color = self.status_color(vol.usage_percent, 70.0, 90.0);
                ui.horizontal(|ui| {
                    ui.label(format!("{} ({})", vol.mount_point, vol.name));
                    ui.add(
                        egui::ProgressBar::new(vol.usage_percent / 100.0)
                            .text(format!(
                                "{:.1}% — {} free of {}",
                                vol.usage_percent,
                                formatting::format_bytes(vol.available_bytes),
                                formatting::format_bytes(vol.total_bytes)
                            ))
                            .fill(usage_color),
                    );
                });
            }
        }

        // ── Storage Trend Chart (always visible) ────────────────────
        if self.scan_history.len() >= 2 {
            ui.separator();
            self.render_storage_chart(ui);
        }

        // ── AI Recommendations (if any) ─────────────────────────────
        if !self.ai_recommendations.is_empty() {
            ui.separator();
            let source_label = if self.ai_recommendation_source == "ai" {
                "🤖 AI"
            } else {
                "⚙ Heuristic"
            };
            ui.horizontal(|ui| {
                ui.heading("Insights");
                ui.small(format!("({})", source_label));
            });
            if self.ai_recommendation_pending {
                ui.small("Generating AI recommendations…");
            }
            for rec in self.ai_recommendations.iter().take(3) {
                let color = match rec.priority {
                    RecommendationPriority::Critical => egui::Color32::RED,
                    RecommendationPriority::High => egui::Color32::from_rgb(255, 165, 0),
                    RecommendationPriority::Medium => egui::Color32::YELLOW,
                    RecommendationPriority::Low => egui::Color32::LIGHT_GRAY,
                };
                ui.label(egui::RichText::new(&rec.title).color(color).strong());
                ui.small(&rec.description);
            }
        }

        // ── Collapsible: AI Status ──────────────────────────────────
        ui.separator();
        egui::CollapsingHeader::new(egui::RichText::new("AI Assistant").strong())
            .default_open(true)
            .show(ui, |ui| {
                self.render_ai_status(ui);
            });

        // ── Collapsible: Activity Status ────────────────────────────
        egui::CollapsingHeader::new(egui::RichText::new("Activity").strong())
            .default_open(true)
            .show(ui, |ui| {
                self.render_activity_status(ui);
            });

        // ── Collapsible: Smart Search ───────────────────────────────
        egui::CollapsingHeader::new(egui::RichText::new("Smart Search & Embeddings").strong())
            .default_open(false)
            .show(ui, |ui| {
                self.render_smart_search_status(ui);
            });

        // ── Collapsible: AI Conversation ────────────────────────────
        egui::CollapsingHeader::new(egui::RichText::new("AI Conversation").strong())
            .default_open(false)
            .show(ui, |ui| {
                self.render_conversation_status(ui);
            });

        // ── Collapsible: System & Settings ──────────────────────────
        egui::CollapsingHeader::new(egui::RichText::new("System & Settings").strong())
            .default_open(false)
            .show(ui, |ui| {
                self.render_system_settings(ui);
            });
    }

    // ── Helper: status color ────────────────────────────────────────
    fn status_color(&self, value: f32, warn: f32, critical: f32) -> egui::Color32 {
        if value > critical {
            egui::Color32::RED
        } else if value > warn {
            egui::Color32::YELLOW
        } else {
            egui::Color32::GREEN
        }
    }

    // ── AI Status ───────────────────────────────────────────────────
    fn render_ai_status(&self, ui: &mut egui::Ui) {
        if self.ollama_available {
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("Connected")
                        .color(egui::Color32::GREEN)
                        .strong(),
                );
                if let Some(ref model) = self.current_active_model {
                    ui.label(format!("Model: {}", model));
                }
                if let Some(ref task) = self.current_model_task {
                    ui.small(format!("({})", task));
                }
            });
            if !self.discovered_models.is_empty() {
                ui.small(format!(
                    "{} models discovered",
                    self.discovered_models.len()
                ));
            }
        } else if self.ollama_checking {
            ui.label("Checking connection...");
        } else {
            ui.horizontal(|ui| {
                ui.label(egui::RichText::new("Not connected").color(egui::Color32::YELLOW));
                ui.small("Enable in Settings for AI features");
            });
        }
    }

    // ── Activity Status ─────────────────────────────────────────────
    fn render_activity_status(&mut self, ui: &mut egui::Ui) {
        let mut has_activity = false;

        if self.is_scanning {
            has_activity = true;
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("● Scanning")
                        .color(egui::Color32::YELLOW)
                        .strong(),
                );
                ui.add(
                    egui::ProgressBar::new(self.scan_progress / 100.0)
                        .text(format!("{:.0}%", self.scan_progress)),
                );
            });
        }

        if self.is_indexing {
            has_activity = true;
            ui.horizontal(|ui| {
                ui.label(egui::RichText::new("● Indexing embeddings").color(egui::Color32::YELLOW));
                ui.add(
                    egui::ProgressBar::new(self.indexing_progress / 100.0)
                        .text(format!("{:.0}%", self.indexing_progress)),
                );
            });
        }

        if self.is_deduplicating {
            has_activity = true;
            ui.label(egui::RichText::new("● Finding duplicates...").color(egui::Color32::YELLOW));
        }

        if let Some(ref execution) = self.active_workflow {
            has_activity = true;
            let status_color = match execution.status {
                ExecutionStatus::Running => egui::Color32::YELLOW,
                ExecutionStatus::Completed => egui::Color32::GREEN,
                ExecutionStatus::Failed => egui::Color32::RED,
                _ => egui::Color32::GRAY,
            };
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new(format!("Workflow: {}", execution.workflow_name))
                        .color(status_color)
                        .strong(),
                );
                if execution.status == ExecutionStatus::Running {
                    ui.label(format!(
                        "{}/{}",
                        execution.actions_completed, execution.total_actions
                    ));
                }
            });
        }

        if !self.pending_workflow_actions.is_empty() {
            has_activity = true;
            ui.small(format!(
                "{} pending actions",
                self.pending_workflow_actions.len()
            ));
        }

        if !has_activity {
            ui.label(
                egui::RichText::new("No active processes")
                    .italics()
                    .color(egui::Color32::GRAY),
            );
        }
    }

    // ── Smart Search Status ─────────────────────────────────────────
    fn render_smart_search_status(&self, ui: &mut egui::Ui) {
        if self.cached_embeddings.is_empty() {
            ui.horizontal(|ui| {
                ui.label(egui::RichText::new("No embeddings indexed").italics());
                ui.small("Enable embedding index in Settings to use Smart Search");
            });
        } else {
            ui.horizontal(|ui| {
                ui.label(format!(
                    "{} embeddings indexed",
                    self.cached_embeddings.len()
                ));
                if let Some(scan_id) = self.embedding_scan_id {
                    ui.small(format!("(scan #{}))", scan_id));
                }
            });
            if !self.search_results.is_empty() {
                ui.label(format!(
                    "Last search: {} results",
                    self.search_results.len()
                ));
            }
            if !self.search_status.is_empty() {
                ui.small(&self.search_status);
            }
        }
    }

    // ── Conversation Status ─────────────────────────────────────────
    fn render_conversation_status(&self, ui: &mut egui::Ui) {
        if self.chat_messages.is_empty() {
            ui.label(egui::RichText::new("No conversations yet").italics());
        } else {
            ui.horizontal(|ui| {
                ui.label(format!("{} messages", self.chat_messages.len()));
                ui.separator();
                ui.label(format!(
                    "{} turns of context",
                    self.conversation_history.len()
                ));
                ui.separator();
                ui.label(format!("Tool depth: {}", self.tool_call_depth));
            });
        }
    }

    // ── System & Settings ───────────────────────────────────────────
    fn render_system_settings(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            ui.label(format!("Directory: {}", self.current_path.display()));
            if ui.small_button("Change").clicked() {
                if let Some(path) = rfd::FileDialog::new().pick_folder() {
                    self.current_path = path.clone();
                    self.settings.default_scan_path = path.to_string_lossy().to_string();
                    self.save_settings();
                    self.push_notification("Directory updated", NotificationLevel::Success);
                }
            }
        });
        ui.horizontal(|ui| {
            ui.label(format!("Workflows: {} available", self.workflows.len()));
            ui.separator();
            ui.label(format!("Notifications: {}", self.notifications.len()));
        });
        ui.horizontal(|ui| {
            if self.session_logger.is_enabled() {
                ui.label(egui::RichText::new("Logging: ON").color(egui::Color32::GREEN));
            } else {
                ui.label("Logging: OFF");
                if ui.small_button("Enable").clicked() {
                    self.settings.log_session_to_file = true;
                    self.save_settings();
                    self.push_notification("Logging enabled", NotificationLevel::Success);
                }
            }
        });
    }

    // ── Storage Trend Chart ─────────────────────────────────────────
    fn render_storage_chart(&self, ui: &mut egui::Ui) {
        ui.heading("Storage Trend");

        let timestamps: Vec<chrono::DateTime<chrono::Utc>> = self
            .scan_history
            .iter()
            .filter_map(|r| chrono::DateTime::parse_from_rfc3339(&r.timestamp).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .collect();

        let use_dates = timestamps.len() == self.scan_history.len();

        let size_points: PlotPoints = self
            .scan_history
            .iter()
            .enumerate()
            .map(|(i, r)| {
                let x = if use_dates {
                    timestamps[i].timestamp() as f64
                } else {
                    i as f64
                };
                [x, r.total_size_mb]
            })
            .collect();

        let size_line = Line::new("Size (MB)", size_points)
            .color(egui::Color32::from_rgb(100, 180, 255))
            .width(2.0)
            .fill_alpha(0.15);

        let max_files = self
            .scan_history
            .iter()
            .map(|r| r.total_files as f64)
            .fold(0.0_f64, f64::max);
        let max_size = self
            .scan_history
            .iter()
            .map(|r| r.total_size_mb)
            .fold(0.0_f64, f64::max);

        let file_points: PlotPoints = self
            .scan_history
            .iter()
            .enumerate()
            .map(|(i, r)| {
                let x = if use_dates {
                    timestamps[i].timestamp() as f64
                } else {
                    i as f64
                };
                let normalized = if max_files > 0.0 && max_size > 0.0 {
                    (r.total_files as f64 / max_files) * max_size
                } else {
                    0.0
                };
                [x, normalized]
            })
            .collect();

        let file_line = Line::new("Files (normalized)", file_points)
            .color(egui::Color32::from_rgb(255, 180, 100))
            .width(1.5)
            .style(egui_plot::LineStyle::dashed_dense());

        let threshold_mb = self.settings.large_file_threshold_mb as f64;

        let mut plot = Plot::new("storage_trend")
            .height(200.0)
            .legend(Legend::default())
            .coordinates_formatter(
                Corner::LeftTop,
                CoordinatesFormatter::new(|point, _value| {
                    if use_dates {
                        let ts = point.x as i64;
                        let dt = chrono::DateTime::from_timestamp(ts, 0).unwrap_or_default();
                        format!("{}\n{:.1} MB", dt.format("%Y-%m-%d %H:%M"), point.y)
                    } else {
                        format!("Scan #{:.0}\n{:.1} MB", point.x, point.y)
                    }
                }),
            )
            .show_x(false)
            .show_y(true);

        if use_dates {
            plot = plot.x_axis_label("Date");
        } else {
            plot = plot.x_axis_label("Scan #");
        }
        plot = plot.y_axis_label("Size (MB)");

        plot.show(ui, |plot_ui| {
            plot_ui.line(size_line);
            plot_ui.line(file_line);
            if threshold_mb > 0.0 {
                plot_ui.hline(
                    HLine::new("Large file threshold", threshold_mb)
                        .color(egui::Color32::from_rgb(255, 80, 80))
                        .width(1.5)
                        .style(egui_plot::LineStyle::dashed_dense()),
                );
            }
        });

        ui.horizontal(|ui| {
            if let Some(latest) = self.scan_history.first() {
                ui.small(format!(
                    "Latest: {} files, {:.2} MB",
                    latest.total_files, latest.total_size_mb
                ));
            }
            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if ui.small_button("Export CSV").clicked() {
                    self.export_chart_to_file();
                }
            });
        });
    }

    fn export_chart_to_file(&self) {
        if let Some(path) = rfd::FileDialog::new()
            .set_title("Export Chart Data")
            .add_filter("CSV", &["csv"])
            .save_file()
        {
            let mut csv = String::from("timestamp,total_files,total_size_mb\n");
            for record in &self.scan_history {
                csv.push_str(&format!(
                    "{},{},{:.2}\n",
                    record.timestamp, record.total_files, record.total_size_mb
                ));
            }
            if let Err(e) = std::fs::write(&path, csv) {
                eprintln!("Failed to export chart: {}", e);
            }
        }
    }
}
