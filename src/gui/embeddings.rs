use super::*;

impl SpaceAnalyzerApp {
    pub(crate) fn start_embedding_index(&mut self) {
        if self.is_indexing || self.scan_result.is_none() || self.ollama_client.is_none() {
            return;
        }
        self.is_indexing = true;
        self.indexing_progress = 0.0;
        self.search_status = "Building semantic index...".to_string();

        let scan_result = match self.scan_result.clone() {
            Some(sr) => sr,
            None => {
                self.is_indexing = false;
                self.search_status = "No scan data available".to_string();
                return;
            }
        };
        let mut client = match self.ollama_client.clone() {
            Some(c) => c,
            None => {
                self.is_indexing = false;
                self.search_status = "Ollama client not available".to_string();
                return;
            }
        };
        // Use embedding_model if configured (may differ from chat model)
        if !self.settings.embedding_model.is_empty() {
            client = client.with_model(&self.settings.embedding_model).unwrap_or(client);
        }
        let batch_size = self.settings.embedding_batch_size;
        let file_limit = self.settings.embedding_file_limit;
        let (tx, rx) = mpsc::channel();
        self.embedding_receiver = Some(rx);

        std::thread::spawn(move || {
            let rt = shared_runtime();

            // Build file list: largest files first, then by type diversity
            let mut files: Vec<(String, u64, String)> = scan_result
                .largest_files
                .iter()
                .map(|(path, size)| {
                    let ext = path.rsplit('.').next().unwrap_or("").to_string();
                    (path.clone(), *size, ext)
                })
                .collect();

            // Apply file limit (0 = unlimited)
            if file_limit > 0 && files.len() > file_limit {
                files.truncate(file_limit);
            }

            let total = files.len();
            let mut all_embeddings: Vec<(String, u64, String, Vec<f32>)> = Vec::new();

            for chunk in files.chunks(batch_size) {
                let chunk_files: Vec<(String, u64, String)> = chunk.to_vec();
                let result = rt.block_on(async {
                    embed_files(&client, &chunk_files).await
                });

                match result {
                    Ok(embeddings) => {
                        for (i, (path, size, ext)) in chunk_files.iter().enumerate() {
                            if i < embeddings.len() {
                                all_embeddings.push((path.clone(), *size, ext.clone(), embeddings[i].clone()));
                            }
                        }
                        let progress = (all_embeddings.len() as f32 / total as f32).min(1.0);
                        let _ = tx.send(EmbeddingMessage::Progress(progress));
                    }
                    Err(e) => {
                        let _ = tx.send(EmbeddingMessage::Error(e));
                        return;
                    }
                }
            }

            let _ = tx.send(EmbeddingMessage::Complete(all_embeddings));
        });
    }

    pub(crate) fn process_embedding_messages(&mut self) {
        if let Some(rx) = self.embedding_receiver.take() {
            while let Ok(msg) = rx.try_recv() {
                match msg {
                    EmbeddingMessage::Progress(progress) => {
                        self.indexing_progress = progress;
                        self.search_status = format!("Indexing... {:.0}%", progress * 100.0);
                    }
                    EmbeddingMessage::Complete(embeddings) => {
                        self.cached_embeddings = embeddings;
                        self.is_indexing = false;
                        let count = self.cached_embeddings.len();
                        self.search_status = format!("Indexed {} files. Ready for search.", count);

                        // Save to database
                        if let Some(ref db) = self.db {
                            if let Some(scan_id) = db.get_latest_scan_id().ok().flatten() {
                                let _ = db.save_embeddings(scan_id, &self.cached_embeddings);
                                self.embedding_scan_id = Some(scan_id);
                            }
                        }
                    }
                    EmbeddingMessage::Error(error) => {
                        self.is_indexing = false;
                        self.search_status = format!("Indexing failed: {}", error);
                    }
                }
            }
            if self.is_indexing {
                self.embedding_receiver = Some(rx);
            }
        }
    }

    pub(crate) fn process_search_messages(&mut self) {
        if let Some(rx) = self.search_receiver.take() {
            while let Ok(msg) = rx.try_recv() {
                match msg {
                    SearchMessage::Complete(results) => {
                        self.search_results = results;
                        self.search_processing = false;
                        self.search_status = format!("Found {} results", self.search_results.len());
                    }
                    SearchMessage::Error(error) => {
                        self.search_processing = false;
                        self.search_status = format!("Search failed: {}", error);
                    }
                }
            }
            if self.search_processing {
                self.search_receiver = Some(rx);
            }
        }
    }

    fn execute_smart_search(&mut self) {
        if self.search_query.trim().is_empty() || self.ollama_client.is_none() {
            return;
        }

        self.search_processing = true;
        self.search_status = "Searching...".to_string();
        self.search_results.clear();

        let client = match self.ollama_client.clone() {
            Some(c) => c,
            None => {
                self.search_processing = false;
                self.search_status = "Ollama client not available".to_string();
                return;
            }
        };
        let query = self.search_query.clone();
        let embeddings = self.cached_embeddings.clone();
        let (tx, rx) = mpsc::channel();

        std::thread::spawn(move || {
            let rt = shared_runtime();
            match rt.block_on(async { embed_query(&client, &query).await }) {
                Ok(query_embedding) => {
                    let results = search_files(&query_embedding, &embeddings, 20);
                    let _ = tx.send(SearchMessage::Complete(results));
                }
                Err(e) => {
                    let _ = tx.send(SearchMessage::Error(e));
                }
            }
        });

        // Store the receiver to process results asynchronously
        self.search_receiver = Some(rx);
    }

    pub(crate) fn load_embeddings_from_db(&mut self, scan_id: Option<i64>) {
        if let Some(ref db) = self.db {
            let target_scan_id = scan_id.or_else(|| db.get_latest_scan_id().ok().flatten());
            if let Some(sid) = target_scan_id {
                if let Ok(records) = db.get_embeddings_for_scan(sid) {
                    if !records.is_empty() {
                        self.cached_embeddings = records
                            .into_iter()
                            .filter_map(|r| {
                                if let Ok(embedding) = serde_json::from_str::<Vec<f32>>(&r.embedding_json) {
                                    Some((r.file_path, r.file_size, r.file_extension, embedding))
                                } else {
                                    None
                                }
                            })
                            .collect();
                        self.embedding_scan_id = Some(sid);
                        self.search_status = format!("Loaded {} indexed files from database.", self.cached_embeddings.len());
                    }
                }
            }
        }
    }

    pub(crate) fn render_smart_search(&mut self, ui: &mut egui::Ui) {
        ui.heading("Smart Search");
        ui.small("Search files by meaning, not just name. Find files matching your description.");
        ui.separator();

        if !self.settings.embedding_enabled {
            if let Some((cp, fam)) = icons::warning() {
                ui.horizontal(|ui| {
                    ui.add(egui::Label::new(icon_text(cp, fam, 14.0, egui::Color32::YELLOW)));
                    ui.colored_label(egui::Color32::YELLOW, "Enable Semantic Indexing in Settings to use Smart Search.");
                });
            } else {
                ui.colored_label(egui::Color32::YELLOW, "[!] Enable Semantic Indexing in Settings to use Smart Search.");
            }
        }

        // Search input (disabled when embedding not enabled)
        ui.add_enabled_ui(self.settings.embedding_enabled, |ui| {
            ui.horizontal(|ui| {
                ui.label("Search:");
                let response = ui.add(egui::TextEdit::singleline(&mut self.search_query)
                    .hint_text("Describe what you're looking for..."));
                if response.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)) {
                    self.execute_smart_search();
                }
                if ui.button("Search").clicked() {
                    self.execute_smart_search();
                }
            });
        });

        if !self.settings.embedding_enabled {
            return;
        }

        if self.is_indexing {
            ui.label(format!("Indexing progress: {:.1}%", self.indexing_progress * 100.0));
            ui.add(egui::ProgressBar::new(self.indexing_progress));
            ui.label(&self.search_status);
            return;
        }

        if !self.search_status.is_empty() {
            ui.small(&self.search_status);
        }

        // Indexed files counter
        if !self.is_indexing && !self.cached_embeddings.is_empty() {
            let total_files = self.scan_result.as_ref().map(|r| r.total_files).unwrap_or(0);
            let indexed = self.cached_embeddings.len();
            let limit = self.settings.embedding_file_limit;
            let limit_str = if limit == 0 { "unlimited" } else { &format!("{}", limit) };
            ui.horizontal(|ui| {
                if let Some((cp, fam)) = icons::index() {
                    ui.add(egui::Label::new(icon_text(cp, fam, 12.0, egui::Color32::LIGHT_BLUE)));
                }
                ui.small(format!("Indexed: {} files", indexed));
                if total_files > 0 {
                    ui.small(format!("of {} total", total_files));
                }
                ui.small(format!("(limit: {})", limit_str));
                if limit > 0 && indexed >= limit {
                    if let Some((cp, _)) = icons::warning() {
                        ui.small(egui::RichText::new(format!("{} Limit reached", icon_char(cp))).color(egui::Color32::YELLOW));
                    } else {
                        ui.small(egui::RichText::new("[!] Limit reached").color(egui::Color32::YELLOW));
                    }
                }
            });
        }

        if self.search_processing {
            ui.label("Processing query...");
            return;
        }

        if !self.search_results.is_empty() {
            ui.separator();
            ui.heading(format!("{} Results", self.search_results.len()));
            
            egui::ScrollArea::vertical().show(ui, |ui| {
                egui::Grid::new("search_results")
                    .striped(true)
                    .show(ui, |ui| {
                        ui.strong("File");
                        ui.strong("Size");
                        ui.strong("Similarity");
                        ui.end_row();

                        for result in &self.search_results {
                            ui.label(&result.file_path);
                            ui.label(formatting::format_bytes(result.file_size));
                            ui.label(format!("{:.1}%", result.similarity * 100.0));
                            ui.end_row();
                        }
                    });
            });
        }

        ui.separator();
        if ui.button("Rebuild Index").clicked() {
            self.start_embedding_index();
        }
    }
}
