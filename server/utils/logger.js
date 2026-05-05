/**
 * Structured Logger Utility
 * Replaces console.* with leveled, structured logging
 * Supports log levels: error, warn, info, debug
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

// Default log level from env or info
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

/**
 * Format log message with timestamp and level
 */
function formatMessage(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
}

/**
 * Logger object with level-based logging
 */
const logger = {
  error: (message, meta = {}) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.ERROR) {
      console.error(formatMessage("ERROR", message, meta));
    }
  },

  warn: (message, meta = {}) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.WARN) {
      console.warn(formatMessage("WARN", message, meta));
    }
  },

  info: (message, meta = {}) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.INFO) {
      console.log(formatMessage("INFO", message, meta));
    }
  },

  debug: (message, meta = {}) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.DEBUG) {
      console.log(formatMessage("DEBUG", message, meta));
    }
  },

  // Legacy compatibility - log with emoji prefixes preserved
  log: (emoji, message, meta = {}) => {
    if (CURRENT_LEVEL >= LOG_LEVELS.INFO) {
      console.log(formatMessage("INFO", `${emoji} ${message}`, meta));
    }
  },

  // Get current log level
  getLevel: () => Object.keys(LOG_LEVELS).find((k) => LOG_LEVELS[k] === CURRENT_LEVEL),

  // Check if level is enabled
  isEnabled: (level) => CURRENT_LEVEL >= LOG_LEVELS[level.toUpperCase()],
};

module.exports = logger;
module.exports.LOG_LEVELS = LOG_LEVELS;
