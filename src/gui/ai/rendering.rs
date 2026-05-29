//! AI chat UI rendering functions
//! 
//! This module contains functions for rendering the AI chat interface,
//! including message display and input handling.

use eframe::egui;

use super::super::{SpaceAnalyzerApp, icon_char, icon_text};
use super::super::icons;

impl SpaceAnalyzerApp {
    pub(crate) fn render_ai_chat(&mut self, ui: &mut egui::Ui) {
        ui.heading("AI Storage Assistant");
        ui.horizontal(|ui| {
            if self.ollama_available {
                ui.label(egui::RichText::new("Ollama: Connected").color(egui::Color32::GREEN));
            } else if self.ollama_checking {
                ui.label("Ollama: Checking...");
            } else {
                ui.label(egui::RichText::new("Ollama: Not available (using local analysis)").color(egui::Color32::YELLOW));
            }
            // Model indicator
            if !self.settings.ollama_model.is_empty() {
                ui.separator();
                ui.small(format!("Model: {}", self.settings.ollama_model));
            }
            // Cache stats toggle
            ui.separator();
            if ui.small_button("Cache").clicked() {
                self.cache_stats_visible = !self.cache_stats_visible;
            }
        });
        
        // Prompt Cache Panel
        if self.cache_stats_visible {
            egui::Frame::group(&ui.style()).show(ui, |ui| {
                ui.horizontal(|ui| {
                    ui.heading("Prompt Cache");
                    if ui.small_button("Close").clicked() {
                        self.cache_stats_visible = false;
                    }
                });
                ui.separator();
                
                let stats = self.prompt_cache.stats();
                let cache_enabled = self.prompt_cache.config().enabled;
                
                ui.horizontal(|ui| {
                    ui.checkbox(&mut self.settings.prompt_cache_enabled, "Enabled");
                    if ui.small_button("Clear Cache").clicked() {
                        self.prompt_cache.clear();
                    }
                });
                
                ui.horizontal(|ui| {
                    ui.small(format!("Entries: {}/{}", stats.total_entries, stats.max_entries));
                    ui.small(format!("Hit Rate: {:.1}%", stats.overall_hit_rate * 100.0));
                    ui.small(format!("Memory: {}MB/{}MB", stats.estimated_memory_mb, stats.max_memory_mb));
                });
                
                ui.horizontal(|ui| {
                    ui.small("TTL:");
                    let mut ttl = self.settings.prompt_cache_ttl_seconds as i32;
                    if ui.add(egui::DragValue::new(&mut ttl).range(30..=3600).speed(10)).changed() {
                        self.settings.prompt_cache_ttl_seconds = ttl as u64;
                        self.prompt_cache.update_config(self.settings.to_prompt_cache_config());
                    }
                    ui.small("s");

                    ui.small("Max mem:");
                    let mut max_mem = self.settings.prompt_cache_max_memory_mb as i32;
                    if ui.add(egui::DragValue::new(&mut max_mem).range(16..=1024).speed(16)).changed() {
                        self.settings.prompt_cache_max_memory_mb = max_mem as usize;
                        self.prompt_cache.update_config(self.settings.to_prompt_cache_config());
                    }
                    ui.small("MB");

                    ui.small("Max entries:");
                    let mut max_entries = self.settings.prompt_cache_max_entries as i32;
                    if ui.add(egui::DragValue::new(&mut max_entries).range(10..=500).speed(5)).changed() {
                        self.settings.prompt_cache_max_entries = max_entries as usize;
                        self.prompt_cache.update_config(self.settings.to_prompt_cache_config());
                    }
                });
                
                ui.horizontal(|ui| {
                    ui.small(format!("Total cached: {} prompt + {} completion tokens",
                        stats.total_prompt_tokens_cached, stats.total_completion_tokens_cached));
                    ui.small(format!("Hits: {} | Misses: {}", stats.total_cache_hits, stats.total_cache_misses));
                });
                
                // Model budgets
                if !stats.model_budgets.is_empty() {
                    ui.separator();
                    ui.small("Model Token Budgets:");
                    for budget in &stats.model_budgets {
                        ui.horizontal(|ui| {
                            ui.small(format!("{}:", budget.model_name));
                            ui.small(format!("{:.0} tokens/min remaining", budget.remaining_tokens_this_minute()));
                            ui.small(format!("Hit rate: {:.1}%", budget.cache_hit_rate() * 100.0));
                        });
                    }
                }
                
                // Update cache enabled state immediately (in-memory only; persisted on Save)
                if !cache_enabled && self.settings.prompt_cache_enabled {
                    let mut new_config = self.settings.to_prompt_cache_config();
                    new_config.enabled = true;
                    self.prompt_cache.update_config(new_config);
                } else if cache_enabled && !self.settings.prompt_cache_enabled {
                    let mut new_config = self.settings.to_prompt_cache_config();
                    new_config.enabled = false;
                    self.prompt_cache.update_config(new_config);
                }
            });
            ui.separator();
        }
        ui.separator();

        // Quick Actions Toolbar
        if self.ollama_available && self.scan_result.is_some() {
            ui.horizontal_wrapped(|ui| {
                ui.small("Quick Actions:");
                if let Some((cp, _)) = icons::filetype() {
                    if ui.small_button(format!("{} Analyze", icon_char(cp))).clicked() {
                        self.send_quick_action("Analyze this scan and give me prioritized recommendations for freeing up space.", "analysis");
                    }
                } else if ui.small_button("Analyze Scan").clicked() {
                    self.send_quick_action("Analyze this scan and give me prioritized recommendations for freeing up space.", "analysis");
                }
                if let Some((cp, _)) = icons::cleanup() {
                    if ui.small_button(format!("{} Cleanup", icon_char(cp))).clicked() {
                        self.send_quick_action("What files can I safely clean up from this scan?", "cleanup");
                    }
                } else if ui.small_button("Cleanup Advice").clicked() {
                    self.send_quick_action("What files can I safely clean up from this scan?", "cleanup");
                }
                if let Some((cp, _)) = icons::trend() {
                    if ui.small_button(format!("{} Trends", icon_char(cp))).clicked() {
                        self.send_quick_action("Analyze my storage usage trends and predict when my disk will be full.", "prediction");
                    }
                } else if ui.small_button("Storage Trends").clicked() {
                    self.send_quick_action("Analyze my storage usage trends and predict when my disk will be full.", "prediction");
                }
                if let Some((cp, _)) = icons::pattern() {
                    if ui.small_button(format!("{} Patterns", icon_char(cp))).clicked() {
                        self.send_quick_action("Analyze file patterns to find duplicates, orphans, and optimization opportunities.", "file_patterns");
                    }
                } else if ui.small_button("File Patterns").clicked() {
                    self.send_quick_action("Analyze file patterns to find duplicates, orphans, and optimization opportunities.", "file_patterns");
                }
                if let Some((cp, _)) = icons::security() {
                    if ui.small_button(format!("{} Security", icon_char(cp))).clicked() {
                        self.send_quick_action("Scan for potential security issues like exposed credentials, sensitive files, or insecure backups.", "security");
                    }
                } else if ui.small_button("Security Scan").clicked() {
                    self.send_quick_action("Scan for potential security issues like exposed credentials, sensitive files, or insecure backups.", "security");
                }
                if let Some((cp, _)) = icons::performance() {
                    if ui.small_button(format!("{} Performance", icon_char(cp))).clicked() {
                        self.send_quick_action("Analyze file system structure for performance bottlenecks.", "performance");
                    }
                } else if ui.small_button("Performance").clicked() {
                    self.send_quick_action("Analyze file system structure for performance bottlenecks.", "performance");
                }
                if let Some((cp, _)) = icons::workflow() {
                    if ui.small_button(format!("{} Workflows", icon_char(cp))).clicked() {
                        self.send_quick_action("Recommend automated workflows based on my scan results.", "workflow");
                    }
                } else if ui.small_button("Workflows").clicked() {
                    self.send_quick_action("Recommend automated workflows based on my scan results.", "workflow");
                }
            });
            ui.separator();
        }

        // Chat messages
        egui::ScrollArea::vertical().show(ui, |ui| {
            for msg in &self.chat_messages {
                let is_user = msg.role == "user";
                let is_tool_call = msg.content.starts_with("[Calling tool:");
                let is_tool_result = msg.content.starts_with("[Tool result:");
                let is_quick_action = msg.content.starts_with("[Quick Action:");
                let color = if is_user {
                    egui::Color32::LIGHT_BLUE
                } else if is_tool_call || is_tool_result {
                    egui::Color32::YELLOW
                } else if is_quick_action {
                    egui::Color32::from_rgb(180, 130, 255)
                } else {
                    egui::Color32::LIGHT_GREEN
                };
                ui.horizontal(|ui| {
                    let label = if is_user {
                        "You"
                    } else if is_tool_call {
                        "Tool Calling"
                    } else if is_tool_result {
                        "Tool Result"
                    } else if is_quick_action {
                        if let Some((cp, fam)) = icons::quick() {
                            ui.add(egui::Label::new(icon_text(cp, fam, 14.0, color)));
                        } else {
                            ui.label(egui::RichText::new("[QA]").color(color).strong());
                        }
                        "AI"
                    } else {
                        "AI"
                    };
                    if !is_quick_action {
                        ui.label(egui::RichText::new(label).color(color).strong());
                    }
                });

                if is_tool_call {
                    ui.label(egui::RichText::new(&msg.content).italics().size(11.0));
                } else if is_tool_result {
                    if let Some(ref display) = msg.tool_result {
                        let header_label = if let Some((cp, _)) = &display.tool_icon {
                            format!("{} {} - {}", icon_char(*cp), display.tool_name, display.summary)
                        } else {
                            format!("{} - {}", display.tool_name, display.summary)
                        };
                        egui::CollapsingHeader::new(&header_label)
                            .default_open(true)
                            .show(ui, |ui| {
                                egui::ScrollArea::vertical().max_height(150.0).show(ui, |ui| {
                                    for line in &display.details {
                                        ui.label(line);
                                    }
                                });
                            });
                    } else {
                        ui.label(egui::RichText::new(&msg.content).italics().size(11.0));
                    }
                } else if is_quick_action {
                    ui.label(egui::RichText::new(&msg.content).size(11.0).color(egui::Color32::from_rgb(180, 130, 255)));
                } else {
                    ui.label(&msg.content);
                }
                ui.separator();
            }
            if self.chat_processing {
                ui.label(egui::RichText::new("AI is thinking...").italics());
                if !self.conversation_history.is_empty() {
                    ui.small("Tool calling enabled - AI can access scan results, disk info, and system stats.");
                }
            }
        });

        // Input
        ui.horizontal(|ui| {
            let response = ui.add(egui::TextEdit::singleline(&mut self.chat_input)
                .desired_width(f32::INFINITY)
                .hint_text("Ask about your disk usage..."));
            if (response.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter))) ||
               ui.button("Send").clicked() {
                self.send_chat_message();
            }
        });
    }
}
