use super::*;
use super::super::gui_common::ScanResult;

impl super::Database {
    /// Save a scan result to history
    pub fn save_scan(&self, result: &ScanResult, deep_scan: bool) -> rusqlite::Result<i64> {
        let file_types_json = serde_json::to_string(&result.file_types)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let largest_files_json = serde_json::to_string(&result.largest_files)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
        let timestamp = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO scan_history (path, total_files, total_size_bytes, total_size_mb, duration_secs, file_types_json, largest_files_json, deep_scan, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                result.path, result.total_files, result.total_size_bytes,
                result.total_size_mb, result.duration_secs,
                file_types_json, largest_files_json, deep_scan, timestamp,
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
    #[allow(dead_code)] // Planned: scan detail view
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

    /// Delete a scan record by ID (also removes associated embeddings)
    pub fn delete_scan(&self, id: i64) -> rusqlite::Result<usize> {
        self.delete_scan_embeddings(id)?;
        self.conn.execute("DELETE FROM scan_history WHERE id = ?1", params![id])
    }

    /// Clear all scan history (also removes associated embeddings)
    pub fn clear_history(&self) -> rusqlite::Result<usize> {
        self.conn.execute("DELETE FROM file_embeddings", [])?;
        self.conn.execute("DELETE FROM scan_history", [])
    }
}
