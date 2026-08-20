use super::*;
use rusqlite::OptionalExtension;

impl super::Database {
    /// Save a batch of file embeddings for a scan
    pub fn save_embeddings(
        &self,
        scan_id: i64,
        model: &str,
        embeddings: &[(String, u64, String, Vec<f32>)],
    ) -> rusqlite::Result<usize> {
        let mut count = 0;
        let tx = self.conn.unchecked_transaction()?;
        {
            // Rebuild is idempotent: drop any vectors already stored for this
            // scan before inserting, otherwise repeated `embed` / "Rebuild
            // Index" calls would append duplicate rows for the same files.
            tx.execute(
                "DELETE FROM file_embeddings WHERE scan_id = ?1",
                params![scan_id],
            )?;
            let mut stmt = tx.prepare(
                "INSERT INTO file_embeddings (scan_id, file_path, file_size, file_extension, embedding, created_at, model) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)"
            )?;
            let created_at = chrono::Utc::now().to_rfc3339();
            for (path, size, ext, vec) in embeddings {
                let embedding_json = serde_json::to_string(vec)
                    .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;
                stmt.execute(params![
                    scan_id,
                    path,
                    *size as i64,
                    ext,
                    embedding_json,
                    created_at,
                    model
                ])?;
                count += 1;
            }
        }
        tx.commit()?;
        Ok(count)
    }

    /// Get all embeddings for a scan
    pub fn get_embeddings_for_scan(
        &self,
        scan_id: i64,
    ) -> rusqlite::Result<Vec<FileEmbeddingRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, scan_id, file_path, file_size, file_extension, embedding, created_at, model FROM file_embeddings WHERE scan_id = ?1 ORDER BY file_path"
        )?;
        let rows = stmt.query_map(params![scan_id], |row| {
            Ok(FileEmbeddingRecord {
                id: row.get(0)?,
                scan_id: row.get(1)?,
                file_path: row.get(2)?,
                file_size: row.get::<_, i64>(3)? as u64,
                file_extension: row.get(4)?,
                embedding_json: row.get(5)?,
                created_at: row.get(6)?,
                model: row.get(7)?,
            })
        })?;
        rows.collect()
    }

    /// Return the embedding model stamped on this scan's index, if any.
    /// Used to detect index/model drift before a search (a different model
    /// than the one currently configured silently degrades similarity).
    pub fn get_embedding_model(&self, scan_id: i64) -> rusqlite::Result<Option<String>> {
        self.conn
            .query_row(
                "SELECT model FROM file_embeddings WHERE scan_id = ?1 AND model IS NOT NULL LIMIT 1",
                params![scan_id],
                |row| row.get(0),
            )
            .optional()
    }

    /// Count embeddings stored for a scan without loading the (potentially
    /// large) vectors. Used to decide whether an existing index can be reused.
    pub fn count_embeddings_for_scan(&self, scan_id: i64) -> rusqlite::Result<usize> {
        let count: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM file_embeddings WHERE scan_id = ?1",
            params![scan_id],
            |row| row.get(0),
        )?;
        Ok(count as usize)
    }

    /// Delete embeddings for a scan
    pub fn delete_scan_embeddings(&self, scan_id: i64) -> rusqlite::Result<usize> {
        self.conn.execute(
            "DELETE FROM file_embeddings WHERE scan_id = ?1",
            params![scan_id],
        )
    }

    /// Delete all embeddings
    pub fn clear_all_embeddings(&self) -> rusqlite::Result<usize> {
        self.conn.execute("DELETE FROM file_embeddings", [])
    }
}
