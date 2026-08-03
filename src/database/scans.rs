use super::super::gui_common::ScanResult;
use super::*;

/// Maximum number of scan-history records kept per distinct path. Newer scans
/// beyond this limit are removed on insert so the cache cannot grow unbounded.
pub const MAX_SCANS_PER_PATH: usize = 20;

impl super::Database {
    /// Save a scan result to history with extended data.
    ///
    /// After inserting, the history is trimmed to the most recent
    /// [`MAX_SCANS_PER_PATH`] records for the scanned path.
    pub fn save_scan(
        &self,
        result: &ScanResult,
        deep_scan: bool,
        shallow_scan: bool,
        max_scan_depth: u32,
    ) -> rusqlite::Result<i64> {
        let file_types_json = serde_json::to_string(&result.file_types)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let extension_sizes_json = serde_json::to_string(&result.extension_sizes)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let top_directories_json = serde_json::to_string(&result.top_directories)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let largest_files_json = serde_json::to_string(&result.largest_files)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

        let potential_cleanup = result.calculate_potential_cleanup();

        let timestamp = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO scan_history (path, total_files, total_size_bytes, total_size_mb, duration_secs, file_types_json, extension_sizes_json, top_directories_json, largest_files_json, deep_scan, shallow_scan, max_scan_depth, potential_cleanup_bytes, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                result.path, result.total_files as i64, result.total_size_bytes as i64,
                result.total_size_mb, result.duration_secs,
                file_types_json, extension_sizes_json, top_directories_json, largest_files_json,
                deep_scan, shallow_scan, max_scan_depth as i64,
                potential_cleanup as i64, timestamp,
            ],
        )?;
        let id = self.conn.last_insert_rowid();
        self.prune_path_overflow(&result.path)?;
        Ok(id)
    }

    /// Trim history for a single path down to the newest
    /// [`MAX_SCANS_PER_PATH`] records. Old records are deleted along with any
    /// orphaned duplicate-analysis/embedding rows that referenced them.
    fn prune_path_overflow(&self, path: &str) -> rusqlite::Result<()> {
        self.conn.execute(
            "DELETE FROM scan_history
             WHERE path = ?1 AND id NOT IN (
                 SELECT id FROM scan_history WHERE path = ?1 ORDER BY id DESC LIMIT ?2
             )",
            params![path, MAX_SCANS_PER_PATH as i64],
        )?;
        self.cleanup_orphaned_scan_data()
    }

    /// Remove duplicate scan records, keeping only the newest entry per
    /// (path, total_size_bytes, total_files). Deletes orphaned
    /// duplicate-analysis/embedding rows for the removed scans. Returns the
    /// number of scan-history records deleted.
    pub fn prune_duplicate_scans(&self) -> rusqlite::Result<usize> {
        let removed = self.conn.execute(
            "DELETE FROM scan_history WHERE id NOT IN (
                 SELECT MAX(id) FROM scan_history
                 GROUP BY path, total_size_bytes, total_files
             )",
            [],
        )?;
        self.cleanup_orphaned_scan_data()?;
        Ok(removed)
    }

    /// Remove scan records whose path is not absolute (drive-letter rooted,
    /// UNC, or POSIX-rooted). Relative paths such as "." do not resolve to a
    /// stable directory across runs, so they are pure cache noise. Returns the
    /// number of scan-history records deleted.
    pub fn prune_relative_scan_paths(&self) -> rusqlite::Result<usize> {
        let removed = self.conn.execute(
            r#"DELETE FROM scan_history
               WHERE path NOT LIKE '_:\%'
                 AND path NOT LIKE '_:/%'
                 AND path NOT LIKE '/%'
                 AND path NOT LIKE '\\%'"#,
            [],
        )?;
        self.cleanup_orphaned_scan_data()?;
        Ok(removed)
    }

    /// Delete rows in child tables that no longer reference a scan_history row.
    fn cleanup_orphaned_scan_data(&self) -> rusqlite::Result<()> {
        self.conn.execute(
            "DELETE FROM duplicate_analysis
             WHERE scan_id NOT IN (SELECT id FROM scan_history)",
            [],
        )?;
        self.conn.execute(
            "DELETE FROM file_embeddings
             WHERE scan_id NOT IN (SELECT id FROM scan_history)",
            [],
        )?;
        Ok(())
    }

    /// Save duplicate analysis results linked to a scan
    pub fn save_duplicate_analysis(
        &self,
        scan_id: i64,
        duplicate_groups_json: &str,
        potential_savings: u64,
    ) -> rusqlite::Result<i64> {
        let timestamp = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO duplicate_analysis (scan_id, duplicate_groups_json, potential_savings_bytes, timestamp)
             VALUES (?1, ?2, ?3, ?4)",
            params![scan_id, duplicate_groups_json, potential_savings as i64, timestamp],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// Get scan history, most recent first
    pub fn get_scan_history(&self, limit: usize) -> rusqlite::Result<Vec<ScanHistoryRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, total_files, total_size_bytes, total_size_mb, duration_secs, file_types_json, extension_sizes_json, top_directories_json, largest_files_json, deep_scan, shallow_scan, max_scan_depth, potential_cleanup_bytes, timestamp
             FROM scan_history ORDER BY timestamp DESC LIMIT ?1",
        )?;
        let rows = stmt.query_map(params![limit as i64], |row| {
            Ok(ScanHistoryRecord {
                id: row.get(0)?,
                path: row.get(1)?,
                total_files: row.get::<_, i64>(2)? as usize,
                total_size_bytes: row.get::<_, i64>(3)? as u64,
                total_size_mb: row.get(4)?,
                duration_secs: row.get(5)?,
                file_types_json: row.get(6)?,
                extension_sizes_json: row.get(7)?,
                top_directories_json: row.get(8)?,
                largest_files_json: row.get(9)?,
                deep_scan: row.get(10)?,
                shallow_scan: row.get(11)?,
                max_scan_depth: row.get::<_, i64>(12)? as u32,
                potential_cleanup_bytes: row.get::<_, i64>(13)? as u64,
                timestamp: row.get(14)?,
            })
        })?;
        rows.collect()
    }

    /// Get scan history with pagination, search, and sort support
    pub fn get_scan_history_page(
        &self,
        limit: usize,
        offset: usize,
        search: Option<&str>,
        sort_by: &str,
        sort_asc: bool,
    ) -> rusqlite::Result<(Vec<ScanHistoryRecord>, i64)> {
        let order = match sort_by {
            "path" => "path",
            "total_files" => "total_files",
            "total_size_bytes" => "total_size_bytes",
            "duration_secs" => "duration_secs",
            _ => "timestamp",
        };
        let direction = if sort_asc { "ASC" } else { "DESC" };

        let (count_sql, query_sql) = if let Some(s) = search {
            let pattern = format!("%{}%", s);
            let escaped = pattern.replace('\'', "''");
            (
                format!("SELECT COUNT(*) FROM scan_history WHERE path LIKE '{}'", escaped),
                format!(
                    "SELECT id, path, total_files, total_size_bytes, total_size_mb, duration_secs, \
                     file_types_json, extension_sizes_json, top_directories_json, largest_files_json, \
                     deep_scan, shallow_scan, max_scan_depth, potential_cleanup_bytes, timestamp \
                     FROM scan_history WHERE path LIKE '{}' ORDER BY {} {} LIMIT ?1 OFFSET ?2",
                    escaped, order, direction
                ),
            )
        } else {
            (
                "SELECT COUNT(*) FROM scan_history".to_string(),
                format!(
                    "SELECT id, path, total_files, total_size_bytes, total_size_mb, duration_secs, \
                     file_types_json, extension_sizes_json, top_directories_json, largest_files_json, \
                     deep_scan, shallow_scan, max_scan_depth, potential_cleanup_bytes, timestamp \
                     FROM scan_history ORDER BY {} {} LIMIT ?1 OFFSET ?2",
                    order, direction
                ),
            )
        };

        let total: i64 = self.conn.query_row(&count_sql, [], |row| row.get(0))?;

        let mut stmt = self.conn.prepare(&query_sql)?;
        let rows = stmt
            .query_map(params![limit as i64, offset as i64], |row| {
                Ok(ScanHistoryRecord {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    total_files: row.get::<_, i64>(2)? as usize,
                    total_size_bytes: row.get::<_, i64>(3)? as u64,
                    total_size_mb: row.get(4)?,
                    duration_secs: row.get(5)?,
                    file_types_json: row.get(6)?,
                    extension_sizes_json: row.get(7)?,
                    top_directories_json: row.get(8)?,
                    largest_files_json: row.get(9)?,
                    deep_scan: row.get(10)?,
                    shallow_scan: row.get(11)?,
                    max_scan_depth: row.get::<_, i64>(12)? as u32,
                    potential_cleanup_bytes: row.get::<_, i64>(13)? as u64,
                    timestamp: row.get(14)?,
                })
            })?
            .collect::<rusqlite::Result<_>>()?;

        Ok((rows, total))
    }

    /// Get a specific scan by ID
    pub fn get_scan_by_id(&self, id: i64) -> rusqlite::Result<Option<ScanHistoryRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, total_files, total_size_bytes, total_size_mb, duration_secs, file_types_json, extension_sizes_json, top_directories_json, largest_files_json, deep_scan, shallow_scan, max_scan_depth, potential_cleanup_bytes, timestamp
             FROM scan_history WHERE id = ?1",
        )?;
        let row = stmt.query_row(params![id], |row| {
            Ok(ScanHistoryRecord {
                id: row.get(0)?,
                path: row.get(1)?,
                total_files: row.get::<_, i64>(2)? as usize,
                total_size_bytes: row.get::<_, i64>(3)? as u64,
                total_size_mb: row.get(4)?,
                duration_secs: row.get(5)?,
                file_types_json: row.get(6)?,
                extension_sizes_json: row.get(7)?,
                top_directories_json: row.get(8)?,
                largest_files_json: row.get(9)?,
                deep_scan: row.get(10)?,
                shallow_scan: row.get(11)?,
                max_scan_depth: row.get::<_, i64>(12)? as u32,
                potential_cleanup_bytes: row.get::<_, i64>(13)? as u64,
                timestamp: row.get(14)?,
            })
        });
        match row {
            Ok(record) => Ok(Some(record)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Delete a scan record by ID (also removes associated embeddings and duplicate analysis)
    pub fn delete_scan(&self, id: i64) -> rusqlite::Result<usize> {
        self.delete_scan_embeddings(id)?;
        self.conn.execute(
            "DELETE FROM duplicate_analysis WHERE scan_id = ?1",
            params![id],
        )?;
        self.conn
            .execute("DELETE FROM scan_history WHERE id = ?1", params![id])
    }

    /// Clear all scan history (also removes associated embeddings, duplicate analysis, and file cache)
    pub fn clear_history(&self) -> rusqlite::Result<usize> {
        self.conn.execute("DELETE FROM file_embeddings", [])?;
        self.conn.execute("DELETE FROM duplicate_analysis", [])?;
        self.conn.execute("DELETE FROM file_cache", [])?;
        self.conn.execute("DELETE FROM workflow_executions", [])?;
        self.conn.execute("DELETE FROM scan_history", [])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_db() -> Database {
        Database::open(PathBuf::from(":memory:")).expect("in-memory db")
    }

    fn insert_scan(db: &Database, path: &str, size: u64, files: i64) -> i64 {
        db.conn
            .execute(
                "INSERT INTO scan_history (path, total_files, total_size_bytes, total_size_mb,
                                           duration_secs, file_types_json, extension_sizes_json,
                                           top_directories_json, largest_files_json, deep_scan,
                                           shallow_scan, max_scan_depth, potential_cleanup_bytes,
                                           timestamp)
                 VALUES (?1, ?2, ?3, 0.0, 0.0, '{}', '{}', '[]', '[]', 0, 0, 5, 0, ?4)",
                params![
                    path,
                    files,
                    size as i64,
                    format!("2026-08-03T00:00:0{}Z", 1 + path.len() % 9)
                ],
            )
            .unwrap();
        db.conn.last_insert_rowid()
    }

    fn count(db: &Database) -> i64 {
        db.conn
            .query_row("SELECT COUNT(*) FROM scan_history", [], |r| r.get(0))
            .unwrap()
    }

    #[test]
    fn prune_duplicates_keeps_newest_per_content() {
        let db = test_db();
        // Same path + same content signature, three inserts (older first).
        insert_scan(&db, "C:\\app", 1000, 10);
        insert_scan(&db, "C:\\app", 1000, 10);
        insert_scan(&db, "C:\\app", 1000, 10);
        // Different content for the same path — must be preserved.
        let newest_id = insert_scan(&db, "C:\\app", 2000, 20);

        assert_eq!(count(&db), 4);
        let removed = db.prune_duplicate_scans().unwrap();
        assert_eq!(removed, 2);
        assert_eq!(count(&db), 2);

        let remaining: Vec<i64> = db
            .conn
            .prepare("SELECT id FROM scan_history")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<rusqlite::Result<_>>()
            .unwrap();
        // The distinct-content record and the newest of the duplicate group survive.
        assert!(
            remaining.contains(&newest_id),
            "distinct-content scan must be kept"
        );
    }

    #[test]
    fn prune_relative_paths_keeps_absolute() {
        let db = test_db();
        insert_scan(&db, ".", 100, 5);
        insert_scan(&db, "src", 100, 5);
        insert_scan(&db, "C:\\Windows", 100, 5);
        insert_scan(&db, "C:/Windows/System32", 100, 5);
        insert_scan(&db, "/usr/share", 100, 5);
        insert_scan(&db, "\\\\server\\share", 100, 5);

        let removed = db.prune_relative_scan_paths().unwrap();
        assert_eq!(removed, 2, "relative '.' and 'src' should be dropped");
        assert_eq!(count(&db), 4);
    }

    #[test]
    fn save_scan_trims_path_overflow() {
        let db = test_db();
        let max = MAX_SCANS_PER_PATH as i64;
        for _ in 0..(max + 5) {
            insert_scan(&db, "C:\\grow", 500, 5);
        }
        insert_scan(&db, "D:\\other", 500, 5);

        // insert_scan bypasses save_scan trimming; verify the trim helper works.
        assert_eq!(count(&db), max + 6);
        db.prune_path_overflow("C:\\grow").unwrap();
        assert_eq!(count(&db), max + 1);
    }
}
