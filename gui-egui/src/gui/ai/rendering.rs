//! AI chat UI rendering functions
//!
//! This module contains functions for rendering the AI chat interface,
//! including message display and input handling.

use eframe::egui;

use super::super::{
    badge, card_frame, colors, empty_state, icons, section_heading, tiny_button, SpaceAnalyzerApp,
};

impl SpaceAnalyzerApp {
    pub(crate) fn render_ai_chat(&mut self, ui: &mut egui::Ui) {
        // ── Connection Status Card ────────────────────────────────────
        section_heading(ui, Some(icons::MODEL), "AI Assistant");
        card_frame(ui.style()).show(ui, |ui| {
            ui.horizontal(|ui| {
                if self.ollama_available {
                    badge(ui, "Connected", colors::SUCCESS);
                    if !self.settings.ollama_model.is_empty() {
                        badge(ui, &self.settings.ollama_model, colors::ACCENT);
                    }
                    if let Some(ref v) = self.ollama_version {
                        badge(ui, &format!("v{}", v), colors::TEXT_SECONDARY);
                    }
                    // Show scan status
                    if self.scan_result.is_some() {
                        badge(ui, "Scan ready", colors::SUCCESS);
                    } else {
                        badge(ui, "No scan data", colors::WARNING);
                    }
                } else if self.ollama_checking {
                    ui.spinner();
                    ui.label(
                        egui::RichText::new("Checking connection...").color(colors::TEXT_SECONDARY),
                    );
                } else {
                    badge(ui, "Offline", colors::WARNING);
                    ui.label(
                        egui::RichText::new("Enable Ollama in Settings for AI features")
                            .size(11.0)
                            .color(colors::TEXT_MUTED),
                    );
                }

                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if tiny_button(ui, "Cache").clicked() {
                        self.prompt_cache_state.cache_stats_visible =
                            !self.prompt_cache_state.cache_stats_visible;
                    }
                });
            });

            // Surface the last error from the discovery / availability probes.
            if let Some(ref err) = self.last_ollama_error {
                ui.add_space(4.0);
                egui::Frame::NONE
                    .fill(colors::ERROR.linear_multiply(0.1))
                    .corner_radius(egui::CornerRadius::same(6))
                    .inner_margin(egui::Margin::symmetric(10, 6))
                    .show(ui, |ui| {
                        ui.horizontal(|ui| {
                            ui.label(
                                egui::RichText::new(format!("{} {}", icons::WARNING, err))
                                    .size(11.0)
                                    .color(colors::ERROR),
                            );
                        });
                    });
            }

            // Prompt Cache Panel (collapsible)
            if self.prompt_cache_state.cache_stats_visible {
                ui.add_space(8.0);
                self.render_cache_panel(ui);
            }
        });

        // ── Empty State / Quick Actions / AI Tools ───────────────────
        if !self.ollama_available {
            // Ollama offline — show setup prompt
            ui.add_space(8.0);
            empty_state(
                ui,
                icons::MODEL,
                "AI features require Ollama",
                "Install Ollama and enable it in Settings to use AI-powered analysis, semantic search, and smart recommendations.",
                Some(("Open Settings", &mut || {
                    self.active_tab = super::super::AppTab::Settings;
                })),
            );
        } else if self.scan_result.is_none() {
            // No scan data — prompt to scan first
            ui.add_space(8.0);
            empty_state(
                ui,
                icons::SCAN,
                "Run a scan first",
                "The AI assistant analyzes your scan results to provide insights, recommendations, and cleanup plans.",
                Some(("Start a scan", &mut || {
                    self.active_tab = super::super::AppTab::Scan;
                })),
            );
        } else {
            // ── Quick Actions Grid ────────────────────────────────────
            self.render_ai_quick_actions(ui);

            // ── AI Tools Panel ────────────────────────────────────────
            self.render_ai_tools_panel(ui);
        }

        // ── Chat Messages ─────────────────────────────────────────────
        self.render_chat_messages(ui);

        // ── Input Area ────────────────────────────────────────────────
        self.render_chat_input(ui);
    }

    fn render_cache_panel(&mut self, ui: &mut egui::Ui) {
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
                    if tiny_button(ui, "Close").clicked() {
                        self.prompt_cache_state.cache_stats_visible = false;
                    }
                });

                let stats = self.prompt_cache_state.prompt_cache.stats();

                ui.horizontal(|ui| {
                    ui.checkbox(&mut self.settings.prompt_cache_enabled, "Enabled");
                    if tiny_button(ui, "Clear Cache").clicked() {
                        self.prompt_cache_state.prompt_cache.clear();
                    }
                });

                ui.add_space(4.0);
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
                        &format!("{}MB/{}MB", stats.estimated_memory_mb, stats.max_memory_mb),
                        colors::TEXT_SECONDARY,
                    );
                });

                ui.add_space(4.0);
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

                    ui.add_space(8.0);
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

    fn render_ai_quick_actions(&mut self, ui: &mut egui::Ui) {
        section_heading(ui, Some(icons::LIGHTBULB), "Quick Actions");
        card_frame(ui.style()).show(ui, |ui| {
            ui.label(
                egui::RichText::new("One-click analysis powered by your local AI model")
                    .size(11.0)
                    .color(colors::TEXT_SECONDARY),
            );
            ui.add_space(8.0);

            let actions = [
                (
                    icons::SCAN,
                    "Analyze",
                    "Analyze this scan and give me prioritized recommendations for freeing up space.",
                    "analysis",
                    colors::ACCENT,
                ),
                (
                    icons::CLEANUP,
                    "Cleanup",
                    "What files can I safely clean up from this scan?",
                    "cleanup",
                    colors::SUCCESS,
                ),
                (
                    icons::TREND,
                    "Trends",
                    "Analyze my storage usage trends and predict when my disk will be full.",
                    "prediction",
                    colors::INFO,
                ),
                (
                    icons::PATTERN,
                    "Patterns",
                    "Analyze file patterns to find duplicates, orphans, and optimization opportunities.",
                    "file_patterns",
                    colors::WARNING,
                ),
                (
                    icons::SECURITY,
                    "Security",
                    "Scan for potential security issues like exposed credentials, sensitive files, or insecure backups.",
                    "security",
                    colors::ERROR,
                ),
                (
                    icons::PERFORMANCE,
                    "Performance",
                    "Analyze file system structure for performance bottlenecks.",
                    "performance",
                    colors::ACCENT,
                ),
            ];

            // 3-column grid layout
            let col_width = (ui.available_width() - 16.0) / 3.0;
            for row in actions.chunks(3) {
                ui.horizontal(|ui| {
                    for (icon, label, prompt, task, color) in row {
                        let btn = egui::Button::new(
                            egui::RichText::new(format!("{} {}", icon, label))
                                .size(12.0)
                                .strong(),
                        )
                        .fill(color.linear_multiply(0.15))
                        .stroke(egui::Stroke::new(1.0, color.linear_multiply(0.3)))
                        .corner_radius(egui::CornerRadius::same(8))
                        .min_size(egui::vec2(col_width, 36.0));
                        if ui.add(btn).on_hover_text(*prompt).clicked() {
                            self.send_quick_action(prompt, task);
                        }
                    }
                });
                ui.add_space(4.0);
            }
        });
    }

    fn render_chat_messages(&mut self, ui: &mut egui::Ui) {
        // Use a scroll area that auto-scrolls to bottom
        let scroll_area = egui::ScrollArea::vertical()
            .auto_shrink([false, false])
            .stick_to_bottom(true);

        scroll_area.show(ui, |ui| {
            if self.chat_messages.is_empty() {
                // Empty chat state
                ui.add_space(40.0);
                ui.vertical_centered(|ui| {
                    ui.label(
                        egui::RichText::new(icons::AI_CHAT)
                            .size(32.0)
                            .color(colors::ACCENT.linear_multiply(0.5)),
                    );
                    ui.add_space(8.0);
                    ui.label(
                        egui::RichText::new("Start a conversation")
                            .size(14.0)
                            .color(colors::TEXT_SECONDARY),
                    );
                    ui.add_space(4.0);
                    ui.label(
                        egui::RichText::new("Ask about your disk usage, request analysis, or get cleanup recommendations")
                            .size(11.0)
                            .color(colors::TEXT_MUTED),
                    );
                });
                ui.add_space(40.0);
            } else {
                for msg in &self.chat_messages {
                    let is_user = msg.role == "user";
                    let is_tool_call = msg.content.starts_with("[Calling tool:");
                    let is_tool_result = msg.content.starts_with("[Tool result:");
                    let is_quick_action = msg.content.starts_with("[Quick Action:");

                    let (bg_color, border_color) = if is_user {
                        (colors::ACCENT_BG, colors::ACCENT.linear_multiply(0.3))
                    } else if is_tool_call || is_tool_result {
                        (colors::CARD_BG, colors::WARNING.linear_multiply(0.3))
                    } else if is_quick_action {
                        (
                            egui::Color32::from_rgb(45, 35, 65),
                            colors::ACCENT.linear_multiply(0.3),
                        )
                    } else {
                        (colors::CARD_BG, colors::CARD_BORDER)
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
                                let (role_label, role_color) = if is_user {
                                    ("You", colors::ACCENT)
                                } else if is_tool_call {
                                    ("Tool Call", colors::WARNING)
                                } else if is_tool_result {
                                    ("Tool Result", colors::WARNING)
                                } else if is_quick_action {
                                    ("Quick Action", colors::ACCENT)
                                } else {
                                    ("AI", colors::SUCCESS)
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
                                    let header =
                                        format!("{} {}", display.tool_name, display.summary);
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
                                        egui::CollapsingHeader::new(
                                            egui::RichText::new("Thinking Process")
                                                .size(11.0)
                                                .color(colors::TEXT_MUTED),
                                        )
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
            }

            // Processing indicator
            if self.chat_processing {
                ui.add_space(4.0);
                egui::Frame::NONE
                    .fill(colors::ACCENT.linear_multiply(0.08))
                    .stroke(egui::Stroke::new(1.0, colors::ACCENT.linear_multiply(0.2)))
                    .corner_radius(egui::CornerRadius::same(8))
                    .inner_margin(egui::Margin::symmetric(12, 10))
                    .show(ui, |ui| {
                        ui.horizontal(|ui| {
                            ui.spinner();
                            ui.label(
                                egui::RichText::new("AI is thinking...")
                                    .size(12.0)
                                    .strong()
                                    .color(colors::ACCENT),
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
    }

    fn render_chat_input(&mut self, ui: &mut egui::Ui) {
        ui.add_space(4.0);
        card_frame(ui.style()).show(ui, |ui| {
            ui.horizontal(|ui| {
                let response = ui.add(
                    egui::TextEdit::singleline(&mut self.chat_input)
                        .desired_width(ui.available_width() - 70.0)
                        .hint_text("Ask about your disk usage..."),
                );
                let send_btn = egui::Button::new(
                    egui::RichText::new("Send")
                        .size(12.0)
                        .strong()
                        .color(colors::BG_APP),
                )
                .min_size(egui::vec2(65.0, 32.0))
                .fill(colors::ACCENT)
                .corner_radius(egui::CornerRadius::same(8));

                let send_clicked = ui.add(send_btn).clicked();
                let enter_pressed =
                    response.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter));

                if enter_pressed || send_clicked {
                    self.send_chat_message();
                }
            });

            // Input hints
            ui.horizontal(|ui| {
                ui.label(
                    egui::RichText::new("Enter to send · Shift+Enter for new line")
                        .size(9.0)
                        .color(colors::TEXT_MUTED),
                );
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if !self.chat_messages.is_empty()
                        && tiny_button(ui, "Clear chat").clicked()
                    {
                        self.chat_messages.clear();
                        self.conversation_history.clear();
                        // Keep the system message
                        self.chat_messages.push(super::super::ChatMessage {
                            role: "assistant".to_string(),
                            content: "Hello! I'm your local AI storage assistant. Run a scan first, then ask me questions about your disk usage.".to_string(),
                            thinking: None,
                            tool_result: None,
                        });
                        self.conversation_history.push(
                            super::super::ollama::ChatMessage::system(
                                "You are a helpful AI assistant for disk space analysis. You have access to tools that can retrieve scan results, disk info, and system stats. Use these tools to provide accurate answers. When you don't have enough information, say so rather than guessing.",
                            ),
                        );
                    }
                });
            });
        });
    }
}
