use super::*;
use eframe::egui;
use egui_plot::{CoordinatesFormatter, Corner, HLine, Legend, Line, Plot, PlotPoints};

impl SpaceAnalyzerApp {
    pub(crate) fn render_dashboard(&mut self, ui: &mut egui::Ui) {
        self.render_dashboard_header(ui);
        self.render_disk_alert(ui);
        self.render_hero_stats(ui);

        let is_compact = ui.available_width() < 980.0;
        if is_compact {
            ui.vertical(|ui| {
                ui.add_space(8.0);
                self.render_storage_by_volume(ui);
                ui.add_space(8.0);
                self.render_quick_actions(ui);
                ui.add_space(8.0);
                self.render_system_resources_card(ui);
                ui.add_space(8.0);
                self.render_file_type_chart(ui);
                ui.add_space(8.0);
                self.render_categories_card(ui);
                ui.add_space(8.0);
                self.render_bloat_card(ui);
                if !self.ai_recommendations.is_empty() {
                    ui.add_space(8.0);
                    self.render_recommendations_card(ui);
                }
                if self.scan_history.len() >= 2 {
                    ui.add_space(8.0);
                    self.render_trend_card(ui);
                }
            });
        } else {
            ui.columns(2, |cols| {
                let left = &mut cols[0];
                left.add_space(8.0);
                self.render_storage_by_volume(left);
                left.add_space(8.0);
                self.render_file_type_chart(left);
                left.add_space(8.0);
                self.render_categories_card(left);
                left.add_space(8.0);
                self.render_bloat_card(left);
                if !self.ai_recommendations.is_empty() {
                    left.add_space(8.0);
                    self.render_recommendations_card(left);
                }

                let right = &mut cols[1];
                right.add_space(8.0);
                self.render_quick_actions(right);
                right.add_space(8.0);
                self.render_system_resources_card(right);
                if self.scan_history.len() >= 2 {
                    right.add_space(8.0);
                    self.render_trend_card(right);
                }
            });
        }
    }

    fn render_dashboard_header(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            ui.vertical(|ui| {
                ui.label(
                    egui::RichText::new("Storage overview")
                        .text_style(egui::TextStyle::Name("PageTitle".into()))
                        .color(colors::TEXT_PRIMARY),
                );
                ui.label(
                    egui::RichText::new(
                        "Review disk health, recent scans, and cleanup opportunities.",
                    )
                    .color(colors::TEXT_SECONDARY)
                    .small(),
                );
            });

            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                if secondary_button(ui, "View history").clicked() {
                    self.active_tab = AppTab::History;
                }
                if primary_button(ui, "Start a scan").clicked() {
                    self.active_tab = AppTab::Scan;
                    self.start_scan();
                }
            });
        });
        ui.add_space(12.0);
    }

    fn render_disk_alert(&mut self, ui: &mut egui::Ui) {
        if let Some(volume) = self
            .system_state
            .disk_volumes
            .iter()
            .filter(|v| v.usage_percent >= 90.0)
            .max_by(|a, b| a.usage_percent.total_cmp(&b.usage_percent))
        {
            ui.add_space(4.0);
            let _ = inline_alert(
                ui,
                Tone::Danger,
                &format!("{} is nearly full", volume.mount_point),
                &format!(
                    "Only {} is free. Run a scan to identify large files and cleanup opportunities.",
                    formatting::format_bytes(volume.available_bytes)
                ),
                Some(&format!("Analyze {}", volume.mount_point)),
            );
            ui.add_space(4.0);
        }
    }

    // ── Hero Stats Row ────────────────────────────────────────────────────
    fn render_hero_stats(&self, ui: &mut egui::Ui) {
        ui.horizontal_wrapped(|ui| {
            if let Some(ref result) = self.scan_result {
                stat_card(
                    ui,
                    "Total Files",
                    &format!("{}", result.total_files),
                    colors::ACCENT,
                );

                stat_card(
                    ui,
                    "Total Size",
                    &formatting::format_bytes(result.total_size_bytes),
                    colors::SUCCESS,
                );

                stat_card(
                    ui,
                    "Scans",
                    &format!("{}", self.scan_history.len()),
                    colors::INFO,
                );
                if let Some(last) = self.scan_history.last() {
                    stat_card(
                        ui,
                        "Last Scan",
                        &last.timestamp[..last.timestamp.len().min(16)],
                        colors::SUCCESS,
                    );
                }

                let threshold = self.settings.large_file_threshold_mb * 1024 * 1024;
                let large_count = result
                    .largest_files
                    .iter()
                    .filter(|(_, size)| *size > threshold)
                    .count();
                if large_count > 0 {
                    stat_card(
                        ui,
                        &format!("Large (>{ }MB)", self.settings.large_file_threshold_mb),
                        &format!("{}", large_count),
                        colors::WARNING,
                    );
                }

                if result.duration_secs > 0.0 {
                    stat_card(
                        ui,
                        "Speed",
                        &format!("{:.0}/s", result.total_files as f64 / result.duration_secs),
                        colors::ACCENT,
                    );
                }
            } else {
                stat_card(ui, "Total Files", "0", colors::TEXT_MUTED);
                stat_card(ui, "Total Size", "0 B", colors::TEXT_MUTED);
                stat_card(
                    ui,
                    "Scans",
                    &format!("{}", self.scan_history.len()),
                    colors::INFO,
                );
            }
        });
    }

    // ── Storage by volume ──────────────────────────────────────────────
    fn render_storage_by_volume(&self, ui: &mut egui::Ui) {
        section_header(ui, Some(icons::DISK), "Storage by volume");
        app_card(ui, |ui| {
            if self.system_state.disk_volumes.is_empty() {
                ui.label(
                    egui::RichText::new("No volume data available yet.")
                        .italics()
                        .color(colors::TEXT_MUTED),
                );
                return;
            }
            ui.vertical(|ui| {
                for vol in &self.system_state.disk_volumes {
                    self.render_volume_row(ui, vol);
                    ui.add_space(6.0);
                }
            });
        });
        ui.add_space(4.0);
    }

    fn render_volume_row(
        &self,
        ui: &mut egui::Ui,
        vol: &system_monitor::DiskVolume,
    ) -> egui::Response {
        let tone = if vol.usage_percent >= 90.0 {
            Tone::Danger
        } else if vol.usage_percent >= 75.0 {
            Tone::Warning
        } else {
            Tone::Success
        };
        let bar_color = tone.fill();
        let pct = (vol.usage_percent / 100.0).clamp(0.0, 1.0);

        let response = app_card(ui, |ui| {
            ui.vertical(|ui| {
                ui.horizontal(|ui| {
                    ui.vertical(|ui| {
                        ui.label(
                            egui::RichText::new(&vol.mount_point)
                                .strong()
                                .color(colors::TEXT_PRIMARY),
                        );
                        ui.label(
                            egui::RichText::new(&vol.name)
                                .size(11.0)
                                .color(colors::TEXT_MUTED),
                        );
                    });

                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        status_badge(ui, &format!("{:.1}% used", vol.usage_percent), tone);
                    });
                });

                ui.add_space(8.0);
                ui.add(
                    egui::ProgressBar::new(pct)
                        .fill(bar_color)
                        .desired_height(9.0)
                        .show_percentage(),
                );

                ui.add_space(6.0);
                ui.horizontal(|ui| {
                    ui.label(
                        egui::RichText::new(format!(
                            "{} free of {}",
                            formatting::format_bytes(vol.available_bytes),
                            formatting::format_bytes(vol.total_bytes)
                        ))
                        .size(11.0)
                        .color(colors::TEXT_SECONDARY),
                    );
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        ui.label(
                            egui::RichText::new(vol.file_system.clone())
                                .size(10.0)
                                .color(colors::TEXT_MUTED),
                        );
                    });
                });
            });
        })
        .response;

        response.on_hover_text(format!("Click to scan {}", vol.mount_point))
    }

    // ── Quick Actions ─────────────────────────────────────────────────────
    fn render_quick_actions(&mut self, ui: &mut egui::Ui) {
        section_header(ui, Some(icons::QUICK), "Quick actions");
        app_card(ui, |ui| {
            ui.horizontal_wrapped(|ui| {
                let scan_text = if self.is_scanning {
                    "Scanning..."
                } else {
                    "Start scan"
                };
                if primary_button(ui, scan_text).clicked() {
                    self.active_tab = AppTab::Scan;
                    if !self.is_scanning {
                        self.start_scan();
                    }
                }

                if secondary_button(ui, "View history").clicked() {
                    self.active_tab = AppTab::History;
                }

                if secondary_button(ui, "Workflows").clicked() {
                    self.active_tab = AppTab::Workflows;
                }

                if secondary_button(ui, "AI assistant").clicked() {
                    self.active_tab = AppTab::AIChat;
                }
            });
        });
        ui.add_space(4.0);
    }

    // ── File Type Distribution Chart ──────────────────────────────────
    fn render_file_type_chart(&self, ui: &mut egui::Ui) {
        section_header(ui, Some(icons::CHART_BAR), "File type distribution");
        app_card(ui, |ui| {
            if let Some(ref result) = self.scan_result {
                let mut sorted: Vec<(&String, &usize)> = result.file_types.iter().collect();
                sorted.sort_by(|a, b| b.1.cmp(a.1));
                let top_n = sorted.iter().take(10);

                let bar_points: PlotPoints = top_n
                    .enumerate()
                    .map(|(i, (_ext, count))| {
                        let x = i as f64;
                        let y = **count as f64;
                        [x, y]
                    })
                    .collect();

                let bar_line = Line::new("File count", bar_points)
                    .color(colors::ACCENT)
                    .width(3.0)
                    .fill_alpha(0.3);

                let mut plot = Plot::new("file_type_dist")
                    .height(140.0)
                    .legend(Legend::default())
                    .show_x(false)
                    .show_y(true)
                    .y_axis_label("File count");

                plot = plot.x_axis_label("Extension");

                plot.show(ui, |plot_ui| {
                    plot_ui.line(bar_line);
                });

                ui.horizontal(|ui| {
                    for (ext, count) in sorted.iter().take(10) {
                        ui.colored_label(
                            egui::Color32::from_rgb(
                                category::category_color(ext).0,
                                category::category_color(ext).1,
                                category::category_color(ext).2,
                            ),
                            format!(".{}: {}", ext, count),
                        );
                    }
                });
            } else {
                ui.label(
                    egui::RichText::new("Run a scan to see file type distribution")
                        .italics()
                        .color(colors::TEXT_MUTED),
                );
            }
        });
        ui.add_space(4.0);
    }

    // ── File Categories Card ──────────────────────────────────────────────
    fn render_categories_card(&self, ui: &mut egui::Ui) {
        section_header(ui, Some(icons::FOLDER), "File categories");
        app_card(ui, |ui| {
            if let Some(ref result) = self.scan_result {
                let categories = category::categorize_files(&result.file_types);
                let total: usize = categories.values().sum();
                if total == 0 {
                    ui.label(
                        egui::RichText::new("No categorized files in last scan")
                            .italics()
                            .color(colors::TEXT_MUTED),
                    );
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
                        let bar_pct = (pct / 100.0) as f32;

                        ui.vertical(|ui| {
                            ui.horizontal(|ui| {
                                ui.colored_label(
                                    egui::Color32::from_rgb(r, g, b),
                                    format!("{:>12}", cat),
                                );
                                ui.label(
                                    egui::RichText::new(format!("{} ({:.1}%)", count, pct))
                                        .size(11.0)
                                        .color(colors::TEXT_SECONDARY),
                                );
                            });
                            gauge_bar(ui, bar_pct, ui.available_width(), 4.0);
                        });
                        ui.add_space(2.0);
                    }
                }
            } else {
                ui.label(
                    egui::RichText::new("Run a scan to see file categories")
                        .italics()
                        .color(colors::TEXT_MUTED),
                );
            }
        });
    }

    // ── Bloat Candidates Card ─────────────────────────────────────────────
    fn render_bloat_card(&self, ui: &mut egui::Ui) {
        section_header(ui, Some(icons::QUICK), "Bloat candidates");
        app_card(ui, |ui| {
            if let Some(ref result) = self.scan_result {
                let classifier = offline_ai::FilePatternClassifier::new();
                let mut flagged: Vec<(String, String, usize)> = Vec::new();
                for (ext, count) in &result.file_types {
                    if let Some(rule) = classifier.classify_file(ext, 0) {
                        flagged.push((ext.clone(), rule.name.clone(), *count));
                    }
                }
                if flagged.is_empty() {
                    ui.label(
                        egui::RichText::new("No bloat patterns detected — looking good!")
                            .italics()
                            .color(colors::SUCCESS),
                    );
                } else {
                    for (ext, name, count) in flagged.iter().take(5) {
                        ui.horizontal(|ui| {
                            badge(ui, &format!(".{}", ext), colors::WARNING);
                            ui.label(
                                egui::RichText::new(format!("{} — {} file(s)", name, count))
                                    .size(11.0),
                            );
                        });
                    }
                }
            } else {
                ui.label(
                    egui::RichText::new("Run a scan to detect bloat")
                        .italics()
                        .color(colors::TEXT_MUTED),
                );
            }
        });
    }

    // ── System Resources Card ─────────────────────────────────────────────
    fn render_system_resources_card(&self, ui: &mut egui::Ui) {
        section_header(ui, Some(icons::SYSTEM), "System resources");
        app_card(ui, |ui| {
            if let Some(ref sys) = self.system_state.system_resources {
                ui.columns(2, |cols| {
                    labeled_gauge(&mut cols[0], "CPU", sys.cpu_percent / 100.0, None);
                    labeled_gauge(
                        &mut cols[1],
                        "Memory",
                        sys.memory_percent / 100.0,
                        Some(&format!(
                            "{} / {}",
                            formatting::format_bytes(sys.memory_used_bytes),
                            formatting::format_bytes(sys.memory_total_bytes)
                        )),
                    );
                });

                if let Some(ref gpu) = self.system_state.gpu_info {
                    ui.add_space(4.0);
                    ui.separator();
                    ui.horizontal(|ui| {
                        ui.label(
                            egui::RichText::new("GPU:")
                                .size(12.0)
                                .color(colors::TEXT_SECONDARY),
                        );
                        if gpu.available {
                            badge(
                                ui,
                                gpu.name.as_deref().unwrap_or("Unknown"),
                                colors::SUCCESS,
                            );
                        } else {
                            badge(ui, "CPU Only", colors::TEXT_MUTED);
                        }
                    });
                }
            } else {
                ui.label(
                    egui::RichText::new("Loading system info...")
                        .italics()
                        .color(colors::TEXT_MUTED),
                );
            }
        });
    }

    // ── Storage Trend Card ────────────────────────────────────────────────
    fn render_trend_card(&self, ui: &mut egui::Ui) {
        section_header(ui, Some(icons::TREND), "Storage trend");
        app_card(ui, |ui| {
            self.render_storage_chart_inner(ui);
        });
    }

    // ── Recommendations Card ──────────────────────────────────────────────
    fn render_recommendations_card(&self, ui: &mut egui::Ui) {
        let source_label = if self.ai_recommendation_source == "ai" {
            format!("{} AI", icons::MODEL)
        } else {
            format!("{} Heuristic", icons::WORKFLOW)
        };

        section_header(
            ui,
            Some(icons::LIGHTBULB),
            &format!("Insights ({})", source_label),
        );
        app_card(ui, |ui| {
            if self.ai_recommendation_pending {
                ui.horizontal(|ui| {
                    ui.spinner();
                    ui.label(
                        egui::RichText::new("Generating AI recommendations…")
                            .italics()
                            .color(colors::TEXT_SECONDARY),
                    );
                });
            } else {
                for rec in self.ai_recommendations.iter().take(3) {
                    let (priority_color, priority_bg) = match rec.priority {
                        RecommendationPriority::Critical => (
                            colors::PRIORITY_CRITICAL,
                            colors::PRIORITY_CRITICAL.linear_multiply(0.15),
                        ),
                        RecommendationPriority::High => (
                            colors::PRIORITY_HIGH,
                            colors::PRIORITY_HIGH.linear_multiply(0.15),
                        ),
                        RecommendationPriority::Medium => (
                            colors::PRIORITY_MEDIUM,
                            colors::PRIORITY_MEDIUM.linear_multiply(0.15),
                        ),
                        RecommendationPriority::Low => (
                            colors::PRIORITY_LOW,
                            colors::PRIORITY_LOW.linear_multiply(0.15),
                        ),
                    };

                    egui::Frame::NONE
                        .fill(priority_bg)
                        .corner_radius(egui::CornerRadius::same(8))
                        .inner_margin(egui::Margin::symmetric(12, 8))
                        .show(ui, |ui| {
                            ui.horizontal(|ui| {
                                badge(ui, &format!("{:?}", rec.priority), priority_color);
                                ui.label(
                                    egui::RichText::new(&rec.title)
                                        .strong()
                                        .color(colors::TEXT_PRIMARY),
                                );
                            });
                            ui.label(
                                egui::RichText::new(&rec.description)
                                    .size(11.0)
                                    .color(colors::TEXT_SECONDARY),
                            );
                        });
                    ui.add_space(4.0);
                }
            }
        });
    }

    // ── Storage Trend Chart (inner) ───────────────────────────────────────
    fn render_storage_chart_inner(&self, ui: &mut egui::Ui) {
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
            .color(colors::ACCENT)
            .width(2.5)
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
            .color(colors::PRIORITY_HIGH)
            .width(1.5)
            .style(egui_plot::LineStyle::dashed_dense());

        let threshold_mb = self.settings.large_file_threshold_mb as f64;

        let mut plot = Plot::new("storage_trend")
            .height(160.0)
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
                        .color(colors::ERROR)
                        .width(1.5)
                        .style(egui_plot::LineStyle::dashed_dense()),
                );
            }
        });

        ui.horizontal(|ui| {
            if let Some(latest) = self.scan_history.first() {
                ui.label(
                    egui::RichText::new(format!(
                        "Latest: {} files, {:.2} MB",
                        latest.total_files, latest.total_size_mb
                    ))
                    .size(11.0)
                    .color(colors::TEXT_SECONDARY),
                );
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
