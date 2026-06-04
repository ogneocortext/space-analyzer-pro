use super::*;

impl SpaceAnalyzerApp {
    pub fn refresh_system_info(&mut self) {
        self.disk_volumes = SystemMonitor::get_disk_volumes();
        self.system_resources = Some(SystemMonitor::get_system_resources());
        self.gpu_info = Some(SystemMonitor::detect_gpu());
    }

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

    /// Update running model status based on system monitoring
    pub fn update_model_resource_usage(&mut self) {
        if !self.settings.ollama_enabled || !self.ollama_available {
            return;
        }

        // Throttle tasklist subprocess to once per ~60 frames (~1s at 60fps)
        if !self.frame_counter.is_multiple_of(60) {
            return;
        }

        // Check if any Ollama models are running via nvidia-smi or process list
        #[cfg(windows)]
        {
            // Check for ollama process
            if let Ok(output) = std::process::Command::new("tasklist")
                .args(["/FI", "IMAGENAME eq ollama.exe", "/NH", "/FO", "CSV"])
                .output()
            {
                let output_str = String::from_utf8_lossy(&output.stdout);
                let is_running = output_str.contains("ollama.exe");

                for model in &mut self.discovered_models {
                    model.is_running = is_running;
                    if is_running {
                        // Estimate VRAM usage based on model size
                        if let Some(size_gb) = model
                            .size
                            .split_whitespace()
                            .next()
                            .and_then(|s| s.parse::<f32>().ok())
                        {
                            model.vram_usage_mb = Some((size_gb * 1024.0 * 0.8) as u64);
                            // ~80% of model size in VRAM
                        }
                        model.cpu_usage_percent = Some(5.0); // Estimate
                    } else {
                        model.vram_usage_mb = None;
                        model.cpu_usage_percent = None;
                    }
                }
            }
        }
    }

    pub(crate) fn render_system(&mut self, ui: &mut egui::Ui) {
        // ── Refresh Button ────────────────────────────────────────────
        section_heading(ui, Some('🖥'), "System Monitor");
        card_frame(ui.style()).show(ui, |ui| {
            ui.horizontal(|ui| {
                if ui.button("🔄 Refresh").clicked() {
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
        if let Some(ref resources) = self.system_resources {
            section_heading(ui, Some('💻'), "CPU & Memory");
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
            });
        }

        // ── Disk Volumes ──────────────────────────────────────────────
        if !self.disk_volumes.is_empty() {
            section_heading(ui, Some('💾'), "Disk Volumes");
            card_frame(ui.style()).show(ui, |ui| {
                for volume in &self.disk_volumes {
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
        if let Some(ref gpu) = self.gpu_info {
            section_heading(ui, Some('🎮'), "GPU");
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
            section_heading(ui, Some('🤖'), "AI Model Resource Usage");
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
                                if let Some(gpu_vram) =
                                    self.gpu_info.as_ref().and_then(|g| g.vram_bytes)
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
