const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const zlib = require("zlib");

/**
 * Knowledge Database - Persistent storage for AI responses and file metadata
 * Enables incremental analysis and intelligent caching across server restarts
 */
class KnowledgeDatabase {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, "knowledge.db");
    this.db = null;
    this.initialize();
  }

  initialize() {
    // Ensure directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        console.error("❌ Failed to open knowledge database:", err);
      } else {
        console.log("📚 Knowledge database initialized:", this.dbPath);
        this.createTables();
      }
    });
  }

  createTables() {
    const tables = `
            -- Analysis metadata for directories
            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                directory_path TEXT UNIQUE NOT NULL,
                total_files INTEGER,
                total_size INTEGER,
                metadata_hash TEXT,
                last_analyzed DATETIME DEFAULT CURRENT_TIMESTAMP,
                analysis_data_compressed TEXT -- Compressed JSON for full data
            );

            -- AI responses cache
            CREATE TABLE IF NOT EXISTS ai_responses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                context_hash TEXT,
                model_used TEXT,
                response_time INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                hit_count INTEGER DEFAULT 1,
                last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            -- File metadata for incremental analysis
            CREATE TABLE IF NOT EXISTS file_metadata (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                directory_path TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER,
                file_hash TEXT,
                last_modified DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(directory_path, file_path)
            );

            -- Analysis files - separate storage for efficient querying
            CREATE TABLE IF NOT EXISTS analysis_files (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                analysis_id INTEGER NOT NULL,
                file_path TEXT NOT NULL,
                file_name TEXT,
                file_size INTEGER,
                file_category TEXT,
                file_extension TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
            );

            -- Indexes for performance
            CREATE INDEX IF NOT EXISTS idx_analyses_path ON analyses(directory_path);
            CREATE INDEX IF NOT EXISTS idx_ai_context ON ai_responses(context_hash);
            CREATE INDEX IF NOT EXISTS idx_file_dir ON file_metadata(directory_path);

            -- New indexes for analysis_files
            CREATE INDEX IF NOT EXISTS idx_analysis_files_analysis_id ON analysis_files(analysis_id);
            CREATE INDEX IF NOT EXISTS idx_analysis_files_category ON analysis_files(analysis_id, file_category);
            CREATE INDEX IF NOT EXISTS idx_analysis_files_extension ON analysis_files(analysis_id, file_extension);
            CREATE INDEX IF NOT EXISTS idx_analysis_files_size ON analysis_files(file_size);

            -- AI Analysis Context for Ollama prompts
            CREATE TABLE IF NOT EXISTS ai_analysis_context (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                analysis_id INTEGER NOT NULL,
                directory_path TEXT NOT NULL,
                context_type TEXT NOT NULL, -- 'summary', 'detailed', 'trends'
                context_payload TEXT, -- Structured JSON for Ollama
                model_used TEXT,
                prompt_template TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (analysis_id) REFERENCES analyses(id) ON DELETE CASCADE
            );

            -- Analysis Trends for tracking changes over time
            CREATE TABLE IF NOT EXISTS analysis_trends (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                directory_path TEXT NOT NULL,
                analysis_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                total_files INTEGER,
                total_size INTEGER,
                file_count_change INTEGER, -- Change from previous analysis
                size_change INTEGER, -- Change in bytes
                top_categories TEXT, -- JSON array of top 5 categories
                largest_files TEXT, -- JSON array of top 5 files
                growth_rate REAL, -- Percentage growth
                FOREIGN KEY (directory_path) REFERENCES analyses(directory_path)
            );

            -- File Summaries for AI document summarization
            CREATE TABLE IF NOT EXISTS file_summaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT UNIQUE NOT NULL,
                file_hash TEXT, -- For cache invalidation
                file_size INTEGER,
                file_type TEXT, -- 'document', 'code', 'data', etc.
                summary_text TEXT, -- AI-generated summary
                extracted_text_preview TEXT, -- First 500 chars of extracted text
                model_used TEXT,
                tokens_used INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                hit_count INTEGER DEFAULT 1
            );

            -- Cleanup Recommendations for AI cleanup assistant
            CREATE TABLE IF NOT EXISTS cleanup_recommendations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                directory_path TEXT NOT NULL,
                file_path TEXT NOT NULL,
                file_size INTEGER,
                recommendation_type TEXT, -- 'safe_to_delete', 'review', 'archive', 'duplicate'
                confidence_score REAL, -- 0.0 to 1.0
                reasoning TEXT, -- AI explanation
                potential_savings INTEGER, -- Size in bytes
                safe_to_delete BOOLEAN DEFAULT 0,
                user_action TEXT, -- 'pending', 'approved', 'rejected', 'completed'
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(directory_path, file_path)
            );

            -- Code Complexity Metrics
            CREATE TABLE IF NOT EXISTS complexity_metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT UNIQUE NOT NULL,
                directory_path TEXT NOT NULL,
                language TEXT,
                lines_of_code INTEGER,
                logical_lines INTEGER,
                comment_lines INTEGER,
                blank_lines INTEGER,
                cyclomatic_complexity INTEGER,
                cognitive_complexity INTEGER,
                function_count INTEGER,
                max_function_length INTEGER,
                avg_function_length REAL,
                nesting_depth INTEGER,
                maintainability_index REAL,
                complexity_grade TEXT, -- 'A', 'B', 'C', 'D', 'F'
                refactoring_priority TEXT, -- 'critical', 'high', 'medium', 'low'
                analyzed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                file_hash TEXT -- For cache invalidation
            );

            -- Indexes for AI context, trends, summaries, cleanup, and complexity
            CREATE INDEX IF NOT EXISTS idx_ai_context_analysis ON ai_analysis_context(analysis_id);
            CREATE INDEX IF NOT EXISTS idx_ai_context_type ON ai_analysis_context(context_type);
            CREATE INDEX IF NOT EXISTS idx_trends_path ON analysis_trends(directory_path);
            CREATE INDEX IF NOT EXISTS idx_trends_date ON analysis_trends(analysis_date);
            CREATE INDEX IF NOT EXISTS idx_summaries_path ON file_summaries(file_path);
            CREATE INDEX IF NOT EXISTS idx_summaries_type ON file_summaries(file_type);
            CREATE INDEX IF NOT EXISTS idx_complexity_path ON complexity_metrics(file_path);
            CREATE INDEX IF NOT EXISTS idx_complexity_dir ON complexity_metrics(directory_path);
            CREATE INDEX IF NOT EXISTS idx_complexity_grade ON complexity_metrics(complexity_grade);
            CREATE INDEX IF NOT EXISTS idx_complexity_priority ON complexity_metrics(refactoring_priority);
        `;

    this.db.exec(tables, (err) => {
      if (err) {
        console.error("❌ Failed to create tables:", err);
      } else {
        console.log("✅ Knowledge database tables ready");
      }
    });
  }

  /**
   * Compress JSON data using zlib
   */
  compressData(data) {
    try {
      const json = JSON.stringify(data);
      const compressed = zlib.deflateSync(json);
      return compressed.toString("base64");
    } catch (err) {
      console.error("❌ Compression error:", err);
      return JSON.stringify(data);
    }
  }

  /**
   * Decompress data from base64 zlib
   */
  decompressData(compressed) {
    try {
      const buffer = Buffer.from(compressed, "base64");
      const decompressed = zlib.inflateSync(buffer);
      return JSON.parse(decompressed.toString());
    } catch (err) {
      // Fallback to plain JSON if decompression fails
      try {
        return JSON.parse(compressed);
      } catch {
        return null;
      }
    }
  }

  /**
   * Store analysis results for a directory with separate file storage
   */
  storeAnalysis(directoryPath, analysisData) {
    return new Promise((resolve, reject) => {
      const metadataHash = this.generateHash(
        JSON.stringify({
          totalFiles: analysisData.totalFiles,
          totalSize: analysisData.totalSize,
        })
      );

      // Compress the full analysis data
      const compressedData = this.compressData(analysisData);

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
          console.log(`� Stored ${processed} files (errors: ${errors})`);
          resolve();
          return;
        }

        let pending = batch.length;
        batch.forEach((file) => {
          stmt.run(
            [
              analysisId,
              file.path,
              file.name,
              file.size,
              file.category || "Other",
              file.extension || "",
            ],
            (err) => {
              if (err) {
                errors++;
                console.error("Error storing file:", err);
              } else {
                processed++;
              }
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
        if (err) reject(err);
        else if (row) {
          // Decompress the analysis data
          const analysisData = row.analysis_data_compressed
            ? this.decompressData(row.analysis_data_compressed)
            : null;
          resolve({
            ...row,
            analysis_data: analysisData,
          });
        } else {
          resolve(null);
        }
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
        perPage = 100,
        category = null,
        extension = null,
        minSize = null,
        maxSize = null,
        sortBy = "file_size",
        sortOrder = "DESC",
      } = options;

      let whereClause = "analysis_id = ?";
      const params = [analysisId];

      if (category) {
        whereClause += " AND file_category = ?";
        params.push(category);
      }
      if (extension) {
        whereClause += " AND file_extension = ?";
        params.push(extension);
      }
      if (minSize !== null) {
        whereClause += " AND file_size >= ?";
        params.push(minSize);
      }
      if (maxSize !== null) {
        whereClause += " AND file_size <= ?";
        params.push(maxSize);
      }

      // Get total count
      const countSql = `SELECT COUNT(*) as total FROM analysis_files WHERE ${whereClause}`;

      this.db.get(countSql, params, (err, countRow) => {
        if (err) {
          reject(err);
          return;
        }

        const total = countRow.total;
        const totalPages = Math.ceil(total / perPage);
        const offset = (page - 1) * perPage;

        // Get files
        const validSortColumns = ["file_name", "file_size", "file_category", "file_extension"];
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : "file_size";
        const order = sortOrder.toUpperCase() === "ASC" ? "ASC" : "DESC";

        const filesSql = `
          SELECT file_path, file_name, file_size, file_category, file_extension
          FROM analysis_files
          WHERE ${whereClause}
          ORDER BY ${sortColumn} ${order}
          LIMIT ? OFFSET ?
        `;

        this.db.all(filesSql, [...params, perPage, offset], (err, rows) => {
          if (err) {
            reject(err);
            return;
          }

          resolve({
            files: rows.map((r) => ({
              path: r.file_path,
              name: r.file_name,
              size: r.file_size,
              category: r.file_category,
              extension: r.file_extension,
            })),
            pagination: {
              page,
              perPage,
              total,
              totalPages,
              hasNext: page < totalPages,
              hasPrev: page > 1,
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
          file_category,
          COUNT(*) as count,
          SUM(file_size) as total_size,
          AVG(file_size) as avg_size
        FROM analysis_files
        WHERE analysis_id = ?
        GROUP BY file_category
        ORDER BY total_size DESC
      `;

      const extensionSql = `
        SELECT
          file_extension,
          COUNT(*) as count,
          SUM(file_size) as total_size
        FROM analysis_files
        WHERE analysis_id = ? AND file_extension != ''
        GROUP BY file_extension
        ORDER BY count DESC
        LIMIT 20
      `;

      this.db.all(statsSql, [analysisId], (err, categories) => {
        if (err) {
          reject(err);
          return;
        }

        this.db.all(extensionSql, [analysisId], (err2, extensions) => {
          if (err2) {
            reject(err2);
            return;
          }

          resolve({
            categories: categories.map((c) => ({
              name: c.file_category,
              count: c.count,
              totalSize: c.total_size,
              avgSize: c.avg_size,
            })),
            topExtensions: extensions.map((e) => ({
              extension: e.file_extension,
              count: e.count,
              totalSize: e.total_size,
            })),
          });
        });
      });
    });
  }

  /**
   * Get analysis history for all directories
   */
  getAnalysisHistory() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT
          id,
          directory_path as path,
          total_files as totalFiles,
          total_size as totalSize,
          last_analyzed as date,
          metadata_hash as hash
        FROM analyses
        ORDER BY last_analyzed DESC
      `;

      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(
          rows.map((row) => ({
            id: row.id,
            path: row.path,
            totalFiles: row.totalFiles,
            totalSize: row.totalSize,
            date: row.date,
            hash: row.hash,
          }))
        );
      });
    });
  }

  /**
   * Store AI response for future retrieval
   */
  storeAIResponse(question, answer, contextHash, modelUsed, responseTime) {
    return new Promise((resolve, reject) => {
      const sql = `
                INSERT INTO ai_responses
                (question, answer, context_hash, model_used, response_time)
                VALUES (?, ?, ?, ?, ?)
            `;

      this.db.run(sql, [question, answer, contextHash, modelUsed, responseTime], (err) => {
        if (err) reject(err);
        else {
          console.log(`🧠 Cached AI response for: "${question.substring(0, 50)}..."`);
          resolve();
        }
      });
    });
  }

  /**
   * Find similar cached response
   */
  findSimilarResponse(question, contextHash) {
    return new Promise((resolve, reject) => {
      const sql = `
                SELECT * FROM ai_responses
                WHERE question = ? AND context_hash = ?
                ORDER BY last_accessed DESC
                LIMIT 1
            `;

      this.db.get(sql, [question, contextHash], (err, row) => {
        if (err) reject(err);
        else if (row) {
          // Update hit count and last accessed
          this.db.run(
            "UPDATE ai_responses SET hit_count = hit_count + 1, last_accessed = CURRENT_TIMESTAMP WHERE id = ?",
            [row.id]
          );
          console.log(`🎯 Cache HIT: "${question.substring(0, 50)}..." (${row.hit_count} hits)`);
          resolve(row);
        } else {
          console.log(`🎯 Cache MISS: "${question.substring(0, 50)}..."`);
          resolve(null);
        }
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
      files.forEach((file) => {
        stmt.run(
          [
            directoryPath,
            file.path,
            file.size,
            file.hash || this.generateHash(file.path + file.size),
            file.lastModified || new Date().toISOString(),
          ],
          (err) => {
            if (err) console.error("Error storing file metadata:", err);
            processed++;
            if (processed === files.length) {
              stmt.finalize();
              resolve();
            }
          }
        );
      });
    });
  }

  /**
   * Get changed files since last analysis
   */
  getChangedFiles(directoryPath, currentFiles) {
    return new Promise((resolve, reject) => {
      const sql = "SELECT * FROM file_metadata WHERE directory_path = ?";

      this.db.all(sql, [directoryPath], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const previousFiles = new Map(rows.map((r) => [r.file_path, r]));
        const changed = [];
        const added = [];
        const removed = [];

        // Check for new and changed files
        currentFiles.forEach((file) => {
          const prev = previousFiles.get(file.path);
          if (!prev) {
            added.push(file);
          } else if (prev.file_size !== file.size || prev.file_hash !== file.hash) {
            changed.push(file);
          }
          previousFiles.delete(file.path);
        });

        // Remaining files in previousFiles are removed
        removed.push(...Array.from(previousFiles.values()));

        console.log(`📊 File changes: +${added.length} ~${changed.length} -${removed.length}`);

        resolve({ added, changed, removed });
      });
    });
  }

  /**
   * Get analysis history
   */
  getAnalysisHistory() {
    return new Promise((resolve, reject) => {
      const sql = "SELECT * FROM analyses ORDER BY last_analyzed DESC LIMIT 50";

      this.db.all(sql, [], (err, rows) => {
        if (err) reject(err);
        else {
          const analyses = rows.map((row) => ({
            ...row,
            analysis_data: JSON.parse(row.analysis_data),
          }));
          resolve(analyses);
        }
      });
    });
  }

  /**
   * Get database statistics
   */
  getStats() {
    return new Promise((resolve, reject) => {
      const sql = `
                SELECT
                    (SELECT COUNT(*) FROM analyses) as total_analyses,
                    (SELECT COUNT(*) FROM ai_responses) as total_responses,
                    (SELECT SUM(hit_count) FROM ai_responses) as total_cache_hits,
                    (SELECT COUNT(*) FROM file_metadata) as total_files_tracked
            `;

      this.db.get(sql, [], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Check database size and log warning if exceeds threshold
   */
  checkDatabaseSize(thresholdMB = 500) {
    return new Promise((resolve, reject) => {
      fs.stat(this.dbPath, (err, stats) => {
        if (err) {
          reject(err);
          return;
        }

        const sizeMB = stats.size / (1024 * 1024);
        if (sizeMB > thresholdMB) {
          console.warn(
            `⚠️ Database size warning: ${sizeMB.toFixed(2)} MB (threshold: ${thresholdMB} MB)`
          );
          console.warn("⚠️ Consider running database cleanup to free space");
        } else {
          console.log(`📊 Database size: ${sizeMB.toFixed(2)} MB`);
        }

        resolve({ sizeMB, thresholdMB, exceedsThreshold: sizeMB > thresholdMB });
      });
    });
  }

  /**
   * Clean up old data to reduce database size
   */
  cleanup(daysToKeep = 30) {
    return new Promise((resolve, reject) => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const sql = `
                DELETE FROM ai_responses
                WHERE created_at < ?
            `;

      this.db.run(sql, [cutoffDate.toISOString()], function (err) {
        if (err) {
          reject(err);
        } else {
          console.log(
            `🧹 Cleaned up ${this.changes} old AI responses (older than ${daysToKeep} days)`
          );

          // Vacuum database to reclaim space
          this.db.run("VACUUM", (vacuumErr) => {
            if (vacuumErr) {
              console.error("❌ Vacuum failed:", vacuumErr);
            } else {
              console.log("✅ Database vacuumed successfully");
            }
            resolve({ deleted: this.changes });
          });
        }
      });
    });
  }

  /**
   * Generate hash for content
   */
  generateHash(content) {
    return crypto.createHash("md5").update(content).digest("hex");
  }

  /**
   * Store AI analysis context for Ollama prompts
   */
  storeAIAnalysisContext(
    analysisId,
    directoryPath,
    contextType,
    contextPayload,
    modelUsed,
    promptTemplate
  ) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO ai_analysis_context
        (analysis_id, directory_path, context_type, context_payload, model_used, prompt_template)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        sql,
        [
          analysisId,
          directoryPath,
          contextType,
          JSON.stringify(contextPayload),
          modelUsed,
          promptTemplate,
        ],
        (err) => {
          if (err) {
            console.error("❌ Error storing AI context:", err);
            reject(err);
          } else {
            console.log(`🧠 Stored AI context for: ${directoryPath} (${contextType})`);
            resolve();
          }
        }
      );
    });
  }

  /**
   * Get AI analysis context for a directory
   */
  getAIAnalysisContext(analysisId, contextType = null) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT * FROM ai_analysis_context
        WHERE analysis_id = ?
      `;
      const params = [analysisId];

      if (contextType) {
        sql += ` AND context_type = ?`;
        params.push(contextType);
      }

      sql += ` ORDER BY created_at DESC LIMIT 1`;

      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row) {
          resolve({
            ...row,
            context_payload: JSON.parse(row.context_payload),
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Store analysis trend data
   */
  storeAnalysisTrend(directoryPath, analysisData) {
    return new Promise((resolve, reject) => {
      // Get previous analysis to calculate changes
      const prevSql = `
        SELECT total_files, total_size
        FROM analysis_trends
        WHERE directory_path = ?
        ORDER BY analysis_date DESC
        LIMIT 1
      `;

      this.db.get(prevSql, [directoryPath], (err, prevRow) => {
        if (err) {
          reject(err);
          return;
        }

        const fileCountChange = prevRow ? analysisData.totalFiles - prevRow.total_files : 0;
        const sizeChange = prevRow ? analysisData.totalSize - prevRow.total_size : 0;
        const growthRate =
          prevRow && prevRow.total_size > 0
            ? ((analysisData.totalSize - prevRow.total_size) / prevRow.total_size) * 100
            : 0;

        const sql = `
          INSERT INTO analysis_trends
          (directory_path, total_files, total_size, file_count_change, size_change, top_categories, largest_files, growth_rate)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        this.db.run(
          sql,
          [
            directoryPath,
            analysisData.totalFiles,
            analysisData.totalSize,
            fileCountChange,
            sizeChange,
            JSON.stringify(analysisData.topCategories || []),
            JSON.stringify(analysisData.largestFiles || []),
            growthRate,
          ],
          (err) => {
            if (err) {
              console.error("❌ Error storing trend:", err);
              reject(err);
            } else {
              console.log(
                `📈 Stored trend for: ${directoryPath} (${fileCountChange > 0 ? "+" : ""}${fileCountChange} files, ${growthRate > 0 ? "+" : ""}${growthRate.toFixed(1)}%)`
              );
              resolve();
            }
          }
        );
      });
    });
  }

  /**
   * Get analysis trends for a directory
   */
  getAnalysisTrends(directoryPath, limit = 10) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM analysis_trends
        WHERE directory_path = ?
        ORDER BY analysis_date DESC
        LIMIT ?
      `;

      this.db.all(sql, [directoryPath, limit], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(
          rows.map((row) => ({
            ...row,
            top_categories: JSON.parse(row.top_categories || "[]"),
            largest_files: JSON.parse(row.largest_files || "[]"),
          }))
        );
      });
    });
  }

  /**
   * Get trend summary (growth over time)
   */
  getTrendSummary(directoryPath) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT
          COUNT(*) as analysis_count,
          MIN(analysis_date) as first_analysis,
          MAX(analysis_date) as last_analysis,
          MIN(total_size) as min_size,
          MAX(total_size) as max_size,
          AVG(growth_rate) as avg_growth_rate
        FROM analysis_trends
        WHERE directory_path = ?
      `;

      this.db.get(sql, [directoryPath], (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        resolve({
          analysisCount: row.analysis_count,
          firstAnalysis: row.first_analysis,
          lastAnalysis: row.last_analysis,
          minSize: row.min_size,
          maxSize: row.max_size,
          avgGrowthRate: row.avg_growth_rate,
          totalGrowth: row.max_size && row.min_size ? row.max_size - row.min_size : 0,
        });
      });
    });
  }

  /**
   * Store AI-generated file summary
   */
  storeFileSummary(
    filePath,
    fileHash,
    fileSize,
    fileType,
    summaryText,
    extractedPreview,
    modelUsed,
    tokensUsed
  ) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO file_summaries
        (file_path, file_hash, file_size, file_type, summary_text, extracted_text_preview, model_used, tokens_used, created_at, accessed_at, hit_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, COALESCE(
          (SELECT hit_count + 1 FROM file_summaries WHERE file_path = ?), 1
        ))
      `;

      this.db.run(
        sql,
        [
          filePath,
          fileHash,
          fileSize,
          fileType,
          summaryText,
          extractedPreview,
          modelUsed,
          tokensUsed,
          filePath,
        ],
        (err) => {
          if (err) {
            console.error("❌ Error storing file summary:", err);
            reject(err);
          } else {
            console.log(`📝 Stored summary for: ${path.basename(filePath)} (${fileType})`);
            resolve();
          }
        }
      );
    });
  }

  /**
   * Get cached file summary
   */
  getFileSummary(filePath, fileHash = null) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT * FROM file_summaries WHERE file_path = ?`;
      const params = [filePath];

      // If hash provided, check if summary is still valid
      if (fileHash) {
        sql += ` AND file_hash = ?`;
        params.push(fileHash);
      }

      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (row) {
          // Update access time
          this.db.run(
            `UPDATE file_summaries SET accessed_at = CURRENT_TIMESTAMP, hit_count = hit_count + 1 WHERE id = ?`,
            [row.id]
          );
          resolve(row);
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Get popular file summaries (for analytics)
   */
  getPopularSummaries(limit = 20) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT file_path, file_type, summary_text, hit_count, accessed_at
        FROM file_summaries
        ORDER BY hit_count DESC, accessed_at DESC
        LIMIT ?
      `;

      this.db.all(sql, [limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Clean up old summaries (files that no longer exist)
   */
  async cleanupStaleSummaries(existingFilePaths) {
    return new Promise((resolve, reject) => {
      const placeholders = existingFilePaths.map(() => "?").join(",");
      const sql = `
        DELETE FROM file_summaries
        WHERE file_path NOT IN (${placeholders})
      `;

      this.db.run(sql, existingFilePaths, function (err) {
        if (err) {
          reject(err);
        } else {
          console.log(`🧹 Cleaned up ${this.changes} stale file summaries`);
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Store AI cleanup recommendation
   */
  storeCleanupRecommendation(
    directoryPath,
    filePath,
    fileSize,
    recommendationType,
    confidenceScore,
    reasoning,
    potentialSavings,
    safeToDelete
  ) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO cleanup_recommendations
        (directory_path, file_path, file_size, recommendation_type, confidence_score, reasoning, potential_savings, safe_to_delete, user_action, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP)
      `;

      this.db.run(
        sql,
        [
          directoryPath,
          filePath,
          fileSize,
          recommendationType,
          confidenceScore,
          reasoning,
          potentialSavings,
          safeToDelete ? 1 : 0,
        ],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  /**
   * Get cleanup recommendations for a directory
   */
  getCleanupRecommendations(directoryPath, limit = 50, type = null) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT * FROM cleanup_recommendations WHERE directory_path = ?`;
      const params = [directoryPath];

      if (type) {
        sql += ` AND recommendation_type = ?`;
        params.push(type);
      }

      sql += ` ORDER BY confidence_score DESC, potential_savings DESC LIMIT ?`;
      params.push(limit);

      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Update user action on recommendation
   */
  updateCleanupAction(filePath, action) {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE cleanup_recommendations SET user_action = ? WHERE file_path = ?`;
      this.db.run(sql, [action, filePath], function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      });
    });
  }

  /**
   * Get total potential savings from pending recommendations
   */
  getPotentialSavings(directoryPath) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT
          COUNT(*) as recommendation_count,
          SUM(potential_savings) as total_savings,
          SUM(CASE WHEN safe_to_delete = 1 THEN potential_savings ELSE 0 END) as safe_savings
        FROM cleanup_recommendations
        WHERE directory_path = ? AND user_action = 'pending'
      `;

      this.db.get(sql, [directoryPath], (err, row) => {
        if (err) reject(err);
        else resolve(row || { recommendation_count: 0, total_savings: 0, safe_savings: 0 });
      });
    });
  }

  /**
   * Store code complexity metrics
   */
  storeComplexityMetrics(metrics) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO complexity_metrics
        (file_path, directory_path, language, lines_of_code, logical_lines, comment_lines, blank_lines,
         cyclomatic_complexity, cognitive_complexity, function_count, max_function_length, avg_function_length,
         nesting_depth, maintainability_index, complexity_grade, refactoring_priority, analyzed_at, file_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      `;

      this.db.run(
        sql,
        [
          metrics.filePath,
          metrics.directoryPath,
          metrics.language,
          metrics.linesOfCode,
          metrics.logicalLines,
          metrics.commentLines,
          metrics.blankLines,
          metrics.cyclomaticComplexity,
          metrics.cognitiveComplexity,
          metrics.functionCount,
          metrics.maxFunctionLength,
          metrics.averageFunctionLength,
          metrics.nestingDepth,
          metrics.maintainabilityIndex,
          metrics.complexityGrade,
          metrics.refactoringPriority,
          metrics.fileHash,
        ],
        function (err) {
          if (err) {
            console.error("❌ Error storing complexity metrics:", err);
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  /**
   * Get complexity metrics for a file
   */
  getComplexityMetrics(filePath) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM complexity_metrics WHERE file_path = ?`;
      this.db.get(sql, [filePath], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Get complexity metrics for a directory
   */
  getDirectoryComplexity(directoryPath, minPriority = null) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT * FROM complexity_metrics WHERE directory_path = ?`;
      const params = [directoryPath];

      if (minPriority) {
        const priorityOrder = { critical: 1, high: 2, medium: 3, low: 4 };
        sql += ` AND CASE refactoring_priority
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END <= ?`;
        params.push(priorityOrder[minPriority] || 4);
      }

      sql += ` ORDER BY cyclomatic_complexity DESC`;

      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Get complexity summary statistics for a directory
   */
  getComplexitySummary(directoryPath) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT
          COUNT(*) as total_files,
          AVG(lines_of_code) as avg_lines,
          AVG(cyclomatic_complexity) as avg_complexity,
          AVG(maintainability_index) as avg_maintainability,
          MAX(cyclomatic_complexity) as max_complexity,
          MIN(maintainability_index) as min_maintainability,
          SUM(CASE WHEN complexity_grade = 'A' THEN 1 ELSE 0 END) as grade_a,
          SUM(CASE WHEN complexity_grade = 'B' THEN 1 ELSE 0 END) as grade_b,
          SUM(CASE WHEN complexity_grade = 'C' THEN 1 ELSE 0 END) as grade_c,
          SUM(CASE WHEN complexity_grade = 'D' THEN 1 ELSE 0 END) as grade_d,
          SUM(CASE WHEN complexity_grade = 'F' THEN 1 ELSE 0 END) as grade_f,
          SUM(CASE WHEN refactoring_priority = 'critical' THEN 1 ELSE 0 END) as critical_count,
          SUM(CASE WHEN refactoring_priority = 'high' THEN 1 ELSE 0 END) as high_count,
          SUM(CASE WHEN refactoring_priority = 'medium' THEN 1 ELSE 0 END) as medium_count
        FROM complexity_metrics
        WHERE directory_path = ?
      `;

      this.db.get(sql, [directoryPath], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Get files needing refactoring by priority
   */
  getFilesNeedingRefactoring(directoryPath, limit = 20) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM complexity_metrics
        WHERE directory_path = ?
          AND refactoring_priority IN ('critical', 'high')
        ORDER BY
          CASE refactoring_priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
          END,
          cyclomatic_complexity DESC
        LIMIT ?
      `;

      this.db.all(sql, [directoryPath, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) console.error("Error closing database:", err);
        else console.log("📚 Knowledge database closed");
      });
    }
  }
}

module.exports = KnowledgeDatabase;
