//! Embedded SQLite database for Space Analyzer Pro
//!
//! Provides self-contained persistence with zero external dependencies.
//! Stores scan history, settings, workflow executions, and analysis data.

use rusqlite::{Connection, params};
use std::path::PathBuf;
use serde::{Serialize, Deserialize};

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

/// File embedding record for semantic search
#[derive(Debug, Clone, Serialize, Deserialize)]
#[allow(dead_code)] // Planned: semantic search integration
pub struct FileEmbeddingRecord {
    pub id: i64,
    pub scan_id: i64,
    pub file_path: String,
    pub file_size: u64,
    pub file_extension: String,
    pub embedding_json: String,
    pub created_at: String,
}

mod settings;
mod scans;
mod embeddings;
mod workflows;

pub use settings::*;

impl Database {
    /// Create or open database at the given path
    pub fn open(db_path: PathBuf) -> rusqlite::Result<Self> {
        if let Some(parent) = db_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
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
            CREATE INDEX IF NOT EXISTS idx_scan_history_timestamp ON scan_history(timestamp);
            CREATE INDEX IF NOT EXISTS idx_scan_history_path ON scan_history(path);
            CREATE TABLE IF NOT EXISTS workflow_executions (
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                workflow_name TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                error_message TEXT,
                actions_completed INTEGER NOT NULL DEFAULT 0,
                total_actions INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
            CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
            CREATE TABLE IF NOT EXISTS file_embeddings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scan_id INTEGER NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                file_extension TEXT NOT NULL,
                embedding TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (scan_id) REFERENCES scan_history(id)
            );
            CREATE INDEX IF NOT EXISTS idx_file_embeddings_scan_id ON file_embeddings(scan_id);
            CREATE INDEX IF NOT EXISTS idx_file_embeddings_path ON file_embeddings(file_path);
        ")?;
        Ok(())
    }

    /// Get storage trend data (size over time)
    #[allow(dead_code)] // Planned: trend visualization in dashboard
    pub fn get_storage_trend(&self, limit: usize) -> rusqlite::Result<Vec<(String, u64)>> {
        let mut stmt = self.conn.prepare(
            "SELECT timestamp, total_size_bytes FROM scan_history ORDER BY timestamp ASC LIMIT ?1"
        )?;
        let rows = stmt.query_map(params![limit], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })?;
        rows.collect()
    }

    /// Get the latest scan ID
    #[allow(dead_code)] // Planned: incremental scan support
    pub fn get_latest_scan_id(&self) -> rusqlite::Result<Option<i64>> {
        let mut stmt = self.conn.prepare("SELECT id FROM scan_history ORDER BY timestamp DESC LIMIT 1")?;
        let mut rows = stmt.query([])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }
}
