//! AI Tools Panel — capability-driven quick-action buttons (v3.5.0+)
//!
//! Each button targets one Ollama capability reported by 0.30+:
//!
//! | Button                | Capability   | Default model            | Time  |
//! |-----------------------|--------------|--------------------------|-------|
//! | icons::PATTERN Semantic Search    | embedding    | `embedding_model`        | <1 s  |
//! | icons::FILETYPE Summarize Scan     | completion   | `ollama_model`           | ~10 s |
//! | icons::CLEANUP Cleanup Plan       | thinking     | `ollama_model`           | ~3 m  |
//! | icons::CAMERA Describe Screenshot| vision       | `ollama_model`           | ~60 s |
//!
//! The chat-backed Agent Mode (tool calling) is in `chat.rs` and
//! unchanged here.
//!
//! All four methods follow the same pattern as `send_quick_action`:
//! push a status ChatMessage, spawn a thread with a fresh
//! `OllamaClient`, run the feature via `shared_runtime().block_on`,
//! and stream results back over `OllamaMessage` for the UI to pick
//! up on the next frame.

use crate::gui::icons;
use std::path::PathBuf;
use std::sync::mpsc;

use space_analyzer_pro_desktop::ollama::features::{
    self, CleanupPlanInput, ScanSummaryInput, ScreenshotInput, SemanticSearchInput,
};
use space_analyzer_pro_desktop::ollama::OllamaClient;

use super::super::{
    formatting, secondary_button_small, ChatMessage, OllamaMessage, SpaceAnalyzerApp,
};

/// Result tuple returned by a feature runner. The 6 trailing numbers
/// are shown in the chat reply (prompt/completion tokens, duration,
/// payload sizes). One type alias keeps clippy's type_complexity happy
/// at the call site.
type FeatureReply = (String, Option<String>, u32, u32, u128, u64, u64);

impl SpaceAnalyzerApp {
    /// Whether the AI Tools panel can currently do anything. The
    /// panel is interactive when Ollama is reachable; per-button
    /// gates (e.g. screenshot path) are checked at click time.
    pub(crate) fn ai_tools_enabled(&self) -> bool {
        self.ollama_available && self.ollama_client.is_some() && !self.chat_processing
    }

    // ── 1. semantic_search (embedding) ─────────────────────────

    /// Run a semantic file search over the most recent scan.
    /// Uses `embedding_model` from settings (default: `nomic-embed-text:latest`).
    pub(crate) fn run_semantic_search(&mut self) {
        if !self.ai_tools_enabled() {
            return;
        }
        let query = self
            .ai_prompt_state
            .semantic_search_query
            .trim()
            .to_string();
        if query.is_empty() {
            self.push_ai_tool_error("Semantic search query is empty.");
            return;
        }
        let scan = match self.scan_result.as_ref() {
            Some(s) => s,
            None => {
                self.push_ai_tool_error(
                    "No scan results available — run a scan first, then try again.",
                );
                return;
            }
        };

        // Build the file list from the scan's largest files (top 50
        // is plenty for cosine to be useful; the embedding model
        // batches them in one /api/embed call).
        let files: Vec<(String, u64, String)> = scan
            .largest_files
            .iter()
            .take(50)
            .map(|file| {
                let ext = std::path::Path::new(&file.path)
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                (file.path.clone(), file.size, ext)
            })
            .collect();

        if files.is_empty() {
            self.push_ai_tool_error("Scan has no files to search.");
            return;
        }

        let model = self.settings.embedding_model.clone();
        let url = self.settings.ollama_url.clone();

        self.chat_messages.push(ChatMessage {
            role: "user".to_string(),
            content: format!(
                "[AI Tool] {} Semantic Search: \"{}\"",
                icons::PATTERN,
                query
            ),
            thinking: None,
            tool_result: None,
        });
        self.chat_processing = true;

        let (tx, rx) = mpsc::channel();
        self.ollama_receiver = Some(rx);

        std::thread::spawn(move || {
            let rt = super::super::shared_runtime();
            let result: Result<String, String> = rt.block_on(async {
                let client = OllamaClient::new(&url, &model).map_err(|e| e.to_string())?;
                let out = features::semantic_search(
                    &client,
                    &model,
                    SemanticSearchInput {
                        query: query.clone(),
                        files,
                        top_k: 5,
                    },
                )
                .await
                .map_err(|e| e.to_string())?;
                let mut s = format!(
                    "Top-{} matches ({} files indexed, {} dims, {} ms):\n",
                    out.matches.len(),
                    out.files_searched,
                    out.query_dim,
                    out.duration_ms
                );
                for (i, m) in out.matches.iter().enumerate() {
                    s.push_str(&format!(
                        "  {}.  sim={:.4}  {:>10}  {}  {}\n",
                        i + 1,
                        m.similarity,
                        formatting::format_bytes(m.file_size),
                        m.file_extension,
                        m.file_path
                    ));
                }
                Ok(s)
            });
            let _ = match result {
                Ok(content) => tx.send(OllamaMessage::ChatReply {
                    content: format!("{} Semantic Search\n\n{}", icons::PATTERN, content),
                    thinking: None,
                }),
                Err(e) => tx.send(OllamaMessage::Error(format!(
                    "{} Semantic Search failed: {}",
                    icons::PATTERN,
                    e
                ))),
            };
        });
    }

    // ── 2. summarize_scan (completion) ─────────────────────────

    /// Generate a 2-3 sentence summary of the most recent scan.
    /// Uses `ollama_model` from settings (default: `gemma3:4b`).
    pub(crate) fn run_summarize_scan(&mut self) {
        if !self.ai_tools_enabled() {
            return;
        }
        let scan = match self.scan_result.as_ref() {
            Some(s) => s.clone(),
            None => {
                self.push_ai_tool_error(
                    "No scan results available — run a scan first, then try again.",
                );
                return;
            }
        };

        let model = self.settings.ollama_model.clone();
        let url = self.settings.ollama_url.clone();

        self.chat_messages.push(ChatMessage {
            role: "user".to_string(),
            content: format!("[AI Tool] {} Summarize Scan", icons::FILETYPE),
            thinking: None,
            tool_result: None,
        });
        self.chat_processing = true;

        let (tx, rx) = mpsc::channel();
        self.ollama_receiver = Some(rx);

        std::thread::spawn(move || {
            let rt = super::super::shared_runtime();
            let result: Result<(String, u32, u32, u128), String> = rt.block_on(async {
                let client = OllamaClient::new(&url, &model).map_err(|e| e.to_string())?;
                let mut types: Vec<(String, usize)> = scan
                    .file_types
                    .iter()
                    .map(|(e, c)| (e.clone(), *c))
                    .collect();
                types.sort_by_key(|t| std::cmp::Reverse(t.1));
                types.truncate(10);
                let input = ScanSummaryInput {
                    total_files: scan.total_files,
                    total_size_bytes: scan.total_size_bytes,
                    top_files: scan.largest_files.clone(),
                    file_types: types,
                };
                let out = features::summarize_scan(&client, &model, input)
                    .await
                    .map_err(|e| e.to_string())?;
                Ok((
                    out.summary,
                    out.prompt_tokens,
                    out.completion_tokens,
                    out.duration_ms,
                ))
            });
            let _ = match result {
                Ok((summary, p, c, ms)) => tx.send(OllamaMessage::ChatReply {
                    content: format!(
                        "📝 Scan Summary ({} prompt + {} completion tokens, {} ms)\n\n{}",
                        p, c, ms, summary
                    ),
                    thinking: None,
                }),
                Err(e) => tx.send(OllamaMessage::Error(format!("📝 Summarize failed: {}", e))),
            };
        });
    }

    // ── 3. cleanup_plan (thinking) ─────────────────────────────

    /// Ask the model to plan a cleanup. Uses `think: true` so qwen3.5+
    /// and other reasoning-capable models emit a chain of thought.
    /// The chain-of-thought is captured separately and only shown
    /// when the user toggles "Show thinking" in the panel.
    pub(crate) fn run_cleanup_plan(&mut self) {
        if !self.ai_tools_enabled() {
            return;
        }
        let question = self
            .ai_prompt_state
            .cleanup_plan_question
            .trim()
            .to_string();
        if question.is_empty() {
            self.push_ai_tool_error("Cleanup question is empty.");
            return;
        }
        let model = self.settings.ollama_model.clone();
        let url = self.settings.ollama_url.clone();
        let context = self.scan_result.as_ref().map(|s| {
            format!(
                "Latest scan: {} files, {} total. Top: {}",
                s.total_files,
                formatting::format_bytes(s.total_size_bytes),
                s.largest_files
                    .first()
                    .map(|file| format!("{} ({})", file.path, formatting::format_bytes(file.size)))
                    .unwrap_or_else(|| "(no files)".to_string()),
            )
        });

        self.chat_messages.push(ChatMessage {
            role: "user".to_string(),
            content: format!(
                "[AI Tool] {} Cleanup Plan: \"{}\"",
                icons::CLEANUP,
                question
            ),
            thinking: None,
            tool_result: None,
        });
        self.chat_processing = true;

        let (tx, rx) = mpsc::channel();
        self.ollama_receiver = Some(rx);

        std::thread::spawn(move || {
            let rt = super::super::shared_runtime();
            let result: Result<(String, Option<String>, u32, u32, u128), String> =
                rt.block_on(async {
                    let client = OllamaClient::new(&url, &model).map_err(|e| e.to_string())?;
                    let out = features::cleanup_plan(
                        &client,
                        &model,
                        CleanupPlanInput {
                            question: question.clone(),
                            context,
                        },
                    )
                    .await
                    .map_err(|e| e.to_string())?;
                    Ok((
                        out.plan,
                        out.thinking,
                        out.prompt_tokens,
                        out.completion_tokens,
                        out.duration_ms,
                    ))
                });
            let _ = match result {
                Ok((plan, thinking, p, c, ms)) => tx.send(OllamaMessage::ChatReply {
                    content: format!(
                        "{} Cleanup Plan ({} prompt + {} completion tokens, {} ms)\n\n{}",
                        icons::CLEANUP,
                        p,
                        c,
                        ms,
                        plan
                    ),
                    thinking,
                }),
                Err(e) => tx.send(OllamaMessage::Error(format!(
                    "{} Cleanup Plan failed: {}",
                    icons::CLEANUP,
                    e
                ))),
            };
        });
    }

    // ── 4. describe_screenshot (vision) ────────────────────────

    /// Send a PNG/JPEG file to a vision-capable model. The image is
    /// read and base64-encoded inside the feature; we just pass the
    /// path.
    pub(crate) fn run_describe_screenshot(&mut self) {
        if !self.ai_tools_enabled() {
            return;
        }
        let path = match self.ai_prompt_state.pending_screenshot_path.as_ref() {
            Some(p) => p.clone(),
            None => {
                self.push_ai_tool_error(
                    "No screenshot selected. Use the file picker to choose a PNG or JPEG.",
                );
                return;
            }
        };
        if !std::path::Path::new(&path).is_file() {
            self.push_ai_tool_error(&format!("File not found: {}", path));
            return;
        }
        let model = self.settings.ollama_model.clone();
        let url = self.settings.ollama_url.clone();

        self.chat_messages.push(ChatMessage {
            role: "user".to_string(),
            content: format!("[AI Tool] {} Describe Screenshot: {}", icons::CAMERA, path),
            thinking: None,
            tool_result: None,
        });
        self.chat_processing = true;

        let (tx, rx) = mpsc::channel();
        self.ollama_receiver = Some(rx);

        std::thread::spawn(move || {
            let rt = super::super::shared_runtime();
            let result: Result<FeatureReply, String> = rt.block_on(async {
                let client = OllamaClient::new(&url, &model).map_err(|e| e.to_string())?;
                let out = features::describe_screenshot(
                    &client,
                    &model,
                    ScreenshotInput {
                        image_path: path.clone(),
                        question: "Describe what you see in this image in detail.".to_string(),
                        max_dim: 1024,
                    },
                )
                .await
                .map_err(|e| e.to_string())?;
                Ok((
                    out.answer,
                    out.thinking,
                    out.prompt_tokens,
                    out.completion_tokens,
                    out.duration_ms,
                    out.original_bytes,
                    out.sent_bytes,
                ))
            });
            let _ = match result {
                Ok((answer, thinking, p, c, ms, orig, sent)) => {
                    tx.send(OllamaMessage::ChatReply {
                        content: format!(
                            "{} Screenshot ({} B → {} B base64, {} prompt + {} completion tokens, {} ms)\n\n{}",
                            icons::CAMERA, orig, sent, p, c, ms, answer
                        ),
                        thinking,
                    })
                }
                Err(e) => tx.send(OllamaMessage::Error(format!(
                    "{} Screenshot failed: {}",
                    icons::CAMERA, e
                ))),
            };
        });
    }

    // ── UI rendering ───────────────────────────────────────────

    /// Render the AI Tools panel section. Inserted between the
    /// "Quick Actions" toolbar and the chat scrollback in
    /// `render_ai_chat`. The section can be hidden via
    /// `settings.ai_features_panel_visible`.
    pub(crate) fn render_ai_tools_panel(&mut self, ui: &mut egui::Ui) {
        if !self.settings.ai_features_panel_visible {
            return;
        }
        if !self.ollama_available {
            return;
        }
        use super::super::{card_frame, colors, section_heading};
        use eframe::egui;

        section_heading(ui, None, "AI Tools");
        card_frame(ui.style()).show(ui, |ui| {
            ui.label(
                egui::RichText::new(
                    "Each button targets one Ollama capability. Results appear in the chat below.",
                )
                .size(10.0)
                .color(colors::TEXT_SECONDARY),
            );
            ui.add_space(4.0);

            // ── 1. Semantic Search ────────────────────────────
            ui.horizontal(|ui| {
                let btn = egui::Button::new(
                    egui::RichText::new(format!("{} Semantic Search", icons::PATTERN)).size(12.0),
                )
                .fill(colors::ACCENT_BG);
                let can_run = self.ai_tools_enabled() && !self.ai_prompt_state.semantic_search_query.is_empty();
                if ui.add_enabled(can_run, btn).clicked() {
                    self.run_semantic_search();
                }
                ui.add(
                    egui::TextEdit::singleline(&mut self.ai_prompt_state.semantic_search_query)
                        .desired_width(ui.available_width() - 80.0)
                        .hint_text("e.g. 'find documents about my taxes'"),
                );
            });

            ui.add_space(2.0);

            // ── 2. Summarize Scan ─────────────────────────────
            ui.horizontal(|ui| {
                let btn = egui::Button::new(
                    egui::RichText::new(format!("{} Summarize Scan", icons::FILETYPE)).size(12.0),
                )
                .fill(colors::ACCENT_BG);
                let can_run = self.ai_tools_enabled() && self.scan_result.is_some();
                if ui.add_enabled(can_run, btn).clicked() {
                    self.run_summarize_scan();
                }
                ui.label(
                    egui::RichText::new(
                        format!(
                            "Model: {} · 2-3 sentence summary of the latest scan",
                            self.settings.ollama_model
                        ),
                    )
                    .size(10.0)
                    .color(colors::TEXT_MUTED),
                );
            });

            ui.add_space(2.0);

            // ── 3. Cleanup Plan ───────────────────────────────
            ui.horizontal(|ui| {
                let btn = egui::Button::new(
                    egui::RichText::new(format!("{} Cleanup Plan", icons::CLEANUP)).size(12.0),
                )
                .fill(colors::ACCENT_BG);
                let can_run = self.ai_tools_enabled() && !self.ai_prompt_state.cleanup_plan_question.is_empty();
                if ui.add_enabled(can_run, btn).clicked() {
                    self.run_cleanup_plan();
                }
                ui.add(
                    egui::TextEdit::singleline(&mut self.ai_prompt_state.cleanup_plan_question)
                        .desired_width(ui.available_width() - 80.0)
                        .hint_text("e.g. 'Plan how to free 50 GB on D:'"),
                );
            });
            ui.label(
                egui::RichText::new(
                    "Chain-of-thought is captured automatically and shown behind the 'Thinking Process' header in the result.",
                )
                .size(10.0)
                .color(colors::TEXT_MUTED),
            );

            ui.add_space(2.0);

            // ── 4. Describe Screenshot ────────────────────────
            ui.horizontal(|ui| {
                let btn = egui::Button::new(
                    egui::RichText::new(format!("{} Describe Screenshot", icons::CAMERA)).size(12.0),
                )
                .fill(colors::ACCENT_BG);
                let can_run = self.ai_tools_enabled() && self.ai_prompt_state.pending_screenshot_path.is_some();
                if ui.add_enabled(can_run, btn).clicked() {
                    self.run_describe_screenshot();
                }
                if secondary_button_small(ui, "Pick image…").clicked() {
                    if let Some(path) = rfd::FileDialog::new()
                        .add_filter("Image", &["png", "jpg", "jpeg"])
                        .pick_file()
                    {
                        self.ai_prompt_state.pending_screenshot_path = Some(path.to_string_lossy().to_string());
                    }
                }
                if let Some(p) = &self.ai_prompt_state.pending_screenshot_path {
                    let name = PathBuf::from(p)
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| p.clone());
                    ui.label(
                        egui::RichText::new(format!("{} {}", icons::TOOL, name))
                            .size(11.0)
                            .color(colors::ACCENT),
                    );
                } else {
                    ui.label(
                        egui::RichText::new("(no image selected)")
                            .size(10.0)
                            .color(colors::TEXT_MUTED),
                    );
                }
            });
        });
    }

    fn push_ai_tool_error(&mut self, msg: &str) {
        self.chat_messages.push(ChatMessage {
            role: "system".to_string(),
            content: format!("[AI Tool] {} {}", icons::WARNING, msg),
            thinking: None,
            tool_result: None,
        });
    }
}
