use super::super::gui_common::ScanResult;
use super::*;

impl super::Database {
    /// Save a scan result to history with extended data
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
        Ok(self.conn.last_insert_rowid())
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
        self.conn
            .execute("DELETE FROM duplicate_analysis WHERE scan_id = ?1", params![id])?;
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
