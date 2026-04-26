const native = require('./index.node');

/**
 * High-performance directory scanner using Rust native addon
 * Provides significant performance improvements for large directory scans
 */
class RustScanner {
    constructor() {
        this.isNativeAvailable = true;
        this.systemInfo = null;
        
        try {
            this.systemInfo = native.getSystemInfo();
            console.log('🦀 Rust Scanner initialized:', this.systemInfo);
        } catch (error) {
            console.warn('⚠️ Rust native addon not available, falling back to JS implementation');
            this.isNativeAvailable = false;
        }
    }

    /**
     * Scan directory with optimized Rust implementation
     * @param {string} directoryPath - Path to scan
     * @param {Object} options - Scan options
     * @returns {Promise<Object>} Scan results
     */
    async scanDirectory(directoryPath, options = {}) {
        if (!this.isNativeAvailable) {
            return this._fallbackScan(directoryPath, options);
        }

        const {
            maxDepth = 10,
            includeHidden = false,
            parallel = true,
            pageSize = 1000,
            page = 1
        } = options;

        try {
            const result = await native.scanDirectoryOptimized(
                directoryPath,
                maxDepth,
                includeHidden,
                parallel
            );

            // Apply pagination if requested
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const paginatedFiles = result.files.slice(startIndex, endIndex);

            return {
                success: true,
                data: {
                    directory: directoryPath,
                    files: paginatedFiles,
                    totalFiles: result.total_files,
                    totalSize: result.total_size,
                    scanTime: result.scan_time_ms,
                    categories: this._formatCategories(result.categories),
                    pagination: {
                        page,
                        pageSize,
                        totalPages: Math.ceil(result.total_files / pageSize),
                        hasNextPage: endIndex < result.total_files,
                        hasPrevPage: page > 1,
                        totalFiles: result.total_files
                    }
                },
                metadata: {
                    scanner: 'rust-native',
                    systemInfo: this.systemInfo,
                    performance: {
                        filesPerSecond: Math.round(result.total_files / (result.scan_time_ms / 1000)),
                        bytesPerSecond: Math.round(result.total_size / (result.scan_time_ms / 1000))
                    }
                }
            };
        } catch (error) {
            console.error('❌ Rust scanner error:', error);
            return {
                success: false,
                error: error.message,
                fallback: 'Would use JavaScript implementation'
            };
        }
    }

    /**
     * Categorize file using Rust implementation
     * @param {string} filename - File name to categorize
     * @returns {string} Category name
     */
    categorizeFile(filename) {
        if (!this.isNativeAvailable) {
            return this._fallbackCategorizeFile(filename);
        }

        try {
            return native.categorizeFile(filename);
        } catch (error) {
            return this._fallbackCategorizeFile(filename);
        }
    }

    /**
     * Get system information from Rust scanner
     * @returns {Object} System information
     */
    getSystemInfo() {
        return this.systemInfo;
    }

    /**
     * Format categories for frontend consumption
     * @private
     */
    _formatCategories(categories) {
        const formatted = {};
        for (const [name, info] of Object.entries(categories)) {
            formatted[name] = {
                count: info.count,
                size: info.size
            };
        }
        return formatted;
    }

    /**
     * Fallback JavaScript implementation (simplified)
     * @private
     */
    async _fallbackScan(directoryPath, options) {
        const fs = require('fs').promises;
        const path = require('path');
        
        console.log('🔄 Using JavaScript fallback scanner');
        
        // Simple fallback implementation
        try {
            const stats = await fs.stat(directoryPath);
            if (!stats.isDirectory()) {
                throw new Error('Path is not a directory');
            }

            const files = await fs.readdir(directoryPath);
            const results = [];
            
            for (const file of files.slice(0, 100)) { // Limit for fallback
                try {
                    const filePath = path.join(directoryPath, file);
                    const fileStats = await fs.stat(filePath);
                    
                    results.push({
                        name: file,
                        path: filePath,
                        size: fileStats.size,
                        extension: path.extname(file),
                        category: this._fallbackCategorizeFile(file),
                        modified: fileStats.mtime.getTime(),
                        created: fileStats.birthtime.getTime(),
                        isHidden: file.startsWith('.'),
                        isDirectory: fileStats.isDirectory()
                    });
                } catch (err) {
                    // Skip files we can't read
                }
            }

            return {
                success: true,
                data: {
                    directory: directoryPath,
                    files: results,
                    totalFiles: results.length,
                    totalSize: results.reduce((sum, f) => sum + f.size, 0),
                    scanTime: Date.now(),
                    categories: {},
                    pagination: {
                        page: 1,
                        pageSize: 100,
                        totalPages: 1,
                        hasNextPage: false,
                        hasPrevPage: false,
                        totalFiles: results.length
                    }
                },
                metadata: {
                    scanner: 'javascript-fallback',
                    warning: 'Using limited fallback implementation'
                }
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Fallback categorization
     * @private
     */
    _fallbackCategorizeFile(filename) {
        const ext = filename.split('.').pop()?.toLowerCase();
        
        const categories = {
            'js': 'JavaScript/TypeScript',
            'ts': 'JavaScript/TypeScript',
            'jsx': 'JavaScript/TypeScript',
            'tsx': 'JavaScript/TypeScript',
            'py': 'Python',
            'json': 'Configuration/Data',
            'md': 'Documents',
            'txt': 'Documents',
            'html': 'HTML',
            'css': 'CSS',
            'png': 'Images',
            'jpg': 'Images',
            'jpeg': 'Images',
            'gif': 'Images',
            'svg': 'Images'
        };
        
        return categories[ext] || 'Other';
    }
}

// Export singleton instance
module.exports = new RustScanner();
