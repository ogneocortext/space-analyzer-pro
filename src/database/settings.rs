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
    pub ollama_think: bool,

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

    // AI Features Panel (v3.5.0+) — capability-driven buttons
    /// Show the "AI Tools" section in the AI Assistant panel.
    /// Each tool targets one Ollama capability (embedding, completion,
    /// thinking, vision). Disabled by default to keep the panel tidy
    /// for users who only use the chat.
    pub ai_features_panel_visible: bool,
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
            ollama_model: "gemma4:e2b-it-qat".to_string(),
            agentic_tools_enabled: true,
            tool_calling_model: "qwen2.5-coder:7b".to_string(),
            tool_choice: "auto".to_string(),
            auto_start_ollama: true,
            ollama_think: true,
            prompt_cache_enabled: true,
            prompt_cache_max_entries: 100,
            prompt_cache_ttl_seconds: 300,
            prompt_cache_max_memory_mb: 64,
            embedding_enabled: false,
            embedding_model: "nomic-embed-text:v1.5".to_string(),
            embedding_batch_size: 32,
            embedding_file_limit: 1000,
            auto_model_selection: true,
            ai_recommendation_enabled: true,
            log_session_to_file: false,
            log_file_path: "space-analyzer-session.log".to_string(),
            ai_features_panel_visible: true,
        }
    }
}

impl AppSettings {
    pub const SETTINGS_VERSION_KEY: &'static str = "settings_version";
    pub const CURRENT_SETTINGS_VERSION: u32 = 2;

    pub fn to_prompt_cache_config(&self) -> super::super::ollama::PromptCacheConfig {
        super::super::ollama::PromptCacheConfig {
            enabled: self.prompt_cache_enabled,
            max_entries: self.prompt_cache_max_entries,
            ttl_seconds: self.prompt_cache_ttl_seconds,
            max_memory_mb: self.prompt_cache_max_memory_mb,
            estimate_tokens_per_char: 0.25,
        }
    }

    /// Obsolete keys from older versions. Removed on migration to keep the
    /// key-value store compact and avoid stale entries confusing future readers.
    pub fn obsolete_keys() -> &'static [&'static str] {
        &[]
    }
}

impl super::Database {
    pub fn load_settings(&self) -> AppSettings {
        let mut settings = AppSettings::default();
        let mut loaded_version: u32 = 0;
        let mut read_ok = false;
        let mut had_rows = false;

        let tx_result = self.conn.unchecked_transaction();
        if let Ok(tx) = tx_result {
            if let Ok(mut stmt) = tx.prepare("SELECT key, value FROM settings") {
                match stmt.query_map([], |row| {
                    Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
                }) {
                    Ok(rows) => {
                        read_ok = true;
                        for row in rows.flatten() {
                            had_rows = true;
                            let (key, value) = row;
                            match key.as_str() {
                                "default_scan_path" => settings.default_scan_path = value,
                                "default_deep_scan" => settings.default_deep_scan = value == "true",
                                "max_scan_depth" => {
                                    settings.max_scan_depth = parse_positive(&value, 5, 1)
                                }
                                "large_file_threshold_mb" => {
                                    settings.large_file_threshold_mb =
                                        parse_positive(&value, 100, 1)
                                }
                                "gpu_acceleration" => settings.gpu_acceleration = value == "true",
                                "cuda_enabled" => settings.cuda_enabled = value == "true",
                                "dedup_use_gpu" => settings.dedup_use_gpu = value == "true",
                                "ollama_enabled" => settings.ollama_enabled = value == "true",
                                "ollama_url" => settings.ollama_url = value,
                                "ollama_model" => settings.ollama_model = value,
                                "agentic_tools_enabled" => {
                                    settings.agentic_tools_enabled = value == "true"
                                }
                                "tool_calling_model" => settings.tool_calling_model = value,
                                "tool_choice" => settings.tool_choice = value,
                                "auto_start_ollama" => settings.auto_start_ollama = value == "true",
                                "ollama_think" => settings.ollama_think = value == "true",
                                "prompt_cache_enabled" => {
                                    settings.prompt_cache_enabled = value == "true"
                                }
                                "prompt_cache_max_entries" => {
                                    settings.prompt_cache_max_entries =
                                        parse_positive(&value, 100, 1)
                                }
                                "prompt_cache_ttl_seconds" => {
                                    settings.prompt_cache_ttl_seconds =
                                        parse_positive(&value, 300, 1)
                                }
                                "prompt_cache_max_memory_mb" => {
                                    settings.prompt_cache_max_memory_mb =
                                        parse_positive(&value, 64, 1)
                                }
                                "embedding_enabled" => settings.embedding_enabled = value == "true",
                                "embedding_model" => settings.embedding_model = value,
                                "embedding_batch_size" => {
                                    settings.embedding_batch_size = parse_positive(&value, 32, 1)
                                }
                                "embedding_file_limit" => {
                                    settings.embedding_file_limit = parse_positive(&value, 1000, 1)
                                }
                                "auto_model_selection" => {
                                    settings.auto_model_selection = value == "true"
                                }
                                "ai_recommendation_enabled" => {
                                    settings.ai_recommendation_enabled = value == "true"
                                }
                                "log_session_to_file" => {
                                    settings.log_session_to_file = value == "true"
                                }
                                "log_file_path" => settings.log_file_path = value,
                                "ai_features_panel_visible" => {
                                    settings.ai_features_panel_visible = value == "true"
                                }
                                AppSettings::SETTINGS_VERSION_KEY => {
                                    loaded_version = value.parse().unwrap_or(0)
                                }
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

        // If the settings table could not be read, return the defaults WITHOUT
        // persisting them. Writing defaults here would silently overwrite the
        // user's stored configuration on a transient DB error.
        if !read_ok {
            return settings;
        }

        // Apply versioned migrations before returning
        settings = self.migrate_settings(settings, loaded_version, had_rows);

        if let Ok(env_url) = std::env::var("OLLAMA_HOST") {
            let env_url = env_url.trim();
            if !env_url.is_empty() {
                settings.ollama_url = env_url.to_string();
            }
        }
        settings
    }

    /// Apply versioned migrations to an already-loaded settings struct.
    /// Returns the migrated settings. Each migration step should be idempotent.
    fn migrate_settings(
        &self,
        mut settings: AppSettings,
        from_version: u32,
        had_rows: bool,
    ) -> AppSettings {
        let current = AppSettings::CURRENT_SETTINGS_VERSION;
        let mut changed = false;

        // Pin the floating `nomic-embed-text:latest` tag to the reproducible
        // `nomic-embed-text:v1.5`. This must NOT be gated on `(from_version < 2)`:
        // a database can already be at the current settings version while still
        // storing the old `latest` default (it was written before the default
        // was pinned), so a version-gated migration would never correct it and
        // the value would persist forever. `latest` is a server-side floating
        // tag that is not reliably installed, whereas `v1.5` is a concrete,
        // reproducible model — so pinning on load is always safe.
        if settings.embedding_model == "nomic-embed-text:latest" {
            settings.embedding_model = "nomic-embed-text:v1.5".to_string();
            changed = true;
        }

        // Future versioned migration steps go here, each keyed on
        // `from_version` and flipping `changed` when it touches the struct.
        if from_version < current {
            // (no-op placeholder; add real steps as the schema evolves)
        }

        // Persist when a migration/normalization actually changed something,
        // when the stored schema version is behind, or when the table was empty
        // and needs first-run initialization. Writing on every read is wasteful
        // and risks clobbering keys that other components (e.g. the GUI) manage
        // independently, so only write when strictly necessary.
        if changed || from_version < current || !had_rows {
            let _ = self.save_all_settings(&settings);
        }
        settings
    }

    pub fn save_all_settings(&self, settings: &AppSettings) -> rusqlite::Result<()> {
        let pairs: Vec<(&str, String)> = vec![
            (
                AppSettings::SETTINGS_VERSION_KEY,
                AppSettings::CURRENT_SETTINGS_VERSION.to_string(),
            ),
            ("default_scan_path", settings.default_scan_path.clone()),
            ("default_deep_scan", settings.default_deep_scan.to_string()),
            ("max_scan_depth", settings.max_scan_depth.to_string()),
            (
                "large_file_threshold_mb",
                settings.large_file_threshold_mb.to_string(),
            ),
            ("gpu_acceleration", settings.gpu_acceleration.to_string()),
            ("cuda_enabled", settings.cuda_enabled.to_string()),
            ("dedup_use_gpu", settings.dedup_use_gpu.to_string()),
            ("ollama_enabled", settings.ollama_enabled.to_string()),
            ("ollama_url", settings.ollama_url.clone()),
            ("ollama_model", settings.ollama_model.clone()),
            (
                "agentic_tools_enabled",
                settings.agentic_tools_enabled.to_string(),
            ),
            ("tool_calling_model", settings.tool_calling_model.clone()),
            ("tool_choice", settings.tool_choice.clone()),
            ("auto_start_ollama", settings.auto_start_ollama.to_string()),
            ("ollama_think", settings.ollama_think.to_string()),
            (
                "prompt_cache_enabled",
                settings.prompt_cache_enabled.to_string(),
            ),
            (
                "prompt_cache_max_entries",
                settings.prompt_cache_max_entries.to_string(),
            ),
            (
                "prompt_cache_ttl_seconds",
                settings.prompt_cache_ttl_seconds.to_string(),
            ),
            (
                "prompt_cache_max_memory_mb",
                settings.prompt_cache_max_memory_mb.to_string(),
            ),
            ("embedding_enabled", settings.embedding_enabled.to_string()),
            ("embedding_model", settings.embedding_model.clone()),
            (
                "embedding_batch_size",
                settings.embedding_batch_size.to_string(),
            ),
            (
                "embedding_file_limit",
                settings.embedding_file_limit.to_string(),
            ),
            (
                "auto_model_selection",
                settings.auto_model_selection.to_string(),
            ),
            (
                "ai_recommendation_enabled",
                settings.ai_recommendation_enabled.to_string(),
            ),
            (
                "log_session_to_file",
                settings.log_session_to_file.to_string(),
            ),
            ("log_file_path", settings.log_file_path.clone()),
            (
                "ai_features_panel_visible",
                settings.ai_features_panel_visible.to_string(),
            ),
        ];
        let tx = self.conn.unchecked_transaction()?;
        for (key, value) in &pairs {
            tx.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
                params![key, value],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    /// Remove stale settings keys that are no longer recognized.
    /// Call after `save_all_settings` during an upgrade path.
    pub fn prune_obsolete_settings(&self) -> rusqlite::Result<usize> {
        let obsolete = AppSettings::obsolete_keys();
        if obsolete.is_empty() {
            return Ok(0);
        }
        let mut deleted = 0usize;
        let tx = self.conn.unchecked_transaction()?;
        for key in obsolete {
            deleted += tx.execute("DELETE FROM settings WHERE key = ?1", params![key])?;
        }
        tx.commit()?;
        Ok(deleted)
    }

    /// Read all raw key/value pairs from the settings table. Unlike
    /// `load_settings`, this returns every stored key verbatim (including
    /// unknown/custom keys), which is what the GUI settings store uses to
    /// mirror its own preferences without losing Rust-core defaults.
    pub fn get_all_settings(&self) -> rusqlite::Result<Vec<(String, String)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT key, value FROM settings ORDER BY key")?;
        let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?;
        rows.collect()
    }

    /// Upsert arbitrary key/value pairs into the settings table. Existing keys
    /// are replaced, unknown keys are added. Runs in a single transaction.
    pub fn upsert_settings(&self, pairs: &[(&str, String)]) -> rusqlite::Result<usize> {
        if pairs.is_empty() {
            return Ok(0);
        }
        let tx = self.conn.unchecked_transaction()?;
        let mut written = 0usize;
        for (key, value) in pairs {
            written += tx.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
                params![key, value],
            )?;
        }
        tx.commit()?;
        Ok(written)
    }
}

/// Parse a numeric setting that must be strictly positive. Unparseable
/// input falls back to `default`; a value that parses but is below `min`
/// is corrected to `min`. This keeps the persisted-settings path in line
/// with the CLI's `--max-depth` guard, where `0` would otherwise produce a
/// silently empty scan or (for the embedding/batch settings) a latent
/// divide-by-zero / `chunks(0)` panic once they are wired up.
fn parse_positive<T>(value: &str, default: T, min: T) -> T
where
    T: std::str::FromStr + PartialOrd + Copy,
{
    match value.parse::<T>() {
        Ok(n) if n >= min => n,
        Ok(_) => min,
        Err(_) => default,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Database {
        Database::open(PathBuf::from(":memory:")).expect("in-memory db")
    }

    #[test]
    fn upsert_and_get_all_round_trip() {
        let db = test_db();
        db.upsert_settings(&[
            ("theme", "Dark".to_string()),
            ("scanner_path", "C:\\scanner.exe".to_string()),
        ])
        .unwrap();
        let all = db.get_all_settings().unwrap();
        let map: std::collections::HashMap<_, _> = all.into_iter().collect();
        assert_eq!(map.get("theme"), Some(&"Dark".to_string()));
        assert_eq!(
            map.get("scanner_path"),
            Some(&"C:\\scanner.exe".to_string())
        );
    }

    #[test]
    fn upsert_overwrites_existing() {
        let db = test_db();
        db.upsert_settings(&[("theme", "Dark".to_string())])
            .unwrap();
        db.upsert_settings(&[("theme", "Light".to_string())])
            .unwrap();
        let all = db.get_all_settings().unwrap();
        let theme: Vec<_> = all.into_iter().filter(|(k, _)| k == "theme").collect();
        assert_eq!(theme.len(), 1);
        assert_eq!(theme[0].1, "Light");
    }

    #[test]
    fn load_initializes_empty_db_and_persists_version() {
        let db = test_db();
        let loaded = db.load_settings();
        assert_eq!(loaded.ollama_model, "gemma4:e2b-it-qat");
        // A load on a fresh DB should persist the version marker.
        let all = db.get_all_settings().unwrap();
        let map: std::collections::HashMap<_, _> = all.into_iter().collect();
        assert_eq!(
            map.get(AppSettings::SETTINGS_VERSION_KEY),
            Some(&AppSettings::CURRENT_SETTINGS_VERSION.to_string())
        );
    }

    #[test]
    fn load_preserves_unknown_keys() {
        let db = test_db();
        db.upsert_settings(&[("gui_only_flag", "1".to_string())])
            .unwrap();
        // load_settings must not delete keys it does not own.
        let _ = db.load_settings();
        let all = db.get_all_settings().unwrap();
        let map: std::collections::HashMap<_, _> = all.into_iter().collect();
        assert_eq!(map.get("gui_only_flag"), Some(&"1".to_string()));
    }

    #[test]
    fn load_clamps_invalid_numeric_settings_to_minimum() {
        let db = test_db();
        db.upsert_settings(&[
            ("max_scan_depth", "0".to_string()),
            ("large_file_threshold_mb", "0".to_string()),
            ("embedding_batch_size", "0".to_string()),
            ("prompt_cache_max_entries", "0".to_string()),
        ])
        .unwrap();
        let s = db.load_settings();
        assert_eq!(
            s.max_scan_depth, 1,
            "depth 0 must clamp to 1, not empty scan"
        );
        assert_eq!(s.large_file_threshold_mb, 1);
        assert_eq!(s.embedding_batch_size, 1);
        assert_eq!(s.prompt_cache_max_entries, 1);
    }

    #[test]
    fn load_accepts_valid_numeric_settings() {
        let db = test_db();
        db.upsert_settings(&[("max_scan_depth", "7".to_string())])
            .unwrap();
        let s = db.load_settings();
        assert_eq!(s.max_scan_depth, 7);
    }
}
