use super::*;

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
        if should_enable != was_enabled || should_enable {
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
        ui.heading(egui::RichText::new("Scan Settings").strong().size(16.0));
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
        ui.heading(
            egui::RichText::new("GPU / CUDA Settings")
                .strong()
                .size(16.0),
        );
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
                ui.small("GPU Operations:");
                ui.small("â€¢ BLAKE3 batch hashing for deduplication");
                ui.small("â€¢ Scan post-processing, ML predictions");

                if let Some(ref gpu) = self.gpu_info {
                    ui.separator();
                    if let Some(ref name) = gpu.name {
                        ui.small(format!("Detected: {}", name));
                    }
                    if let Some(vram) = gpu.vram_bytes {
                        ui.small(format!("VRAM: {} MB", vram / 1_048_576));
                    }
                } else {
                    ui.small("No GPU detected - using CPU fallback");
                }
            });
        }
    }

    fn render_ai_settings(&mut self, ui: &mut egui::Ui) {
        ui.heading(
            egui::RichText::new("AI Settings (Ollama)")
                .strong()
                .size(16.0),
        );
        ui.checkbox(&mut self.settings.ollama_enabled, "Enable Ollama AI");
        if self.settings.ollama_enabled {
            ui.indent("ollama_options", |ui| {
                ui.horizontal(|ui| {
                    ui.label("Ollama URL:");
                    ui.text_edit_singleline(&mut self.settings.ollama_url);
                });

                ui.separator();
                ui.heading("Feature Toggles");
                ui.checkbox(&mut self.settings.agentic_tools_enabled, "Enable Agentic Tool Calling");
                ui.checkbox(&mut self.settings.ai_recommendation_enabled, "AI-Powered Recommendations (uses Ollama)");
                ui.checkbox(&mut self.settings.auto_model_selection, "Auto-select model based on task");
                ui.checkbox(&mut self.settings.auto_start_ollama, "Auto-start Ollama when needed");
                ui.checkbox(&mut self.settings.ollama_think, "Enable Deep Thinking / Reasoning (Ollama 0.30+)");

                ui.separator();
                ui.heading("Model Configuration");

                ui.horizontal(|ui| {
                    ui.label("Chat Model:");
                    ui.add(egui::TextEdit::singleline(&mut self.settings.ollama_model)
                        .hint_text("e.g. llama3.2"));
                });

                ui.horizontal(|ui| {
                    ui.label("Tool Calling Model:");
                    ui.add(egui::TextEdit::singleline(&mut self.settings.tool_calling_model)
                        .hint_text("e.g. functionary-small-v3.1"));
                });

                if self.settings.agentic_tools_enabled {
                    let has_tool_capability = self.discovered_models.iter()
                        .filter(|m| m.name == self.settings.tool_calling_model)
                        .any(|m| m.capabilities.iter().any(|c| c == "Tool Calling"));
                    if !has_tool_capability {
                        ui.colored_label(egui::Color32::YELLOW, "âš  Warning: Selected model may not support tool calling. Use a functionary or tool-capable model.");
                    }

                    ui.horizontal(|ui| {
                        ui.label("Tool Choice:");
                        egui::ComboBox::from_id_salt("tool_choice")
                            .selected_text(&self.settings.tool_choice)
                            .show_ui(ui, |ui| {
                                ui.selectable_value(&mut self.settings.tool_choice, "auto".to_string(), "auto (model decides)");
                                ui.selectable_value(&mut self.settings.tool_choice, "none".to_string(), "none (no tool calls)");
                                ui.selectable_value(&mut self.settings.tool_choice, "required".to_string(), "required (must use tools)");
                            });
                    });
                }

                ui.small("Use the model list below to select models for chat and tools.");

                ui.separator();
                ui.small("Installed Models:");
                self.render_ollama_model_list(ui);

                ui.separator();
                if ui.button("Test Connection").clicked() {
                    match OllamaClient::new(&self.settings.ollama_url, &self.settings.ollama_model) {
                        Ok(client) => {
                            self.ollama_client = Some(client);
                            self.check_ollama();
                        }
                        Err(e) => {
                            self.status_message = Some(format!("Ollama config error: {}", sanitize_error_message(&e.to_string())));
                        }
                    }
                }
            });
        }
    }

    fn render_smart_search_settings(&mut self, ui: &mut egui::Ui) {
        ui.heading(
            egui::RichText::new("Smart Search (Semantic File Search)")
                .strong()
                .size(16.0),
        );
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
                    ui.small(hint);
                });
                ui.small("Uses nomic-embed-text or similar model. Set limit to 0 to index all files (may be slow for large scans).");
            });
        }
    }

    fn render_logging_settings(&mut self, ui: &mut egui::Ui) {
        ui.heading(egui::RichText::new("Session Logging").strong().size(16.0));
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
                ui.small(
                    "Logs all user interactions for automated flow testing and issue detection.",
                );
            });
        }
    }

    pub(crate) fn render_settings(&mut self, ui: &mut egui::Ui) {
        ui.heading("Settings");
        ui.separator();

        self.render_scan_settings(ui);
        ui.separator();
        self.render_gpu_settings(ui);
        ui.separator();
        self.render_ai_settings(ui);
        ui.separator();
        self.render_smart_search_settings(ui);
        ui.separator();
        self.render_logging_settings(ui);
        ui.separator();

        if ui
            .add(egui::Button::new(
                egui::RichText::new("💾 Save Settings").strong(),
            ))
            .clicked()
        {
            let old_url = self.settings.ollama_url.clone();
            let old_model = self.settings.ollama_model.clone();
            let old_enabled = self.settings.ollama_enabled;

            self.save_settings();

            if (self.settings.ollama_url != old_url
                || self.settings.ollama_model != old_model
                || self.settings.ollama_enabled != old_enabled)
                && self.settings.ollama_enabled
            {
                match OllamaClient::new(&self.settings.ollama_url, &self.settings.ollama_model) {
                    Ok(client) => {
                        self.ollama_client = Some(client);
                        self.ollama_available = false;
                        self.ollama_checking = false;
                        self.ollama_receiver = None;
                        self.check_ollama();
                    }
                    Err(e) => {
                        self.status_message = Some(format!(
                            "Ollama config error: {}",
                            sanitize_error_message(&e.to_string())
                        ));
                    }
                }
            }

            self.status_message = Some("Settings saved.".to_string());
        }
    }
}
