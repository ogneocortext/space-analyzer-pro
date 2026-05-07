/**
 * User Repository
 * Handles database operations for user data
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

class UserRepository {
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
        const createUsersTable = `
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `;

        this.db.run(createUsersTable, (err) => {
            if (err) {
                console.error('Error creating users table:', err);
            } else {
                console.log('Users table created or already exists');
            }
        });
    }

    async createUser(userData) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO users (username, email, password_hash, role)
                VALUES (?, ?, ?, ?)
            `;
            
            this.db.run(sql, [
                userData.username,
                userData.email,
                userData.passwordHash,
                userData.role || 'user'
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, ...userData });
                }
            });
        });
    }

    async getUserByUsername(username) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM users WHERE username = ?';
            
            this.db.get(sql, [username], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getUserByEmail(email) {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM users WHERE email = ?';
            
            this.db.get(sql, [email], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async getAllUsers() {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT id, username, email, role, created_at, updated_at FROM users ORDER BY created_at DESC';
            
            this.db.all(sql, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    async updateUser(id, userData) {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE users 
                SET username = ?, email = ?, role = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `;
            
            this.db.run(sql, [
                userData.username,
                userData.email,
                userData.role,
                id
            ], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ updated: this.changes });
                }
            });
        });
    }

    async deleteUser(id) {
        return new Promise((resolve, reject) => {
            const sql = 'DELETE FROM users WHERE id = ?';
            
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

module.exports = UserRepository;
