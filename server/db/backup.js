/**
 * Database Backup System
 * Provides automated backups with scheduling, compression, and retention management
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const logger = require('../utils/logger');

class DatabaseBackup {
  constructor(options = {}) {
    this.options = {
      backupDirectory: options.backupDirectory || path.join(__dirname, '..', 'backups'),
      compressionLevel: options.compressionLevel || 'gzip',
      maxBackups: options.maxBackups || 10,
      retentionDays: options.retentionDays || 30,
      scheduleInterval: options.scheduleInterval || 24 * 60 * 60 * 1000, // 24 hours
      excludePatterns: options.excludePatterns || ['*.tmp', '*.log', '*.cache'],
      enableEncryption: options.enableEncryption !== false,
      ...options
    };
    
    this.backupSchedule = null;
    this.isRunning = false;
    this.currentBackup = null;
    this.stats = {
      totalBackups: 0,
      successfulBackups: 0,
      failedBackups: 0,
      totalSize: 0,
      compressedSize: 0,
      lastBackup: null,
      nextBackup: null
    };
  }

  /**
   * Initialize the backup system
   */
  async initialize() {
    try {
      // Ensure backup directory exists
      if (!fs.existsSync(this.options.backupDirectory)) {
        fs.mkdirSync(this.options.backupDirectory, { recursive: true });
        logger.info('Created backup directory', this.options.backupDirectory);
      }

      // Load backup schedule
      this.loadBackupSchedule();
      
      // Start scheduled backups
      this.startScheduledBackups();
      
      logger.info('Database backup system initialized', {
        backupDirectory: this.options.backupDirectory,
        scheduleInterval: this.options.scheduleInterval,
        retentionDays: this.options.retentionDays
      });
    } catch (error) {
      logger.error('Failed to initialize backup system', error);
      throw error;
    }
  }

  /**
   * Load backup schedule from configuration
   */
  loadBackupSchedule() {
    try {
      const scheduleFile = path.join(this.options.backupDirectory, 'backup-schedule.json');
      
      if (fs.existsSync(scheduleFile)) {
        const schedule = JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));
        this.backupSchedule = schedule;
        logger.info('Loaded backup schedule', schedule);
      } else {
        // Create default schedule
        this.backupSchedule = {
          enabled: true,
          time: '02:00', // 2:00 AM
          interval: 'daily',
          retention: {
            daily: 7,
            weekly: 4,
            monthly: 12
          }
        };
        this.saveBackupSchedule();
      }
    } catch (error) {
      logger.error('Failed to load backup schedule', error);
      this.backupSchedule = {
        enabled: true,
        time: '02:00',
        interval: 'daily',
        retention: { daily: 7, weekly: 4, monthly: 12 }
      };
    }
  }

  /**
   * Save backup schedule to file
   */
  saveBackupSchedule() {
    try {
      const scheduleFile = path.join(this.options.backupDirectory, 'backup-schedule.json');
      fs.writeFileSync(scheduleFile, JSON.stringify(this.backupSchedule, null, 2));
      logger.debug('Saved backup schedule');
    } catch (error) {
      logger.error('Failed to save backup schedule', error);
    }
  }

  /**
   * Start scheduled backups
   */
  startScheduledBackups() {
    if (!this.backupSchedule?.enabled || this.isRunning) return;
    
    this.isRunning = true;
    
    // Calculate next backup time
    const now = new Date();
    const [hours, minutes] = this.backupSchedule.time.split(':').map(Number);
    const nextBackup = new Date();
    nextBackup.setHours(hours, minutes, 0, 0);
    
    // If next backup time has passed, schedule for tomorrow
    if (nextBackup <= now) {
      nextBackup.setDate(nextBackup.getDate() + 1);
      nextBackup.setHours(hours, minutes, 0, 0);
    }
    
    const backupInterval = setInterval(async () => {
      const now = new Date();
      
      if (now >= nextBackup) {
        logger.info('Starting scheduled backup');
        
        try {
          await this.createBackup();
          this.updateBackupSchedule('completed');
        } catch (error) {
          logger.error('Scheduled backup failed', error);
          this.updateBackupSchedule('failed');
        }
      }
    }, this.options.scheduleInterval);
    
    logger.info('Scheduled backups started', {
      nextBackup: nextBackup.toISOString(),
      interval: this.options.scheduleInterval
    });
    
    this.backupSchedule.nextBackup = nextBackup;
  }

  /**
   * Create a backup of the database
   */
  async createBackup() {
    const startTime = Date.now();
    
    try {
      logger.info('Starting database backup');
      
      const backupName = `space-analyzer-${startTime.toISOString().replace(/[:.]/g, '-')}.db`;
      const backupPath = path.join(this.options.backupDirectory, backupName);
      
      // Create backup with compression
      await this.createCompressedBackup(backupPath);
      
      // Update backup stats
      const stats = fs.statSync(backupPath);
      this.stats.totalBackups++;
      this.stats.totalSize += stats.size;
      this.stats.lastBackup = {
        name: backupName,
        path: backupPath,
        size: stats.size,
        compressed: true,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime
      };
      
      // Clean up old backups
      await this.cleanupOldBackups();
      
      logger.info('Database backup completed', {
        backupName,
        size: stats.size,
        duration: Date.now() - startTime
      });
      
      this.currentBackup = this.stats.lastBackup;
    } catch (error) {
      logger.error('Database backup failed', error);
      this.stats.failedBackups++;
      this.updateBackupSchedule('failed');
    }
  }

  /**
   * Create a compressed backup
   */
  async createCompressedBackup(backupPath) {
    return new Promise((resolve, reject) => {
      const db = require('sqlite3').Database(this.options.dbPath);
      
      try {
        // Open backup file for writing
        const backupStream = fs.createWriteStream(backupPath);
        
        // Create gzip compression stream
        const gzip = zlib.createGzip();
        
        // Pipe database backup through gzip
        const backupDb = await new Promise((backupResolve, backupReject) => {
          db.backup(backupStream, (err) => {
            if (err) {
              backupReject(err);
            } else {
              backupResolve();
            }
          }, (err) => {
            backupReject(err);
          });
        });
        
        // Pipe gzip to backup file
        gzip.pipe(backupStream, {
          finish: () => {
            backupStream.end();
          }
        });
        
        // Close database when backup is complete
        backupDb.then(() => {
          db.close();
          gzip.end();
          resolve();
        }).catch((err) => {
          backupDb.close();
          reject(err);
        });
      } catch (error) {
        logger.error('Failed to create compressed backup', error);
        reject(error);
      }
    });
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups() {
    try {
      const files = fs.readdirSync(this.options.backupDirectory);
      const now = Date.now();
      const cutoffTime = new Date(now.getTime() - (this.options.retentionDays * 24 * 60 * 60 * 1000));
      
      let cleaned = 0;
      
      for (const file of files) {
        if (!file.endsWith('.db')) continue;
        
        const filePath = path.join(this.options.backupDirectory, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffTime) {
          fs.unlinkSync(filePath);
          cleaned++;
          logger.debug('Deleted old backup', file);
        }
      }
      
      if (cleaned > 0) {
        logger.info('Cleaned up old backups', { deleted: cleaned });
      }
    } catch (error) {
      logger.error('Failed to cleanup old backups', error);
    }
  }

  /**
   * Update backup schedule status
   */
  updateBackupSchedule(status) {
    this.backupSchedule.lastBackup = new Date().toISOString();
    
    try {
      const scheduleFile = path.join(this.options.backupDirectory, 'backup-schedule.json');
      fs.writeFileSync(scheduleFile, JSON.stringify({
        ...this.backupSchedule,
        lastBackup: this.backupSchedule.lastBackup,
        lastStatus: status,
        lastUpdate: new Date().toISOString()
      }, null, 2);
      
      logger.debug('Updated backup schedule', { status });
    } catch (error) {
      logger.error('Failed to update backup schedule', error);
    }
  }

  /**
   * Create an on-demand backup
   */
  async createOnDemandBackup() {
    const startTime = Date.now();
    
    try {
      logger.info('Starting on-demand backup');
      
      const backupName = `space-analyzer-ondemand-${startTime.toISOString().replace(/[:.]/g, '-')}.db`;
      const backupPath = path.join(this.options.backupDirectory, backupName);
      
      await this.createCompressedBackup(backupPath);
      
      const stats = fs.statSync(backupPath);
      this.stats.totalBackups++;
      this.stats.totalSize += stats.size;
      this.stats.lastBackup = {
        name: backupName,
        path: backupPath,
        size: stats.size,
        compressed: true,
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        type: 'ondemand'
      };
      
      logger.info('On-demand backup completed', {
        backupName,
        size: stats.size,
        duration: Date.now() - startTime
      });
      
      this.currentBackup = this.stats.lastBackup;
    } catch (error) {
      logger.error('On-demand backup failed', error);
      this.stats.failedBackups++;
    }
  }

  /**
   * Restore database from backup
   */
  async restoreFromBackup(backupPath) {
    try {
      logger.info('Starting database restore', { backupPath });
      
      // Create temporary directory for restore
      const tempDir = path.join(this.options.backupDirectory, 'temp-restore');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Extract backup
      await new Promise((resolve, reject) => {
        const extract = require('tar').Extract({
          file: backupPath,
          cwd: tempDir
        });
        
        extract.on('entry', (header, fileStream) => {
          if (fileStream && !header.name.endsWith('/')) {
            const writeStream = fs.createWriteStream(path.join(tempDir, header.name));
            fileStream.pipe(writeStream);
          }
        });
        
        extract.on('finish', () => {
          logger.info('Backup extracted successfully');
          resolve();
        });
        
        extract.on('error', (error) => {
          logger.error('Backup extraction failed', error);
          reject(error);
        });
      });
      
      // Close current database
      const db = require('sqlite3').Database(this.options.dbPath);
      db.close();
      
      // Restore from extracted files
      const dbPath = path.join(tempDir, 'restored.db');
      const restoredDb = new sqlite3.Database(dbPath);
      
      // Copy extracted database files
      await new Promise((copyResolve, copyReject) => {
        const dbFiles = fs.readdirSync(tempDir).filter(f => f.endsWith('.db'));
        
        for (const dbFile of dbFiles) {
          const srcPath = path.join(tempDir, dbFile);
          const destPath = path.join(this.options.backupDirectory, '..', 'restored-database', dbFile);
          
          fs.copyFileSync(srcPath, destPath);
        }
        
        copyResolve();
      }).catch((err) => {
        copyReject(err);
      });
      
      // Open restored database
      await new Promise((openResolve, openReject) => {
        restoredDb.open((err) => {
          if (err) {
            openReject(err);
          } else {
            openResolve();
          }
        });
      });
      
      logger.info('Database restored successfully');
    } catch (error) {
      logger.error('Database restore failed', error);
    }
  }

  /**
   * Get backup statistics
   */
  getStats() {
    return {
      ...this.stats,
      compressionRatio: this.stats.totalSize > 0 ? 
        ((this.stats.totalSize - this.stats.compressedSize) / this.stats.totalSize * 100).toFixed(2) : '0'
      : '0'
    };
  }

  /**
   * Stop scheduled backups
   */
  stopScheduledBackups() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.backupSchedule) {
      clearInterval(this.backupSchedule);
      logger.info('Scheduled backups stopped');
    }
  }

  /**
   * Get backup history
   */
  getBackupHistory(limit = 10) {
    try {
      const files = fs.readdirSync(this.options.backupDirectory)
        .filter(f => f.endsWith('.db'))
        .map(file => ({
          name: file,
          path: path.join(this.options.backupDirectory, file),
          stats: fs.statSync(path.join(this.options.backupDirectory, file))
        }))
        .sort((a, b) => b.stats.mtime - a.stats.mtime)
        .slice(0, limit);
      
      return files;
    } catch (error) {
      logger.error('Failed to get backup history', error);
      return [];
    }
  }
}

module.exports = DatabaseBackup;