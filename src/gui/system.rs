use super::*;
use crate::gui::icons;

impl SpaceAnalyzerApp {
    pub fn refresh_system_info(&mut self) {
        self.system_state.disk_volumes = SystemMonitor::get_disk_volumes();
        self.system_state.system_resources = Some(SystemMonitor::get_system_resources());
        self.system_state.gpu_info = Some(SystemMonitor::detect_gpu());
    }

    pub fn refresh_system_info_throttled(&mut self) {
        if !self.frame_counter.is_multiple_of(120) {
            return;
        }
        self.refresh_system_info();
    }

    pub fn export_results(&self) {
        if let Some(ref result) = self.scan_result {
            if let Some(path) = rfd::FileDialog::new()
                .set_title("Export Scan Results")
                .add_filter("JSON", &["json"])
                .add_filter("CSV", &["csv"])
                .save_file()
            {
                let is_csv = path
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| ext.eq_ignore_ascii_case("csv"))
                    .unwrap_or(false);

                let content = if is_csv {
                    let mut csv = String::from("field,value\n");
                    csv.push_str(&format!("total_files,{}\n", result.total_files));
                    csv.push_str(&format!("total_size_bytes,{}\n", result.total_size_bytes));
                    csv.push_str(&format!("duration_secs,{}\n", result.duration_secs));
                    csv.push_str(&format!("scanned_path,{}\n", result.path));
                    for (ext, count) in &result.file_types {
                        csv.push_str(&format!("file_type_.{},{}\n", ext, count));
                    }
                    for (path, size) in &result.largest_files {
                        csv.push_str(&format!(
                            "largest_file,\"{}|{}\"\n",
                            path.replace('"', "\"\""),
                            size
                        ));
                    }
                    csv
                } else {
                    serde_json::to_string_pretty(result).unwrap_or_default()
                };

                if let Err(e) = std::fs::write(&path, content) {
                    eprintln!("Failed to export scan results: {}", e);
                }
            }
        }
    }

    /// Update running model status based on the latest `/api/ps` payload.
    ///
    /// The previous implementation called `tasklist /FI "IMAGENAME eq ollama.exe"`
    /// every 60 frames, treated ALL discovered models as running if ollama.exe
    /// was found, and estimated VRAM by multiplying the model file size by
    /// 0.8. None of that was accurate — running models show a `size_vram`
    /// value reported by Ollama itself, which is the authoritative source.
    ///
    /// We refresh via `discover_ollama_models` (which now also queries
    /// `/api/ps`) on a 60-frame cadence; the discovery path is the single
    /// source of truth and includes the running-models list.
    pub fn update_model_resource_usage(&mut self) {
        if !self.settings.ollama_enabled || !self.ollama_available {
            return;
        }

        // Throttle to once per ~60 frames (~1s at 60fps) so we're not hammering
        // the API. Uses `is_multiple_of` (Rust 1.84+) on the frame counter.
        if !self.frame_counter.is_multiple_of(60) {
            return;
        }

        // If we don't yet have a running-models snapshot, fetch one. Don't
        // fire if a discovery is already in flight — it would race with
        // the existing one and produce a confusing state.
        if self.running_models.is_empty() && !self.models_discovering {
            self.discover_ollama_models();
        }

        // Project the running-models list onto the discovered models so the
        // System tab can show real VRAM numbers without re-querying.
        for model in &mut self.discovered_models {
            if let Some(running) = self.running_models.iter().find(|r| r.name == model.name) {
                model.is_running = true;
                model.vram_usage_mb = Some(running.size_vram / (1024 * 1024));
                // CPU percent isn't reported by /api/ps (it's an Ollama API
                // gap). Show 0 instead of the previous constant 5.0 estimate
                // — better to be honest about not knowing.
                model.cpu_usage_percent = Some(0.0);
            } else {
                model.is_running = false;
                model.vram_usage_mb = None;
                model.cpu_usage_percent = None;
            }
        }
    }

    pub(crate) fn render_system(&mut self, ui: &mut egui::Ui) {
        // ── Refresh Button ────────────────────────────────────────────
        section_heading(ui, Some(icons::SYSTEM), "System Monitor");
        card_frame(ui.style()).show(ui, |ui| {
            ui.horizontal(|ui| {
                if ui.button(format!("{} Refresh", icons::REFRESH)).clicked() {
                    self.refresh_system_info();
                }
                ui.label(
                    egui::RichText::new("Real-time system resource monitoring")
                        .size(11.0)
                        .color(colors::TEXT_MUTED),
                );
            });
        });

        // ── CPU & Memory ──────────────────────────────────────────────
        if let Some(ref resources) = self.system_state.system_resources {
            section_heading(ui, Some(icons::PERFORMANCE), "CPU & Memory");
            card_frame(ui.style()).show(ui, |ui| {
                // CPU info row
                ui.horizontal(|ui| {
                    ui.label(
                        egui::RichText::new(&resources.cpu_model)
                            .size(11.0)
                            .color(colors::TEXT_SECONDARY),
                    );
                    ui.separator();
                    ui.label(
                        egui::RichText::new(format!(
                            "{} cores ({} physical)",
                            resources.cpu_cores, resources.cpu_physical_cores
                        ))
                        .size(11.0)
                        .color(colors::TEXT_MUTED),
                    );
                });
                ui.add_space(4.0);

                ui.columns(2, |cols| {
                    labeled_gauge(
                        &mut cols[0],
                        "CPU Usage",
                        resources.cpu_percent / 100.0,
                        None,
                    );
                    labeled_gauge(
                        &mut cols[1],
                        "Memory",
                        resources.memory_percent / 100.0,
                        Some(&format!(
                            "{} / {}",
                            formatting::format_bytes(resources.memory_used_bytes),
                            formatting::format_bytes(resources.memory_total_bytes)
                        )),
                    );
                });

                // Swap usage
                if resources.swap_total_bytes > 0 {
                    ui.add_space(4.0);
                    let swap_pct = if resources.swap_total_bytes > 0 {
                        resources.swap_used_bytes as f32 / resources.swap_total_bytes as f32
                    } else {
                        0.0
                    };
                    labeled_gauge(
                        ui,
                        "Swap",
                        swap_pct,
                        Some(&format!(
                            "{} / {}",
                            formatting::format_bytes(resources.swap_used_bytes),
                            formatting::format_bytes(resources.swap_total_bytes)
                        )),
                    );
                }
            });
        }

        // ── Disk Volumes ──────────────────────────────────────────────
        if !self.system_state.disk_volumes.is_empty() {
            section_heading(ui, Some(icons::DISK), "Disk Volumes");
            card_frame(ui.style()).show(ui, |ui| {
                for volume in &self.system_state.disk_volumes {
                    labeled_gauge(
                        ui,
                        &format!("{} ({})", volume.mount_point, volume.name),
                        volume.usage_percent / 100.0,
                        Some(&format!(
                            "{} free of {}",
                            formatting::format_bytes(volume.available_bytes),
                            formatting::format_bytes(volume.total_bytes)
                        )),
                    );
                    ui.add_space(4.0);
                }
            });
        }

        // ── GPU ───────────────────────────────────────────────────────
        if let Some(ref gpu) = self.system_state.gpu_info {
            section_heading(ui, Some(icons::PERFORMANCE), "GPU");
            card_frame(ui.style()).show(ui, |ui| {
                if gpu.available {
                    ui.horizontal(|ui| {
                        badge(
                            ui,
                            gpu.name.as_deref().unwrap_or("Unknown"),
                            colors::SUCCESS,
                        );
                        if let Some(vram) = gpu.vram_bytes {
                            badge(
                                ui,
                                &format!("VRAM: {}", formatting::format_bytes(vram)),
                                colors::ACCENT,
                            );
                        }
                    });
                } else {
                    ui.label(
                        egui::RichText::new("No NVIDIA GPU detected — using CPU fallback")
                            .color(colors::TEXT_MUTED),
                    );
                }
            });
        }

        // ── AI Model Resource Usage ───────────────────────────────────
        if self.settings.ollama_enabled && self.ollama_available {
            section_heading(ui, Some(icons::MODEL), "AI Model Resource Usage");
            card_frame(ui.style()).show(ui, |ui| {
                let mut any_running = false;
                for model in &self.discovered_models {
                    if model.is_running {
                        any_running = true;
                        ui.horizontal(|ui| {
                            badge(ui, &model.name, colors::WARNING);
                            badge(ui, "Running", colors::SUCCESS);
                        });

                        if let Some(vram) = model.vram_usage_mb {
                            labeled_gauge(
                                ui,
                                "VRAM Usage",
                                if let Some(gpu_vram) = self
                                    .system_state
                                    .gpu_info
                                    .as_ref()
                                    .and_then(|g| g.vram_bytes)
                                {
                                    (vram as f32 / gpu_vram as f32).min(1.0)
                                } else {
                                    0.0
                                },
                                Some(&format!("{} MB", vram)),
                            );
                        }

                        ui.horizontal(|ui| {
                            if let Some(cpu) = model.cpu_usage_percent {
                                ui.label(
                                    egui::RichText::new(format!("CPU: {:.1}%", cpu))
                                        .size(11.0)
                                        .color(colors::TEXT_SECONDARY),
                                );
                            }
                            if let Some(tokens) = model.performance_metrics.tokens_per_second {
                                ui.label(
                                    egui::RichText::new(format!("~{:.0} tok/s", tokens))
                                        .size(11.0)
                                        .color(colors::TEXT_SECONDARY),
                                );
                            }
                        });
                        ui.add_space(4.0);
                    }
                }

                if !any_running {
                    ui.label(
                        egui::RichText::new("No AI models currently running")
                            .italics()
                            .color(colors::TEXT_MUTED),
                    );
                }

                // Total AI resource impact
                let total_vram: u64 = self
                    .discovered_models
                    .iter()
                    .filter(|m| m.is_running)
                    .filter_map(|m| m.vram_usage_mb)
                    .sum();
                let total_cpu: f32 = self
                    .discovered_models
                    .iter()
                    .filter(|m| m.is_running)
                    .filter_map(|m| m.cpu_usage_percent)
                    .sum();

                if total_vram > 0 || total_cpu > 0.0 {
                    ui.separator();
                    ui.horizontal(|ui| {
                        ui.label(
                            egui::RichText::new("Total AI Impact:")
                                .strong()
                                .color(colors::TEXT_SECONDARY),
                        );
                        if total_vram > 0 {
                            badge(ui, &format!("VRAM: {} MB", total_vram), colors::WARNING);
                        }
                        if total_cpu > 0.0 {
                            badge(ui, &format!("CPU: {:.1}%", total_cpu), colors::WARNING);
                        }
                    });
                }
            });
        }
    }
}
