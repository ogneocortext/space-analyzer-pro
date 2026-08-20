//! Scan history and duplicate-analysis queries.
//!
//! This module contains the `Database` implementation methods for saving,
//! retrieving, pruning, and backfilling scan history and duplicate analysis data.

use super::super::*;
use super::models::*;
use crate::gui_common::ScanReport;

impl Database {
    /// Save a scan result to history with extended data.
    ///
    /// After inserting, the history is trimmed to the most recent
    /// [`MAX_SCANS_PER_PATH`] records for the scanned path.
    pub fn save_scan(
        &self,
        result: &ScanReport,
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
        let category_sizes_json = serde_json::to_string(&result.category_sizes)
            .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

        let potential_cleanup = result.calculate_potential_cleanup();

        let timestamp = chrono::Utc::now().to_rfc3339();
        self.conn.execute(
            "INSERT INTO scan_history (path, total_files, total_size_bytes, total_size_mb, duration_secs, file_types_json, extension_sizes_json, top_directories_json, largest_files_json, category_sizes_json, deep_scan, shallow_scan, max_scan_depth, potential_cleanup_bytes, is_index_only, timestamp)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
            params![
                result.path, result.total_files as i64, result.total_size_bytes as i64,
                result.total_size_mb, result.duration_secs,
                file_types_json, extension_sizes_json, top_directories_json, largest_files_json,
                category_sizes_json,
                deep_scan, shallow_scan, max_scan_depth as i64,
                potential_cleanup as i64, result.is_index_only as i64, timestamp,
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
        // Index-only rows (created by `embed` with no real scan) are excluded
        // from the per-path slot count so they neither displace real scans nor
        // get pruned away (which would silently drop their embedding index).
        self.conn.execute(
            "DELETE FROM scan_history
             WHERE path = ?1 AND (is_index_only = 0 OR is_index_only IS NULL) AND id NOT IN (
                 SELECT id FROM scan_history WHERE path = ?1 AND (is_index_only = 0 OR is_index_only IS NULL) ORDER BY id DESC LIMIT ?2
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

    /// Delete scan records that captured nothing (zero files). These are empty
    /// scans (e.g. of a temporary or non-existent directory) that carry no useful
    /// metrics. Also removes orphaned duplicate-analysis/embedding rows for the
    /// deleted scans. Returns the number of scan-history records deleted.
    /// Index-only rows (from `embed` with no real scan) are never pruned here,
    /// since an empty file count is expected for them and their embedding index
    /// must survive.
    pub fn prune_empty_scans(&self) -> rusqlite::Result<usize> {
        let removed = self
            .conn
            .execute("DELETE FROM scan_history WHERE total_files = 0 AND (is_index_only = 0 OR is_index_only IS NULL)", [])?;
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
            "SELECT id, path, total_files, total_size_bytes, total_size_mb, duration_secs, file_types_json, extension_sizes_json, top_directories_json, largest_files_json, category_sizes_json, deep_scan, shallow_scan, max_scan_depth, potential_cleanup_bytes, timestamp, is_index_only
             FROM scan_history WHERE (is_index_only = 0 OR is_index_only IS NULL) ORDER BY timestamp DESC LIMIT ?1",
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
                category_sizes_json: row.get(10)?,
                deep_scan: row.get(11)?,
                shallow_scan: row.get(12)?,
                max_scan_depth: row.get::<_, i64>(13)? as u32,
                potential_cleanup_bytes: row.get::<_, i64>(14)? as u64,
                timestamp: row.get(15)?,
                is_index_only: row.get::<_, i64>(16)? != 0,
            })
        })?;
        rows.collect()
    }

    /// Get scan history with pagination, search, sort, and duplicate filtering.
    ///
    /// When `only_duplicates` is true, only scans whose `path` appears more than
    /// once in history are returned (every member of each re-scanned-folder
    /// group, including the newest). This keeps the result paginated while still
    /// letting the caller learn the total number of duplicate records.
    pub fn get_scan_history_page(
        &self,
        limit: usize,
        offset: usize,
        search: Option<&str>,
        sort_by: &str,
        sort_asc: bool,
        only_duplicates: bool,
        include_index_only: bool,
    ) -> rusqlite::Result<(Vec<ScanHistoryRecord>, i64)> {
        let order = match sort_by {
            "path" => "path",
            "total_files" => "total_files",
            "total_size_bytes" => "total_size_bytes",
            "duration_secs" => "duration_secs",
            _ => "timestamp",
        };
        let direction = if sort_asc { "ASC" } else { "DESC" };

        // Index-only rows (created by `embed` with no real scan) are semantic
        // embedding anchors, not user scans. They are hidden from the
        // user-facing history list/trend/donut by default; the agentic
        // assistant passes `include_index_only` to locate an existing index.
        let idx_pred = if include_index_only {
            String::new()
        } else {
            "(is_index_only = 0 OR is_index_only IS NULL)".to_string()
        };
        let where_idx = if idx_pred.is_empty() {
            String::new()
        } else {
            format!("WHERE {idx_pred}")
        };
        let and_idx = if idx_pred.is_empty() {
            String::new()
        } else {
            format!("AND {idx_pred}")
        };

        let columns = "id, path, total_files, total_size_bytes, total_size_mb, duration_secs, \
                     file_types_json, extension_sizes_json, top_directories_json, largest_files_json, \
                     category_sizes_json, deep_scan, shallow_scan, max_scan_depth, potential_cleanup_bytes, timestamp, is_index_only";

        let dup_clause = format!(
            "path IN (SELECT path FROM scan_history {where_idx} GROUP BY path HAVING COUNT(*) > 1)"
        );
        let (count_sql, query_sql, bound) = match (search, only_duplicates) {
            (Some(s), true) => {
                let pattern = format!("%{}%", s.replace('\'', "''"));
                (
                    format!("SELECT COUNT(*) FROM scan_history WHERE path LIKE ?1 {and_idx} AND {dup_clause}"),
                    format!(
                        "SELECT {columns} FROM scan_history WHERE path LIKE ?1 {and_idx} AND {dup_clause} ORDER BY {order} {direction} LIMIT ?2 OFFSET ?3"
                    ),
                    vec![
                        Box::new(pattern) as Box<dyn rusqlite::ToSql>,
                        Box::new(limit as i64) as Box<dyn rusqlite::ToSql>,
                        Box::new(offset as i64) as Box<dyn rusqlite::ToSql>,
                    ],
                )
            }
            (Some(s), false) => {
                let pattern = format!("%{}%", s.replace('\'', "''"));
                (
                    format!("SELECT COUNT(*) FROM scan_history WHERE path LIKE ?1 {and_idx}"),
                    format!(
                        "SELECT {columns} FROM scan_history WHERE path LIKE ?1 {and_idx} ORDER BY {order} {direction} LIMIT ?2 OFFSET ?3"
                    ),
                    vec![
                        Box::new(pattern) as Box<dyn rusqlite::ToSql>,
                        Box::new(limit as i64) as Box<dyn rusqlite::ToSql>,
                        Box::new(offset as i64) as Box<dyn rusqlite::ToSql>,
                    ],
                )
            }
            (None, true) => (
                format!("SELECT COUNT(*) FROM scan_history WHERE {idx_pred} AND {dup_clause}"),
                format!(
                    "SELECT {columns} FROM scan_history WHERE {idx_pred} AND {dup_clause} ORDER BY {order} {direction} LIMIT ?1 OFFSET ?2"
                ),
                vec![
                    Box::new(limit as i64) as Box<dyn rusqlite::ToSql>,
                    Box::new(offset as i64) as Box<dyn rusqlite::ToSql>,
                ],
            ),
            (None, false) => (
                format!("SELECT COUNT(*) FROM scan_history {where_idx}"),
                format!(
                    "SELECT {columns} FROM scan_history {where_idx} ORDER BY {order} {direction} LIMIT ?1 OFFSET ?2"
                ),
                vec![
                    Box::new(limit as i64) as Box<dyn rusqlite::ToSql>,
                    Box::new(offset as i64) as Box<dyn rusqlite::ToSql>,
                ],
            ),
        };

        let total: i64 = self.conn.query_row(&count_sql, [], |row| row.get(0))?;

        let mut stmt = self.conn.prepare(&query_sql)?;
        let params = rusqlite::params_from_iter(bound.iter().map(|b| &**b));
        let rows = stmt
            .query_map(params, |row| {
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
                    category_sizes_json: row.get(10)?,
                    deep_scan: row.get(11)?,
                    shallow_scan: row.get(12)?,
                    max_scan_depth: row.get::<_, i64>(13)? as u32,
                    potential_cleanup_bytes: row.get::<_, i64>(14)? as u64,
                    timestamp: row.get(15)?,
                    is_index_only: row.get::<_, i64>(16)? != 0,
                })
            })?
            .collect::<rusqlite::Result<_>>()?;

        Ok((rows, total))
    }

    /// Return every scan-history row as a compact `(id, path, timestamp, size)`
    /// tuple, ordered chronologically (oldest first) for trend plotting. The
    /// heavy per-scan JSON columns are intentionally omitted so this stays cheap
    /// even for thousands of records.
    pub fn get_scan_history_trend(&self) -> rusqlite::Result<Vec<HistoryTrendPoint>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, timestamp, total_size_bytes FROM scan_history WHERE (is_index_only = 0 OR is_index_only IS NULL) ORDER BY timestamp ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(HistoryTrendPoint {
                id: row.get(0)?,
                path: row.get(1)?,
                timestamp: row.get(2)?,
                total_size_bytes: row.get::<_, i64>(3)? as u64,
            })
        })?;
        rows.collect()
    }

    /// Aggregate the per-category size breakdown across every scan-history record.
    /// Each row stores its own `category_sizes_json` (category -> bytes); this sums
    /// them into a single map so the UI can render a "library composition" donut
    /// spanning all scans without re-scanning. Rows with empty/invalid JSON are
    /// skipped so a single corrupt record can't poison the aggregate.
    pub fn get_category_totals(&self) -> rusqlite::Result<HashMap<String, u64>> {
        let mut stmt = self
            .conn
            .prepare("SELECT category_sizes_json FROM scan_history WHERE (is_index_only = 0 OR is_index_only IS NULL)")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;

        let mut totals: HashMap<String, u64> = HashMap::new();
        for r in rows {
            let json = r?;
            if json.is_empty() || json == "{}" || json == "null" {
                continue;
            }
            let map: HashMap<String, u64> = match serde_json::from_str(&json) {
                Ok(m) => m,
                Err(_) => continue,
            };
            for (cat, bytes) in map {
                *totals.entry(cat).or_insert(0) += bytes;
            }
        }
        Ok(totals)
    }

    /// Return every stored duplicate-file analysis for a scan, newest first.
    ///
    /// A scan may have several analyses saved over time (re-runs of `dedup`).
    /// Returns an empty `Vec` when the scan has no linked analysis yet, so callers
    /// can treat "none" and "error" uniformly. The heavy `duplicate_groups_json`
    /// column is returned as-is; deserialize it on demand.
    pub fn get_duplicate_analysis(
        &self,
        scan_id: i64,
    ) -> rusqlite::Result<Vec<DuplicateAnalysisRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, scan_id, duplicate_groups_json, potential_savings_bytes, timestamp
             FROM duplicate_analysis WHERE scan_id = ?1 ORDER BY id DESC",
        )?;
        let rows = stmt.query_map(params![scan_id], |row| {
            Ok(DuplicateAnalysisRecord {
                id: row.get(0)?,
                scan_id: row.get(1)?,
                duplicate_groups_json: row.get(2)?,
                potential_savings_bytes: row.get::<_, i64>(3)? as u64,
                timestamp: row.get(4)?,
            })
        })?;
        rows.collect()
    }

    /// Get a specific scan by ID
    pub fn get_scan_by_id(&self, id: i64) -> rusqlite::Result<Option<ScanHistoryRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, total_files, total_size_bytes, total_size_mb, duration_secs, file_types_json, extension_sizes_json, top_directories_json, largest_files_json, category_sizes_json, deep_scan, shallow_scan, max_scan_depth, potential_cleanup_bytes, timestamp, is_index_only
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
                category_sizes_json: row.get(10)?,
                deep_scan: row.get(11)?,
                shallow_scan: row.get(12)?,
                max_scan_depth: row.get::<_, i64>(13)? as u32,
                potential_cleanup_bytes: row.get::<_, i64>(14)? as u64,
                timestamp: row.get(15)?,
                is_index_only: row.get::<_, i64>(16)? != 0,
            })
        });
        match row {
            Ok(record) => Ok(Some(record)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }

    /// Normalize a path for matching: unify separators to `/` and drop a trailing
    /// separator so `C:\X`, `C:\X\`, and `C:/X` compare equal.
    fn normalize_path_for_match(p: &str) -> String {
        p.replace('\\', "/").trim_end_matches('/').to_string()
    }

    /// Find the most recent scan-history row whose (slash-normalized,
    /// case-insensitive) path matches `path`. Used to link a `dedup` run back to
    /// the scan it analyzed so the result can be persisted and later retrieved.
    /// Returns `None` when no matching scan exists, so callers can skip persisting
    /// rather than writing an orphaned analysis row.
    pub fn get_latest_scan_id_for_path(&self, path: &str) -> rusqlite::Result<Option<i64>> {
        let norm = Self::normalize_path_for_match(path);
        let mut stmt = self
            .conn
            .prepare("SELECT id, path FROM scan_history ORDER BY timestamp DESC")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?;
        for r in rows {
            let (id, stored) = r?;
            if Self::normalize_path_for_match(&stored).eq_ignore_ascii_case(&norm) {
                return Ok(Some(id));
            }
        }
        Ok(None)
    }

    /// Recompute `category_sizes_json` for any history record that lacks it.
    ///
    /// Records created before the `category_sizes_json` column existed stored
    /// only `extension_sizes_json`. Since the per-file paths are not retained,
    /// the path-derived categories (Development/Build Output/VCS) cannot be
    /// recovered, but the extension-derived breakdown can be rebuilt from the
    /// cached `extension_sizes` map. This keeps the History detail category
    /// rollups populated for older cached scans without forcing a re-scan.
    ///
    /// Returns the number of records back-filled. Idempotent: rows that already
    /// have a category breakdown are skipped, so calling this repeatedly is a
    /// no-op once every record is populated.
    pub fn backfill_category_sizes(&self) -> rusqlite::Result<usize> {
        let mut stmt = self.conn.prepare(
            "SELECT id, extension_sizes_json FROM scan_history \
             WHERE category_sizes_json IS NULL \
                OR category_sizes_json = '{}' \
                OR category_sizes_json = 'null'",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut updates: Vec<(String, i64)> = Vec::new();
        for row in rows {
            let (id, ext_json) = row?;
            let ext_map: HashMap<String, u64> = match serde_json::from_str(&ext_json) {
                Ok(m) => m,
                Err(_) => continue,
            };
            if ext_map.is_empty() {
                continue;
            }
            let mut cats: HashMap<String, u64> = HashMap::new();
            for (ext, size) in &ext_map {
                let cat = scan_engine::category_for_extension(ext);
                *cats.entry(cat.to_string()).or_insert(0) += size;
            }
            let json = serde_json::to_string(&cats)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
            updates.push((json, id));
        }

        if updates.is_empty() {
            return Ok(0);
        }

        let tx = self.conn.unchecked_transaction()?;
        for (json, id) in &updates {
            tx.execute(
                "UPDATE scan_history SET category_sizes_json = ?1 WHERE id = ?2",
                params![json, id],
            )?;
        }
        tx.commit()?;
        Ok(updates.len())
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

    /// Clear all scan history (also removes associated embeddings, duplicate
    /// analysis, and the per-scan file cache). Workflow execution history is a
    /// separate domain with its own pruning (`db --prune-workflows`), so it is
    /// intentionally left intact.
    pub fn clear_history(&self) -> rusqlite::Result<usize> {
        self.conn.execute("DELETE FROM file_embeddings", [])?;
        self.conn.execute("DELETE FROM duplicate_analysis", [])?;
        self.conn.execute("DELETE FROM file_cache", [])?;
        self.conn.execute("DELETE FROM scan_history", [])
    }

    /// Remove file-cache rows whose `scan_path` no longer has any matching
    /// scan-history record. The scanner keys the cache by the canonical
    /// (display) path, so this cleans up caches for directories that have had
    /// every history record pruned or cleared. Returns the number of cache rows
    /// removed.
    pub fn prune_orphaned_file_cache(&self) -> rusqlite::Result<usize> {
        self.conn.execute(
            "DELETE FROM file_cache WHERE scan_path NOT IN (SELECT DISTINCT path FROM scan_history)",
            [],
        )
    }
}

#[cfg(test)]
mod tests {
    use super::super::super::*;

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
        insert_scan(&db, "C:\\app", 1000, 10);
        insert_scan(&db, "C:\\app", 1000, 10);
        insert_scan(&db, "C:\\app", 1000, 10);
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
    fn backfill_recomputes_category_sizes_from_extension_sizes() {
        let db = test_db();
        db.conn
            .execute(
                "INSERT INTO scan_history (path, total_files, total_size_bytes, total_size_mb,
                                           duration_secs, file_types_json, extension_sizes_json,
                                           top_directories_json, largest_files_json, deep_scan,
                                           shallow_scan, max_scan_depth, potential_cleanup_bytes,
                                           timestamp, category_sizes_json)
                 VALUES ('C:\\legacy', 3, 2024, 0.0, 0.0, '{}', '{\"rs\":600,\"md\":424,\"ttf\":1000}',
                         '[]', '[]', 0, 0, 5, 0, '2026-08-03T00:00:00Z', '{}')",
                [],
            )
            .unwrap();

        let updated = db.backfill_category_sizes().unwrap();
        assert_eq!(
            updated, 1,
            "exactly one legacy record should be back-filled"
        );

        let json: String = db
            .conn
            .query_row(
                "SELECT category_sizes_json FROM scan_history WHERE path = 'C:\\legacy'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        let cats: std::collections::HashMap<String, u64> = serde_json::from_str(&json).unwrap();
        assert_eq!(cats.get("Code").copied(), Some(600));
        assert_eq!(cats.get("Documents").copied(), Some(424));
        assert_eq!(cats.get("Fonts").copied(), Some(1000));

        assert_eq!(db.backfill_category_sizes().unwrap(), 0);
    }

    #[test]
    fn prune_orphaned_file_cache_removes_unmatched_paths() {
        let db = test_db();
        let _ = insert_scan(&db, "C:\\keep", 500, 5);
        db.conn
            .execute(
                "INSERT INTO file_cache (scan_path, file_path, size_bytes, mtime_unix, extension, updated_at)
                 VALUES ('C:\\keep', 'C:\\keep\\a.txt', 10, 0, 'txt', datetime('now'))",
                [],
            )
            .unwrap();
        db.conn
            .execute(
                "INSERT INTO file_cache (scan_path, file_path, size_bytes, mtime_unix, extension, updated_at)
                 VALUES ('C:\\gone', 'C:\\gone\\b.txt', 20, 0, 'txt', datetime('now'))",
                [],
            )
            .unwrap();

        let removed = db.prune_orphaned_file_cache().unwrap();
        assert_eq!(removed, 1, "only the orphaned path cache should be removed");
        let remaining: i64 = db
            .conn
            .query_row("SELECT COUNT(*) FROM file_cache", [], |r| r.get(0))
            .unwrap();
        assert_eq!(remaining, 1);
    }

    #[test]
    fn save_scan_trims_path_overflow() {
        let db = test_db();
        let max = MAX_SCANS_PER_PATH as i64;
        for _ in 0..(max + 5) {
            insert_scan(&db, "C:\\grow", 500, 5);
        }
        insert_scan(&db, "D:\\other", 500, 5);

        assert_eq!(count(&db), max + 6);
        db.prune_path_overflow("C:\\grow").unwrap();
        assert_eq!(count(&db), max + 1);
    }

    #[test]
    fn get_scan_history_page_only_duplicates() {
        let db = test_db();
        insert_scan(&db, "C:\\dup", 100, 5);
        insert_scan(&db, "C:\\dup", 200, 6);
        insert_scan(&db, "C:\\unique", 300, 7);

        let (all, total_all) = db
            .get_scan_history_page(50, 0, None, "timestamp", false, false, false)
            .unwrap();
        assert_eq!(total_all, 3);
        assert_eq!(all.len(), 3);

        let (dupes, total_dupes) = db
            .get_scan_history_page(50, 0, None, "timestamp", false, true, false)
            .unwrap();
        assert_eq!(total_dupes, 2, "both re-scans of C:\\dup must be returned");
        assert!(dupes.iter().all(|r| r.path.eq_ignore_ascii_case("C:\\dup")));
    }

    #[test]
    fn get_scan_history_page_excludes_index_only_by_default() {
        let db = test_db();
        insert_scan(&db, "C:\\real", 100, 5);
        // Index-only anchor created by `embed` with no real scan.
        db.conn
            .execute(
                "INSERT INTO scan_history (path, total_files, total_size_bytes, total_size_mb, duration_secs, file_types_json, extension_sizes_json, top_directories_json, largest_files_json, deep_scan, shallow_scan, max_scan_depth, potential_cleanup_bytes, timestamp, is_index_only)
                 VALUES ('C:\\idx', 5, 100, 0.0, 0.0, '{}', '{}', '[]', '[]', 0, 0, 5, 0, '2026-08-03T00:00:09Z', 1)",
                [],
            )
            .unwrap();

        let (all, total) = db
            .get_scan_history_page(50, 0, None, "timestamp", false, false, false)
            .unwrap();
        assert_eq!(total, 1, "index-only anchor must be excluded by default");
        assert!(all.iter().all(|r| !r.is_index_only));

        let (inc, total_inc) = db
            .get_scan_history_page(50, 0, None, "timestamp", false, false, true)
            .unwrap();
        assert_eq!(total_inc, 2, "--include-index-only must surface the anchor");
        assert!(inc.iter().any(|r| r.is_index_only));
    }

    #[test]
    fn get_latest_scan_id_for_path_normalizes_separators_and_trailing_slash() {
        let db = test_db();
        let id = insert_scan(&db, "C:\\target", 1000, 10);
        assert_eq!(
            db.get_latest_scan_id_for_path("c:\\target\\").unwrap(),
            Some(id)
        );
        assert_eq!(
            db.get_latest_scan_id_for_path("C:/target").unwrap(),
            Some(id)
        );
        assert_eq!(db.get_latest_scan_id_for_path("C:\\other").unwrap(), None);
    }

    #[test]
    fn save_and_get_duplicate_analysis_roundtrip() {
        let db = test_db();
        let scan_id = insert_scan(&db, "C:\\dupscan", 1000, 10);
        assert_eq!(db.get_duplicate_analysis(scan_id).unwrap().len(), 0);

        let groups = serde_json::json!([
            {"hash":"abc","size":100,"file_count":2,"files":["a","b"],"wasted_bytes":100}
        ])
        .to_string();
        let saved = db.save_duplicate_analysis(scan_id, &groups, 100).unwrap();
        assert!(saved > 0);

        let got = db.get_duplicate_analysis(scan_id).unwrap();
        assert_eq!(got.len(), 1);
        assert_eq!(got[0].scan_id, scan_id);
        assert_eq!(got[0].potential_savings_bytes, 100);
        assert_eq!(got[0].duplicate_groups_json, groups);
    }

    #[test]
    fn get_scan_history_maps_columns_without_off_by_one() {
        let db = test_db();
        let _ = insert_scan(&db, "C:\\ordered", 1000, 10);

        let rows = db.get_scan_history(10).unwrap();
        assert_eq!(rows.len(), 1);
        let r = &rows[0];
        assert!(!r.deep_scan);
        assert!(!r.shallow_scan);
        assert_eq!(r.max_scan_depth, 5);
        assert_eq!(r.potential_cleanup_bytes, 0);
        assert_eq!(r.category_sizes_json, "{}");
        assert!(r.timestamp.starts_with("2026-08-03"));
    }

    #[test]
    fn get_scan_history_trend_returns_all_chronological() {
        let db = test_db();
        insert_scan(&db, "C:\\a", 100, 5);
        insert_scan(&db, "C:\\b", 200, 6);

        let points = db.get_scan_history_trend().unwrap();
        assert_eq!(points.len(), 2);
        assert!(points[0].path.eq_ignore_ascii_case("C:\\a"));
        assert_eq!(points[1].total_size_bytes, 200);
    }
}
