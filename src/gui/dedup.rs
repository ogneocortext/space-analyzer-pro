use super::*;
use std::collections::HashMap;
use std::path::PathBuf;

struct SimpleDeduplicator {
    exclude_patterns: Vec<String>,
    use_gpu: bool,
}

impl SimpleDeduplicator {
    fn new() -> Self {
        Self {
            exclude_patterns: vec!["node_modules".to_string(), ".git".to_string()],
            use_gpu: false,
        }
    }

    fn with_gpu(mut self, use_gpu: bool) -> Self {
        self.use_gpu = use_gpu;
        self
    }

    fn scan_directory(&self, path: &str) -> Result<Vec<(String, u64, String)>, String> {
        let files = self.collect_files(path)?;
        if files.is_empty() {
            return Ok(Vec::new());
        }

        // Hash using BatchHasher (parallel CPU or GPU-accelerated)
        let paths: Vec<PathBuf> = files.iter().map(|(p, _)| PathBuf::from(p)).collect();
        let hasher = gpu_compute::hash::BatchHasher::new().with_gpu(self.use_gpu);
        let hash_results = hasher.hash_files(&paths);

        let mut results = Vec::new();
        for (file_path, size) in files {
            let hash = hash_results
                .iter()
                .find(|r| r.path.to_string_lossy() == file_path)
                .map(|r| r.hash.clone())
                .unwrap_or_else(|| "unknown".to_string());
            results.push((file_path, size, hash));
        }
        Ok(results)
    }

    fn collect_files(&self, dir: &str) -> Result<Vec<(String, u64)>, String> {
        let path = std::path::Path::new(dir);
        if !path.exists() {
            return Err(format!("Path does not exist: {}", dir));
        }

        let mut files = Vec::new();
        for entry in walkdir::WalkDir::new(path)
            .follow_links(false)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let entry_path = entry.path();
            if entry_path.is_file() {
                let path_str = entry_path.to_string_lossy().to_string();
                if self.exclude_patterns.iter().any(|p| path_str.contains(p)) {
                    continue;
                }
                if let Ok(metadata) = std::fs::metadata(entry_path) {
                    files.push((path_str, metadata.len()));
                }
            }
        }
        Ok(files)
    }

    fn find_duplicates(&self, files: Vec<(String, u64, String)>) -> Vec<Vec<(String, u64)>> {
        let mut by_hash: HashMap<String, Vec<(String, u64)>> = HashMap::new();
        for (path, size, hash) in files {
            by_hash.entry(hash).or_default().push((path, size));
        }
        by_hash
            .into_values()
            .filter(|group| group.len() > 1)
            .collect()
    }
}

/// Parsed dedup result for structured display
#[allow(dead_code)]
struct DedupResult {
    duplicate_groups: Vec<Vec<(String, u64)>>,
    total_scanned: usize,
    scan_paths: Vec<String>,
}

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
            let deduplicator = SimpleDeduplicator::new().with_gpu(use_gpu);
            let mut all_files = Vec::new();
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
            let duplicate_groups = deduplicator.find_duplicates(all_files);

            if duplicate_groups.is_empty() {
                let _ = tx.send(format!(
                    "[DONE] Scanned {} files. No duplicates found.",
                    total_scanned
                ));
            } else {
                let total_duplicates: usize = duplicate_groups.iter().map(|g| g.len() - 1).sum();
                let potential_savings: u64 = duplicate_groups
                    .iter()
                    .map(|g| g[0].1 * (g.len() as u64 - 1))
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

    #[allow(dead_code)]
    pub(crate) fn render_dedup(&mut self, ui: &mut egui::Ui) {
        ui.heading("File Deduplication");
        ui.label("Find duplicate files using BLAKE3 hashing to recover disk space.");
        ui.separator();

        // Scan path input
        ui.horizontal(|ui| {
            ui.label("Scan path:");
            if ui.button("Browse...").clicked() {
                if let Some(path) = rfd::FileDialog::new().pick_folder() {
                    self.current_path = path;
                }
            }
            ui.label(self.current_path.display().to_string());
        });

        ui.horizontal(|ui| {
            ui.checkbox(&mut self.settings.default_deep_scan, "Deep scan");
            if ui
                .add_enabled(!self.is_deduplicating, egui::Button::new("Find Duplicates"))
                .clicked()
            {
                self.start_deduplication(
                    vec![self.current_path.to_string_lossy().to_string()],
                    self.settings.dedup_use_gpu,
                );
            }
            if ui
                .add_enabled(self.is_deduplicating, egui::Button::new("Cancel"))
                .clicked()
            {
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
        });
    }
}
