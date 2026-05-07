/**
 * Logger Utility
 * Provides logging functionality for the application
 */

const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'info';
        this.logFile = process.env.LOG_FILE || './logs/app.log';
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    formatMessage(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const formattedArgs = args.length > 0 ? ' ' + JSON.stringify(args) : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedArgs}`;
    }

    writeLog(level, message, ...args) {
        const logMessage = this.formatMessage(level, message, ...args);
        
        // Write to console
        console.log(logMessage);
        
        // Write to file
        try {
            fs.appendFileSync(this.logFile, logMessage + '\n');
        } catch (error) {
            console.error('Failed to write to log file:', error.message);
        }
    }

    debug(message, ...args) {
        if (this.shouldLog('debug')) {
            this.writeLog('debug', message, ...args);
        }
    }

    info(message, ...args) {
        if (this.shouldLog('info')) {
            this.writeLog('info', message, ...args);
        }
    }

    warn(message, ...args) {
        if (this.shouldLog('warn')) {
            this.writeLog('warn', message, ...args);
        }
    }

    error(message, ...args) {
        if (this.shouldLog('error')) {
            this.writeLog('error', message, ...args);
        }
    }

    shouldLog(level) {
        const levels = ['debug', 'info', 'warn', 'error'];
        const currentLevelIndex = levels.indexOf(this.logLevel);
        const messageLevelIndex = levels.indexOf(level);
        return messageLevelIndex >= currentLevelIndex;
    }
}

// Create and export a singleton instance
const logger = new Logger();
module.exports = logger;
