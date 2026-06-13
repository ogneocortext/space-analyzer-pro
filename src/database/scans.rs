use super::super::gui_common::ScanResult;
use super::*;

impl super::Database {
    /// Save a scan result to history with extended data
    pub fn save_scan(&self, result: &ScanResult, deep_scan: bool) -> rusqlite::Result<i64> {
        let file_types_json = serde_json::to_string(&result.file_types)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let extension_sizes_json = serde_json::to_string(&result.extension_sizes)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        // Note: top_directories_json stores an empty array since ScanResult doesn't have top_directories
        // The GUI version populates this separately from its own scan data
        let top_directories_json = "[]".to_string();
        let largest_files_json = serde_json::to_string(&result.largest_files)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

        let potential_cleanup = self.calculate_potential_cleanup(result);

        let timestamp = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO scan_history (path, total_files, total_size_bytes, total_size_mb, duration_secs, file_types_json, extension_sizes_json, top_directories_json, largest_files_json, deep_scan, potential_cleanup_bytes, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![
                result.path, result.total_files, result.total_size_bytes,
                result.total_size_mb, result.duration_secs,
                file_types_json, extension_sizes_json, top_directories_json, largest_files_json,
                deep_scan, potential_cleanup, timestamp,
            ],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// Calculate potential cleanup size from caches, installers, etc.
    fn calculate_potential_cleanup(&self, result: &ScanResult) -> u64 {
        let mut total: u64 = 0;

        // Add extension sizes for cache/temp indicators
        for (ext, size) in &result.extension_sizes {
            let lower = ext.to_lowercase();
            if lower == "tmp" || lower == "cache" || lower == "log" {
                total += *size as u64;
            }
        }

        // Add sizes for large installer files
        for (path, size) in &result.largest_files {
            let lower = path.to_lowercase();
            if (lower.ends_with(".exe")
                || lower.ends_with(".msi")
                || lower.ends_with(".zip")
                || lower.ends_with(".rar"))
                && (lower.contains("installer") || lower.contains("setup"))
            {
                total += size;
            }
        }

        total
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
            params![scan_id, duplicate_groups_json, potential_savings, timestamp],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// Get scan history, most recent first
    pub fn get_scan_history(&self, limit: usize) -> rusqlite::Result<Vec<ScanHistoryRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, total_files, total_size_bytes, total_size_mb, duration_secs, file_types_json, extension_sizes_json, top_directories_json, largest_files_json, deep_scan, potential_cleanup_bytes, timestamp
             FROM scan_history ORDER BY timestamp DESC LIMIT ?1",
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
                extension_sizes_json: row.get(7)?,
                top_directories_json: row.get(8)?,
                largest_files_json: row.get(9)?,
                deep_scan: row.get(10)?,
                potential_cleanup_bytes: row.get(11)?,
                timestamp: row.get(12)?,
            })
        })?;
        rows.collect()
    }

    /// Get a specific scan by ID
    pub fn get_scan_by_id(&self, id: i64) -> rusqlite::Result<Option<ScanHistoryRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, total_files, total_size_bytes, total_size_mb, duration_secs, file_types_json, extension_sizes_json, top_directories_json, largest_files_json, deep_scan, potential_cleanup_bytes, timestamp
             FROM scan_history WHERE id = ?1",
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
                extension_sizes_json: row.get(7)?,
                top_directories_json: row.get(8)?,
                largest_files_json: row.get(9)?,
                deep_scan: row.get(10)?,
                potential_cleanup_bytes: row.get(11)?,
                timestamp: row.get(12)?,
            })
        });
        match row {
            Ok(record) => Ok(Some(record)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Delete a scan record by ID (also removes associated embeddings)
    pub fn delete_scan(&self, id: i64) -> rusqlite::Result<usize> {
        self.delete_scan_embeddings(id)?;
        self.conn
            .execute("DELETE FROM scan_history WHERE id = ?1", params![id])
    }

    /// Clear all scan history (also removes associated embeddings)
    pub fn clear_history(&self) -> rusqlite::Result<usize> {
        self.conn.execute("DELETE FROM file_embeddings", [])?;
        self.conn.execute("DELETE FROM scan_history", [])
    }
}
