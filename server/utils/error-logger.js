/**
 * Error Logger - Comprehensive error tracking and logging
 * Logs unexpected errors with context for debugging
 */

const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");

class ErrorLogger {
  constructor(options = {}) {
    this.logDir = options.logDir || path.join(__dirname, "..", "logs", "errors");
    this.maxFileSize = options.maxFileSize || 5 * 1024 * 1024; // 5MB
    this.maxFiles = options.maxFiles || 10;
    this.maxAgeDays = options.maxAgeDays || 30;
    this.inMemoryBuffer = [];
    this.bufferSize = options.bufferSize || 100;
    this.flushInterval = options.flushInterval || 5000; // 5 seconds

    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.logDir, { recursive: true });
      this.startFlushInterval();
      console.log(`✅ Error logger initialized: ${this.logDir}`);
    } catch (err) {
      console.error("❌ Failed to initialize error logger:", err);
    }
  }

  startFlushInterval() {
    this.flushIntervalId = setInterval(() => this.flushBuffer(), this.flushInterval);
  }

  /**
   * Stop the flush interval (for graceful shutdown)
   */
  stopFlushInterval() {
    if (this.flushIntervalId) {
      clearInterval(this.flushIntervalId);
      this.flushIntervalId = null;
      console.log("✅ Error logger flush interval cleared");
    }
  }

  /**
   * Cleanup for graceful shutdown
   */
  async cleanup() {
    this.stopFlushInterval();
    // Flush any remaining errors
    await this.flushBuffer();
  }

  /**
   * Log an error with full context
   */
  async logError(error, context = {}) {
    // Handle undefined/null error parameter
    const safeError = error || new Error("Unknown error occurred");

    const errorEntry = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      type: safeError?.name || "UnknownError",
      message: safeError?.message || String(safeError),
      stack: safeError?.stack || null,
      code: safeError?.code || null,
      ...context,
    };

    // Add to in-memory buffer
    this.inMemoryBuffer.push(errorEntry);

    // Keep only recent errors in memory
    if (this.inMemoryBuffer.length > this.bufferSize) {
      this.inMemoryBuffer.shift();
    }

    // Log to console immediately for visibility
    console.error(`[ERROR ${errorEntry.id}] ${errorEntry.type}: ${errorEntry.message}`);

    // Try to flush immediately for critical errors
    if (this.isCriticalError(error)) {
      await this.flushBuffer();
    }

    return errorEntry.id;
  }

  /**
   * Log Express request error
   */
  async logRequestError(error, req, res, context = {}) {
    return this.logError(error, {
      source: "express",
      method: req?.method,
      url: req?.originalUrl || req?.url,
      path: req?.path,
      query: req?.query,
      headers: this.sanitizeHeaders(req?.headers),
      userAgent: req?.headers?.["user-agent"],
      ip: req?.ip || req?.connection?.remoteAddress,
      statusCode: res?.statusCode,
      ...context,
    });
  }

  /**
   * Log frontend-reported error
   */
  async logFrontendError(errorData, clientInfo = {}) {
    // Validate errorData to prevent undefined errors
    if (!errorData || typeof errorData !== "object") {
      errorData = { message: "Unknown frontend error" };
    }

    const errorMessage = errorData.message || "Unknown frontend error";
    return this.logError(new Error(errorMessage), {
      source: "frontend",
      type: errorData.type || "FrontendError",
      component: errorData.component,
      action: errorData.action,
      url: errorData.url,
      userAgent: clientInfo.userAgent,
      viewport: clientInfo.viewport,
      ...errorData.metadata,
    });
  }

  /**
   * Log unhandled promise rejection
   */
  async logUnhandledRejection(reason, promise) {
    return this.logError(reason instanceof Error ? reason : new Error(String(reason)), {
      source: "unhandledRejection",
      promiseId: this.generateId(),
    });
  }

  /**
   * Log uncaught exception
   */
  async logUncaughtException(error) {
    return this.logError(error, {
      source: "uncaughtException",
      fatal: true,
    });
  }

  /**
   * Check if error is critical and needs immediate flushing
   */
  isCriticalError(error) {
    // Handle undefined/null error parameter
    if (!error) return false;

    const criticalTypes = [
      "uncaughtException",
      "UnhandledPromiseRejection",
      "SyntaxError",
      "ReferenceError",
    ];
    return (
      criticalTypes.includes(error?.name) ||
      error?.message?.includes("database") ||
      error?.message?.includes("connection") ||
      error?.code === "ECONNREFUSED"
    );
  }

  /**
   * Sanitize headers to remove sensitive info
   */
  sanitizeHeaders(headers = {}) {
    const sensitive = ["authorization", "cookie", "x-api-key", "password", "token"];
    const sanitized = {};

    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (sensitive.some((s) => lowerKey.includes(s))) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Flush in-memory buffer to file
   */
  async flushBuffer() {
    if (this.inMemoryBuffer.length === 0) return;

    const entries = [...this.inMemoryBuffer];
    this.inMemoryBuffer = [];

    try {
      const logFile = await this.getCurrentLogFile();
      const lines = entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
      await fs.appendFile(logFile, lines, "utf8");
    } catch (err) {
      // Put entries back if failed
      this.inMemoryBuffer.unshift(...entries);
      console.error("❌ Failed to write error log:", err);
    }
  }

  /**
   * Get current log file path (rotate if needed)
   */
  async getCurrentLogFile() {
    const date = new Date().toISOString().split("T")[0];
    const baseFile = path.join(this.logDir, `errors-${date}.log`);

    try {
      const stats = await fs.stat(baseFile);
      if (stats.size > this.maxFileSize) {
        // Rotate file
        const rotated = path.join(this.logDir, `errors-${date}-${Date.now()}.log`);
        await fs.rename(baseFile, rotated);
        await this.cleanupOldLogs();
      }
    } catch {
      // File doesn't exist yet
    }

    return baseFile;
  }

  /**
   * Cleanup old log files
   */
  async cleanupOldLogs() {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files
        .filter((f) => f.startsWith("errors-") && f.endsWith(".log"))
        .map((f) => ({
          name: f,
          path: path.join(this.logDir, f),
          time: fs
            .stat(path.join(this.logDir, f))
            .then((s) => s.mtime)
            .catch(() => new Date(0)),
        }));

      const fileInfos = await Promise.all(
        logFiles.map(async (f) => ({
          ...f,
          mtime: await f.time,
        }))
      );

      // Sort by modification time (newest first)
      fileInfos.sort((a, b) => b.mtime - a.mtime);

      // Delete old files beyond maxFiles
      const toDelete = fileInfos.slice(this.maxFiles);
      for (const file of toDelete) {
        try {
          await fs.unlink(file.path);
          console.log(`🗑️ Deleted old error log: ${file.name}`);
        } catch (err) {
          // Ignore deletion errors
        }
      }

      // Delete files older than maxAgeDays
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - this.maxAgeDays);

      for (const file of fileInfos) {
        if (file.mtime < cutoff) {
          try {
            await fs.unlink(file.path);
            console.log(`🗑️ Deleted aged error log: ${file.name}`);
          } catch (err) {
            // Ignore deletion errors
          }
        }
      }
    } catch (err) {
      console.error("❌ Error during log cleanup:", err);
    }
  }

  /**
   * Get recent errors (for admin view)
   */
  async getRecentErrors(limit = 50, source = null) {
    // First, flush any pending errors
    await this.flushBuffer();

    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files
        .filter((f) => f.startsWith("errors-") && f.endsWith(".log"))
        .sort()
        .reverse();

      const errors = [];

      for (const file of logFiles) {
        if (errors.length >= limit) break;

        try {
          const content = await fs.readFile(path.join(this.logDir, file), "utf8");
          const lines = content.trim().split("\n").filter(Boolean);

          for (const line of lines.reverse()) {
            try {
              const entry = JSON.parse(line);
              if (!source || entry.source === source) {
                errors.push(entry);
                if (errors.length >= limit) break;
              }
            } catch {
              // Skip malformed lines
            }
          }
        } catch {
          // Skip unreadable files
        }
      }

      return errors.slice(0, limit);
    } catch (err) {
      console.error("❌ Failed to read error logs:", err);
      return [];
    }
  }

  /**
   * Get error statistics
   */
  async getErrorStats(days = 7) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);

    const errors = await this.getRecentErrors(1000);
    const recentErrors = errors.filter((e) => new Date(e.timestamp) >= cutoff);

    const stats = {
      total: recentErrors.length,
      byType: {},
      bySource: {},
      byDay: {},
      critical: recentErrors.filter((e) => e.fatal || e.source === "uncaughtException").length,
    };

    for (const error of recentErrors) {
      // By type
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;

      // By source
      stats.bySource[error.source || "unknown"] =
        (stats.bySource[error.source || "unknown"] || 0) + 1;

      // By day
      const day = error.timestamp.split("T")[0];
      stats.byDay[day] = (stats.byDay[day] || 0) + 1;
    }

    return stats;
  }

  /**
   * Export errors to JSON file
   */
  async exportErrors(outputPath, options = {}) {
    const errors = await this.getRecentErrors(options.limit || 1000, options.source);
    const exportData = {
      exportedAt: new Date().toISOString(),
      count: errors.length,
      errors,
    };

    await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2), "utf8");
    return outputPath;
  }

  /**
   * Clear all error logs
   */
  async clearAllLogs() {
    try {
      const files = await fs.readdir(this.logDir);
      for (const file of files) {
        if (file.startsWith("errors-") && file.endsWith(".log")) {
          await fs.unlink(path.join(this.logDir, file));
        }
      }
      this.inMemoryBuffer = [];
      console.log("🧹 All error logs cleared");
    } catch (err) {
      console.error("❌ Failed to clear error logs:", err);
    }
  }

  generateId() {
    return `err_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  }
}

// Singleton instance
let instance = null;

function getErrorLogger(options = {}) {
  if (!instance) {
    instance = new ErrorLogger(options);
  }
  return instance;
}

module.exports = { ErrorLogger, getErrorLogger };
