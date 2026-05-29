//! Model discovery and management functions
//! 
//! This module contains functions for discovering Ollama models,
//! rendering model lists, and auto-selecting models based on task type.

use std::sync::mpsc;
use super::super::{OllamaModelInfo, classify_model, icon_text};

use super::super::SpaceAnalyzerApp;

impl SpaceAnalyzerApp {
    /// Discover available Ollama models and their capabilities
    pub(crate) fn discover_ollama_models(&mut self) {
        if self.models_discovering || !self.settings.ollama_enabled {
            return;
        }
        
        self.models_discovering = true;
        let url = self.settings.ollama_url.clone();
        
        // Use a simpler approach - spawn thread and update via message
        // We'll poll for results in the main loop
        let (tx, rx) = mpsc::channel::<Vec<OllamaModelInfo>>();
        
        std::thread::spawn(move || {
            let rt = super::super::shared_runtime();
            
            let models = rt.block_on(async {
                let mut discovered = Vec::new();
                
                // Fetch model list from Ollama API
                if let Ok(resp) = reqwest::get(format!("{}/api/tags", url)).await {
                    if resp.status().is_success() {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            if let Some(models_array) = json.get("models").and_then(|m| m.as_array()) {
                                for model in models_array {
                                    if let Some(name) = model.get("name").and_then(|n| n.as_str()) {
                                        let size = model.get("size")
                                            .and_then(|s| s.as_u64())
                                            .map(|s| format!("{:.1} GB", s as f64 / 1_073_741_824.0))
                                            .unwrap_or_else(|| "Unknown".to_string());
                                            
                                        let info = classify_model(name, &size);
                                        discovered.push(info);
                                    }
                                }
                            }
                        }
                    }
                }
                
                discovered
            });
            
            let _ = tx.send(models);
        });
        
        // Store receiver to poll in main loop
        self.model_discovery_receiver = Some(rx);
    }

    /// Render the Ollama model list in settings
    pub(crate) fn render_ollama_model_list(&mut self, ui: &mut eframe::egui::Ui) {
        use eframe::egui;
        
        if self.discovered_models.is_empty() && !self.models_discovering {
            if ui.small_button("Discover Models").clicked() {
                self.discover_ollama_models();
            }
            ui.small("Click to discover installed Ollama models");
            return;
        }
        
        if self.models_discovering {
            ui.small("Discovering models...");
            return;
        }
        
        ui.horizontal(|ui| {
            ui.small(format!("{} models found:", self.discovered_models.len()));
        });
        
        // Clone data we need to avoid borrowing self in closures
        let models = self.discovered_models.clone();
        let current_active = self.current_active_model.clone();
        let chat_model = self.settings.ollama_model.clone();
        let tool_model = self.settings.tool_calling_model.clone();
        let agentic_enabled = self.settings.agentic_tools_enabled;
        let mut clicked_chat: Option<String> = None;
        let mut clicked_tool: Option<String> = None;
        
        for model in &models {
            ui.separator();
            
            // Model name with running indicator
            ui.horizontal(|ui| {
                let is_active = current_active.as_ref() == Some(&model.name);
                if is_active {
                    ui.label(egui::RichText::new("?").color(egui::Color32::GREEN));
                }
                
                let name_text = ui.label(egui::RichText::new(&model.name).strong());
                if !model.tooltip.is_empty() {
                    name_text.on_hover_text(&model.tooltip);
                }
                
                ui.label(format!("({})", model.size));
                
                if model.is_running {
                    ui.label(egui::RichText::new("Running").color(egui::Color32::YELLOW));
                }
            });
            
            // VRAM requirement
            ui.small(format!("VRAM: {}", model.vram_requirement));
            
            // Performance metrics
            if let Some(tokens_sec) = model.performance_metrics.tokens_per_second {
                ui.small(format!("Performance: ~{:.0} tokens/sec | First token: {:.0}ms | Avg response: {:.0}ms",
                    tokens_sec,
                    model.performance_metrics.time_to_first_token_ms.unwrap_or(0.0),
                    model.performance_metrics.avg_response_time_ms.unwrap_or(0.0)));
            }
            
            // Resource usage if running
            if model.is_running {
                let mut usage_parts = Vec::new();
                if let Some(vram) = model.vram_usage_mb {
                    usage_parts.push(format!("VRAM: {} MB", vram));
                }
                if let Some(cpu) = model.cpu_usage_percent {
                    usage_parts.push(format!("CPU: {:.1}%", cpu));
                }
                if !usage_parts.is_empty() {
                    ui.small(format!("Current usage: {}", usage_parts.join(" | ")));
                }
            }
            
            // Recommended for
            ui.small(format!("Best for: {}", model.recommended_for));
            
            // Capabilities with tooltips
            if !model.capabilities.is_empty() {
                ui.horizontal_wrapped(|ui| {
                    for cap in &model.capabilities {
                        let cap_tooltip = match cap.as_str() {
                            "Tool Calling" => "Can call functions and tools to perform actions on your system",
                            "Agentic Workflows" => "Can execute multi-step automated workflows",
                            "Function Execution" => "Can run system commands and file operations",
                            "Semantic Embeddings" => "Converts files to vectors for semantic search",
                            "Vector Search" => "Finds files by meaning, not just name",
                            "Similarity Detection" => "Identifies similar files and content",
                            "Vision-Language" => "Understands and describes images",
                            "Image Analysis" => "Analyzes screenshots and visual content",
                            "Screenshot Understanding" => "Can answer questions about screenshots",
                            "Advanced Reasoning" => "Strong at complex analysis and problem solving",
                            "Code Generation" => "Can generate and understand code",
                            "Complex Analysis" => "Handles multi-faceted storage analysis",
                            "General Chat" => "Good for general conversation and quick answers",
                            "Text Analysis" => "Analyzes text content and patterns",
                            "Quick Responses" => "Fast response times for simple queries",
                            _ => "Model capability",
                        };
                        if let Some((cp, fam)) = super::super::icons::check() {
                            ui.add(egui::Label::new(icon_text(cp, fam, 12.0, egui::Color32::GREEN))).on_hover_text(cap_tooltip);
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
                if agentic_enabled && ui.selectable_label(is_tool_model, "Use for Tools").clicked() {
                    clicked_tool = Some(model_name);
                }
            });
        }
        
        if let Some(name) = clicked_chat {
            self.settings.ollama_model = name;
        }
        if let Some(name) = clicked_tool {
            self.settings.tool_calling_model = name;
        }
    }

    /// Process model discovery results
    pub fn process_model_discovery(&mut self) {
        if let Some(rx) = self.model_discovery_receiver.take() {
            match rx.try_recv() {
                Ok(models) => {
                    self.discovered_models = models;
                    self.models_discovering = false;
                }
                Err(std::sync::mpsc::TryRecvError::Empty) => {
                    // Still waiting, put it back
                    self.model_discovery_receiver = Some(rx);
                }
                Err(std::sync::mpsc::TryRecvError::Disconnected) => {
                    // Sender was dropped, discovery is done
                    self.models_discovering = false;
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
                if task_lower.contains("tool") || task_lower.contains("agentic") || task_lower.contains("workflow") {
                    if cap_lower.contains("tool") || cap_lower.contains("agentic") {
                        score += 10.0;
                    }
                }
                if task_lower.contains("search") || task_lower.contains("embed") || task_lower.contains("semantic") {
                    if cap_lower.contains("embed") || cap_lower.contains("search") {
                        score += 10.0;
                    }
                }
                if task_lower.contains("image") || task_lower.contains("vision") || task_lower.contains("screenshot") {
                    if cap_lower.contains("vision") || cap_lower.contains("image") {
                        score += 10.0;
                    }
                }
                if task_lower.contains("analysis") || task_lower.contains("reason") || task_lower.contains("complex") {
                    if cap_lower.contains("reason") || cap_lower.contains("analysis") {
                        score += 8.0;
                    }
                }
                if task_lower.contains("chat") || task_lower.contains("general") || task_lower.contains("quick") {
                    if cap_lower.contains("chat") || cap_lower.contains("general") {
                        score += 6.0;
                    }
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
            
            if task_lower.contains("tool") || task_lower.contains("agentic") || task_lower.contains("workflow") {
                if self.settings.tool_calling_model != model_name {
                    self.settings.tool_calling_model = model_name.clone();
                    self.status_message = Some(format!("Auto-switched to {} for: {}", model_name, task_type));
                    self.save_settings();
                }
            } else if old_active.as_ref() != Some(&model_name) {
                if self.settings.ollama_model != model_name {
                    self.settings.ollama_model = model_name.clone();
                    self.save_settings();
                }
                self.status_message = Some(format!("Auto-switched to {} for: {}", model_name, task_type));
            }
        }
    }
}
