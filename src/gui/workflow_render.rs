use super::*;

/// Escape HTML special characters to prevent XSS
fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#x27;")
}

impl SpaceAnalyzerApp {
    /// Common handler for workflow action types (except Scan first-run logic)
    fn handle_workflow_action(&mut self, action: &WorkflowAction) {
        match action {
            WorkflowAction::Scan { path, deep, .. } => {
                self.current_path = PathBuf::from(path);
                self.settings.default_deep_scan = *deep;
                self.start_scan();
            }
            WorkflowAction::Notify { title, message } => {
                self.push_notification(format!("{}: {}", title, message), NotificationLevel::Info);
            }
            WorkflowAction::AIAnalyze { prompt }
                if self.ollama_client.is_some() && self.scan_result.is_some() =>
            {
                if self.settings.auto_model_selection {
                    let _ = self.select_model_for_task("Complex Analysis");
                }
                let old_input = self.chat_input.clone();
                self.chat_input = prompt.clone();
                self.send_chat_message();
                self.chat_input = old_input;
            }
            WorkflowAction::AIAnalyze { .. } => {
                self.push_notification(
                    "Ollama not available or no scan results",
                    NotificationLevel::Warning,
                );
            }
            WorkflowAction::GenerateRecommendations => {
                self.generate_ai_recommendations();
            }
            WorkflowAction::FindDuplicates { paths, use_gpu } => {
                self.start_deduplication(paths.clone(), *use_gpu);
            }
            WorkflowAction::PredictStorage { days_ahead } => {
                if let Some(ref db) = self.db {
                    match db.get_storage_trend(50) {
                        Ok(trend) if trend.len() >= 2 => {
                            let last_size = trend.last().map(|(_, s)| *s).unwrap_or(0);
                            let first_size = trend.first().map(|(_, s)| *s).unwrap_or(0);
                            let growth = last_size as f64 - first_size as f64;
                            let first_ts = trend.first().map(|(ts, _)| ts.as_str()).unwrap_or("");
                            let last_ts = trend.last().map(|(ts, _)| ts.as_str()).unwrap_or("");
                            let first_dt = chrono::DateTime::parse_from_rfc3339(first_ts).ok();
                            let last_dt = chrono::DateTime::parse_from_rfc3339(last_ts).ok();
                            let days_between = match (first_dt, last_dt) {
                                (Some(f), Some(l)) => {
                                    let diff = l.signed_duration_since(f);
                                    let days = diff.num_seconds() as f64 / 86400.0;
                                    if days > 0.0 {
                                        days
                                    } else {
                                        (trend.len() - 1) as f64 * 7.0
                                    }
                                }
                                _ => (trend.len() - 1) as f64 * 7.0,
                            };
                            let daily_growth = if days_between > 0.0 {
                                growth / days_between
                            } else {
                                0.0
                            };
                            let predicted = last_size as f64 + daily_growth * *days_ahead as f64;
                            self.push_notification(
                                format!(
                                    "Prediction: In {} days: {:.2} MB (growth: {:.2} MB/day)",
                                    days_ahead,
                                    predicted / (1024.0 * 1024.0),
                                    daily_growth / (1024.0 * 1024.0)
                                ),
                                NotificationLevel::Info,
                            );
                        }
                        _ => {
                            self.push_notification(
                                "Not enough historical data for prediction",
                                NotificationLevel::Warning,
                            );
                        }
                    }
                }
            }
            WorkflowAction::Export { format, path } => {
                self.execute_workflow_export(format, path);
            }
        }
    }

    pub fn run_workflow(&mut self, workflow_id: &str) {
        if let Some(index) = self.workflows.iter().position(|w| w.id == workflow_id) {
            let now = chrono::Utc::now().to_rfc3339();
            self.workflows[index].last_run = Some(now.clone());
            let workflow = self.workflows[index].clone();
            let execution = workflow.start_execution();
            self.active_workflow = Some(execution);
            self.pending_workflow_actions.clear();

            let mut scan_started = false;
            for action in &workflow.actions {
                match action {
                    WorkflowAction::Scan { .. } if !scan_started => {
                        self.handle_workflow_action(action);
                        scan_started = true;
                    }
                    WorkflowAction::Scan { .. } => {
                        self.pending_workflow_actions.push(action.clone());
                    }
                    _ => self.handle_workflow_action(action),
                }
            }
            self.push_notification(
                format!("Started: {}", workflow.name),
                NotificationLevel::Info,
            );
        }
    }

    fn execute_workflow_export(&mut self, format: &workflows::ExportFormat, path: &Option<String>) {
        if let Some(ref result) = self.scan_result {
            let ext = match format {
                workflows::ExportFormat::Json => "json",
                workflows::ExportFormat::Csv => "csv",
                workflows::ExportFormat::Html | workflows::ExportFormat::Pdf => "html",
            };
            let export_path = path.clone().unwrap_or_else(|| {
                format!(
                    "scan_export_{}.{}",
                    chrono::Utc::now().timestamp_millis(),
                    ext
                )
            });
            let content = match format {
                workflows::ExportFormat::Json => {
                    serde_json::to_string_pretty(result).unwrap_or_default()
                }
                workflows::ExportFormat::Csv => {
                    let mut csv = String::from("path,size_bytes\n");
                    for file in &result.largest_files {
                        csv.push_str(&format!("{},{}\n", file.path, file.size));
                    }
                    csv
                }
                workflows::ExportFormat::Html => {
                    let mut html = String::from("<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Space Analyzer Report</title>");
                    html.push_str("<style>body{font-family:sans-serif;margin:20px;background:#1a1a1a;color:#e0e0e0}table{border-collapse:collapse;width:100%}th,td{border:1px solid #444;padding:8px;text-align:left}th{background:#2d5a27;color:white}tr:nth-child(even){background:#222}</style>");
                    html.push_str("</head><body>");
                    html.push_str("<h1>Space Analyzer Report</h1>");
                    html.push_str(&format!("<p>Path: {}</p>", escape_html(&result.path)));
                    html.push_str(&format!(
                        "<p>Total Files: {} | Total Size: {:.2} MB | Duration: {:.1}s</p>",
                        result.total_files, result.total_size_mb, result.duration_secs
                    ));
                    html.push_str(
                        "<h2>File Types</h2><table><tr><th>Extension</th><th>Count</th></tr>",
                    );
                    let mut sorted: Vec<_> = result.file_types.iter().collect();
                    sorted.sort_by(|a, b| b.1.cmp(a.1));
                    for (ext, count) in sorted {
                        html.push_str(&format!(
                            "<tr><td>.{}</td><td>{}</td></tr>",
                            escape_html(ext),
                            count
                        ));
                    }
                    html.push_str(
                        "</table><h2>Largest Files</h2><table><tr><th>Path</th><th>Size</th></tr>",
                    );
                     for file in &result.largest_files {
                         html.push_str(&format!(
                             "<tr><td>{}</td><td>{:.2} MB</td></tr>",
                             escape_html(&file.path),
                             file.size as f64 / (1024.0 * 1024.0)
                         ));
                     }
                    html.push_str("</table></body></html>");
                    html
                }
                workflows::ExportFormat::Pdf => {
                    let mut html = String::from("<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Space Analyzer Report</title>");
                    html.push_str("<style>@media print{body{margin:0}}body{font-family:sans-serif;margin:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px}th{background:#4CAF50;color:white}</style>");
                    html.push_str("</head><body>");
                    html.push_str(&format!(
                        "<h1>Scan: {} files, {:.2} MB</h1>",
                        result.total_files, result.total_size_mb
                    ));
                    html.push_str(&format!("<p>Path: {}</p>", escape_html(&result.path)));
                    html.push_str(
                        "<h2>File Types</h2><table><tr><th>Extension</th><th>Count</th></tr>",
                    );
                    let mut sorted: Vec<_> = result.file_types.iter().collect();
                    sorted.sort_by(|a, b| b.1.cmp(a.1));
                    for (ext, count) in sorted {
                        html.push_str(&format!(
                            "<tr><td>.{}</td><td>{}</td></tr>",
                            escape_html(ext),
                            count
                        ));
                    }
                    html.push_str("</table><script>window.print();</script></body></html>");
                    self.push_notification(
                        "PDF: opened print dialog for 'Save as PDF'",
                        NotificationLevel::Info,
                    );
                    html
                }
            };
            if let Err(e) = std::fs::write(&export_path, content) {
                self.push_notification(
                    format!("Export failed: {}", sanitize_error_message(&e.to_string())),
                    NotificationLevel::Error,
                );
            } else {
                self.push_notification(
                    format!("Exported to: {}", export_path),
                    NotificationLevel::Success,
                );
            }
        } else {
            self.push_notification("No scan results to export", NotificationLevel::Warning);
        }
    }

    pub(crate) fn execute_pending_workflow_actions(&mut self) {
        let actions: Vec<WorkflowAction> = self.pending_workflow_actions.drain(..).collect();
        for action in &actions {
            self.handle_workflow_action(action);
        }
    }

    /// Generate storage recommendations using either heuristic rules or AI.
    /// Auto-falls back to heuristic if AI is enabled but Ollama is unavailable.
    pub fn generate_ai_recommendations(&mut self) {
        let use_ai = self.settings.ai_recommendation_enabled
            && self.ollama_client.is_some()
            && self.ollama_available
            && self.scan_result.is_some();

        if use_ai {
            self.start_ai_recommendation();
        } else {
            self.generate_storage_recommendations();
        }
    }

    /// Heuristic rule-based recommendations (no Ollama needed)
    pub fn generate_storage_recommendations(&mut self) {
        self.ai_recommendation_source = "heuristic".to_string();
        self.ai_recommendation_pending = false;
        if let Some(ref result) = self.scan_result {
            self.ai_recommendations = StorageInsights::generate_recommendations(result);
        } else {
            self.ai_recommendations.clear();
        }
    }

    /// Start async AI-powered recommendation via Ollama
    fn start_ai_recommendation(&mut self) {
        if self.ai_recommendation_pending {
            return;
        }
        let result = match self.scan_result {
            Some(ref r) => r.clone(),
            None => return,
        };
        let client = match self.ollama_client {
            Some(ref c) => c.clone(),
            None => {
                self.generate_storage_recommendations();
                return;
            }
        };

        self.ai_recommendation_pending = true;
        self.ai_recommendation_source = "ai".to_string();
        let (tx, rx) = mpsc::channel();
        self.ai_recommendation_receiver = Some(rx);

        let model = self.settings.ollama_model.clone();
        std::thread::spawn(move || {
            let rt = super::shared_runtime();
            let (recommendations, is_ai) = rt.block_on(async {
                generate_ai_recommendations_async(&client, &model, &result).await
            });
            let _ = tx.send((recommendations, is_ai));
        });
    }

    /// Check for completed AI recommendations
    pub fn process_ai_recommendations(&mut self) {
        if let Some(rx) = self.ai_recommendation_receiver.take() {
            if let Ok((recommendations, is_ai)) = rx.try_recv() {
                self.ai_recommendations = recommendations;
                self.ai_recommendation_source = if is_ai {
                    "ai".to_string()
                } else {
                    "heuristic".to_string()
                };
                self.ai_recommendation_pending = false;
            } else {
                self.ai_recommendation_receiver = Some(rx);
            }
        }
    }

    pub fn process_scheduled_workflows(&mut self) {
        use chrono::Local;
        use workflows::matches_cron;

        let now = Local::now();
        let current_minute = now.format("%Y-%m-%dT%H:%M").to_string();

        let to_run: Vec<String> = self
            .workflows
            .iter()
            .filter(|w| w.enabled)
            .filter_map(|w| match &w.trigger {
                WorkflowTrigger::Scheduled(cron_expr) => {
                    if let Some(ref last_run) = w.last_run {
                        if last_run.starts_with(&current_minute[..16]) {
                            return None;
                        }
                    }
                    if matches_cron(cron_expr, &now) {
                        Some(w.id.clone())
                    } else {
                        None
                    }
                }
                WorkflowTrigger::LowDiskSpace { threshold_percent } => {
                    if let Some(ref last_run) = w.last_run {
                        if last_run.starts_with(&current_minute[..16]) {
                            return None;
                        }
                    }
                    let triggered = self
                        .system_state
                        .disk_volumes
                        .iter()
                        .any(|v| v.usage_percent >= *threshold_percent as f32);
                    if triggered {
                        Some(w.id.clone())
                    } else {
                        None
                    }
                }
                WorkflowTrigger::OnStartup => {
                    if w.last_run.is_none() {
                        Some(w.id.clone())
                    } else {
                        None
                    }
                }
                _ => None,
            })
            .collect();
        for id in &to_run {
            self.run_workflow(id);
        }
    }

    /// Load workflow execution history from database
    pub fn load_workflow_history(&mut self) {
        if let Some(ref db) = self.db {
            self.workflow_history = db.get_workflow_history(100).unwrap_or_default();
        }
    }

    /// Save a workflow execution to database
    pub fn save_workflow_execution_to_db(&self, exec: &WorkflowExecution) {
        if let Some(ref db) = self.db {
            if let Err(e) = db.save_workflow_execution(exec) {
                eprintln!("Warning: Failed to save workflow execution: {}", e);
            }
        }
    }

    /// Export all workflows to JSON
    pub fn export_workflows(&mut self) {
        if let Some(path) = rfd::FileDialog::new()
            .set_title("Export Workflows")
            .add_filter("JSON", &["json"])
            .save_file()
        {
            if let Ok(data) = serde_json::to_string_pretty(&self.workflows) {
                if let Err(e) = std::fs::write(&path, data) {
                    self.push_notification(
                        format!("Export failed: {}", e),
                        NotificationLevel::Error,
                    );
                } else {
                    self.push_notification("Workflows exported", NotificationLevel::Success);
                }
            }
        }
    }

    /// Import workflows from JSON
    pub fn import_workflows(&mut self) {
        if let Some(path) = rfd::FileDialog::new()
            .set_title("Import Workflows")
            .add_filter("JSON", &["json"])
            .pick_file()
        {
            if let Ok(data) = std::fs::read_to_string(&path) {
                if let Ok(imported) = serde_json::from_str::<Vec<Workflow>>(&data) {
                    let count = imported.len();
                    for workflow in imported {
                        if !self.workflows.iter().any(|w| w.id == workflow.id) {
                            self.workflows.push(workflow);
                        }
                    }
                    self.push_notification(
                        format!("Imported {} workflows", count),
                        NotificationLevel::Success,
                    );
                } else {
                    self.push_notification("Invalid workflow file", NotificationLevel::Error);
                }
            }
        }
    }

    /// Save a custom workflow
    pub fn save_custom_workflow(&mut self, workflow: Workflow) {
        if let Some(pos) = self.workflows.iter().position(|w| w.id == workflow.id) {
            self.workflows[pos] = workflow;
        } else {
            self.workflows.push(workflow);
        }
        self.workflow_editor_state.show_workflow_editor = false;
        self.workflow_editor_state.editing_workflow = None;
        self.push_notification("Workflow saved", NotificationLevel::Success);
    }

    /// Delete a workflow
    pub fn delete_workflow(&mut self, workflow_id: &str) {
        self.workflows.retain(|w| w.id != workflow_id);
        self.push_notification("Workflow deleted", NotificationLevel::Success);
    }

    pub(crate) fn render_workflows(&mut self, ui: &mut egui::Ui) {
        ui.vertical(|ui| {
            ui.horizontal(|ui| {
                ui.vertical(|ui| {
                    ui.label(
                        egui::RichText::new("Workflows")
                            .text_style(egui::TextStyle::Name("PageTitle".into()))
                            .color(colors::TEXT_PRIMARY),
                    );
                    ui.label(
                        egui::RichText::new("Automate scans, analysis, and cleanup routines.")
                            .color(colors::TEXT_SECONDARY)
                            .small(),
                    );
                });
            });
            ui.add_space(12.0);

            if let Some(ref execution) = self.active_workflow {
                app_card(ui, |ui| {
                    let status_color = match execution.status {
                        ExecutionStatus::Running => colors::WARNING,
                        ExecutionStatus::Completed => colors::SUCCESS,
                        ExecutionStatus::Failed => colors::ERROR,
                        _ => colors::TEXT_MUTED,
                    };
                    ui.horizontal(|ui| {
                        badge(ui, &format!("{}", execution.status), status_color);
                        ui.label(
                            egui::RichText::new(&execution.workflow_name)
                                .strong()
                                .color(colors::TEXT_PRIMARY),
                        );
                        if execution.status == ExecutionStatus::Running {
                            ui.label(
                                egui::RichText::new(format!(
                                    "{}/{} actions",
                                    execution.actions_completed, execution.total_actions
                                ))
                                .size(11.0)
                                .color(colors::TEXT_SECONDARY),
                            );
                            ui.spinner();
                        }
                    });
                });
                ui.add_space(12.0);
            }

            let mut run_workflow_id: Option<String> = None;
            let mut delete_workflow_id: Option<String> = None;
            let mut edit_workflow_id: Option<String> = None;

            if self.workflows.is_empty() {
                empty_state(
                    ui,
                    icons::WORKFLOW,
                    "No workflows yet",
                    "Create a workflow to automate scans, analysis, and cleanup routines.",
                    Some(("New workflow", &mut || {
                        let id = format!("custom-{}", chrono::Utc::now().timestamp_millis());
                        self.workflow_editor_state.editing_workflow = Some(Workflow::new(
                            &id,
                            "New Workflow",
                            workflows::WorkflowCategory::Custom,
                        ));
                        self.workflow_editor_state.show_workflow_editor = true;
                    })),
                );
            } else {
                let mut enable_workflow_ids: Vec<String> = Vec::new();
                for workflow in &self.workflows {
                    let workflow_id = workflow.id.clone();
                    app_card(ui, |ui| {
                        ui.horizontal(|ui| {
                            ui.vertical(|ui| {
                                ui.horizontal(|ui| {
                                    ui.label(
                                        egui::RichText::new(&workflow.name)
                                            .strong()
                                            .color(colors::TEXT_PRIMARY),
                                    );
                                    badge(
                                        ui,
                                        &format!("{}", workflow.category),
                                        colors::ACCENT_DIM,
                                    );
                                    if workflow.enabled {
                                        status_badge(ui, "Enabled", Tone::Success);
                                    } else {
                                        status_badge(ui, "Disabled", Tone::Neutral);
                                    }
                                });
                                ui.label(
                                    egui::RichText::new(&workflow.description)
                                        .size(11.0)
                                        .color(colors::TEXT_SECONDARY),
                                );
                                ui.horizontal(|ui| {
                                    badge(
                                        ui,
                                        &format!("{} actions", workflow.actions.len()),
                                        colors::TEXT_SECONDARY,
                                    );
                                    if let Some(ref last_run) = workflow.last_run {
                                        ui.label(
                                            egui::RichText::new(format!("Last: {}", last_run))
                                                .size(10.0)
                                                .color(colors::TEXT_MUTED),
                                        );
                                    }
                                });
                                if !workflow.enabled {
                                    ui.add_space(4.0);
                                    ui.horizontal(|ui| {
                                        ui.label(
                                            egui::RichText::new(
                                                "Enable this workflow before running it.",
                                            )
                                            .size(11.0)
                                            .color(colors::TEXT_MUTED),
                                        );
                                        if secondary_button(ui, "Enable workflow").clicked() {
                                            enable_workflow_ids.push(workflow_id.clone());
                                        }
                                    });
                                }
                            });
                            ui.with_layout(
                                egui::Layout::right_to_left(egui::Align::Center),
                                |ui| {
                                    if ui
                                        .add(
                                            egui::Button::new(
                                                egui::RichText::new(icons::X).color(colors::ERROR),
                                            )
                                            .fill(colors::ERROR.linear_multiply(0.15))
                                            .corner_radius(egui::CornerRadius::same(4))
                                            .min_size(egui::vec2(28.0, 28.0)),
                                        )
                                        .clicked()
                                    {
                                        delete_workflow_id = Some(workflow.id.clone());
                                    }
                                    if tiny_button(ui, "Edit").clicked() {
                                        edit_workflow_id = Some(workflow.id.clone());
                                    }
                                    let run_btn = egui::Button::new(
                                        egui::RichText::new(format!("{} Run", icons::PLAY))
                                            .size(12.0)
                                            .strong()
                                            .color(colors::BG_APP),
                                    )
                                    .fill(colors::ACCENT)
                                    .corner_radius(egui::CornerRadius::same(8))
                                    .min_size(egui::vec2(80.0, 32.0));

                                    if ui.add_enabled(workflow.enabled, run_btn).clicked() {
                                        run_workflow_id = Some(workflow.id.clone());
                                    }
                                },
                            );
                        });
                    });
                }
                for id in enable_workflow_ids {
                    if let Some(w) = self.workflows.iter_mut().find(|w| w.id == id) {
                        w.enabled = true;
                    }
                }
            }

            if let Some(id) = run_workflow_id {
                self.run_workflow(&id);
            }
            if let Some(id) = delete_workflow_id {
                self.delete_workflow(&id);
            }
            if let Some(id) = edit_workflow_id {
                if let Some(workflow) = self.workflows.iter().find(|w| w.id == id).cloned() {
                    self.workflow_editor_state.editing_workflow = Some(workflow);
                    self.workflow_editor_state.show_workflow_editor = true;
                }
            }

            ui.add_space(8.0);
            app_card(ui, |ui| {
                ui.horizontal(|ui| {
                    if primary_button(ui, "+ New workflow").clicked() {
                        let id = format!("custom-{}", chrono::Utc::now().timestamp_millis());
                        self.workflow_editor_state.editing_workflow = Some(Workflow::new(
                            &id,
                            "New Workflow",
                            workflows::WorkflowCategory::Custom,
                        ));
                        self.workflow_editor_state.show_workflow_editor = true;
                    }
                    if secondary_button(ui, "Import").clicked() {
                        self.import_workflows();
                    }
                    if secondary_button(ui, "Export all").clicked() {
                        self.export_workflows();
                    }
                });
            });

            if !self.workflow_history.is_empty() {
                ui.add_space(4.0);
                section_header(ui, Some(icons::SCROLL), "Execution history");
                app_card(ui, |ui| {
                    for exec in self.workflow_history.iter().rev().take(10) {
                        let color = match exec.status {
                            ExecutionStatus::Completed => colors::SUCCESS,
                            ExecutionStatus::Failed => colors::ERROR,
                            ExecutionStatus::Running => colors::WARNING,
                            _ => colors::TEXT_MUTED,
                        };
                        ui.horizontal(|ui| {
                            badge(ui, &format!("{}", exec.status), color);
                            ui.label(&exec.workflow_name);
                            ui.label(
                                egui::RichText::new(&exec.started_at)
                                    .size(10.0)
                                    .color(colors::TEXT_MUTED),
                            );
                        });
                    }
                });
            }

            if self.workflow_editor_state.show_workflow_editor {
                self.render_workflow_editor(ui);
            }
        });
    }

    fn render_workflow_editor(&mut self, ui: &mut egui::Ui) {
        egui::Window::new("Workflow editor")
            .collapsible(false)
            .resizable(false)
            .default_width(550.0)
            .show(ui.ctx(), |ui| {
                if let Some(ref mut workflow) = self.workflow_editor_state.editing_workflow {
                    ui.horizontal(|ui| {
                        ui.label("Name:");
                        ui.text_edit_singleline(&mut workflow.name);
                    });
                    ui.horizontal(|ui| {
                        ui.label("Description:");
                        ui.text_edit_singleline(&mut workflow.description);
                    });
                    ui.horizontal(|ui| {
                        ui.label("Category:");
                        egui::ComboBox::from_id_salt("category")
                            .selected_text(format!("{}", workflow.category))
                            .show_ui(ui, |ui| {
                                ui.selectable_value(
                                    &mut workflow.category,
                                    workflows::WorkflowCategory::Maintenance,
                                    "Maintenance",
                                );
                                ui.selectable_value(
                                    &mut workflow.category,
                                    workflows::WorkflowCategory::Optimization,
                                    "Optimization",
                                );
                                ui.selectable_value(
                                    &mut workflow.category,
                                    workflows::WorkflowCategory::Organization,
                                    "Organization",
                                );
                                ui.selectable_value(
                                    &mut workflow.category,
                                    workflows::WorkflowCategory::Monitoring,
                                    "Monitoring",
                                );
                                ui.selectable_value(
                                    &mut workflow.category,
                                    workflows::WorkflowCategory::Custom,
                                    "Custom",
                                );
                            });
                    });
                    ui.horizontal(|ui| {
                        ui.label("Enabled:");
                        ui.checkbox(&mut workflow.enabled, "");
                    });

                    ui.separator();
                    ui.label(egui::RichText::new("Trigger").strong());

                    let current_trigger_type = match &workflow.trigger {
                        workflows::WorkflowTrigger::Manual => "Manual",
                        workflows::WorkflowTrigger::Scheduled(_) => "Scheduled (Cron)",
                        workflows::WorkflowTrigger::LowDiskSpace { .. } => "Low Disk Space",
                        workflows::WorkflowTrigger::FileSystemChange => "File System Change",
                        workflows::WorkflowTrigger::OnStartup => "On Startup",
                    };

                    egui::ComboBox::from_id_salt("trigger_type")
                        .selected_text(current_trigger_type)
                        .show_ui(ui, |ui| {
                            if ui
                                .selectable_label(
                                    matches!(workflow.trigger, workflows::WorkflowTrigger::Manual),
                                    "Manual",
                                )
                                .clicked()
                            {
                                workflow.trigger = workflows::WorkflowTrigger::Manual;
                            }
                            if ui
                                .selectable_label(
                                    matches!(
                                        workflow.trigger,
                                        workflows::WorkflowTrigger::Scheduled(_)
                                    ),
                                    "Scheduled (Cron)",
                                )
                                .clicked()
                            {
                                workflow.trigger =
                                    workflows::WorkflowTrigger::Scheduled("0 0 * * *".to_string());
                            }
                            if ui
                                .selectable_label(
                                    matches!(
                                        workflow.trigger,
                                        workflows::WorkflowTrigger::LowDiskSpace { .. }
                                    ),
                                    "Low Disk Space",
                                )
                                .clicked()
                            {
                                workflow.trigger = workflows::WorkflowTrigger::LowDiskSpace {
                                    threshold_percent: 90,
                                };
                            }
                            if ui
                                .selectable_label(
                                    matches!(
                                        workflow.trigger,
                                        workflows::WorkflowTrigger::OnStartup
                                    ),
                                    "On Startup",
                                )
                                .clicked()
                            {
                                workflow.trigger = workflows::WorkflowTrigger::OnStartup;
                            }
                        });

                    match &mut workflow.trigger {
                        workflows::WorkflowTrigger::Manual => {
                            ui.label(
                                egui::RichText::new("Workflow runs only when manually triggered.")
                                    .size(11.0)
                                    .color(colors::TEXT_MUTED),
                            );
                        }
                        workflows::WorkflowTrigger::Scheduled(cron) => {
                            ui.horizontal(|ui| {
                                ui.label("Schedule:");
                                ui.text_edit_singleline(cron);
                            });
                            ui.horizontal(|ui| {
                                ui.label(
                                    egui::RichText::new("Presets:")
                                        .size(11.0)
                                        .color(colors::TEXT_SECONDARY),
                                );
                                if tiny_button(ui, "Daily").clicked() {
                                    *cron = "0 0 * * *".to_string();
                                }
                                if tiny_button(ui, "Weekly").clicked() {
                                    *cron = "0 0 * * 1".to_string();
                                }
                                if tiny_button(ui, "Monthly").clicked() {
                                    *cron = "0 0 1 * *".to_string();
                                }
                                if tiny_button(ui, "Hourly").clicked() {
                                    *cron = "0 * * * *".to_string();
                                }
                            });
                        }
                        workflows::WorkflowTrigger::LowDiskSpace { threshold_percent } => {
                            ui.horizontal(|ui| {
                                ui.label("Alert when usage exceeds:");
                                ui.add(
                                    egui::DragValue::new(threshold_percent)
                                        .range(1..=99)
                                        .suffix("%"),
                                );
                            });
                        }
                        workflows::WorkflowTrigger::OnStartup => {
                            ui.label(
                                egui::RichText::new("Workflow runs when the application starts.")
                                    .size(11.0)
                                    .color(colors::TEXT_MUTED),
                            );
                        }
                        _ => {
                            ui.label(
                                egui::RichText::new("(Automatic trigger)")
                                    .size(11.0)
                                    .color(colors::TEXT_MUTED),
                            );
                        }
                    }

                    ui.separator();
                    ui.label(egui::RichText::new("Actions").strong());
                    ui.label(
                        egui::RichText::new("Actions run in order from top to bottom.")
                            .size(11.0)
                            .color(colors::TEXT_MUTED),
                    );

                    let mut remove_action: Option<usize> = None;
                    let mut move_action: Option<(usize, i32)> = None;

                    for (i, action) in workflow.actions.iter().enumerate() {
                        ui.horizontal(|ui| {
                            if tiny_button(ui, "▲").clicked() && i > 0 {
                                move_action = Some((i, -1));
                            }
                            if tiny_button(ui, "▼").clicked() && i + 1 < workflow.actions.len() {
                                move_action = Some((i, 1));
                            }

                            let (label, details) = match action {
                                workflows::WorkflowAction::Scan { path, deep, .. } => (
                                    "Scan",
                                    format!("{} ({})", path, if *deep { "deep" } else { "quick" }),
                                ),
                                workflows::WorkflowAction::FindDuplicates { paths, .. } => {
                                    ("Find Duplicates", format!("{} path(s)", paths.len()))
                                }
                                workflows::WorkflowAction::PredictStorage {
                                    days_ahead, ..
                                } => ("Predict Storage", format!("{} days ahead", days_ahead)),
                                workflows::WorkflowAction::GenerateRecommendations => {
                                    ("Generate Recommendations", String::new())
                                }
                                workflows::WorkflowAction::Export { format, .. } => {
                                    ("Export", format!("{:?}", format))
                                }
                                workflows::WorkflowAction::Notify { title, .. } => {
                                    ("Notify", title.clone())
                                }
                                workflows::WorkflowAction::AIAnalyze { prompt } => (
                                    "AI Analyze",
                                    format!("{}...", &prompt[..prompt.len().min(25)]),
                                ),
                            };

                            badge(ui, label, colors::ACCENT);
                            if !details.is_empty() {
                                ui.label(
                                    egui::RichText::new(details)
                                        .size(11.0)
                                        .color(colors::TEXT_SECONDARY),
                                );
                            }
                            if tiny_button(ui, "X").clicked() {
                                remove_action = Some(i);
                            }
                        });
                    }

                    if let Some(i) = remove_action {
                        workflow.actions.remove(i);
                    }
                    if let Some((i, dir)) = move_action {
                        let new_pos = (i as i32 + dir) as usize;
                        if new_pos < workflow.actions.len() {
                            workflow.actions.swap(i, new_pos);
                        }
                    }

                    ui.separator();
                    ui.label(egui::RichText::new("Add action").strong());
                    ui.horizontal_wrapped(|ui| {
                        let actions = [
                            (
                                format!("{} Scan", icons::FOLDER),
                                workflows::WorkflowAction::Scan {
                                    path: self.current_path.to_string_lossy().to_string(),
                                    deep: self.settings.default_deep_scan,
                                    min_size: None,
                                },
                            ),
                            (
                                format!("{} Find duplicates", icons::MAGNIFYING_GLASS),
                                workflows::WorkflowAction::FindDuplicates {
                                    paths: vec![self.current_path.to_string_lossy().to_string()],
                                    use_gpu: self.settings.dedup_use_gpu,
                                },
                            ),
                            (
                                format!("{} Predict storage", icons::TREND),
                                workflows::WorkflowAction::PredictStorage { days_ahead: 30 },
                            ),
                            (
                                format!("{} Recommendations", icons::LIGHTBULB),
                                workflows::WorkflowAction::GenerateRecommendations,
                            ),
                            (
                                format!("{} Export", icons::DOWNLOAD),
                                workflows::WorkflowAction::Export {
                                    format: workflows::ExportFormat::Html,
                                    path: None,
                                },
                            ),
                            (
                                format!("{} Notify", icons::BELL),
                                workflows::WorkflowAction::Notify {
                                    title: "Workflow Complete".to_string(),
                                    message: "Your workflow has finished executing.".to_string(),
                                },
                            ),
                            (
                                format!("{} AI analyze", icons::MODEL),
                                workflows::WorkflowAction::AIAnalyze {
                                    prompt: "Analyze the scan results and provide recommendations."
                                        .to_string(),
                                },
                            ),
                        ];

                        for (label, action) in actions {
                            if secondary_button_small(ui, &label).clicked() {
                                workflow.actions.push(action);
                            }
                        }
                    });

                    ui.separator();
                    if workflow.name.is_empty() {
                        badge(ui, "Workflow name is required", colors::ERROR);
                    }
                    if workflow.actions.is_empty() {
                        badge(ui, "Add at least one action", colors::WARNING);
                    }

                    ui.separator();
                    let workflow_clone = workflow.clone();
                    let _can_save = !workflow.name.is_empty() && !workflow.actions.is_empty();
                    ui.horizontal(|ui| {
                        if primary_button(ui, "Save").clicked() {
                            self.save_custom_workflow(workflow_clone);
                        }
                        if secondary_button(ui, "Cancel").clicked() {
                            self.workflow_editor_state.show_workflow_editor = false;
                            self.workflow_editor_state.editing_workflow = None;
                        }
                    });
                }
            });
    }
}

/// Ask Ollama to generate AI-powered storage recommendations from scan data.
/// Falls back to heuristic rules if the AI call fails or returns unparseable output.
/// Returns (recommendations, was_ai) — was_ai is true if Ollama returned parseable results.
async fn generate_ai_recommendations_async(
    client: &OllamaClient,
    model: &str,
    result: &ScanResult,
) -> (Vec<AIRecommendation>, bool) {
    use ollama::ChatMessage;

    let file_type_summary: String = result
        .file_types
        .iter()
        .take(15)
        .map(|(ext, count)| format!("  .{}: {} files", ext, count))
        .collect::<Vec<_>>()
        .join("\n");
    let large_files_summary: String = result
        .largest_files
        .iter()
        .take(10)
        .map(|(path, size)| {
            format!(
                "  {} ({})",
                path,
                crate::gui_common::formatting::format_bytes(*size)
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    let system_prompt = "You are a storage optimization expert. Analyze the scan data and suggest actionable recommendations. \
        Respond with ONLY a valid JSON array of objects, each with these fields: \
        \"priority\" (\"Low\", \"Medium\", \"High\", or \"Critical\"), \
        \"category\" (\"Storage\", \"Performance\", \"Organization\", or \"Security\"), \
        \"title\" (short summary), \
        \"description\" (detailed explanation with specific file paths and sizes), \
        \"action\" (\"Cleanup\", \"Review\", \"Optimize\", or \"Archive\"). \
        Give 3-5 recommendations. No markdown, no code fences, no explanation — only the JSON array.";

    let user_prompt = format!(
        "Scan results for path '{}':\nTotal files: {}\nTotal size: {}\n\nFile types:\n{}\n\nLargest files:\n{}",
        result.path, result.total_files, crate::gui_common::formatting::format_bytes(result.total_size_bytes),
        if file_type_summary.is_empty() { "  (none)" } else { &file_type_summary },
        if large_files_summary.is_empty() { "  (none)" } else { &large_files_summary }
    );

    let ai_client = match client.with_model(model) {
        Ok(c) => c,
        Err(_) => return (StorageInsights::generate_recommendations(result), false),
    };

    let messages = vec![
        ChatMessage::system(system_prompt),
        ChatMessage::user(&user_prompt),
    ];

    let response = ai_client
        .chat_with_tools(messages, None, Some("none".to_string()), None)
        .await;

    match response {
        Ok((content, _, _, _)) => {
            let cleaned = content
                .trim()
                .trim_start_matches("```json")
                .trim_start_matches("```")
                .trim_end_matches("```")
                .trim();
            match serde_json::from_str::<Vec<AIRecommendation>>(cleaned) {
                Ok(recs) if !recs.is_empty() => (recs, true),
                _ => match try_extract_recommendations(cleaned) {
                    Some(recs) => (recs, true),
                    None => (StorageInsights::generate_recommendations(result), false),
                },
            }
        }
        Err(_) => (StorageInsights::generate_recommendations(result), false),
    }
}

/// Try to extract AIRecommendations from a non-array JSON structure
fn try_extract_recommendations(text: &str) -> Option<Vec<AIRecommendation>> {
    if let Ok(val) = serde_json::from_str::<serde_json::Value>(text) {
        if let Some(arr) = val.get("recommendations").and_then(|v| v.as_array()) {
            let recs: Vec<AIRecommendation> = arr
                .iter()
                .filter_map(|v| serde_json::from_value(v.clone()).ok())
                .collect();
            if !recs.is_empty() {
                return Some(recs);
            }
        }
    }
    None
}
