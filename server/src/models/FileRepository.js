/**
 * File Repository
 * Handles database operations for file data
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class FileRepository {
    constructor() {
        this.dbPath = path.join(__dirname, '..', '..', 'data', 'space-analyzer.db');
        this.ensureDatabase();
    }

    ensureDatabase() {
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        
        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err);
            } else {
                console.log('Connected to SQLite database');
                this.createTables();
            }
        });
    }

    createTables() {
        const createAnalysesTable = `
            CREATE TABLE IF NOT EXISTS analyses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                path TEXT NOT NULL,
                data TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        this.db.run(createAnalysesTable, (err) => {
            if (err) {
                console.error('Error creating analyses table:', err);
            } else {
                console.log('Analyses table created or already exists');
            }
        });
    }

    async saveAnalysis(path, data) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT OR REPLACE INTO analyses (path, data, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
            `;
            
            this.db.run(sql, [path, JSON.stringify(data)], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, path, data });
                }
            });
        });
    }

    async getAnalysis(path) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM analyses WHERE path = ? ORDER BY created_at DESC LIMIT 1';
            
            this.db.get(sql, [path], (err, row) => {
                if (err) {
                    reject(err);
                } else if (row) {
                    resolve({
                        ...row,
                        data: JSON.parse(row.data)
                    });
                } else {
                    resolve(null);
                }
            });
        });
    }

    async getAllAnalyses() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM analyses ORDER BY created_at DESC';
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const analyses = rows.map(row => ({
                        ...row,
                        data: JSON.parse(row.data)
                    }));
                    resolve(analyses);
                }
            });
        });
    }

    async deleteAnalysis(id) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM analyses WHERE id = ?';
            
            this.db.run(sql, [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ deleted: this.changes });
                }
            });
        });
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }
}

module.exports = FileRepository;
