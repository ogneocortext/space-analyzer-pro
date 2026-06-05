//! Model discovery and management functions
//!
//! This module contains functions for discovering Ollama models,
//! rendering model lists, and auto-selecting models based on task type.

use super::super::{classify_model, icon_text, OllamaMessage, OllamaModelInfo};
use std::sync::mpsc;

use super::super::SpaceAnalyzerApp;

impl SpaceAnalyzerApp {
    /// Discover available Ollama models, server version, and currently-running
    /// models. Uses the typed `OllamaClient` API (not bare `reqwest::get`) so
    /// errors are reported back through the channel rather than silently
    /// dropping into an empty list.
    ///
    /// The previous implementation used `reqwest::get` and discarded the
    /// response on any failure — the user clicked "Discover Models" and saw
    /// nothing happen. The new version reports the failure to `last_ollama_error`
    /// and surfaces it in the UI.
    pub(crate) fn discover_ollama_models(&mut self) {
        if self.models_discovering || !self.settings.ollama_enabled {
            return;
        }

        self.models_discovering = true;
        // Build a fresh client with the current URL so an unchanged host
        // (e.g. just toggled "Enable Ollama AI") still produces a working
        // client without depending on `self.ollama_client` being up-to-date.
        let client = match super::super::ollama::OllamaClient::new(
            &self.settings.ollama_url,
            &self.settings.ollama_model,
        ) {
            Ok(c) => c,
            Err(e) => {
                self.models_discovering = false;
                let msg = format!("Invalid Ollama config: {}", e);
                self.last_ollama_error = Some(msg.clone());
                self.status_message = Some(msg);
                return;
            }
        };

        // Use a typed channel so we can ship models + running + version + error
        // in a single message.
        let (tx, rx) = mpsc::channel::<OllamaMessage>();

        std::thread::spawn(move || {
            let rt = super::super::shared_runtime();

            // Discovery payload: (installed models, currently running, server version).
            // All three are fetched in one round-trip; partial failures are
            // reported as `error: Some(...)` alongside whatever did succeed.
            type DiscoveryResult = (
                Vec<OllamaModelInfo>,
                Vec<super::super::ollama::RunningModel>,
                Option<String>,
            );
            let result: Result<DiscoveryResult, String> = rt.block_on(async {
                // Older servers (pre ~0.4.10) don't expose /api/version, so a
                // 404 here is non-fatal — treat the version as unknown.
                let version = client.get_version().await.ok();

                // Fetch the installed model list. Capabilities reported by
                // Ollama 0.30+ are used by `classify_model` to populate
                // `OllamaModelInfo.capabilities` accurately.
                let infos = client
                    .list_models()
                    .await
                    .map_err(|e| format!("Failed to list models: {}", e))?;

                // Filter out cloud models (`remote_host.is_some()`) — the
                // user only wants local models reachable on the LAN box.
                // We do this at the discovery boundary so the UI never
                // offers a remote endpoint as a selectable target, and the
                // /api/ps snapshot also reflects only local loads.
                let local_infos: Vec<_> = infos
                    .into_iter()
                    .filter(|m| m.remote_host.is_none())
                    .collect();

                let mut discovered: Vec<OllamaModelInfo> = Vec::with_capacity(local_infos.len());
                for info in &local_infos {
                    discovered.push(classify_model(info));
                }

                // Build a set of local model names so we can filter the
                // /api/ps response too — if a cloud model happens to be
                // loaded on the server, we don't want to display its
                // (remote) VRAM as if it were using our GPU.
                let local_names: std::collections::HashSet<&str> =
                    local_infos.iter().map(|m| m.name.as_str()).collect();

                // Fetch currently-running models. /api/ps may be missing on
                // very old servers; treat the failure as "no running models"
                // rather than a hard error. Then keep only the names that
                // match a local install.
                let running: Vec<super::super::ollama::RunningModel> = client
                    .list_running()
                    .await
                    .unwrap_or_default()
                    .into_iter()
                    .filter(|r| local_names.contains(r.name.as_str()))
                    .collect();

                Ok((discovered, running, version))
            });

            let msg = match result {
                Ok((models, running, version)) => OllamaMessage::ModelDiscovery {
                    models,
                    running,
                    version,
                    error: None,
                },
                Err(e) => OllamaMessage::ModelDiscovery {
                    models: Vec::new(),
                    running: Vec::new(),
                    version: None,
                    error: Some(e),
                },
            };
            let _ = tx.send(msg);
        });

        self.model_discovery_receiver = Some(rx);
    }

    /// Render the Ollama model list in settings
    pub(crate) fn render_ollama_model_list(&mut self, ui: &mut eframe::egui::Ui) {
        use super::super::badge;
        use super::super::colors;
        use eframe::egui;

        // ── Spinner / status header ────────────────────────────────────
        if self.models_discovering {
            ui.horizontal(|ui| {
                ui.spinner();
                ui.label(
                    egui::RichText::new("Querying Ollama…")
                        .italics()
                        .color(colors::TEXT_SECONDARY),
                );
            });
        }

        // ── Ollama version + last error (always visible when known) ─────
        if let Some(ref v) = self.ollama_version {
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("Ollama")
                        .size(11.0)
                        .color(colors::TEXT_MUTED),
                );
                badge(ui, v, colors::SUCCESS);
            });
        }
        if let Some(ref err) = self.last_ollama_error {
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new(format!("⚠ {}", err))
                        .size(11.0)
                        .color(egui::Color32::from_rgb(220, 80, 80)),
                );
            });
        }

        // ── Discover / Refresh controls ─────────────────────────────────
        ui.horizontal(|ui| {
            let btn_label = if self.discovered_models.is_empty() {
                "Discover Models"
            } else {
                "↻ Refresh"
            };
            if ui
                .small_button(btn_label)
                .on_hover_text("Query /api/tags, /api/version, and /api/ps from Ollama")
                .clicked()
            {
                self.discover_ollama_models();
            }
            if !self.discovered_models.is_empty() {
                ui.label(
                    egui::RichText::new(format!(
                        "{} installed · {} running",
                        self.discovered_models.len(),
                        self.running_models.len()
                    ))
                    .size(11.0)
                    .color(colors::TEXT_MUTED),
                );
            }
        });

        // Nothing more to render if we have no models yet.
        if self.discovered_models.is_empty() {
            if !self.models_discovering {
                ui.small(
                    egui::RichText::new(
                        "Click Discover to query the Ollama server, or check the URL above.",
                    )
                    .color(colors::TEXT_MUTED),
                );
            }
            return;
        }

        // ── Model list ──────────────────────────────────────────────────
        // Clone data we need to avoid borrowing self in closures.
        let models = self.discovered_models.clone();
        let current_active = self.current_active_model.clone();
        let chat_model = self.settings.ollama_model.clone();
        let tool_model = self.settings.tool_calling_model.clone();
        let agentic_enabled = self.settings.agentic_tools_enabled;
        let running_names: std::collections::HashSet<String> =
            self.running_models.iter().map(|r| r.name.clone()).collect();
        let mut clicked_chat: Option<String> = None;
        let mut clicked_tool: Option<String> = None;

        for model in &models {
            ui.separator();

            // Model name with active/running indicators
            ui.horizontal(|ui| {
                let is_active = current_active.as_ref() == Some(&model.name);
                if is_active {
                    ui.label(egui::RichText::new("★").color(egui::Color32::YELLOW));
                }

                let name_text = ui.label(egui::RichText::new(&model.name).strong());
                if !model.tooltip.is_empty() {
                    name_text.on_hover_text(&model.tooltip);
                }

                ui.label(
                    egui::RichText::new(format!("({})", model.size))
                        .size(11.0)
                        .color(colors::TEXT_MUTED),
                );

                if running_names.contains(&model.name) {
                    badge(ui, "● Running", egui::Color32::from_rgb(80, 200, 120));
                }
            });

            // VRAM requirement
            ui.label(
                egui::RichText::new(format!("VRAM: {}", model.vram_requirement))
                    .size(11.0)
                    .color(colors::TEXT_MUTED),
            );

            // Real VRAM usage from /api/ps (not estimated from model size).
            if let Some(running) = self.running_models.iter().find(|r| r.name == model.name) {
                ui.horizontal(|ui| {
                    ui.label(
                        egui::RichText::new(format!(
                            "Loaded: {:.1} GB total · {:.1} GB in VRAM",
                            running.size as f64 / 1_073_741_824.0,
                            running.size_vram as f64 / 1_073_741_824.0
                        ))
                        .size(11.0)
                        .color(colors::TEXT_SECONDARY),
                    );
                });
            }

            // Recommended for
            ui.label(
                egui::RichText::new(format!("Best for: {}", model.recommended_for))
                    .size(11.0)
                    .color(colors::TEXT_SECONDARY),
            );

            // Capabilities with tooltips
            if !model.capabilities.is_empty() {
                ui.horizontal_wrapped(|ui| {
                    for cap in &model.capabilities {
                        let cap_tooltip = match cap.as_str() {
                            "Tool Calling" => {
                                "Can call functions and tools to perform actions on your system"
                            }
                            "Agentic Workflows" => "Can execute multi-step automated workflows",
                            "Function Execution" => "Can run system commands and file operations",
                            "Semantic Embeddings" => {
                                "Converts files to vectors for semantic search"
                            }
                            "Vector Search" => "Finds files by meaning, not just name",
                            "Similarity Detection" => "Identifies similar files and content",
                            "Vision-Language" => "Understands and describes images",
                            "Image Analysis" => "Analyzes screenshots and visual content",
                            "Screenshot Understanding" => "Can answer questions about screenshots",
                            "Advanced Reasoning" => {
                                "Strong at complex analysis and problem solving"
                            }
                            "Code Generation" => "Can generate and understand code",
                            "Complex Analysis" => "Handles multi-faceted storage analysis",
                            "General Chat" => "Good for general conversation and quick answers",
                            "Text Analysis" => "Analyzes text content and patterns",
                            "Quick Responses" => "Fast response times for simple queries",
                            "Text Insertion (fill-in-middle)" => {
                                "Fill-in-middle / infill completion (used by code editors)"
                            }
                            _ => "Model capability",
                        };
                        if let Some((cp, fam)) = super::super::icons::check() {
                            ui.add(egui::Label::new(icon_text(
                                cp,
                                fam,
                                12.0,
                                egui::Color32::GREEN,
                            )))
                            .on_hover_text(cap_tooltip);
                        } else {
                            ui.small(format!("[OK] {}", cap)).on_hover_text(cap_tooltip);
                        }
                    }
                });
            }

            // Quick-select buttons
            let is_chat_model = chat_model == model.name;
            let is_tool_model = tool_model == model.name;
            let model_name = model.name.clone();

            ui.horizontal(|ui| {
                if ui.selectable_label(is_chat_model, "Use for Chat").clicked() {
                    clicked_chat = Some(model_name.clone());
                }
                if agentic_enabled
                    && ui
                        .selectable_label(is_tool_model, "Use for Tools")
                        .clicked()
                {
                    clicked_tool = Some(model_name);
                }
            });
        }

        if let Some(name) = clicked_chat {
            self.status_message = Some(format!("Chat model set to {}", name));
            self.settings.ollama_model = name;
        }
        if let Some(name) = clicked_tool {
            self.status_message = Some(format!("Tool model set to {}", name));
            self.settings.tool_calling_model = name;
        }
    }

    /// Process model discovery results
    pub fn process_model_discovery(&mut self) {
        if let Some(rx) = self.model_discovery_receiver.take() {
            match rx.try_recv() {
                Ok(OllamaMessage::ModelDiscovery {
                    models,
                    running,
                    version,
                    error,
                }) => {
                    self.discovered_models = models;
                    self.running_models = running;
                    if version.is_some() {
                        self.ollama_version = version;
                    }
                    if let Some(err) = error {
                        self.last_ollama_error = Some(err.clone());
                        self.status_message = Some(err);
                    } else {
                        // Clear any prior error on a successful probe.
                        self.last_ollama_error = None;
                    }
                    self.models_discovering = false;
                }
                Ok(_) => {
                    // Spurious message on this channel — put the receiver back.
                    self.model_discovery_receiver = Some(rx);
                }
                Err(std::sync::mpsc::TryRecvError::Empty) => {
                    self.model_discovery_receiver = Some(rx);
                }
                Err(std::sync::mpsc::TryRecvError::Disconnected) => {
                    // Sender was dropped, discovery is done (with no result).
                    self.models_discovering = false;
                    if self.last_ollama_error.is_none() {
                        self.last_ollama_error =
                            Some("Discovery request was interrupted".to_string());
                    }
                }
            }
        }
    }

    /// Automatically select the best model for the current task
    pub fn select_model_for_task(&mut self, task_type: &str) {
        if !self.settings.auto_model_selection || self.discovered_models.is_empty() {
            return;
        }

        let task_lower = task_type.to_lowercase();
        let mut best_model: Option<&OllamaModelInfo> = None;
        let mut best_score = 0.0;

        for model in &self.discovered_models {
            let mut score = 0.0;

            // Score based on capability match
            for cap in &model.capabilities {
                let cap_lower = cap.to_lowercase();
                if (task_lower.contains("tool")
                    || task_lower.contains("agentic")
                    || task_lower.contains("workflow"))
                    && (cap_lower.contains("tool") || cap_lower.contains("agentic"))
                {
                    score += 10.0;
                }
                if (task_lower.contains("search")
                    || task_lower.contains("embed")
                    || task_lower.contains("semantic"))
                    && (cap_lower.contains("embed") || cap_lower.contains("search"))
                {
                    score += 10.0;
                }
                if (task_lower.contains("image")
                    || task_lower.contains("vision")
                    || task_lower.contains("screenshot"))
                    && (cap_lower.contains("vision") || cap_lower.contains("image"))
                {
                    score += 10.0;
                }
                if (task_lower.contains("analysis")
                    || task_lower.contains("reason")
                    || task_lower.contains("complex"))
                    && (cap_lower.contains("reason") || cap_lower.contains("analysis"))
                {
                    score += 8.0;
                }
                if (task_lower.contains("chat")
                    || task_lower.contains("general")
                    || task_lower.contains("quick"))
                    && (cap_lower.contains("chat") || cap_lower.contains("general"))
                {
                    score += 6.0;
                }
            }

            // Score based on performance (faster is better)
            if let Some(tokens_sec) = model.performance_metrics.tokens_per_second {
                score += tokens_sec / 5.0; // Normalize: 20 tokens/sec = +4 points
            }

            // Penalty for high VRAM usage on 8GB GPU
            if model.vram_requirement.contains("CPU offload") {
                score -= 5.0;
            }

            if score > best_score {
                best_score = score;
                best_model = Some(model);
            }
        }

        if let Some(model) = best_model {
            let model_name = model.name.clone();
            let old_active = self.current_active_model.clone();
            self.current_active_model = Some(model_name.clone());
            self.current_model_task = Some(task_type.to_string());

            if task_lower.contains("tool")
                || task_lower.contains("agentic")
                || task_lower.contains("workflow")
            {
                if self.settings.tool_calling_model != model_name {
                    self.settings.tool_calling_model = model_name.clone();
                    self.status_message = Some(format!(
                        "Auto-switched to {} for: {}",
                        model_name, task_type
                    ));
                    self.save_settings();
                }
            } else if old_active.as_ref() != Some(&model_name) {
                if self.settings.ollama_model != model_name {
                    self.settings.ollama_model = model_name.clone();
                    self.save_settings();
                }
                self.status_message = Some(format!(
                    "Auto-switched to {} for: {}",
                    model_name, task_type
                ));
            }
        }
    }
}
