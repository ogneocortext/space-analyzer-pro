//! AI chat UI rendering functions
//!
//! This module contains functions for rendering the AI chat interface,
//! including message display and input handling.

use eframe::egui;

use super::super::{badge, card_frame, colors, section_heading, SpaceAnalyzerApp};

impl SpaceAnalyzerApp {
    pub(crate) fn render_ai_chat(&mut self, ui: &mut egui::Ui) {
        // ── Connection Status Card ────────────────────────────────────
        section_heading(ui, Some('🤖'), "AI Assistant");
        card_frame(ui.style()).show(ui, |ui| {
            ui.horizontal(|ui| {
                if self.ollama_available {
                    badge(ui, "Connected", colors::SUCCESS);
                    if !self.settings.ollama_model.is_empty() {
                        badge(ui, &self.settings.ollama_model, colors::ACCENT);
                    }
                    if let Some(ref v) = self.ollama_version {
                        badge(ui, &format!("v{}", v), super::super::colors::TEXT_SECONDARY);
                    }
                } else if self.ollama_checking {
                    ui.spinner();
                    ui.label(
                        egui::RichText::new("Checking connection...").color(colors::TEXT_SECONDARY),
                    );
                } else {
                    badge(ui, "Offline", colors::WARNING);
                    ui.label(
                        egui::RichText::new("Using local analysis")
                            .size(11.0)
                            .color(colors::TEXT_MUTED),
                    );
                }

                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if ui.small_button("Cache").clicked() {
                        self.prompt_cache_state.cache_stats_visible =
                            !self.prompt_cache_state.cache_stats_visible;
                    }
                });
            });

            // Surface the last error from the discovery / availability probes.
            // Previously swallowed — the user would see "Offline" with no clue
            // why the server was unreachable.
            if let Some(ref err) = self.last_ollama_error {
                ui.horizontal(|ui| {
                    ui.label(
                        egui::RichText::new(format!("⚠ {}", err))
                            .size(11.0)
                            .color(egui::Color32::from_rgb(220, 80, 80)),
                    );
                });
            }

            // Prompt Cache Panel
            if self.prompt_cache_state.cache_stats_visible {
                ui.add_space(8.0);
                egui::Frame::NONE
                    .fill(colors::CARD_BG)
                    .stroke(egui::Stroke::new(1.0, colors::CARD_BORDER))
                    .corner_radius(egui::CornerRadius::same(8))
                    .inner_margin(egui::Margin::symmetric(12, 8))
                    .show(ui, |ui| {
                        ui.horizontal(|ui| {
                            ui.label(
                                egui::RichText::new("Prompt Cache")
                                    .strong()
                                    .color(colors::TEXT_PRIMARY),
                            );
                            if ui.small_button("Close").clicked() {
                                self.prompt_cache_state.cache_stats_visible = false;
                            }
                        });

                        let stats = self.prompt_cache_state.prompt_cache.stats();

                        ui.horizontal(|ui| {
                            ui.checkbox(&mut self.settings.prompt_cache_enabled, "Enabled");
                            if ui.small_button("Clear Cache").clicked() {
                                self.prompt_cache_state.prompt_cache.clear();
                            }
                        });

                        ui.horizontal(|ui| {
                            badge(
                                ui,
                                &format!("{}/{} entries", stats.total_entries, stats.max_entries),
                                colors::ACCENT,
                            );
                            badge(
                                ui,
                                &format!("{:.1}% hit rate", stats.overall_hit_rate * 100.0),
                                colors::SUCCESS,
                            );
                            badge(
                                ui,
                                &format!(
                                    "{}MB/{}MB",
                                    stats.estimated_memory_mb, stats.max_memory_mb
                                ),
                                colors::TEXT_SECONDARY,
                            );
                        });

                        ui.horizontal(|ui| {
                            ui.label(
                                egui::RichText::new("TTL:")
                                    .size(11.0)
                                    .color(colors::TEXT_SECONDARY),
                            );
                            let mut ttl = self.settings.prompt_cache_ttl_seconds as i32;
                            if ui
                                .add(egui::DragValue::new(&mut ttl).range(30..=3600).speed(10))
                                .changed()
                            {
                                self.settings.prompt_cache_ttl_seconds = ttl as u64;
                                self.prompt_cache_state
                                    .prompt_cache
                                    .update_config(self.settings.to_prompt_cache_config());
                            }
                            ui.label(
                                egui::RichText::new("s")
                                    .size(11.0)
                                    .color(colors::TEXT_MUTED),
                            );

                            ui.label(
                                egui::RichText::new("Max mem:")
                                    .size(11.0)
                                    .color(colors::TEXT_SECONDARY),
                            );
                            let mut max_mem = self.settings.prompt_cache_max_memory_mb as i32;
                            if ui
                                .add(
                                    egui::DragValue::new(&mut max_mem)
                                        .range(16..=1024)
                                        .speed(16),
                                )
                                .changed()
                            {
                                self.settings.prompt_cache_max_memory_mb = max_mem as usize;
                                self.prompt_cache_state
                                    .prompt_cache
                                    .update_config(self.settings.to_prompt_cache_config());
                            }
                            ui.label(
                                egui::RichText::new("MB")
                                    .size(11.0)
                                    .color(colors::TEXT_MUTED),
                            );
                        });
                    });
            }
        });

        // ── Quick Actions Toolbar ─────────────────────────────────────
        if self.ollama_available && self.scan_result.is_some() {
            section_heading(ui, None, "Quick Actions");
            card_frame(ui.style()).show(ui, |ui| {
                ui.horizontal_wrapped(|ui| {
                    let actions = [
                        ("📊", "Analyze", "Analyze this scan and give me prioritized recommendations for freeing up space.", "analysis"),
                        ("🧹", "Cleanup", "What files can I safely clean up from this scan?", "cleanup"),
                        ("📈", "Trends", "Analyze my storage usage trends and predict when my disk will be full.", "prediction"),
                        ("🔍", "Patterns", "Analyze file patterns to find duplicates, orphans, and optimization opportunities.", "file_patterns"),
                        ("🛡", "Security", "Scan for potential security issues like exposed credentials, sensitive files, or insecure backups.", "security"),
                        ("🏎", "Performance", "Analyze file system structure for performance bottlenecks.", "performance"),
                    ];

                    for (icon, label, prompt, task) in actions {
                        let btn = egui::Button::new(
                            egui::RichText::new(format!("{} {}", icon, label)).size(12.0),
                        )
                        .fill(colors::ACCENT_BG);
                        if ui.add(btn).clicked() {
                            self.send_quick_action(prompt, task);
                        }
                    }
                });
            });
        }

        // ── AI Tools Panel (v3.5.0+) ──────────────────────────────────
        // Capability-driven buttons: Semantic Search (embedding),
        // Summarize Scan (completion), Cleanup Plan (thinking),
        // Describe Screenshot (vision). Each one targets a specific
        // Ollama capability and the user can see the data flow in
        // the resulting ChatMessage (tokens, duration, payload size).
        self.render_ai_tools_panel(ui);

        // ── Chat Messages ─────────────────────────────────────────────
        egui::ScrollArea::vertical().show(ui, |ui| {
            for msg in &self.chat_messages {
                let is_user = msg.role == "user";
                let is_tool_call = msg.content.starts_with("[Calling tool:");
                let is_tool_result = msg.content.starts_with("[Tool result:");
                let is_quick_action = msg.content.starts_with("[Quick Action:");

                let (bg_color, border_color, _text_color) = if is_user {
                    (
                        colors::ACCENT_BG,
                        colors::ACCENT.linear_multiply(0.3),
                        colors::TEXT_PRIMARY,
                    )
                } else if is_tool_call || is_tool_result {
                    (
                        colors::CARD_BG,
                        colors::WARNING.linear_multiply(0.3),
                        colors::TEXT_SECONDARY,
                    )
                } else if is_quick_action {
                    (
                        egui::Color32::from_rgb(45, 35, 65),
                        colors::ACCENT.linear_multiply(0.3),
                        colors::ACCENT,
                    )
                } else {
                    (
                        colors::CARD_BG,
                        colors::CARD_BORDER,
                        colors::TEXT_PRIMARY,
                    )
                };

                egui::Frame::NONE
                    .fill(bg_color)
                    .stroke(egui::Stroke::new(1.0, border_color))
                    .corner_radius(egui::CornerRadius::same(8))
                    .inner_margin(egui::Margin::symmetric(12, 8))
                    .outer_margin(egui::Margin::symmetric(0, 2))
                    .show(ui, |ui| {
                        // Role label
                        ui.horizontal(|ui| {
                            let role_label = if is_user {
                                "You"
                            } else if is_tool_call {
                                "Tool Call"
                            } else if is_tool_result {
                                "Tool Result"
                            } else if is_quick_action {
                                "Quick Action"
                            } else {
                                "AI"
                            };
                            let role_color = if is_user {
                                colors::ACCENT
                            } else if is_tool_call || is_tool_result {
                                colors::WARNING
                            } else {
                                colors::SUCCESS
                            };
                            badge(ui, role_label, role_color);
                        });

                        // Content
                        if is_tool_call {
                            ui.label(
                                egui::RichText::new(&msg.content)
                                    .italics()
                                    .size(11.0)
                                    .color(colors::TEXT_SECONDARY),
                            );
                        } else if is_tool_result {
                            if let Some(ref display) = msg.tool_result {
                                let header = format!(
                                    "{} {}",
                                    display.tool_name,
                                    display.summary
                                );
                                egui::CollapsingHeader::new(
                                    egui::RichText::new(header)
                                        .size(11.0)
                                        .color(colors::WARNING),
                                )
                                .default_open(false)
                                .show(ui, |ui| {
                                    egui::ScrollArea::vertical()
                                        .max_height(120.0)
                                        .show(ui, |ui| {
                                            for line in &display.details {
                                                ui.label(
                                                    egui::RichText::new(line)
                                                        .monospace()
                                                        .size(10.0)
                                                        .color(colors::TEXT_SECONDARY),
                                                );
                                            }
                                        });
                                });
                            } else {
                                ui.label(
                                    egui::RichText::new(&msg.content)
                                        .italics()
                                        .size(11.0)
                                        .color(colors::TEXT_SECONDARY),
                                );
                            }
                        } else if is_quick_action {
                            ui.label(
                                egui::RichText::new(&msg.content)
                                    .size(11.0)
                                    .color(colors::ACCENT),
                            );
                        } else {
                            // Show thinking process if available
                            if let Some(ref think) = msg.thinking {
                                if !think.trim().is_empty() {
                                    egui::CollapsingHeader::new("Thinking Process")
                                        .default_open(false)
                                        .show(ui, |ui| {
                                            ui.add(egui::Label::new(
                                                egui::RichText::new(think)
                                                    .color(colors::TEXT_MUTED)
                                                    .italics()
                                                    .size(11.0),
                                            ));
                                        });
                                }
                            }
                            ui.label(&msg.content);
                        }
                    });
            }

            // Processing indicator
            if self.chat_processing {
                card_frame(ui.style()).show(ui, |ui| {
                    ui.horizontal(|ui| {
                        ui.spinner();
                        ui.label(
                            egui::RichText::new("AI is thinking...")
                                .italics()
                                .color(colors::TEXT_SECONDARY),
                        );
                    });
                    if !self.conversation_history.is_empty() {
                        ui.label(
                            egui::RichText::new("Tool calling enabled — AI can access scan results, disk info, and system stats")
                                .size(10.0)
                                .color(colors::TEXT_MUTED),
                        );
                    }
                });
            }
        });

        // ── Input ─────────────────────────────────────────────────────
        ui.add_space(4.0);
        card_frame(ui.style()).show(ui, |ui| {
            ui.horizontal(|ui| {
                let response = ui.add(
                    egui::TextEdit::singleline(&mut self.chat_input)
                        .desired_width(ui.available_width() - 70.0)
                        .hint_text("Ask about your disk usage..."),
                );
                let send_btn = egui::Button::new(egui::RichText::new("Send").size(13.0).strong())
                    .min_size(egui::vec2(60.0, 28.0))
                    .fill(colors::ACCENT);

                if (response.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)))
                    || ui.add(send_btn).clicked()
                {
                    self.send_chat_message();
                }
            });
        });
    }
}
