/**
 * Database Core Module
 * Handles database initialization, connection, and utility functions
 */

const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const zlib = require("zlib");

class DatabaseCore {
  constructor(dbPath) {
    this.dbPath = dbPath || path.join(__dirname, "..", "knowledge.db");
    this.db = null;
  }

  /**
   * Normalize path for consistent database lookups
   * @param {string} p - Path to normalize
   * @returns {string} Normalized path
   */
  normalizePath(p) {
    if (!p) return p;
    // Convert backslashes to forward slashes and remove trailing slash
    return path.normalize(p).replace(/\\/g, "/").replace(/\/$/, "");
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

      -- Report Templates for user-defined PDF styles
      CREATE TABLE IF NOT EXISTS report_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_name TEXT NOT NULL,
        template_type TEXT NOT NULL, -- 'analysis', 'complexity', 'custom'
        description TEXT,
        header_html TEXT, -- Custom HTML for header section
        footer_html TEXT, -- Custom HTML for footer section
        css_styles TEXT, -- Custom CSS styles
        color_scheme TEXT, -- JSON: { primary, secondary, accent, background }
        logo_url TEXT, -- Optional logo URL/path
        include_sections TEXT, -- JSON array: ['summary', 'categories', 'extensions', 'files', 'charts']
        file_limit INTEGER DEFAULT 100,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_default BOOLEAN DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        UNIQUE(template_name, template_type)
      );

      -- Batch Export Jobs
      CREATE TABLE IF NOT EXISTS batch_export_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_name TEXT,
        job_type TEXT NOT NULL, -- 'pdf', 'csv', 'json'
        status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
        analysis_ids TEXT, -- JSON array of analysis IDs
        export_options TEXT, -- JSON: { format, template, includeFiles, etc. }
        output_files TEXT, -- JSON array of generated file paths
        total_items INTEGER,
        processed_items INTEGER DEFAULT 0,
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME
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

      -- Indexes for report_templates and batch_export_jobs
      CREATE INDEX IF NOT EXISTS idx_templates_type ON report_templates(template_type);
      CREATE INDEX IF NOT EXISTS idx_templates_active ON report_templates(is_active);
      CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_export_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_batch_jobs_created ON batch_export_jobs(created_at);

      -- User Settings
      CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value TEXT, -- JSON string
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Indexes for user_settings
      CREATE INDEX IF NOT EXISTS idx_user_settings_key ON user_settings(setting_key);
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
   * Compress data to base64 zlib
   * Uses Node.js v25+ Uint8Array.toBase64() for better performance
   */
  compressData(data) {
    try {
      const json = JSON.stringify(data);
      const compressed = zlib.deflateSync(json);

      // Use Node.js v25+ Uint8Array.toBase64() if available
      if (Uint8Array.prototype.toBase64) {
        return compressed.toBase64();
      }
      // Fallback to Buffer for older Node.js versions
      return compressed.toString("base64");
    } catch (err) {
      console.error("❌ Compression error:", err);
      return JSON.stringify(data);
    }
  }

  /**
   * Decompress data from base64 zlib
   * Uses Node.js v25+ Uint8Array.from() with base64 for better performance
   */
  decompressData(compressed) {
    try {
      let buffer;

      // Use Node.js v25+ Uint8Array.from() with base64 if available
      if (Uint8Array.from && typeof Uint8Array.from === "function") {
        try {
          buffer = Uint8Array.from(compressed, (c) => c.charCodeAt(0));
          // Convert base64 string to Uint8Array
          const binaryString = atob(compressed);
          buffer = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            buffer[i] = binaryString.charCodeAt(i);
          }
        } catch {
          // Fallback to Buffer
          buffer = Buffer.from(compressed, "base64");
        }
      } else {
        buffer = Buffer.from(compressed, "base64");
      }

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
   * Generate hash for content
   */
  generateHash(content) {
    return crypto.createHash("md5").update(content).digest("hex");
  }

  /**
   * Get database statistics
   */
  getStats() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT
          (SELECT COUNT(*) FROM analyses) as analyses_count,
          (SELECT COUNT(*) FROM ai_responses) as ai_responses_count,
          (SELECT COUNT(*) FROM file_metadata) as file_metadata_count,
          (SELECT COUNT(*) FROM analysis_files) as analysis_files_count
      `;

      this.db.get(sql, (err, row) => {
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
            `⚠️ Database size (${sizeMB.toFixed(2)} MB) exceeds ${thresholdMB} MB threshold`
          );
        }

        resolve({ size: sizeMB, threshold: thresholdMB });
      });
    });
  }

  /**
   * Get user setting by key
   */
  getUserSetting(key) {
    return new Promise((resolve, reject) => {
      const sql = "SELECT setting_value FROM user_settings WHERE setting_key = ?";
      this.db.get(sql, [key], (err, row) => {
        if (err) {
          reject(err);
        } else {
          try {
            resolve(row ? JSON.parse(row.setting_value) : null);
          } catch (e) {
            resolve(row ? row.setting_value : null);
          }
        }
      });
    });
  }

  /**
   * Set user setting
   */
  setUserSetting(key, value) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO user_settings (setting_key, setting_value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(setting_key) DO UPDATE SET
          setting_value = excluded.setting_value,
          updated_at = CURRENT_TIMESTAMP
      `;
      const valueStr = typeof value === "string" ? value : JSON.stringify(value);
      this.db.run(sql, [key, valueStr], (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
  }

  /**
   * Delete user setting
   */
  deleteUserSetting(key) {
    return new Promise((resolve, reject) => {
      const sql = "DELETE FROM user_settings WHERE setting_key = ?";
      this.db.run(sql, [key], (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    });
  }

  /**
   * Get all user settings
   */
  getAllUserSettings() {
    return new Promise((resolve, reject) => {
      const sql = "SELECT setting_key, setting_value FROM user_settings";
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const settings = {};
          rows.forEach((row) => {
            try {
              settings[row.setting_key] = JSON.parse(row.setting_value);
            } catch (e) {
              settings[row.setting_key] = row.setting_value;
            }
          });
          resolve(settings);
        }
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
        DELETE FROM ai_responses WHERE last_accessed < ?;
        DELETE FROM file_metadata WHERE created_at < ?;
        DELETE FROM analyses WHERE last_analyzed < ?;
        VACUUM;
      `;

      this.db.exec(sql, [cutoffDate, cutoffDate, cutoffDate], (err) => {
        if (err) {
          console.error("Cleanup error:", err);
          reject(err);
        } else {
          console.log(`✅ Cleaned up data older than ${daysToKeep} days`);
          resolve(true);
        }
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

  // Getter for database instance
  getDatabase() {
    return this.db;
  }
}

module.exports = DatabaseCore;
