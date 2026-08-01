use super::*;

impl SpaceAnalyzerApp {
    pub(crate) fn render_ai_settings(&mut self, ui: &mut egui::Ui) {
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

                if !self.settings.ollama_model.is_empty() {
                    let chat_model_info = self
                        .discovered_models
                        .iter()
                        .find(|m| m.name == self.settings.ollama_model);
                    if chat_model_info.is_none() && !self.discovered_models.is_empty() {
                        badge(
                            ui,
                            "Warning: selected chat model is not in the local discovered list",
                            colors::WARNING,
                        );
                    }
                }

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
                }

                if !self.settings.tool_calling_model.is_empty()
                    && self.settings.agentic_tools_enabled
                {
                    let tool_model_info = self
                        .discovered_models
                        .iter()
                        .find(|m| m.name == self.settings.tool_calling_model);
                    if tool_model_info.is_none() && !self.discovered_models.is_empty() {
                        badge(
                            ui,
                            "Warning: selected tool model is not in the local discovered list",
                            colors::WARNING,
                        );
                    }
                }

                if self.settings.agentic_tools_enabled {
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
}
