//! Embedded SQLite database for Space Analyzer Pro
//!
//! Provides self-contained persistence with zero external dependencies.
//! Stores scan history, settings, workflow executions, and analysis data.

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// Disk space snapshot recorded by the background monitor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskSpaceSnapshot {
    pub id: i64,
    pub mount_point: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
    pub used_bytes: u64,
    pub usage_percent: f32,
    pub top_process_json: String,
    pub timestamp: String,
}

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
    pub extension_sizes_json: String,
    pub top_directories_json: String,
    pub largest_files_json: String,
    pub category_sizes_json: String,
    pub deep_scan: bool,
    pub shallow_scan: bool,
    pub max_scan_depth: u32,
    pub potential_cleanup_bytes: u64,
    pub timestamp: String,
    /// True when the row exists only to anchor a semantic-embedding index
    /// (created by `embed` with no real scan). Such rows are filtered out of
    /// the History UI and excluded from per-path prune accounting so they
    /// neither pollute history nor lose their index to overflow pruning.
    pub is_index_only: bool,
    /// Total number of directories traversed during the scan (including those
    /// that produced traversal errors). Persisted so the History view can show
    /// full coverage (files + dirs) and surface skipped directories.
    #[serde(default)]
    pub total_dirs: u64,
    /// Number of traversal errors encountered (e.g. permission-denied
    /// directories) during the scan. Persisted so the History view can flag
    /// coverage gaps even after the scan process has exited.
    #[serde(default)]
    pub error_count: u64,
    /// Number of scan-history records that share this record's `path`
    /// (including this one). Computed server-side via a window function so it
    /// is accurate across the entire history, not just the current page — a
    /// folder scanned N times reports `duplicate_count == N` on every row,
    /// even when its scans are split across multiple pages.
    #[serde(default)]
    pub duplicate_count: usize,
    /// Reclaimable bytes by tier (`Safe` / `Caution` / `Keep`), serialized as
    /// JSON. `Safe` + `Caution` together equal the actionable space surfaced to
    /// the user via `potential_cleanup_bytes`.
    #[serde(default)]
    pub reclaim_tier_sizes_json: String,
    /// Per-category reclaimable bytes (only non-zero for `Safe`/`Caution`
    /// files), serialized as JSON. Lets the UI show e.g. "of 24 GB Development,
    /// 18 GB is reclaimable deps".
    #[serde(default)]
    pub category_reclaimable_json: String,
}

impl ScanHistoryRecord {
    pub fn depth_display(&self) -> &'static str {
        if self.deep_scan {
            "Deep Scan"
        } else if self.shallow_scan {
            "Shallow Scan"
        } else if self.max_scan_depth != 5 {
            "Custom Depth"
        } else {
            "Default Scan"
        }
    }
}

/// File embedding record for semantic search
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileEmbeddingRecord {
    pub id: i64,
    pub scan_id: i64,
    pub file_path: String,
    pub file_size: u64,
    pub file_extension: String,
    pub embedding_json: String,
    pub created_at: String,
    /// Embedding model that produced the vector. `None` for rows written
    /// before model stamping existed; used to detect index/model drift.
    pub model: Option<String>,
}

mod embeddings;
mod scans;
mod settings;
mod workflows;

pub use scans::*;
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

    /// Reclaim free pages left behind by deletes (e.g. after pruning). Only
    /// run when no other connection holds a read lock; the CLI is the sole
    /// writer, so calling it from a maintenance command is safe.
    pub fn vacuum(&self) -> rusqlite::Result<()> {
        self.conn.execute_batch("VACUUM;")
    }

    /// Report the number of free pages and the file's page size so tooling can
    /// decide whether a VACUUM is worthwhile. Returns (free_pages, page_size).
    pub fn freelist_info(&self) -> rusqlite::Result<(i64, i64)> {
        let free_pages: i64 = self
            .conn
            .query_row("PRAGMA freelist_count", [], |r| r.get(0))
            .unwrap_or(0);
        let page_size: i64 = self
            .conn
            .query_row("PRAGMA page_size", [], |r| r.get(0))
            .unwrap_or(4096);
        Ok((free_pages, page_size))
    }

    /// Total pages in the database file.
    pub fn page_count(&self) -> rusqlite::Result<i64> {
        self.conn.query_row("PRAGMA page_count", [], |r| r.get(0))
    }

    /// Row count for a given table. Returns 0 if the table doesn't exist.
    pub fn table_row_count(&self, table: &str) -> rusqlite::Result<i64> {
        // Only allow known tables so a caller-supplied name cannot be injected
        // into the SQL. Unknown names simply report zero rows.
        const ALLOWED: &[&str] = &[
            "scan_history",
            "disk_space_history",
            "settings",
            "workflow_executions",
            "file_cache",
            "file_embeddings",
            "duplicate_analysis",
        ];
        if !ALLOWED.contains(&table) {
            return Ok(0);
        }
        self.conn
            .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| {
                r.get::<_, i64>(0)
            })
            .or_else(|_| Ok(0))
    }

    /// Initialize database schema
    fn migrate(&self) -> rusqlite::Result<()> {
        let user_version: i64 = self
            .conn
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap_or(0);

        // Check if workflow_executions table exists before attempting migration
        let table_exists: bool = self
            .conn
            .query_row(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='workflow_executions'",
                [],
                |_| Ok(true),
            )
            .unwrap_or(false);

        if user_version < 1 && table_exists {
            self.conn.execute_batch("BEGIN IMMEDIATE")?;
            let migration_result = (|| -> rusqlite::Result<()> {
                // Check if columns already exist to avoid errors
                let columns: Vec<String> = self.conn.prepare(
                    "SELECT name FROM pragma_table_info('workflow_executions') WHERE name IN ('actions_completed', 'total_actions')"
                )?.query_map([], |row| row.get(0))?.collect::<Result<_, _>>()?;

                if !columns.contains(&"actions_completed".to_string()) {
                    self.conn.execute_batch(
                        "ALTER TABLE workflow_executions ADD COLUMN actions_completed INTEGER NOT NULL DEFAULT 0;",
                    )?;
                }
                if !columns.contains(&"total_actions".to_string()) {
                    self.conn.execute_batch(
                        "ALTER TABLE workflow_executions ADD COLUMN total_actions INTEGER NOT NULL DEFAULT 0;",
                    )?;
                }
                self.conn.execute("PRAGMA user_version = 1", [])?;
                Ok(())
            })();
            if migration_result.is_err() {
                let _ = self.conn.execute_batch("ROLLBACK");
                migration_result?;
            } else {
                self.conn.execute_batch("COMMIT")?;
            }
        }
        if user_version < 2 {
            self.conn.execute_batch("BEGIN IMMEDIATE")?;
            let migration_result = (|| -> rusqlite::Result<()> {
                self.conn
                    .execute_batch("DROP TABLE IF EXISTS workflow_executions;")?;
                self.conn.execute_batch(
                    "CREATE TABLE workflow_executions (
                        id TEXT PRIMARY KEY,
                        workflow_id TEXT NOT NULL,
                        workflow_name TEXT NOT NULL,
                        status TEXT NOT NULL,
                        started_at TEXT NOT NULL,
                        completed_at TEXT,
                        error_message TEXT,
                        actions_completed INTEGER NOT NULL DEFAULT 0,
                        total_actions INTEGER NOT NULL DEFAULT 0
                    );",
                )?;
                self.conn.execute_batch(
                    "CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);",
                )?;
                self.conn.execute_batch(
                    "CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);",
                )?;
                self.conn.execute("PRAGMA user_version = 2", [])?;
                Ok(())
            })();
            if migration_result.is_err() {
                let _ = self.conn.execute_batch("ROLLBACK");
                migration_result?;
            } else {
                self.conn.execute_batch("COMMIT")?;
            }
        }
        if user_version < 3 {
            let table_exists: bool = self
                .conn
                .query_row(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='scan_history'",
                    [],
                    |_| Ok(true),
                )
                .unwrap_or(false);

            if table_exists {
                self.conn.execute_batch("BEGIN IMMEDIATE")?;
                let migration_result = (|| -> rusqlite::Result<()> {
                    let columns: Vec<String> = self.conn.prepare(
                        "SELECT name FROM pragma_table_info('scan_history') WHERE name IN ('extension_sizes_json', 'top_directories_json', 'largest_files_json', 'potential_cleanup_bytes')"
                    )?.query_map([], |row| row.get(0))?.collect::<Result<_, _>>()?;

                    if !columns.contains(&"extension_sizes_json".to_string()) {
                        self.conn.execute_batch(
                            "ALTER TABLE scan_history ADD COLUMN extension_sizes_json TEXT NOT NULL DEFAULT '[]';",
                        )?;
                    }
                    if !columns.contains(&"top_directories_json".to_string()) {
                        self.conn.execute_batch(
                            "ALTER TABLE scan_history ADD COLUMN top_directories_json TEXT NOT NULL DEFAULT '[]';",
                        )?;
                    }
                    if !columns.contains(&"largest_files_json".to_string()) {
                        self.conn.execute_batch(
                            "ALTER TABLE scan_history ADD COLUMN largest_files_json TEXT NOT NULL DEFAULT '[]';",
                        )?;
                    }
                    if !columns.contains(&"potential_cleanup_bytes".to_string()) {
                        self.conn.execute_batch(
                            "ALTER TABLE scan_history ADD COLUMN potential_cleanup_bytes INTEGER NOT NULL DEFAULT 0;",
                        )?;
                    }
                    self.conn.execute("PRAGMA user_version = 3", [])?;
                    Ok(())
                })();
                if migration_result.is_err() {
                    let _ = self.conn.execute_batch("ROLLBACK");
                    migration_result?;
                } else {
                    self.conn.execute_batch("COMMIT")?;
                }
            }
        }
        if user_version < 4 {
            let table_exists: bool = self
                .conn
                .query_row(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='scan_history'",
                    [],
                    |_| Ok(true),
                )
                .unwrap_or(false);

            if table_exists {
                self.conn.execute_batch("BEGIN IMMEDIATE")?;
                let migration_result = (|| -> rusqlite::Result<()> {
                    let columns: Vec<String> = self.conn.prepare(
                        "SELECT name FROM pragma_table_info('scan_history') WHERE name IN ('shallow_scan', 'max_scan_depth')"
                    )?.query_map([], |row| row.get(0))?.collect::<Result<_, _>>()?;

                    if !columns.contains(&"shallow_scan".to_string()) {
                        self.conn.execute_batch(
                            "ALTER TABLE scan_history ADD COLUMN shallow_scan BOOLEAN NOT NULL DEFAULT 0;",
                        )?;
                    }
                    if !columns.contains(&"max_scan_depth".to_string()) {
                        self.conn.execute_batch(
                            "ALTER TABLE scan_history ADD COLUMN max_scan_depth INTEGER NOT NULL DEFAULT 5;",
                        )?;
                    }
                    self.conn.execute("PRAGMA user_version = 4", [])?;
                    Ok(())
                })();
                if migration_result.is_err() {
                    let _ = self.conn.execute_batch("ROLLBACK");
                    migration_result?;
                } else {
                    self.conn.execute_batch("COMMIT")?;
                }
            }
        }
        if user_version < 5 {
            self.conn.execute_batch("BEGIN IMMEDIATE")?;
            let migration_result = (|| -> rusqlite::Result<()> {
                self.conn.execute_batch(
                    "CREATE TABLE IF NOT EXISTS file_cache (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        scan_path TEXT NOT NULL,
                        file_path TEXT NOT NULL,
                        size_bytes INTEGER NOT NULL,
                        mtime_unix INTEGER NOT NULL,
                        extension TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        UNIQUE(scan_path, file_path)
                    );
                    CREATE INDEX IF NOT EXISTS idx_file_cache_scan_path ON file_cache(scan_path);
                    CREATE INDEX IF NOT EXISTS idx_file_cache_file_path ON file_cache(file_path);",
                )?;
                self.conn.execute("PRAGMA user_version = 5", [])?;
                Ok(())
            })();
            if migration_result.is_err() {
                let _ = self.conn.execute_batch("ROLLBACK");
                migration_result?;
            } else {
                self.conn.execute_batch("COMMIT")?;
            }
        }
        if user_version < 6 {
            let table_exists: bool = self
                .conn
                .query_row(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='scan_history'",
                    [],
                    |_| Ok(true),
                )
                .unwrap_or(false);

            if table_exists {
                self.conn.execute_batch("BEGIN IMMEDIATE")?;
                let migration_result = (|| -> rusqlite::Result<()> {
                    let columns: Vec<String> = self.conn.prepare(
                        "SELECT name FROM pragma_table_info('scan_history') WHERE name IN ('category_sizes_json')"
                    )?.query_map([], |row| row.get(0))?.collect::<Result<_, _>>()?;

                    if !columns.contains(&"category_sizes_json".to_string()) {
                        self.conn.execute_batch(
                            "ALTER TABLE scan_history ADD COLUMN category_sizes_json TEXT NOT NULL DEFAULT '{}';",
                        )?;
                    }
                    self.conn.execute("PRAGMA user_version = 6", [])?;
                    Ok(())
                })();
                if migration_result.is_err() {
                    let _ = self.conn.execute_batch("ROLLBACK");
                    migration_result?;
                } else {
                    self.conn.execute_batch("COMMIT")?;
                }
            }
        }
        if user_version < 7 {
            let table_exists: bool = self
                .conn
                .query_row(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='file_embeddings'",
                    [],
                    |_| Ok(true),
                )
                .unwrap_or(false);

            if table_exists {
                self.conn.execute_batch("BEGIN IMMEDIATE")?;
                let migration_result = (|| -> rusqlite::Result<()> {
                    let columns: Vec<String> = self.conn.prepare(
                        "SELECT name FROM pragma_table_info('file_embeddings') WHERE name IN ('model')"
                    )?.query_map([], |row| row.get(0))?.collect::<Result<_, _>>()?;

                    if !columns.contains(&"model".to_string()) {
                        self.conn
                            .execute_batch("ALTER TABLE file_embeddings ADD COLUMN model TEXT;")?;
                    }
                    self.conn.execute("PRAGMA user_version = 7", [])?;
                    Ok(())
                })();
                if migration_result.is_err() {
                    let _ = self.conn.execute_batch("ROLLBACK");
                    migration_result?;
                } else {
                    self.conn.execute_batch("COMMIT")?;
                }
            }
        }
        if user_version < 8 {
            let table_exists: bool = self
                .conn
                .query_row(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='scan_history'",
                    [],
                    |_| Ok(true),
                )
                .unwrap_or(false);

            if table_exists {
                self.conn.execute_batch("BEGIN IMMEDIATE")?;
                let migration_result = (|| -> rusqlite::Result<()> {
                    let columns: Vec<String> = self.conn.prepare(
                        "SELECT name FROM pragma_table_info('scan_history') WHERE name IN ('is_index_only')"
                    )?.query_map([], |row| row.get(0))?.collect::<Result<_, _>>()?;

                    if !columns.contains(&"is_index_only".to_string()) {
                        self.conn.execute_batch(
                            "ALTER TABLE scan_history ADD COLUMN is_index_only INTEGER NOT NULL DEFAULT 0;",
                        )?;
                    }
                    self.conn.execute("PRAGMA user_version = 8", [])?;
                    Ok(())
                })();
                if migration_result.is_err() {
                    let _ = self.conn.execute_batch("ROLLBACK");
                    migration_result?;
                } else {
                    self.conn.execute_batch("COMMIT")?;
                }
            } else {
                // Fresh database: the CREATE TABLE above already includes the
                // column, so just advance the schema version.
                self.conn.execute("PRAGMA user_version = 8", [])?;
            }
        }
        if user_version < 9 {
            let table_exists: bool = self
                .conn
                .query_row(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='scan_history'",
                    [],
                    |_| Ok(true),
                )
                .unwrap_or(false);

            if table_exists {
                self.conn.execute_batch("BEGIN IMMEDIATE")?;
                let migration_result = (|| -> rusqlite::Result<()> {
                    let columns: Vec<String> = self.conn.prepare(
                        "SELECT name FROM pragma_table_info('scan_history') WHERE name IN ('total_dirs', 'error_count')"
                    )?.query_map([], |row| row.get(0))?.collect::<Result<_, _>>()?;

                    if !columns.contains(&"total_dirs".to_string()) {
                        self.conn.execute_batch(
                            "ALTER TABLE scan_history ADD COLUMN total_dirs INTEGER NOT NULL DEFAULT 0;",
                        )?;
                    }
                    if !columns.contains(&"error_count".to_string()) {
                        self.conn.execute_batch(
                            "ALTER TABLE scan_history ADD COLUMN error_count INTEGER NOT NULL DEFAULT 0;",
                        )?;
                    }
                    self.conn.execute("PRAGMA user_version = 9", [])?;
                    Ok(())
                })();
                if migration_result.is_err() {
                    let _ = self.conn.execute_batch("ROLLBACK");
                    migration_result?;
                } else {
                    self.conn.execute_batch("COMMIT")?;
                }
            } else {
                self.conn.execute("PRAGMA user_version = 9", [])?;
            }
        }
        if user_version < 10 {
            let table_exists: bool = self
                .conn
                .query_row(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='scan_history'",
                    [],
                    |_| Ok(true),
                )
                .unwrap_or(false);

            if table_exists {
                self.conn.execute_batch("BEGIN IMMEDIATE")?;
                let migration_result = (|| -> rusqlite::Result<()> {
                    let columns: Vec<String> = self.conn.prepare(
                        "SELECT name FROM pragma_table_info('scan_history') WHERE name IN ('reclaim_tier_sizes_json', 'category_reclaimable_json')"
                    )?.query_map([], |row| row.get(0))?.collect::<Result<_, _>>()?;

                    if !columns.contains(&"reclaim_tier_sizes_json".to_string()) {
                        self.conn.execute_batch(
                            "ALTER TABLE scan_history ADD COLUMN reclaim_tier_sizes_json TEXT NOT NULL DEFAULT '{}';",
                        )?;
                    }
                    if !columns.contains(&"category_reclaimable_json".to_string()) {
                        self.conn.execute_batch(
                            "ALTER TABLE scan_history ADD COLUMN category_reclaimable_json TEXT NOT NULL DEFAULT '{}';",
                        )?;
                    }
                    self.conn.execute("PRAGMA user_version = 10", [])?;
                    Ok(())
                })();
                if migration_result.is_err() {
                    let _ = self.conn.execute_batch("ROLLBACK");
                    migration_result?;
                } else {
                    self.conn.execute_batch("COMMIT")?;
                }
            } else {
                self.conn.execute("PRAGMA user_version = 10", [])?;
            }
        }
        Ok(())
    }

    fn initialize(&self) -> rusqlite::Result<()> {
        self.migrate()?;
        // Best-effort: populate category_sizes_json for records created before
        // that column existed. Non-fatal so a read-only/locked database never
        // blocks startup; run `history --backfill-categories` to force it.
        if let Err(e) = self.backfill_category_sizes() {
            eprintln!("[db] category back-fill skipped: {e}");
        }
        self.conn.execute_batch("
            CREATE TABLE IF NOT EXISTS scan_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL,
                total_files INTEGER NOT NULL,
                total_size_bytes INTEGER NOT NULL,
                total_size_mb REAL NOT NULL,
                duration_secs REAL NOT NULL,
                file_types_json TEXT NOT NULL,
                extension_sizes_json TEXT NOT NULL,
                top_directories_json TEXT NOT NULL,
                largest_files_json TEXT NOT NULL,
                category_sizes_json TEXT NOT NULL DEFAULT '{}',
                deep_scan BOOLEAN NOT NULL DEFAULT 0,
                shallow_scan BOOLEAN NOT NULL DEFAULT 0,
                max_scan_depth INTEGER NOT NULL DEFAULT 5,
                potential_cleanup_bytes INTEGER NOT NULL DEFAULT 0,
                is_index_only INTEGER NOT NULL DEFAULT 0,
                total_dirs INTEGER NOT NULL DEFAULT 0,
                error_count INTEGER NOT NULL DEFAULT 0,
                reclaim_tier_sizes_json TEXT NOT NULL DEFAULT '{}',
                category_reclaimable_json TEXT NOT NULL DEFAULT '{}',
                timestamp TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS duplicate_analysis (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scan_id INTEGER NOT NULL,
                duplicate_groups_json TEXT NOT NULL,
                potential_savings_bytes INTEGER NOT NULL DEFAULT 0,
                timestamp TEXT NOT NULL,
                FOREIGN KEY (scan_id) REFERENCES scan_history(id)
            );
            CREATE INDEX IF NOT EXISTS idx_scan_history_timestamp ON scan_history(timestamp);
            CREATE INDEX IF NOT EXISTS idx_scan_history_path ON scan_history(path);
            CREATE INDEX IF NOT EXISTS idx_duplicate_scan_id ON duplicate_analysis(scan_id);
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
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
                model TEXT,
                FOREIGN KEY (scan_id) REFERENCES scan_history(id)
            );
            CREATE INDEX IF NOT EXISTS idx_file_embeddings_scan_id ON file_embeddings(scan_id);
            CREATE INDEX IF NOT EXISTS idx_file_embeddings_path ON file_embeddings(file_path);
            CREATE TABLE IF NOT EXISTS disk_space_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mount_point TEXT NOT NULL,
                total_bytes INTEGER NOT NULL,
                available_bytes INTEGER NOT NULL,
                used_bytes INTEGER NOT NULL,
                usage_percent REAL NOT NULL,
                top_process_json TEXT NOT NULL DEFAULT '[]',
                timestamp TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_disk_space_history_mount ON disk_space_history(mount_point);
            CREATE INDEX IF NOT EXISTS idx_disk_space_history_timestamp ON disk_space_history(timestamp);
            CREATE TABLE IF NOT EXISTS file_cache (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scan_path TEXT NOT NULL,
                file_path TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                mtime_unix INTEGER NOT NULL,
                extension TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(scan_path, file_path)
            );
            CREATE INDEX IF NOT EXISTS idx_file_cache_scan_path ON file_cache(scan_path);
            CREATE INDEX IF NOT EXISTS idx_file_cache_file_path ON file_cache(file_path);
        ")?;
        Ok(())
    }

    /// Get storage trend data (size over time), most recent `limit` entries in chronological order
    pub fn get_storage_trend(&self, limit: usize) -> rusqlite::Result<Vec<(String, u64)>> {
        let mut stmt = self.conn.prepare(
            "SELECT timestamp, total_size_bytes FROM scan_history ORDER BY timestamp DESC LIMIT ?1",
        )?;
        let mut rows: Vec<(String, u64)> = stmt
            .query_map(params![limit as i64], |row| {
                Ok((row.get(0)?, row.get::<_, i64>(1)? as u64))
            })?
            .collect::<rusqlite::Result<_>>()?;
        rows.reverse(); // Chronological order (oldest first) for trend analysis
        Ok(rows)
    }

    /// Get the latest scan ID
    pub fn get_latest_scan_id(&self) -> rusqlite::Result<Option<i64>> {
        let mut stmt = self
            .conn
            .prepare("SELECT id FROM scan_history WHERE (is_index_only = 0 OR is_index_only IS NULL) ORDER BY timestamp DESC LIMIT 1")?;
        let mut rows = stmt.query([])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    /// Record a disk space snapshot
    pub fn record_disk_snapshot(
        &self,
        mount_point: &str,
        total_bytes: u64,
        available_bytes: u64,
        used_bytes: u64,
        usage_percent: f32,
        top_process_json: &str,
    ) -> rusqlite::Result<i64> {
        self.conn.execute(
            "INSERT INTO disk_space_history (mount_point, total_bytes, available_bytes, used_bytes, usage_percent, top_process_json, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))",
            params![mount_point, total_bytes as i64, available_bytes as i64, used_bytes as i64, usage_percent, top_process_json],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// Get disk space history for a mount point (most recent N entries)
    pub fn get_disk_space_history(
        &self,
        mount_point: &str,
        limit: usize,
    ) -> rusqlite::Result<Vec<DiskSpaceSnapshot>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, mount_point, total_bytes, available_bytes, used_bytes, usage_percent, top_process_json, timestamp
             FROM disk_space_history WHERE mount_point = ?1 ORDER BY timestamp DESC LIMIT ?2",
        )?;
        let rows = stmt.query_map(params![mount_point, limit as i64], |row| {
            Ok(DiskSpaceSnapshot {
                id: row.get(0)?,
                mount_point: row.get(1)?,
                total_bytes: row.get::<_, i64>(2)? as u64,
                available_bytes: row.get::<_, i64>(3)? as u64,
                used_bytes: row.get::<_, i64>(4)? as u64,
                usage_percent: row.get(5)?,
                top_process_json: row.get(6)?,
                timestamp: row.get(7)?,
            })
        })?;
        rows.collect()
    }

    /// Prune old disk space history (keep last N hours)
    pub fn prune_disk_space_history(&self, keep_hours: u32) -> rusqlite::Result<usize> {
        let deleted = self.conn.execute(
            "DELETE FROM disk_space_history WHERE timestamp < datetime('now', '-' || ?1 || ' hours')",
            params![keep_hours],
        )?;
        Ok(deleted)
    }

    /// Save file cache entries for a scan path
    pub fn save_file_cache(
        &self,
        scan_path: &str,
        entries: &[(String, u64, i64, String)],
    ) -> rusqlite::Result<()> {
        let tx = self.conn.unchecked_transaction()?;
        {
            tx.execute(
                "DELETE FROM file_cache WHERE scan_path = ?1",
                params![scan_path],
            )?;
            let mut stmt = tx.prepare(
                "INSERT INTO file_cache (scan_path, file_path, size_bytes, mtime_unix, extension, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
            )?;
            let now = chrono::Utc::now().to_rfc3339();
            for (file_path, size, mtime, ext) in entries {
                stmt.execute(params![scan_path, file_path, *size as i64, mtime, ext, now])?;
            }
        }
        tx.commit()?;
        Ok(())
    }

    /// Load file cache entries for a scan path
    pub fn load_file_cache(
        &self,
        scan_path: &str,
    ) -> rusqlite::Result<HashMap<String, (u64, i64, String)>> {
        let mut stmt = self.conn.prepare(
            "SELECT file_path, size_bytes, mtime_unix, extension FROM file_cache WHERE scan_path = ?1"
        )?;
        let rows = stmt.query_map(params![scan_path], |row| {
            Ok((
                row.get::<_, String>(0)?,
                (
                    row.get::<_, i64>(1)? as u64,
                    row.get::<_, i64>(2)?,
                    row.get::<_, String>(3)?,
                ),
            ))
        })?;
        let mut map = HashMap::new();
        for row in rows {
            let (path, data) = row?;
            map.insert(path, data);
        }
        Ok(map)
    }

    /// Delete file cache entries for a scan path
    pub fn delete_file_cache(&self, scan_path: &str) -> rusqlite::Result<usize> {
        self.conn.execute(
            "DELETE FROM file_cache WHERE scan_path = ?1",
            params![scan_path],
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Database {
        Database::open(PathBuf::from(":memory:")).expect("in-memory db")
    }

    #[test]
    fn save_and_load_file_cache_roundtrip() {
        let db = test_db();
        db.conn
            .execute(
                "INSERT INTO scan_history (path, total_files, total_size_bytes, total_size_mb,
                                           duration_secs, file_types_json, extension_sizes_json,
                                           top_directories_json, largest_files_json, deep_scan,
                                           shallow_scan, max_scan_depth, potential_cleanup_bytes,
                                           timestamp)
                 VALUES ('C:\\cache', 1, 1, 0.0, 0.0, '{}', '{}', '[]', '[]', 0, 0, 5, 0, '2026-08-03T00:00:00Z')",
                [],
            )
            .unwrap();

        // Previously this call failed with InvalidParameterCount because the
        // SQL had 5 placeholders but 6 values were bound.
        db.save_file_cache(
            "C:\\cache",
            &[(
                "C:\\cache\\a.txt".to_string(),
                100u64,
                123i64,
                "txt".to_string(),
            )],
        )
        .unwrap();

        let map = db.load_file_cache("C:\\cache").unwrap();
        assert_eq!(map.len(), 1);
        let (size, mtime, ext) = map.get("C:\\cache\\a.txt").unwrap();
        assert_eq!(*size, 100);
        assert_eq!(*mtime, 123);
        assert_eq!(ext, "txt");
    }

    #[test]
    fn table_row_count_includes_duplicate_analysis() {
        let db = test_db();
        // Unknown tables are guarded; duplicate_analysis must be countable.
        assert_eq!(db.table_row_count("not_a_table").unwrap(), 0);
        assert_eq!(db.table_row_count("duplicate_analysis").unwrap(), 0);
    }
}
