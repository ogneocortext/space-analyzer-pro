//! Embedded SQLite database for Space Analyzer Pro
//! 
//! Provides self-contained persistence with zero external dependencies.
//! Stores scan history, settings, workflow executions, and analysis data.

use rusqlite::{Connection, params};
use std::path::PathBuf;
use serde::{Serialize, Deserialize};

use crate::gui_common::ScanResult;

/// Database manager for persistent storage
pub struct Database {
    conn: Connection,
}

/// Historical scan record stored in database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanHistoryRecord {
    pub id: i64,
    pub path: String,
    pub total_files: usize,
    pub total_size_bytes: u64,
    pub total_size_mb: f64,
    pub duration_secs: f64,
    pub file_types_json: String,
    pub largest_files_json: String,
    pub deep_scan: bool,
    pub timestamp: String,
}

/// Application settings stored in database
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub default_scan_path: String,
    pub default_deep_scan: bool,
    pub ollama_enabled: bool,
    pub ollama_url: String,
    pub ollama_model: String,
    pub gpu_acceleration: bool,
    pub max_scan_depth: u32,
    pub large_file_threshold_mb: u64,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_scan_path: ".".to_string(),
            default_deep_scan: false,
            ollama_enabled: false,
            ollama_url: "http://localhost:11434".to_string(),
            ollama_model: "phi4-mini:latest".to_string(),
            gpu_acceleration: true,
            max_scan_depth: 5,
            large_file_threshold_mb: 100,
        }
    }
}

/// Workflow execution record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowExecutionRecord {
    pub id: i64,
    pub workflow_id: String,
    pub workflow_name: String,
    pub status: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub error_message: Option<String>,
}

impl Database {
    /// Create or open database at the given path
    pub fn open(db_path: PathBuf) -> rusqlite::Result<Self> {
        if let Some(parent) = db_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        
        let conn = Connection::open(&db_path)?;
        let db = Database { conn };
        db.initialize()?;
        Ok(db)
    }

    /// Create database at default location (app data directory)
    pub fn default_open() -> rusqlite::Result<Self> {
        let db_path = Self::default_path();
        Self::open(db_path)
    }

    /// Get default database path
    pub fn default_path() -> PathBuf {
        let data_dir = dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("space-analyzer-pro");
        data_dir.join("space-analyzer.db")
    }

    /// Initialize database schema
    fn initialize(&self) -> rusqlite::Result<()> {
        self.conn.execute_batch("
            CREATE TABLE IF NOT EXISTS scan_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL,
                total_files INTEGER NOT NULL,
                total_size_bytes INTEGER NOT NULL,
                total_size_mb REAL NOT NULL,
                duration_secs REAL NOT NULL,
                file_types_json TEXT NOT NULL,
                largest_files_json TEXT NOT NULL,
                deep_scan BOOLEAN NOT NULL DEFAULT 0,
                timestamp TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS workflow_executions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                workflow_id TEXT NOT NULL,
                workflow_name TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                error_message TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_scan_history_timestamp ON scan_history(timestamp);
            CREATE INDEX IF NOT EXISTS idx_scan_history_path ON scan_history(path);
            CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
        ")?;
        
        Ok(())
    }

    /// Save a scan result to history
    pub fn save_scan(&self, result: &ScanResult, deep_scan: bool) -> rusqlite::Result<i64> {
        let file_types_json = serde_json::to_string(&result.file_types).unwrap_or_default();
        let largest_files_json = serde_json::to_string(&result.largest_files).unwrap_or_default();
        let timestamp = chrono::Utc::now().to_rfc3339();

        self.conn.execute(
            "INSERT INTO scan_history (path, total_files, total_size_bytes, total_size_mb, duration_secs, file_types_json, largest_files_json, deep_scan, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                result.path,
                result.total_files,
                result.total_size_bytes,
                result.total_size_mb,
                result.duration_secs,
                file_types_json,
                largest_files_json,
                deep_scan,
                timestamp,
            ],
        )?;

        Ok(self.conn.last_insert_rowid())
    }

    /// Get scan history, most recent first
    pub fn get_scan_history(&self, limit: usize) -> rusqlite::Result<Vec<ScanHistoryRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, total_files, total_size_bytes, total_size_mb, duration_secs, file_types_json, largest_files_json, deep_scan, timestamp
             FROM scan_history ORDER BY timestamp DESC LIMIT ?1"
        )?;

        let rows = stmt.query_map(params![limit], |row| {
            Ok(ScanHistoryRecord {
                id: row.get(0)?,
                path: row.get(1)?,
                total_files: row.get(2)?,
                total_size_bytes: row.get(3)?,
                total_size_mb: row.get(4)?,
                duration_secs: row.get(5)?,
                file_types_json: row.get(6)?,
                largest_files_json: row.get(7)?,
                deep_scan: row.get(8)?,
                timestamp: row.get(9)?,
            })
        })?;

        rows.collect()
    }

    /// Get a specific scan by ID
    pub fn get_scan_by_id(&self, id: i64) -> rusqlite::Result<Option<ScanHistoryRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, total_files, total_size_bytes, total_size_mb, duration_secs, file_types_json, largest_files_json, deep_scan, timestamp
             FROM scan_history WHERE id = ?1"
        )?;

        let row = stmt.query_row(params![id], |row| {
            Ok(ScanHistoryRecord {
                id: row.get(0)?,
                path: row.get(1)?,
                total_files: row.get(2)?,
                total_size_bytes: row.get(3)?,
                total_size_mb: row.get(4)?,
                duration_secs: row.get(5)?,
                file_types_json: row.get(6)?,
                largest_files_json: row.get(7)?,
                deep_scan: row.get(8)?,
                timestamp: row.get(9)?,
            })
        });

        match row {
            Ok(record) => Ok(Some(record)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Delete a scan record by ID
    pub fn delete_scan(&self, id: i64) -> rusqlite::Result<usize> {
        self.conn.execute("DELETE FROM scan_history WHERE id = ?1", params![id])
    }

    /// Clear all scan history
    pub fn clear_history(&self) -> rusqlite::Result<usize> {
        self.conn.execute("DELETE FROM scan_history", [])
    }

    /// Get scan count
    pub fn get_scan_count(&self) -> rusqlite::Result<usize> {
        let count: usize = self.conn.query_row("SELECT COUNT(*) FROM scan_history", [], |row| row.get(0))?;
        Ok(count)
    }

    /// Save settings
    pub fn save_setting(&self, key: &str, value: &str) -> rusqlite::Result<()> {
        self.conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    /// Load settings
    pub fn load_settings(&self) -> AppSettings {
        let mut settings = AppSettings::default();

        if let Ok(mut stmt) = self.conn.prepare("SELECT key, value FROM settings") {
            let rows = stmt.query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            });

            if let Ok(rows) = rows {
                for row in rows.flatten() {
                    let (key, value) = row;
                    match key.as_str() {
                        "default_scan_path" => settings.default_scan_path = value,
                        "default_deep_scan" => settings.default_deep_scan = value == "true",
                        "ollama_enabled" => settings.ollama_enabled = value == "true",
                        "ollama_url" => settings.ollama_url = value,
                        "ollama_model" => settings.ollama_model = value,
                        "gpu_acceleration" => settings.gpu_acceleration = value == "true",
                        "max_scan_depth" => settings.max_scan_depth = value.parse().unwrap_or(5),
                        "large_file_threshold_mb" => settings.large_file_threshold_mb = value.parse().unwrap_or(100),
                        _ => {}
                    }
                }
            }
        }

        settings
    }

    /// Save all settings at once
    pub fn save_all_settings(&self, settings: &AppSettings) -> rusqlite::Result<()> {
        let settings_data = [
            ("default_scan_path", settings.default_scan_path.clone()),
            ("default_deep_scan", settings.default_deep_scan.to_string()),
            ("ollama_enabled", settings.ollama_enabled.to_string()),
            ("ollama_url", settings.ollama_url.clone()),
            ("ollama_model", settings.ollama_model.clone()),
            ("gpu_acceleration", settings.gpu_acceleration.to_string()),
            ("max_scan_depth", settings.max_scan_depth.to_string()),
            ("large_file_threshold_mb", settings.large_file_threshold_mb.to_string()),
        ];

        for (key, value) in settings_data {
            self.save_setting(key, &value)?;
        }

        Ok(())
    }

    /// Record workflow execution start
    pub fn record_workflow_start(&self, workflow_id: &str, workflow_name: &str) -> rusqlite::Result<i64> {
        let started_at = chrono::Utc::now().to_rfc3339();

        self.conn.execute(
            "INSERT INTO workflow_executions (workflow_id, workflow_name, status, started_at)
             VALUES (?1, ?2, 'running', ?3)",
            params![workflow_id, workflow_name, started_at],
        )?;

        Ok(self.conn.last_insert_rowid())
    }

    /// Record workflow execution completion
    pub fn record_workflow_complete(&self, execution_id: i64) -> rusqlite::Result<()> {
        let completed_at = chrono::Utc::now().to_rfc3339();

        self.conn.execute(
            "UPDATE workflow_executions SET status = 'completed', completed_at = ?1 WHERE id = ?2",
            params![completed_at, execution_id],
        )?;

        Ok(())
    }

    /// Record workflow execution failure
    pub fn record_workflow_failed(&self, execution_id: i64, error: &str) -> rusqlite::Result<()> {
        let completed_at = chrono::Utc::now().to_rfc3339();

        self.conn.execute(
            "UPDATE workflow_executions SET status = 'failed', completed_at = ?1, error_message = ?2 WHERE id = ?3",
            params![completed_at, error, execution_id],
        )?;

        Ok(())
    }

    /// Get workflow execution history
    pub fn get_workflow_history(&self, limit: usize) -> rusqlite::Result<Vec<WorkflowExecutionRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, workflow_id, workflow_name, status, started_at, completed_at, error_message
             FROM workflow_executions ORDER BY started_at DESC LIMIT ?1"
        )?;

        let rows = stmt.query_map(params![limit], |row| {
            Ok(WorkflowExecutionRecord {
                id: row.get(0)?,
                workflow_id: row.get(1)?,
                workflow_name: row.get(2)?,
                status: row.get(3)?,
                started_at: row.get(4)?,
                completed_at: row.get(5)?,
                error_message: row.get(6)?,
            })
        })?;

        rows.collect()
    }

    /// Get storage trend data (size over time)
    pub fn get_storage_trend(&self, limit: usize) -> rusqlite::Result<Vec<(String, u64)>> {
        let mut stmt = self.conn.prepare(
            "SELECT timestamp, total_size_bytes FROM scan_history ORDER BY timestamp ASC LIMIT ?1"
        )?;

        let rows = stmt.query_map(params![limit], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })?;

        rows.collect()
    }

    /// Get unique scanned paths
    pub fn get_scanned_paths(&self) -> rusqlite::Result<Vec<String>> {
        let mut stmt = self.conn.prepare("SELECT DISTINCT path FROM scan_history ORDER BY path")?;
        let rows = stmt.query_map([], |row| row.get(0))?;
        rows.collect()
    }
}
