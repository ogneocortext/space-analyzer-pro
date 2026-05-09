/**
 * Enhanced Logging Utility
 * Provides structured logging with levels, filtering, and persistence
 */

const fs = require('fs');
const path = require('path');

class Logger {
  constructor(options = {}) {
    this.options = {
      level: options.level || 'info',
      enableFileLogging: options.enableFileLogging !== false,
      enableConsoleLogging: options.enableConsoleLogging !== false,
      logDirectory: options.logDirectory || path.join(__dirname, '..', 'logs'),
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: options.maxFiles || 10,
      ...options
    };

    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3,
      trace: 4
    };

    this.ensureLogDirectory();
  }

  /**
   * Ensure log directory exists
   */
  ensureLogDirectory() {
    if (this.options.enableFileLogging) {
      try {
        if (!fs.existsSync(this.options.logDirectory)) {
          fs.mkdirSync(this.options.logDirectory, { recursive: true });
        }
      } catch (error) {
        console.error('Failed to create log directory:', error);
      }
    }
  }

  /**
   * Format log entry
   */
  formatEntry(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level: this.getLevelName(level),
      message,
      meta,
      pid: process.pid,
      hostname: require('os').hostname(),
      memory: process.memoryUsage()
    };

    return JSON.stringify(entry) + '\n';
  }

  /**
   * Get level name
   */
  getLevelName(level) {
    const levelNames = ['error', 'warn', 'info', 'debug', 'trace'];
    return levelNames[level] || 'info';
  }

  /**
   * Check if level should be logged
   */
  shouldLog(level) {
    return level <= this.levels[this.options.level];
  }

  /**
   * Write to file with rotation
   */
  writeToFile(level, formattedEntry) {
    if (!this.options.enableFileLogging) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const logFile = path.join(this.options.logDirectory, `space-analyzer-${today}.log`);

      // Check file size and rotate if needed
      try {
        const stats = fs.statSync(logFile);
        if (stats.size > this.options.maxFileSize) {
          // Rotate file
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupFile = path.join(this.options.logDirectory, `space-analyzer-${timestamp}.log`);
          fs.renameSync(logFile, backupFile);
        }
      } catch (rotateError) {
        // Continue with original file if rotation fails
      }

      fs.appendFileSync(logFile, formattedEntry);
    } catch (writeError) {
      console.error('Failed to write to log file:', writeError);
    }
    } catch (error) {
      console.error('Failed to access log file:', error);
    }
  }

  /**
   * Console logging with colors
   */
  writeToConsole(level, formattedEntry) {
    if (!this.options.enableConsoleLogging) return;

    const colors = {
      error: '\x1b[31m',
      warn: '\x1b[33m',
      info: '\x1b[36m',
      debug: '\x1b[35m',
      trace: '\x1b[37m',
      reset: '\x1b[0m'
    };

    const color = colors[level] || '';
    const levelName = this.getLevelName(level).toUpperCase().padEnd(5);

    console.log(`${color}[${levelName}]${this.reset} ${formattedEntry}${color}`);
  }

  /**
   * Main logging methods
   */
  error(message, meta = {}) {
    if (this.shouldLog(this.levels.error)) {
      const formattedEntry = this.formatEntry(this.levels.error, message, meta);
      this.writeToFile(this.levels.error, formattedEntry);
      this.writeToConsole(this.levels.error, formattedEntry);
    }
  }

  warn(message, meta = {}) {
    if (this.shouldLog(this.levels.warn)) {
      const formattedEntry = this.formatEntry(this.levels.warn, message, meta);
      this.writeToFile(this.levels.warn, formattedEntry);
      this.writeToConsole(this.levels.warn, formattedEntry);
    }
  }

  info(message, meta = {}) {
    if (this.shouldLog(this.levels.info)) {
      const formattedEntry = this.formatEntry(this.levels.info, message, meta);
      this.writeToFile(this.levels.info, formattedEntry);
      this.writeToConsole(this.levels.info, formattedEntry);
    }
  }

  debug(message, meta = {}) {
    if (this.shouldLog(this.levels.debug)) {
      const formattedEntry = this.formatEntry(this.levels.debug, message, middleware);
      this.writeToFile(this.levels.debug, formattedEntry);
      this.writeToConsole(this.levels.debug, formattedEntry);
    }
  }

  trace(message, meta = {}) {
    if (this.shouldLog(this.levels.trace)) {
      const formattedEntry = this.formatEntry(this.levels.trace, message, meta);
      this.writeToFile(this.levels.trace, formattedEntry);
      this.writeToConsole(this.levels.trace, formattedEntry);
    }
  }

  /**
   * Performance logging
   */
  performance(operation, duration, metadata = {}) {
    this.info(`Performance: ${operation}`, {
      duration: `${duration}ms`,
      operation,
      ...metadata
    });
  }

  /**
   * Security logging
   */
  security(event, details = {}) {
    this.warn(`Security Event: ${event}`, {
      event,
      ...details
    });
  }

  /**
   * Database logging
   */
  database(operation, details = {}) {
    this.info(`Database: ${operation}`, {
      operation,
      ...details
    });
  }

  /**
   * API request logging
   */
  apiRequest(method, url, statusCode, duration, metadata = {}) {
    this.info(`API: ${method} ${url}`, {
      method,
      url,
      statusCode,
      duration: `${duration}ms`,
      ...metadata
    });
  }

  /**
   * Error logging with context
   */
  errorWithContext(error, context = {}) {
    this.error(error.message, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Clean up old log files
   */
  cleanup(maxAge = 7) {
    if (!this.options.enableFileLogging) return;

    try {
      const files = fs.readdirSync(this.options.logDirectory);
      const cutoffTime = Date.now() - (maxAge * 24 * 60 * 60 * 1000);

      files.forEach(file => {
        if (file.endsWith('.log')) {
          const filePath = path.join(this.options.logDirectory, file);
          const stats = fs.statSync(filePath);

          if (stats.mtime < cutoffTime) {
            fs.unlinkSync(filePath);
            this.info(`Cleaned up old log file: ${file}`);
          }
        }
      });
    } catch (error) {
      this.error('Failed to cleanup log files:', error);
    }
  }

  /**
   * Get log statistics
   */
  getStats() {
    if (!this.options.enableFileLogging) return null;

    try {
      const files = fs.readdirSync(this.options.logDirectory)
        .filter(file => file.endsWith('.log'));

      const stats = files.map(file => {
        const filePath = path.join(this.options.logDirectory, file);
        const fileStats = fs.statSync(filePath);
        return {
          file,
          size: fileStats.size,
          modified: fileStats.mtime,
          lines: this.countLines(filePath)
        };
      });

      return {
        totalFiles: files.length,
        totalSize: stats.reduce((sum, stat) => sum + stat.size, 0),
        oldestFile: stats.reduce((oldest, stat) =>
          oldest.modified < stat.modified ? stat : oldest, oldest.modified),
          files: stats
      };
    } catch (error) {
      this.error('Failed to get log stats:', error);
      return null;
    }
  }

  /**
   * Count lines in a file (simplified)
   */
  countLines(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return content.split('\n').length;
    } catch (error) {
      return 0;
    }
  }
}

module.exports = Logger;
