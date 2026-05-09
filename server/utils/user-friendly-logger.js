/**
 * User-Friendly Logger for Space Analyzer Backend
 * Replaces verbose technical logs with clean, readable output
 */

class UserFriendlyLogger {
    constructor(options = {}) {
        this.logLevel = options.logLevel || 'info';
        this.showProgress = options.showProgress !== false;
        this.showTimestamps = options.showTimestamps !== false;
        this.useColors = options.useColors !== false;
        this.maxProgressWidth = options.maxProgressWidth || 40;
        
        this.colors = {
            reset: '\x1b[0m',
            bright: '\x1b[1m',
            dim: '\x1b[2m',
            red: '\x1b[31m',
            green: '\x1b[32m',
            yellow: '\x1b[33m',
            blue: '\x1b[34m',
            magenta: '\x1b[35m',
            cyan: '\x1b[36m',
            white: '\x1b[37m'
        };
        
        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };
        
        this.activeScans = new Map();
        this.progressBars = new Map();
    }

    /**
     * Format timestamp for display
     */
    formatTimestamp() {
        if (!this.showTimestamps) return '';
        const now = new Date();
        return `[${now.toLocaleTimeString()}] `;
    }

    /**
     * Apply color to text if colors are enabled
     */
    colorize(text, color) {
        return this.useColors ? `${this.colors[color]}${text}${this.colors.reset}` : text;
    }

    /**
     * Check if log level should be displayed
     */
    shouldLog(level) {
        return this.levels[level] <= this.levels[this.logLevel];
    }

    /**
     * Log error messages
     */
    error(message, details = null) {
        if (!this.shouldLog('error')) return;
        
        const timestamp = this.formatTimestamp();
        const icon = this.colorize('❌', 'red');
        const level = this.colorize('ERROR', 'red');
        
        console.error(`${timestamp}${icon} ${level}: ${message}`);
        
        if (details) {
            console.error(`${timestamp}   ${this.colorize('Details:', 'dim')} ${details}`);
        }
    }

    /**
     * Log warning messages
     */
    warn(message, details = null) {
        if (!this.shouldLog('warn')) return;
        
        const timestamp = this.formatTimestamp();
        const icon = this.colorize('⚠️', 'yellow');
        const level = this.colorize('WARN', 'yellow');
        
        console.warn(`${timestamp}${icon} ${level}: ${message}`);
        
        if (details) {
            console.warn(`${timestamp}   ${this.colorize('Details:', 'dim')} ${details}`);
        }
    }

    /**
     * Log info messages
     */
    info(message, details = null) {
        if (!this.shouldLog('info')) return;
        
        const timestamp = this.formatTimestamp();
        const icon = this.colorize('ℹ️', 'blue');
        const level = this.colorize('INFO', 'blue');
        
        console.log(`${timestamp}${icon} ${level}: ${message}`);
        
        if (details) {
            console.log(`${timestamp}   ${this.colorize('Details:', 'dim')} ${details}`);
        }
    }

    /**
     * Log debug messages
     */
    debug(message, details = null) {
        if (!this.shouldLog('debug')) return;
        
        const timestamp = this.formatTimestamp();
        const icon = this.colorize('🔍', 'dim');
        const level = this.colorize('DEBUG', 'dim');
        
        console.log(`${timestamp}${icon} ${level}: ${message}`);
        
        if (details) {
            console.log(`${timestamp}   ${this.colorize('Details:', 'dim')} ${details}`);
        }
    }

    /**
     * Log success messages
     */
    success(message, details = null) {
        if (!this.shouldLog('info')) return;
        
        const timestamp = this.formatTimestamp();
        const icon = this.colorize('✅', 'green');
        const level = this.colorize('SUCCESS', 'green');
        
        console.log(`${timestamp}${icon} ${level}: ${message}`);
        
        if (details) {
            console.log(`${timestamp}   ${this.colorize('Details:', 'dim')} ${details}`);
        }
    }

    /**
     * Start tracking a scan
     */
    startScan(analysisId, directoryPath, options = {}) {
        if (!this.showProgress) return;
        
        this.activeScans.set(analysisId, {
            directoryPath,
            startTime: Date.now(),
            options,
            filesScanned: 0,
            totalFiles: 0,
            currentFile: 'Starting scan...'
        });
        
        const dirName = this.getDirectoryName(directoryPath);
        this.info(`🔍 Scanning "${dirName}"`, `ID: ${analysisId}`);
        
        // Initialize progress bar
        this.updateProgress(analysisId, 0, 0, 'Initializing...');
    }

    /**
     * Update scan progress
     */
    updateProgress(analysisId, filesScanned, totalFiles, currentFile) {
        if (!this.showProgress || !this.activeScans.has(analysisId)) return;
        
        const scan = this.activeScans.get(analysisId);
        scan.filesScanned = filesScanned;
        scan.totalFiles = totalFiles;
        scan.currentFile = currentFile;
        
        // Update progress bar
        this.renderProgressBar(analysisId);
    }

    /**
     * Render progress bar
     */
    renderProgressBar(analysisId) {
        const scan = this.activeScans.get(analysisId);
        if (!scan) return;
        
        const progress = scan.totalFiles > 0 ? (scan.filesScanned / scan.totalFiles) : 0;
        const percentage = Math.round(progress * 100);
        
        // Create progress bar
        const filledWidth = Math.round(progress * this.maxProgressWidth);
        const emptyWidth = this.maxProgressWidth - filledWidth;
        const filledBar = '█'.repeat(filledWidth);
        const emptyBar = '░'.repeat(emptyWidth);
        const progressBar = this.colorize(filledBar, 'green') + this.colorize(emptyBar, 'dim');
        
        // Format current file name
        const fileName = this.truncateFileName(scan.currentFile);
        
        // Calculate elapsed time
        const elapsed = Date.now() - scan.startTime;
        const elapsedSeconds = (elapsed / 1000).toFixed(1);
        
        // Calculate files per second
        const filesPerSecond = elapsed > 0 ? (scan.filesScanned / (elapsed / 1000)).toFixed(0) : 0;
        
        // Render progress line
        const progressLine = `[${progressBar}] ${percentage}% | ${scan.filesScanned}/${scan.totalFiles} files | ${filesPerSecond}/s | ${elapsedSeconds}s`;
        
        // Clear previous line and render new one
        process.stdout.write('\r' + ' '.repeat(process.stdout.columns || 80) + '\r');
        process.stdout.write(`${this.colorize('📊', 'cyan')} ${progressLine}`);
        process.stdout.write(`\n${this.colorize('📁', 'dim')} ${fileName}`);
        
        // Move cursor up for next update
        process.stdout.write('\x1b[1A');
    }

    /**
     * Complete scan
     */
    completeScan(analysisId, results = {}) {
        if (!this.showProgress || !this.activeScans.has(analysisId)) return;
        
        const scan = this.activeScans.get(analysisId);
        const elapsed = Date.now() - scan.startTime;
        const elapsedSeconds = (elapsed / 1000).toFixed(1);
        
        // Clear progress display
        process.stdout.write('\r' + ' '.repeat(process.stdout.columns || 80) + '\r');
        process.stdout.write('\x1b[1B');
        
        // Show completion summary
        const dirName = this.getDirectoryName(scan.directoryPath);
        this.success(`✨ Scan completed for "${dirName}"`, 
            `${scan.filesScanned} files in ${elapsedSeconds}s`);
        
        if (results.totalSize) {
            const sizeMB = (results.totalSize / 1024 / 1024).toFixed(1);
            this.info(`📦 Total size: ${sizeMB} MB`);
        }
        
        if (results.categories) {
            const categoryCount = Object.keys(results.categories).length;
            this.info(`📋 Found ${categoryCount} file categories`);
        }
        
        // Clean up
        this.activeScans.delete(analysisId);
        console.log(); // Add blank line for spacing
    }

    /**
     * Log scan error
     */
    scanError(analysisId, error) {
        if (!this.activeScans.has(analysisId)) return;
        
        const scan = this.activeScans.get(analysisId);
        const dirName = this.getDirectoryName(scan.directoryPath);
        
        // Clear progress display
        process.stdout.write('\r' + ' '.repeat(process.stdout.columns || 80) + '\r');
        process.stdout.write('\x1b[1B');
        
        this.error(`❌ Scan failed for "${dirName}"`, error.message || error);
        
        // Clean up
        this.activeScans.delete(analysisId);
        console.log(); // Add blank line for spacing
    }

    /**
     * Get directory name from path
     */
    getDirectoryName(path) {
        const parts = path.split(/[/\\]/);
        return parts[parts.length - 1] || path;
    }

    /**
     * Truncate file name for display
     */
    truncateFileName(fileName, maxLength = 50) {
        if (fileName.length <= maxLength) return fileName;
        return '...' + fileName.slice(-(maxLength - 3));
    }

    /**
     * Log API request (simplified)
     */
    logRequest(method, url, analysisId = null) {
        if (!this.shouldLog('debug')) return;
        
        const cleanUrl = url.replace(/\/api\//, '/');
        const idInfo = analysisId ? ` (${analysisId})` : '';
        
        this.debug(`${method} ${cleanUrl}${idInfo}`);
    }

    /**
     * Log system status
     */
    logSystemStatus(status, details = {}) {
        const statusMap = {
            healthy: { icon: '🟢', color: 'green', text: 'System Healthy' },
            degraded: { icon: '🟡', color: 'yellow', text: 'System Degraded' },
            error: { icon: '🔴', color: 'red', text: 'System Error' }
        };
        
        const config = statusMap[status] || statusMap.error;
        const icon = this.colorize(config.icon, config.color);
        const text = this.colorize(config.text, config.color);
        
        console.log(`${icon} ${text}`);
        
        if (Object.keys(details).length > 0) {
            Object.entries(details).forEach(([key, value]) => {
                console.log(`   ${this.colorize(key + ':', 'dim')} ${value}`);
            });
        }
    }

    /**
     * Create a child logger with different settings
     */
    child(options = {}) {
        return new UserFriendlyLogger({
            logLevel: options.logLevel || this.logLevel,
            showProgress: options.showProgress !== undefined ? options.showProgress : this.showProgress,
            showTimestamps: options.showTimestamps !== undefined ? options.showTimestamps : this.showTimestamps,
            useColors: options.useColors !== undefined ? options.useColors : this.useColors,
            maxProgressWidth: options.maxProgressWidth || this.maxProgressWidth
        });
    }
}

module.exports = UserFriendlyLogger;
