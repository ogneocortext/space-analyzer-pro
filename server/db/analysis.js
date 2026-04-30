/**
 * Database Analysis Module
 * Handles analysis storage, retrieval, and file operations
 */

class AnalysisDatabase {
  constructor(core) {
    this.core = core;
    this.db = null;
  }

  setDatabase(db) {
    this.db = db;
  }

  /**
   * Store analysis results for a directory with separate file storage
   */
  storeAnalysis(directoryPath, analysisData) {
    return new Promise((resolve, reject) => {
      const metadataHash = this.core.generateHash(
        JSON.stringify({
          totalFiles: analysisData.totalFiles,
          totalSize: analysisData.totalSize,
        })
      );

      // Compress the full analysis data
      const compressedData = this.core.compressData(analysisData);

      const sql = `
        INSERT OR REPLACE INTO analyses
        (directory_path, total_files, total_size, metadata_hash, analysis_data_compressed, last_analyzed)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      this.db.run(
        sql,
        [
          directoryPath,
          analysisData.totalFiles,
          analysisData.totalSize,
          metadataHash,
          compressedData,
        ],
        function (err) {
          if (err) {
            reject(err);
            return;
          }

          const analysisId = this.lastID;
          console.log(`💾 Stored analysis for: ${directoryPath} (ID: ${analysisId})`);

          // Store files separately if they exist
          if (analysisData.files && analysisData.files.length > 0) {
            this.storeAnalysisFiles(analysisId, analysisData.files)
              .then(() => resolve(analysisId))
              .catch(reject);
          } else {
            resolve(analysisId);
          }
        }.bind(this)
      );
    });
  }

  /**
   * Store individual files for an analysis with batching
   */
  storeAnalysisFiles(analysisId, files) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO analysis_files
        (analysis_id, file_path, file_name, file_size, file_category, file_extension)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const batchSize = 1000;
      let processed = 0;
      let errors = 0;

      const insertBatch = (start) => {
        const batch = files.slice(start, start + batchSize);
        if (batch.length === 0) {
          stmt.finalize();
          console.log(`✅ Stored ${processed} files (${errors} errors)`);
          resolve({ processed, errors });
          return;
        }

        let pending = batch.length;
        batch.forEach((file) => {
          stmt.run(
            [analysisId, file.path, file.name, file.size, file.category, file.extension],
            (err) => {
              if (err) errors++;
              else processed++;
              pending--;
              if (pending === 0) {
                insertBatch(start + batchSize);
              }
            }
          );
        });
      };

      insertBatch(0);
    });
  }

  /**
   * Get previous analysis for a directory
   */
  getAnalysis(directoryPath) {
    return new Promise((resolve, reject) => {
      const sql = "SELECT * FROM analyses WHERE directory_path = ?";

      this.db.get(sql, [directoryPath], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row && row.analysis_data_compressed) {
          row.analysis_data = this.core.decompressData(row.analysis_data_compressed);
        }

        resolve(row);
      });
    });
  }

  /**
   * Get paginated files for an analysis with optional filtering
   */
  getAnalysisFiles(analysisId, options = {}) {
    return new Promise((resolve, reject) => {
      const {
        page = 1,
        limit = 100,
        sortBy = "file_size",
        sortOrder = "desc",
        category = null,
        extension = null,
        minSize = null,
        maxSize = null,
        search = null,
      } = options;

      let sql = `SELECT * FROM analysis_files WHERE analysis_id = ?`;
      const params = [analysisId];

      // Apply filters
      if (category) {
        sql += ` AND file_category = ?`;
        params.push(category);
      }

      if (extension) {
        sql += ` AND file_extension = ?`;
        params.push(extension);
      }

      if (minSize !== null) {
        sql += ` AND file_size >= ?`;
        params.push(minSize);
      }

      if (maxSize !== null) {
        sql += ` AND file_size <= ?`;
        params.push(maxSize);
      }

      if (search) {
        sql += ` AND (file_name LIKE ? OR file_path LIKE ?)`;
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern);
      }

      // Get total count before pagination
      const countSql = sql.replace("SELECT *", "SELECT COUNT(*) as count");

      this.db.get(countSql, params, (err, countRow) => {
        if (err) {
          reject(err);
          return;
        }

        const total = countRow.count;

        // Apply sorting
        const validSortColumns = ["file_name", "file_size", "file_category", "file_extension"];
        const orderColumn = validSortColumns.includes(sortBy) ? sortBy : "file_size";
        const orderDirection = sortOrder.toLowerCase() === "asc" ? "ASC" : "DESC";

        sql += ` ORDER BY ${orderColumn} ${orderDirection}`;

        // Apply pagination
        const offset = (page - 1) * limit;
        sql += ` LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        this.db.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          resolve({
            files: rows,
            pagination: {
              page,
              limit,
              total,
              pages: Math.ceil(total / limit),
            },
          });
        });
      });
    });
  }

  /**
   * Get file statistics for an analysis
   */
  getAnalysisStats(analysisId) {
    return new Promise((resolve, reject) => {
      const statsSql = `
        SELECT
          COUNT(*) as total_files,
          SUM(file_size) as total_size,
          AVG(file_size) as avg_size,
          MAX(file_size) as max_size,
          MIN(file_size) as min_size
        FROM analysis_files
        WHERE analysis_id = ?
      `;

      const categoriesSql = `
        SELECT file_category, COUNT(*) as count, SUM(file_size) as total_size
        FROM analysis_files
        WHERE analysis_id = ?
        GROUP BY file_category
      `;

      const extensionsSql = `
        SELECT file_extension, COUNT(*) as count, SUM(file_size) as total_size
        FROM analysis_files
        WHERE analysis_id = ?
        GROUP BY file_extension
      `;

      Promise.all([
        new Promise((res, rej) => {
          this.db.get(statsSql, [analysisId], (err, row) => {
            if (err) rej(err);
            else res(row);
          });
        }),
        new Promise((res, rej) => {
          this.db.all(categoriesSql, [analysisId], (err, rows) => {
            if (err) rej(err);
            else res(rows);
          });
        }),
        new Promise((res, rej) => {
          this.db.all(extensionsSql, [analysisId], (err, rows) => {
            if (err) rej(err);
            else res(rows);
          });
        }),
      ])
        .then(([stats, categories, extensions]) => {
          resolve({
            ...stats,
            categories: categories.reduce((acc, cat) => {
              acc[cat.file_category] = {
                count: cat.count,
                size: cat.total_size,
              };
              return acc;
            }, {}),
            extensions: extensions.reduce((acc, ext) => {
              acc[ext.file_extension] = {
                count: ext.count,
                size: ext.total_size,
              };
              return acc;
            }, {}),
          });
        })
        .catch(reject);
    });
  }

  /**
   * Get analysis history for all directories
   */
  getAnalysisHistory() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT
          a.*,
          (SELECT COUNT(*) FROM analysis_files WHERE analysis_id = a.id) as file_count
        FROM analyses a
        ORDER BY a.last_analyzed DESC
        LIMIT 50
      `;

      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        // Decompress analysis data for each row
        rows.forEach((row) => {
          if (row.analysis_data_compressed) {
            row.analysis_data = this.core.decompressData(row.analysis_data_compressed);
          }
        });

        resolve(rows);
      });
    });
  }

  /**
   * Get current analysis for a directory (most recent)
   */
  getCurrentAnalysis(directoryPath) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM analyses
        WHERE directory_path = ?
        ORDER BY last_analyzed DESC
        LIMIT 1
      `;

      this.db.get(sql, [directoryPath], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row && row.analysis_data_compressed) {
          row.analysis_data = this.core.decompressData(row.analysis_data_compressed);
        }

        resolve(row);
      });
    });
  }

  /**
   * Store file metadata for incremental analysis
   */
  storeFileMetadata(directoryPath, files) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO file_metadata
        (directory_path, file_path, file_size, file_hash, last_modified)
        VALUES (?, ?, ?, ?, ?)
      `);

      let processed = 0;
      let errors = 0;

      files.forEach((file) => {
        const hash = this.core.generateHash(`${file.path}:${file.size}:${file.modified}`);
        stmt.run(
          [directoryPath, file.path, file.size, hash, file.modified],
          (err) => {
            if (err) errors++;
            else processed++;
          }
        );
      });

      stmt.finalize();
      console.log(`💾 Stored metadata for ${processed} files (${errors} errors)`);
      resolve({ processed, errors });
    });
  }

  /**
   * Get changed files since last analysis
   */
  getChangedFiles(directoryPath, currentFiles) {
    return new Promise((resolve, reject) => {
      const sql = "SELECT * FROM file_metadata WHERE directory_path = ?";

      this.db.all(sql, [directoryPath], (err, storedFiles) => {
        if (err) {
          reject(err);
          return;
        }

        const storedMap = new Map(storedFiles.map((f) => [f.file_path, f]));

        const changed = [];
        const unchanged = [];
        const removed = [];

        currentFiles.forEach((file) => {
          const stored = storedMap.get(file.path);
          const currentHash = this.core.generateHash(`${file.path}:${file.size}:${file.modified}`);

          if (!stored) {
            changed.push({ ...file, status: "new" });
          } else if (stored.file_hash !== currentHash) {
            changed.push({ ...file, status: "modified" });
          } else {
            unchanged.push(file);
          }
        });

        // Find removed files
        const currentPaths = new Set(currentFiles.map((f) => f.path));
        storedFiles.forEach((stored) => {
          if (!currentPaths.has(stored.file_path)) {
            removed.push(stored);
          }
        });

        resolve({ changed, unchanged, removed, total: currentFiles.length });
      });
    });
  }
}

module.exports = AnalysisDatabase;
