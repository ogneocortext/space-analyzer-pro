use super::*;

/// Application settings stored in database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    // Scan Settings
    pub default_scan_path: String,
    pub default_deep_scan: bool,
    pub max_scan_depth: u32,
    pub large_file_threshold_mb: u64,

    // GPU / CUDA Settings
    pub gpu_acceleration: bool,
    pub cuda_enabled: bool,
    pub dedup_use_gpu: bool,

    // Ollama / AI Settings
    pub ollama_enabled: bool,
    pub ollama_url: String,
    pub ollama_model: String,
    pub agentic_tools_enabled: bool,
    pub tool_calling_model: String,
    pub tool_choice: String,
    pub auto_start_ollama: bool,

    // Prompt Cache Settings
    pub prompt_cache_enabled: bool,
    pub prompt_cache_max_entries: usize,
    pub prompt_cache_ttl_seconds: u64,
    pub prompt_cache_max_memory_mb: usize,

    // Smart Search (Embeddings)
    pub embedding_enabled: bool,
    pub embedding_model: String,
    pub embedding_batch_size: usize,
    pub embedding_file_limit: usize,

    // AI Model Selection
    pub auto_model_selection: bool,
    pub ai_recommendation_enabled: bool,

    // Session Logging
    pub log_session_to_file: bool,
    pub log_file_path: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_scan_path: ".".to_string(),
            default_deep_scan: false,
            max_scan_depth: 5,
            large_file_threshold_mb: 100,
            gpu_acceleration: true,
            cuda_enabled: false,
            dedup_use_gpu: true,
            ollama_enabled: true,
            ollama_url: "http://localhost:11434".to_string(),
            ollama_model: "gemma3:4b".to_string(),
            agentic_tools_enabled: true,
            tool_calling_model: "qwen2.5-coder:7b".to_string(),
            tool_choice: "auto".to_string(),
            auto_start_ollama: true,
            prompt_cache_enabled: true,
            prompt_cache_max_entries: 100,
            prompt_cache_ttl_seconds: 300,
            prompt_cache_max_memory_mb: 64,
            embedding_enabled: false,
            embedding_model: "nomic-embed-text:latest".to_string(),
            embedding_batch_size: 32,
            embedding_file_limit: 1000,
            auto_model_selection: true,
            ai_recommendation_enabled: true,
            log_session_to_file: false,
            log_file_path: "space-analyzer-session.log".to_string(),
        }
    }
}

impl AppSettings {
    pub fn to_prompt_cache_config(&self) -> super::super::ollama::PromptCacheConfig {
        super::super::ollama::PromptCacheConfig {
            enabled: self.prompt_cache_enabled,
            max_entries: self.prompt_cache_max_entries,
            ttl_seconds: self.prompt_cache_ttl_seconds,
            max_memory_mb: self.prompt_cache_max_memory_mb,
            estimate_tokens_per_char: 0.25,
        }
    }
}

impl super::Database {
    pub fn load_settings(&self) -> AppSettings {
        let mut settings = AppSettings::default();
        let tx_result = self.conn.unchecked_transaction();
        if let Ok(tx) = tx_result {
            if let Ok(mut stmt) = tx.prepare("SELECT key, value FROM settings") {
                match stmt.query_map([], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                }) {
                    Ok(rows) => {
                        for row in rows.flatten() {
                            let (key, value) = row;
                            match key.as_str() {
                                "default_scan_path" => settings.default_scan_path = value,
                                "default_deep_scan" => settings.default_deep_scan = value == "true",
                                "max_scan_depth" => settings.max_scan_depth = value.parse().unwrap_or(5),
                                "large_file_threshold_mb" => settings.large_file_threshold_mb = value.parse().unwrap_or(100),
                                "gpu_acceleration" => settings.gpu_acceleration = value == "true",
                                "cuda_enabled" => settings.cuda_enabled = value == "true",
                                "dedup_use_gpu" => settings.dedup_use_gpu = value == "true",
                                "ollama_enabled" => settings.ollama_enabled = value == "true",
                                "ollama_url" => settings.ollama_url = value,
                                "ollama_model" => settings.ollama_model = value,
                                "agentic_tools_enabled" => settings.agentic_tools_enabled = value == "true",
                                "tool_calling_model" => settings.tool_calling_model = value,
                                "tool_choice" => settings.tool_choice = value,
                                "auto_start_ollama" => settings.auto_start_ollama = value == "true",
                                "prompt_cache_enabled" => settings.prompt_cache_enabled = value == "true",
                                "prompt_cache_max_entries" => settings.prompt_cache_max_entries = value.parse().unwrap_or(100),
                                "prompt_cache_ttl_seconds" => settings.prompt_cache_ttl_seconds = value.parse().unwrap_or(300),
                                "prompt_cache_max_memory_mb" => settings.prompt_cache_max_memory_mb = value.parse().unwrap_or(64),
                                "embedding_enabled" => settings.embedding_enabled = value == "true",
                                "embedding_model" => settings.embedding_model = value,
                                "embedding_batch_size" => settings.embedding_batch_size = value.parse().unwrap_or(32),
                                "embedding_file_limit" => settings.embedding_file_limit = value.parse().unwrap_or(1000),
                                "auto_model_selection" => settings.auto_model_selection = value == "true",
                                "ai_recommendation_enabled" => settings.ai_recommendation_enabled = value == "true",
                                "log_session_to_file" => settings.log_session_to_file = value == "true",
                                "log_file_path" => settings.log_file_path = value,
                                _ => {}
                            }
                        }
                    }
                    Err(e) => {
                        eprintln!("Warning: Failed to load settings: {}", e);
                    }
                }
            }
        } else {
            eprintln!("Warning: Failed to create read transaction for settings (DB busy?)");
        }
        if let Ok(env_url) = std::env::var("OLLAMA_HOST") {
            let env_url = env_url.trim();
            if !env_url.is_empty() {
                settings.ollama_url = env_url.to_string();
            }
        }
        settings
    }

    pub fn save_all_settings(&self, settings: &AppSettings) -> rusqlite::Result<()> {
        let pairs: &[(&str, String)] = &[
            ("default_scan_path",       settings.default_scan_path.clone()),
            ("default_deep_scan",       settings.default_deep_scan.to_string()),
            ("max_scan_depth",          settings.max_scan_depth.to_string()),
            ("large_file_threshold_mb", settings.large_file_threshold_mb.to_string()),
            ("gpu_acceleration",        settings.gpu_acceleration.to_string()),
            ("cuda_enabled",            settings.cuda_enabled.to_string()),
            ("dedup_use_gpu",           settings.dedup_use_gpu.to_string()),
            ("ollama_enabled",          settings.ollama_enabled.to_string()),
            ("ollama_url",              settings.ollama_url.clone()),
            ("ollama_model",            settings.ollama_model.clone()),
            ("agentic_tools_enabled",   settings.agentic_tools_enabled.to_string()),
            ("tool_calling_model",      settings.tool_calling_model.clone()),
            ("tool_choice",             settings.tool_choice.clone()),
            ("auto_start_ollama",       settings.auto_start_ollama.to_string()),
            ("prompt_cache_enabled",    settings.prompt_cache_enabled.to_string()),
            ("prompt_cache_max_entries", settings.prompt_cache_max_entries.to_string()),
            ("prompt_cache_ttl_seconds", settings.prompt_cache_ttl_seconds.to_string()),
            ("prompt_cache_max_memory_mb", settings.prompt_cache_max_memory_mb.to_string()),
            ("embedding_enabled",       settings.embedding_enabled.to_string()),
            ("embedding_model",         settings.embedding_model.clone()),
            ("embedding_batch_size",    settings.embedding_batch_size.to_string()),
            ("embedding_file_limit",    settings.embedding_file_limit.to_string()),
            ("auto_model_selection",    settings.auto_model_selection.to_string()),
            ("ai_recommendation_enabled", settings.ai_recommendation_enabled.to_string()),
            ("log_session_to_file",     settings.log_session_to_file.to_string()),
            ("log_file_path",           settings.log_file_path.clone()),
        ];
        let tx = self.conn.unchecked_transaction()?;
        for (key, value) in pairs {
            tx.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
                params![key, value],
            )?;
        }
        tx.commit()?;
        Ok(())
    }
}
