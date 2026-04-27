const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

/**
 * Knowledge Database - Persistent storage for AI responses and file metadata
 * Enables incremental analysis and intelligent caching across server restarts
 */
class KnowledgeDatabase {
    constructor(dbPath) {
        this.dbPath = dbPath || path.join(__dirname, 'knowledge.db');
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
                console.error('❌ Failed to open knowledge database:', err);
            } else {
                console.log('📚 Knowledge database initialized:', this.dbPath);
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
                analysis_data TEXT
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

            -- Indexes for performance
            CREATE INDEX IF NOT EXISTS idx_analyses_path ON analyses(directory_path);
            CREATE INDEX IF NOT EXISTS idx_ai_context ON ai_responses(context_hash);
            CREATE INDEX IF NOT EXISTS idx_file_dir ON file_metadata(directory_path);
        `;

        this.db.exec(tables, (err) => {
            if (err) {
                console.error('❌ Failed to create tables:', err);
            } else {
                console.log('✅ Knowledge database tables ready');
            }
        });
    }

    /**
     * Store analysis results for a directory
     */
    storeAnalysis(directoryPath, analysisData) {
        return new Promise((resolve, reject) => {
            const metadataHash = this.generateHash(JSON.stringify({
                totalFiles: analysisData.totalFiles,
                totalSize: analysisData.totalSize
            }));

            const sql = `
                INSERT OR REPLACE INTO analyses 
                (directory_path, total_files, total_size, metadata_hash, analysis_data, last_analyzed)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;

            this.db.run(sql, [
                directoryPath,
                analysisData.totalFiles,
                analysisData.totalSize,
                metadataHash,
                JSON.stringify(analysisData)
            ], (err) => {
                if (err) reject(err);
                else {
                    console.log(`💾 Stored analysis for: ${directoryPath}`);
                    resolve();
                }
            });
        });
    }

    /**
     * Get previous analysis for a directory
     */
    getAnalysis(directoryPath) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM analyses WHERE directory_path = ?';
            
            this.db.get(sql, [directoryPath], (err, row) => {
                if (err) reject(err);
                else if (row) {
                    resolve({
                        ...row,
                        analysis_data: JSON.parse(row.analysis_data)
                    });
                } else {
                    resolve(null);
                }
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
                        'UPDATE ai_responses SET hit_count = hit_count + 1, last_accessed = CURRENT_TIMESTAMP WHERE id = ?',
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
            files.forEach(file => {
                stmt.run([
                    directoryPath,
                    file.path,
                    file.size,
                    file.hash || this.generateHash(file.path + file.size),
                    file.lastModified || new Date().toISOString()
                ], (err) => {
                    if (err) console.error('Error storing file metadata:', err);
                    processed++;
                    if (processed === files.length) {
                        stmt.finalize();
                        resolve();
                    }
                });
            });
        });
    }

    /**
     * Get changed files since last analysis
     */
    getChangedFiles(directoryPath, currentFiles) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM file_metadata WHERE directory_path = ?';
            
            this.db.all(sql, [directoryPath], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }

                const previousFiles = new Map(rows.map(r => [r.file_path, r]));
                const changed = [];
                const added = [];
                const removed = [];

                // Check for new and changed files
                currentFiles.forEach(file => {
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
            const sql = 'SELECT * FROM analyses ORDER BY last_analyzed DESC LIMIT 50';
            
            this.db.all(sql, [], (err, rows) => {
                if (err) reject(err);
                else {
                    const analyses = rows.map(row => ({
                        ...row,
                        analysis_data: JSON.parse(row.analysis_data)
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
                    console.warn(`⚠️ Database size warning: ${sizeMB.toFixed(2)} MB (threshold: ${thresholdMB} MB)`);
                    console.warn('⚠️ Consider running database cleanup to free space');
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

            this.db.run(sql, [cutoffDate.toISOString()], function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`🧹 Cleaned up ${this.changes} old AI responses (older than ${daysToKeep} days)`);
                    
                    // Vacuum database to reclaim space
                    this.db.run('VACUUM', (vacuumErr) => {
                        if (vacuumErr) {
                            console.error('❌ Vacuum failed:', vacuumErr);
                        } else {
                            console.log('✅ Database vacuumed successfully');
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
        return crypto.createHash('md5').update(content).digest('hex');
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) console.error('Error closing database:', err);
                else console.log('📚 Knowledge database closed');
            });
        }
    }
}

module.exports = KnowledgeDatabase;
