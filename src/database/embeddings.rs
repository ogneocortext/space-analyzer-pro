use super::*;

impl super::Database {
    /// Save a batch of file embeddings for a scan
    pub fn save_embeddings(
        &self,
        scan_id: i64,
        embeddings: &[(String, u64, String, Vec<f32>)],
    ) -> rusqlite::Result<usize> {
        let mut count = 0;
        let tx = self.conn.unchecked_transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT INTO file_embeddings (scan_id, file_path, file_size, file_extension, embedding, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
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
                    created_at
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
            "SELECT id, scan_id, file_path, file_size, file_extension, embedding, created_at FROM file_embeddings WHERE scan_id = ?1 ORDER BY file_path"
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
            })
        })?;
        rows.collect()
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
