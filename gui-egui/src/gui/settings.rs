use super::*;
use crate::gui::icons;

impl SpaceAnalyzerApp {
    pub(crate) fn save_settings(&mut self) {
        if let Some(ref db) = self.db {
            let _ = db.save_all_settings(&self.settings);
        }

        // Update session logger configuration based on current settings
        let current_path = PathBuf::from(&self.settings.log_file_path);
        let was_enabled = self.session_logger.is_enabled();
        let should_enable = self.settings.log_session_to_file;

        // Reinitialize the logger whenever settings change
        if should_enable != was_enabled {
            let new_config = session_logger::SessionLoggerConfig {
                log_path: current_path,
                enabled: should_enable,
                ..Default::default()
            };
            let mut new_logger = session_logger::SessionLogger::new(new_config);
            if should_enable {
                new_logger.info("app", "Session logging (re)started from settings");
            }
            new_logger.flush();
            self.session_logger = new_logger;
        }
    }

    fn render_scan_settings(&mut self, ui: &mut egui::Ui) {
        ui.horizontal(|ui| {
            ui.label("Default Scan Path:");
            ui.text_edit_singleline(&mut self.settings.default_scan_path);
        });
        ui.checkbox(&mut self.settings.default_deep_scan, "Default to Deep Scan");
        ui.horizontal(|ui| {
            ui.label("Max Scan Depth:");
            ui.add(egui::DragValue::new(&mut self.settings.max_scan_depth).range(1..=20));
        });
        ui.horizontal(|ui| {
            ui.label("Large File Threshold (MB):");
            ui.add(
                egui::DragValue::new(&mut self.settings.large_file_threshold_mb).range(1..=10000),
            );
        });
    }

    fn render_gpu_settings(&mut self, ui: &mut egui::Ui) {
        ui.checkbox(
            &mut self.settings.gpu_acceleration,
            "Enable GPU Acceleration for Scan Processing",
        );
        if self.settings.gpu_acceleration {
            ui.indent("gpu_options", |ui| {
                ui.checkbox(
                    &mut self.settings.cuda_enabled,
                    "Enable CUDA Kernels (requires CUDA toolkit at compile time)",
                );
                ui.checkbox(
                    &mut self.settings.dedup_use_gpu,
                    "Use GPU for Deduplication Hashing",
                );

                ui.separator();
                ui.label(
                    egui::RichText::new("GPU Operations:")
                        .size(11.0)
                        .color(colors::TEXT_SECONDARY),
                );
                ui.label(
                    egui::RichText::new("• BLAKE3 batch hashing for deduplication")
                        .size(11.0)
                        .color(colors::TEXT_MUTED),
                );
                ui.label(
                    egui::RichText::new("• Scan post-processing, ML predictions")
                        .size(11.0)
                        .color(colors::TEXT_MUTED),
                );

                if let Some(ref gpu) = self.system_state.gpu_info {
                    ui.separator();
                    if let Some(ref name) = gpu.name {
                        badge(ui, &format!("Detected: {}", name), colors::SUCCESS);
                    }
                    if let Some(vram) = gpu.vram_bytes {
                        badge(
                            ui,
                            &format!("VRAM: {} MB", vram / 1_048_576),
                            colors::ACCENT,
                        );
                    }
                } else {
                    ui.label(
                        egui::RichText::new("No GPU detected — using CPU fallback")
                            .color(colors::TEXT_MUTED),
                    );
                    ui.label(
                        egui::RichText::new("GPU acceleration requires NVIDIA GPU with nvidia-smi")
                            .size(10.0)
                            .color(colors::TEXT_MUTED),
                    );
                }
            });
        } else {
            ui.label(
                egui::RichText::new(
                    "GPU acceleration is disabled. Enable to use NVIDIA GPU for faster processing.",
                )
                .size(10.0)
                .color(colors::TEXT_MUTED),
            );
        }
    }

    fn render_ai_settings(&mut self, ui: &mut egui::Ui) {
        ui.checkbox(&mut self.settings.ollama_enabled, "Enable Ollama AI");
        if self.settings.ollama_enabled {
            ui.indent("ollama_options", |ui| {
                ui.horizontal(|ui| {
                    ui.label("Ollama URL:");
                    ui.text_edit_singleline(&mut self.settings.ollama_url);
                });

                // Show availability status
                if self.ollama_available {
                    badge(ui, "Ollama Connected", colors::SUCCESS);
                } else if self.ollama_checking {
                    badge(ui, "Checking...", colors::TEXT_MUTED);
                } else if let Some(ref error) = self.last_ollama_error {
                    badge(ui, &format!("Unavailable: {}", error), colors::WARNING);
                } else {
                    badge(ui, "Not Connected", colors::WARNING);
                }

                ui.horizontal(|ui| {
                    if secondary_button(ui, "Check Connection").clicked() {
                        self.check_ollama();
                    }
                    if secondary_button(ui, "Start Ollama").clicked() {
                        self.start_ollama_process();
                    }
                });

                ui.separator();
                ui.label(
                    egui::RichText::new("Feature Toggles")
                        .strong()
                        .color(colors::TEXT_PRIMARY),
                );
                ui.checkbox(
                    &mut self.settings.agentic_tools_enabled,
                    "Enable Agentic Tool Calling",
                );
                ui.checkbox(
                    &mut self.settings.ai_recommendation_enabled,
                    "AI-Powered Recommendations (uses Ollama)",
                );
                ui.checkbox(
                    &mut self.settings.ai_features_panel_visible,
                    "Show 'AI Tools' panel in the AI Assistant tab",
                )
                .on_hover_text(
                    "Capability-driven buttons: semantic search (embedding), \
                     summarize scan (completion), cleanup plan (thinking), \
                     describe screenshot (vision). Each one targets one Ollama \
                     capability and shows the data flow (tokens, duration, payload).",
                );
                ui.checkbox(
                    &mut self.settings.auto_model_selection,
                    "Auto-select model based on task",
                );
                ui.checkbox(
                    &mut self.settings.auto_start_ollama,
                    "Auto-start Ollama when needed",
                );
                ui.checkbox(
                    &mut self.settings.ollama_think,
                    "Enable Deep Thinking / Reasoning (Ollama 0.30+)",
                );

                ui.separator();
                ui.label(
                    egui::RichText::new("Model Configuration")
                        .strong()
                        .color(colors::TEXT_PRIMARY),
                );

                ui.horizontal(|ui| {
                    ui.label("Chat Model:");
                    ui.add(
                        egui::TextEdit::singleline(&mut self.settings.ollama_model)
                            .hint_text("e.g. llama3.2"),
                    );
                });

                ui.horizontal(|ui| {
                    ui.label("Tool Calling Model:");
                    ui.add(
                        egui::TextEdit::singleline(&mut self.settings.tool_calling_model)
                            .hint_text("e.g. functionary-small-v3.1"),
                    );
                });

                if self.settings.agentic_tools_enabled {
                    let has_tool_capability = self
                        .discovered_models
                        .iter()
                        .filter(|m| m.name == self.settings.tool_calling_model)
                        .any(|m| m.capabilities.iter().any(|c| c == "Tool Calling"));
                    if !has_tool_capability {
                        badge(
                            ui,
                            "Warning: Selected model may not support tool calling",
                            colors::WARNING,
                        );
                    }

                    ui.horizontal(|ui| {
                        ui.label("Tool Choice:");
                        egui::ComboBox::from_id_salt("tool_choice")
                            .selected_text(&self.settings.tool_choice)
                            .show_ui(ui, |ui| {
                                ui.selectable_value(
                                    &mut self.settings.tool_choice,
                                    "auto".to_string(),
                                    "auto (model decides)",
                                );
                                ui.selectable_value(
                                    &mut self.settings.tool_choice,
                                    "none".to_string(),
                                    "none (no tool calls)",
                                );
                                ui.selectable_value(
                                    &mut self.settings.tool_choice,
                                    "required".to_string(),
                                    "required (must use tools)",
                                );
                            });
                    });
                }

                ui.label(
                    egui::RichText::new(
                        "Use the model list below to select models for chat and tools.",
                    )
                    .size(11.0)
                    .color(colors::TEXT_MUTED),
                );

                ui.separator();
                ui.label(
                    egui::RichText::new("Installed Models")
                        .strong()
                        .color(colors::TEXT_PRIMARY),
                );
                self.render_ollama_model_list(ui);

                ui.separator();
                if secondary_button(ui, "Test Connection")
                    .on_hover_text(
                        "Probe the Ollama server, fetch the version, and clear any stale error",
                    )
                    .clicked()
                {
                    self.ollama_checking = true;
                    self.last_ollama_error = None;
                    self.check_ollama();
                }
            });
        }
    }

    fn render_smart_search_settings(&mut self, ui: &mut egui::Ui) {
        ui.checkbox(
            &mut self.settings.embedding_enabled,
            "Enable Semantic Indexing",
        );
        if self.settings.embedding_enabled {
            ui.indent("embedding_options", |ui| {
                ui.horizontal(|ui| {
                    ui.label("Embedding Model:");
                    ui.text_edit_singleline(&mut self.settings.embedding_model);
                });
                ui.horizontal(|ui| {
                    ui.label("Batch Size:");
                    ui.add(egui::DragValue::new(&mut self.settings.embedding_batch_size).range(1..=128));
                });
                ui.horizontal(|ui| {
                    ui.label("File Limit:");
                    let mut limit = self.settings.embedding_file_limit;
                    ui.add(egui::DragValue::new(&mut limit).range(0..=10000).speed(50));
                    self.settings.embedding_file_limit = limit;
                    let hint = if limit == 0 { "All files" } else { &format!("{} files", limit) };
                    ui.label(
                        egui::RichText::new(hint)
                            .size(11.0)
                            .color(colors::TEXT_MUTED),
                    );
                });
                ui.label(
                    egui::RichText::new("Uses nomic-embed-text or similar model. Set limit to 0 to index all files.")
                        .size(11.0)
                        .color(colors::TEXT_MUTED),
                );
            });
        }
    }

    fn render_logging_settings(&mut self, ui: &mut egui::Ui) {
        ui.checkbox(
            &mut self.settings.log_session_to_file,
            "Enable Session Logging",
        );
        if self.settings.log_session_to_file {
            ui.indent("log_options", |ui| {
                ui.horizontal(|ui| {
                    ui.label("Log File Path:");
                    ui.text_edit_singleline(&mut self.settings.log_file_path);
                });
                ui.label(
                    egui::RichText::new("Logs all user interactions for automated flow testing and issue detection.")
                        .size(11.0)
                        .color(colors::TEXT_MUTED),
                );
            });
        }
    }

    pub(crate) fn render_settings(&mut self, ui: &mut egui::Ui) {
        section_heading(ui, Some(icons::SETTINGS), "Settings");

        // Scan Settings
        section_heading(ui, None, "Scan");
        card_frame(ui.style()).show(ui, |ui| {
            self.render_scan_settings(ui);
        });

        // GPU Settings
        section_heading(ui, Some(icons::PERFORMANCE), "GPU / CUDA");
        card_frame(ui.style()).show(ui, |ui| {
            self.render_gpu_settings(ui);
        });

        // AI Settings
        section_heading(ui, Some(icons::MODEL), "AI (Ollama)");
        card_frame(ui.style()).show(ui, |ui| {
            self.render_ai_settings(ui);
        });

        // Smart Search Settings
        section_heading(
            ui,
            Some(icons::SMART_SEARCH),
            "Smart Search (Semantic File Search)",
        );
        card_frame(ui.style()).show(ui, |ui| {
            self.render_smart_search_settings(ui);
        });

        // Logging Settings
        section_heading(ui, Some(icons::HISTORY), "Session Logging");
        card_frame(ui.style()).show(ui, |ui| {
            self.render_logging_settings(ui);
        });

        // Save Button
        ui.add_space(4.0);
        card_frame(ui.style()).show(ui, |ui| {
            if ui
                .add(
                    egui::Button::new(
                        egui::RichText::new(format!("{}  Save Settings", icons::DISK))
                            .size(13.0)
                            .strong()
                            .color(colors::BG_APP),
                    )
                    .min_size(egui::vec2(160.0, 36.0))
                    .fill(colors::ACCENT)
                    .corner_radius(egui::CornerRadius::same(8)),
                )
                .clicked()
            {
                let old_url = self.settings.ollama_url.clone();
                let old_model = self.settings.ollama_model.clone();
                let old_enabled = self.settings.ollama_enabled;

                self.save_settings();

                let ollama_config_changed = self.settings.ollama_url != old_url
                    || self.settings.ollama_model != old_model
                    || self.settings.ollama_enabled != old_enabled;

                if ollama_config_changed {
                    if self.settings.ollama_enabled {
                        self.ollama_available = false;
                        self.ollama_checking = true;
                        self.ollama_receiver = None;
                        self.last_ollama_error = None;
                        self.discovered_models.clear();
                        self.running_models.clear();
                        self.check_ollama();
                        self.discover_ollama_models();
                    } else {
                        self.ollama_client = None;
                        self.ollama_available = false;
                        self.ollama_checking = false;
                        self.ollama_receiver = None;
                        self.last_ollama_error = None;
                        self.ollama_version = None;
                    }
                }

                self.status_message = Some("Settings saved.".to_string());
            }
        });

        // Reset Button
        if secondary_button(ui, &format!("{} Reset to Defaults", icons::REFRESH)).clicked() {
            self.settings = AppSettings::default();
            if let Some(ref db) = self.db {
                let _ = db.save_all_settings(&self.settings);
            }
            self.status_message = Some("Settings reset to defaults.".to_string());
        }
    }
}
