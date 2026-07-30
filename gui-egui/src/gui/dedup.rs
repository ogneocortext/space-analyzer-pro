use super::*;
use file_deduplicator::{DeduplicationConfig, DuplicateGroup, FileDeduplicator, FileInfo};
use std::sync::mpsc;

impl SpaceAnalyzerApp {
    pub fn start_deduplication(&mut self, paths: Vec<String>, use_gpu: bool) {
        if self.is_deduplicating {
            return;
        }
        self.is_deduplicating = true;
        let gpu_tag = if use_gpu { " (GPU)" } else { "" };
        self.status_message = Some(format!(
            "[Dedup] Scanning for duplicates in: {}{}",
            paths.join(", "),
            gpu_tag
        ));

        let (tx, rx) = mpsc::channel();
        self.dedup_receiver = Some(rx);

        std::thread::spawn(move || {
            let mut config = DeduplicationConfig {
                dry_run: true,
                create_hard_links: true,
                ..Default::default()
            };
            config
                .exclude_patterns
                .extend(vec!["node_modules".to_string(), ".git".to_string()]);
            // GPU is auto-detected by FileDeduplicator; force CPU if use_gpu is false
            let deduplicator = if use_gpu {
                FileDeduplicator::with_config(config)
            } else {
                let mut cpu_config = DeduplicationConfig {
                    dry_run: true,
                    create_hard_links: true,
                    ..Default::default()
                };
                cpu_config
                    .exclude_patterns
                    .extend(vec!["node_modules".to_string(), ".git".to_string()]);
                FileDeduplicator::with_config(cpu_config)
            };

            let mut all_files: Vec<FileInfo> = Vec::new();
            let mut errors = Vec::new();

            for path in &paths {
                match deduplicator.scan_directory(path) {
                    Ok(files) => all_files.extend(files),
                    Err(e) => errors.push(format!("Error scanning {}: {}", path, e)),
                }
            }

            if !errors.is_empty() {
                let _ = tx.send(format!("[ERROR] {}", errors.join("; ")));
                return;
            }

            let total_scanned = all_files.len();
            let duplicate_groups: Vec<DuplicateGroup> = deduplicator.find_duplicates(all_files);

            if duplicate_groups.is_empty() {
                let _ = tx.send(format!(
                    "[DONE] Scanned {} files. No duplicates found.",
                    total_scanned
                ));
            } else {
                let total_duplicates: usize =
                    duplicate_groups.iter().map(|g| g.files.len() - 1).sum();
                let potential_savings: u64 = duplicate_groups
                    .iter()
                    .map(|g| g.size * (g.files.len() as u64 - 1))
                    .sum();
                let _ = tx.send(format!(
                    "[DONE] {} groups, {} extra files, {} savings",
                    duplicate_groups.len(),
                    total_duplicates,
                    formatting::format_bytes(potential_savings)
                ));
            }
        });
    }

    pub fn process_dedup_messages(&mut self) {
        if let Some(rx) = self.dedup_receiver.take() {
            while let Ok(msg) = rx.try_recv() {
                if msg.starts_with("[DONE]") {
                    self.status_message = Some(msg);
                    self.is_deduplicating = false;
                    let completed_exec = self.active_workflow.as_mut().map(|exec| {
                        exec.complete();
                        exec.clone()
                    });
                    if let Some(exec) = completed_exec {
                        self.save_workflow_execution_to_db(&exec);
                    }
                } else if msg.starts_with("[ERROR]") {
                    self.status_message = Some(msg);
                    self.is_deduplicating = false;
                } else {
                    self.status_message = Some(msg);
                }
            }
            if self.is_deduplicating {
                self.dedup_receiver = Some(rx);
            }
        }
    }

    pub(crate) fn render_dedup(&mut self, ui: &mut egui::Ui) {
        ui.heading("File Deduplication");
        ui.label("Find duplicate files using BLAKE3 hashing to recover disk space.");
        ui.separator();

        // Scan path input
        ui.horizontal(|ui| {
            ui.label("Scan path:");
            if secondary_button(ui, "Browse...").clicked() {
                if let Some(path) = rfd::FileDialog::new().pick_folder() {
                    self.current_path = path;
                }
            }
            ui.label(self.current_path.display().to_string());
        });

        ui.horizontal(|ui| {
            ui.checkbox(&mut self.settings.dedup_use_gpu, "Use GPU acceleration");
            let find_btn = egui::Button::new(
                egui::RichText::new("Find Duplicates")
                    .size(13.0)
                    .strong()
                    .color(colors::BG_APP),
            )
            .fill(if self.is_deduplicating {
                colors::TEXT_MUTED
            } else {
                colors::ACCENT
            })
            .corner_radius(egui::CornerRadius::same(8))
            .min_size(egui::vec2(0.0, 36.0));
            if ui.add_enabled(!self.is_deduplicating, find_btn).clicked() {
                self.start_deduplication(
                    vec![self.current_path.to_string_lossy().to_string()],
                    self.settings.dedup_use_gpu,
                );
            }
            if danger_button(ui, "Cancel").clicked() {
                self.is_deduplicating = false;
                self.dedup_receiver = None;
            }
        });

        // Progress
        if self.is_deduplicating {
            ui.separator();
            ui.horizontal(|ui| {
                ui.spinner();
                ui.label("Scanning for duplicates...");
            });
        }

        // Status message
        if let Some(ref msg) = self.status_message {
            if msg.contains("[Dedup]") || msg.contains("[DONE]") || msg.contains("[ERROR]") {
                ui.separator();
                let color = if msg.contains("[ERROR]") {
                    egui::Color32::RED
                } else if msg.contains("[DONE]") {
                    egui::Color32::GREEN
                } else {
                    egui::Color32::YELLOW
                };
                ui.colored_label(color, msg);
            }
        }

        // Tips
        ui.separator();
        ui.collapsing("How it works", |ui| {
            ui.label("• Uses BLAKE3 cryptographic hashing for fast, accurate duplicate detection");
            ui.label("• Skips node_modules and .git directories automatically");
            ui.label("• Only files with identical content hashes are considered duplicates");
            ui.label("• Potential savings = (duplicate copies - 1) × file size");
            ui.label("• Hard links can reclaim space without copying data");
        });
    }
}
