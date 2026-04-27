/**
 * Polyglot Scanner Service
 * Integrates Rust and C++ native components for maximum performance
 */

const path = require('path');
const fs = require('fs');

class PolyglotScanner {
    constructor() {
        this.rustScanner = null;
        this.cppScanner = null;
        this.fallbackScanner = null;
        this.systemInfo = null;
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        console.log('🚀 Initializing Polyglot Scanner...');

        // Try to load Rust scanner
        try {
            const rustPath = path.join(__dirname, '../src/rust/cli');
            if (fs.existsSync(rustPath)) {
                console.log('🦀 Attempting to load Rust scanner...');
                this.rustScanner = await this.loadRustScanner();
                console.log('✅ Rust scanner loaded successfully');
            }
        } catch (error) {
            console.warn('⚠️ Rust scanner not available:', error.message);
        }

        // Try to load C++ scanner
        try {
            const cppPath = path.join(__dirname, '../src/cpp');
            if (fs.existsSync(cppPath)) {
                console.log('⚙️ Attempting to load C++ scanner...');
                this.cppScanner = await this.loadCppScanner();
                console.log('✅ C++ scanner loaded successfully');
            }
        } catch (error) {
            console.warn('⚠️ C++ scanner not available:', error.message);
        }

        // Initialize fallback
        this.fallbackScanner = new FallbackScanner();

        // Get system information
        this.systemInfo = await this.getSystemInfo();

        this.initialized = true;
        console.log('🎯 Polyglot Scanner initialization complete');
        console.log('📊 Available scanners:', this.getAvailableScanners());
    }

    async loadRustScanner() {
        // Load the real Rust scanner using the proper index.js loader
        console.log('🦀 Loading Rust scanner...');
        try {
            const scannerPath = path.join(__dirname, '../src/rust/simple-scanner');
            console.log('📁 Rust scanner path:', scannerPath);
            console.log('📁 Directory exists:', fs.existsSync(scannerPath));
            
            if (fs.existsSync(scannerPath)) {
                console.log('📁 Attempting to load Rust scanner via index.js...');
                const nativeScanner = require(scannerPath);
                console.log('✅ Rust native scanner loaded successfully');
                console.log('📋 Available exports:', Object.keys(nativeScanner));
                console.log('📋 Loaded from:', nativeScanner._loadedPath);
                
                return {
                    create_analyzer: () => ({
                        categorize_file: (filename) => {
                            return nativeScanner.categorizeFile(filename);
                        }
                    }),
                    analyze_directory_optimized: async (analyzer, directoryPath, maxDepth, includeHidden, parallel) => {
                        console.log(`🦀 Rust-optimized scan for: ${directoryPath}`);
                        
                        const startTime = Date.now();
                        const result = await nativeScanner.scan(directoryPath);
                        const scanTime = Date.now() - startTime;
                        
                        // Convert Rust result to our format
                        const categories = {};
                        if (result.categories) {
                            Object.entries(result.categories).forEach(([name, count]) => {
                                categories[name] = {
                                    count: count,
                                    size: 0 // Rust scanner may not provide size per category
                                };
                            });
                        }
                        
                        return {
                            total_files: result.totalFiles,
                            total_size: result.totalSize,
                            files: result.files.map(f => ({
                                name: f.name,
                                path: f.path,
                                size: f.size,
                                extension: f.extension,
                                category: f.category
                            })),
                            categories: categories,
                            analysis_time_ms: scanTime,
                            directory_path: directoryPath
                        };
                    },
                    get_system_info: () => {
                        const metrics = nativeScanner.getMetrics();
                        return {
                            platform: 'windows',
                            arch: 'x86_64',
                            rust_version: '1.92.0',
                            target: 'x86_64-pc-windows-msvc',
                            scanner_type: 'rust-native',
                            details: metrics
                        };
                    }
                };
            } else {
                console.warn('⚠️ Rust scanner not found at:', scannerPath);
            }
        } catch (error) {
            console.warn('⚠️ Failed to load Rust scanner:', error.message);
            throw error;
        }
    }

    async loadCppScanner() {
        // Load the compiled C++ native scanner using proper loader
        console.log('⚙️ Loading C++ native scanner...');
        try {
            const scannerPath = path.join(__dirname, '../src/cpp/native-scanner');
            console.log('📁 Scanner path:', scannerPath);
            console.log('📁 Directory exists:', fs.existsSync(scannerPath));
            
            if (fs.existsSync(scannerPath)) {
                console.log('📁 Attempting to load C++ scanner via index.js...');
                const nativeScanner = require(scannerPath);
                console.log('✅ C++ native scanner loaded successfully');
                console.log('📋 Available exports:', Object.keys(nativeScanner));
                console.log('📋 Loaded from:', nativeScanner._loadedPath);
                
                return {
                    scanDirectory: (dirPath, config) => {
                        console.log(`⚙️ Using C++ native scanner for: ${dirPath}`);
                        const result = nativeScanner.scanDirectory(dirPath);
                        return {
                            files: result.files || [],
                            totalFiles: Number(result.totalFiles) || 0,
                            totalSize: Number(result.totalSize) || 0,
                            categories: result.categories || {},
                            scanTime: Number(result.scanTimeMs) || 0,
                            metadata: {
                                scanner: 'cpp-native',
                                performance: {
                                    filesPerSecond: Number(result.totalFiles) > 0 && Number(result.scanTimeMs) > 0 ? Math.round(Number(result.totalFiles) / (Number(result.scanTimeMs) / 1000)) : 0,
                                    bytesPerSecond: Number(result.totalSize) > 0 && Number(result.scanTimeMs) > 0 ? Math.round(Number(result.totalSize) / (Number(result.scanTimeMs) / 1000)) : 0
                                }
                            }
                        };
                    }
                };
            } else {
                console.warn('⚠️ C++ native scanner not found at:', scannerPath);
            }
        } catch (error) {
            console.warn('⚠️ Failed to load C++ native scanner:', error.message);
            console.warn('⚠️ Stack trace:', error.stack);
        }
        
        return null;
    }

    async scanDirectory(directoryPath, options = {}) {
        await this.initialize();

        const {
            maxDepth = 10,
            includeHidden = false,
            parallel = true,
            pageSize = 1000,
            page = 1,
            preferScanner = 'auto' // 'rust', 'cpp', 'auto'
        } = options;

        console.log(`🔍 Scanning directory: ${directoryPath}`);
        console.log(`📊 Options: depth=${maxDepth}, hidden=${includeHidden}, parallel=${parallel}`);

        let result;
        let scannerUsed = 'fallback';

        // Try scanners in order of preference
        const scanners = this.getScannerOrder(preferScanner);

        if (this.cppScanner && preferScanner === 'cpp') {
            console.log('🔄 Trying cpp scanner...');
            try {
                const result = await this.cppScanner.scanDirectory(directoryPath, options);
                console.log('✅ cpp scanner successful');
                return {
                    data: result,
                    metadata: {
                        scanner: 'cpp',
                        availableScanners: this.getSystemInfo().availableScanners,
                        performance: result.metadata?.performance || {}
                    }
                };
            } catch (error) {
                console.warn('❌ cpp scanner failed:', error.message);
            }
        }

        for (const scanner of scanners) {
            try {
                console.log(`🔄 Trying ${scanner} scanner...`);
                result = await this.scanWithScanner(scanner, directoryPath, {
                    maxDepth,
                    includeHidden,
                    parallel,
                    pageSize,
                    page
                });
                
                if (result.success) {
                    scannerUsed = scanner;
                    console.log(`✅ ${scanner} scanner successful`);
                    break;
                }
            } catch (error) {
                console.warn(`❌ ${scanner} scanner failed:`, error.message);
                continue;
            }
        }

        if (!result || !result.success) {
            throw new Error('All scanners failed');
        }

        // Add metadata
        result.metadata = {
            scanner: scannerUsed,
            systemInfo: this.systemInfo,
            availableScanners: this.getAvailableScanners(),
            performance: this.calculatePerformance(result),
            timestamp: new Date().toISOString()
        };

        return result;
    }

    getScannerOrder(preferScanner) {
        const available = this.getAvailableScanners();
        
        if (preferScanner === 'rust' && available.rust) {
            return ['rust', 'cpp', 'fallback'];
        } else if (preferScanner === 'cpp' && available.cpp) {
            return ['cpp', 'rust', 'fallback'];
        } else if (preferScanner === 'auto') {
            // Auto-select based on system capabilities and directory size
            return ['rust', 'cpp', 'fallback']; // Rust is generally fastest
        }
        
        return ['fallback'];
    }

    async scanWithScanner(scanner, directoryPath, options) {
        switch (scanner) {
            case 'rust':
                return await this.scanWithRust(directoryPath, options);
            case 'cpp':
                return await this.scanWithCpp(directoryPath, options);
            case 'fallback':
                return await this.scanWithFallback(directoryPath, options);
            default:
                throw new Error(`Unknown scanner: ${scanner}`);
        }
    }

    async scanWithRust(directoryPath, options) {
        if (!this.rustScanner) {
            throw new Error('Rust scanner not available');
        }

        const analyzer = this.rustScanner.create_analyzer();
        const result = await this.rustScanner.analyze_directory_optimized(
            analyzer,
            directoryPath,
            options.maxDepth,
            options.includeHidden,
            options.parallel
        );

        // Convert Rust result to our format
        return this.formatResult(result, options, 'rust');
    }

    async scanWithCpp(directoryPath, options) {
        if (!this.cppScanner) {
            throw new Error('C++ scanner not available');
        }

        // Use the C++ scanner directly
        const result = this.cppScanner.scanDirectory(directoryPath);
        
        // Format the result for consistency
        const startIndex = (options.page - 1) * options.pageSize;
        const endIndex = startIndex + options.pageSize;
        
        const files = result.files.slice(startIndex, endIndex);
        
        return {
            success: true,
            data: {
                directory: directoryPath,
                files,
                totalFiles: result.totalFiles,
                totalSize: result.totalSize,
                scanTime: result.scanTimeMs,
                categories: result.categories || {},
                pagination: {
                    page: options.page,
                    pageSize: options.pageSize,
                    totalPages: Math.ceil(result.totalFiles / options.pageSize),
                    hasNextPage: endIndex < result.totalFiles,
                    hasPrevPage: options.page > 1,
                    totalFiles: result.totalFiles
                }
            }
        };
    }

    async scanWithFallback(directoryPath, options) {
        const result = await this.fallbackScanner.scan(directoryPath, options);
        return this.formatResult(result, options, 'fallback');
    }

    formatResult(rawResult, options, scannerType) {
        const startIndex = (options.page - 1) * options.pageSize;
        const endIndex = startIndex + options.pageSize;
        
        let files, totalFiles, totalSize, categories, scanTime;

        if (scannerType === 'rust') {
            files = rawResult.files.slice(startIndex, endIndex);
            totalFiles = rawResult.total_files;
            totalSize = rawResult.total_size;
            categories = rawResult.categories;
            scanTime = rawResult.analysis_time_ms;
        } else if (scannerType === 'cpp') {
            files = rawResult.files.slice(startIndex, endIndex);
            totalFiles = rawResult.totalFiles;
            totalSize = rawResult.totalSize;
            categories = rawResult.categories;
            scanTime = rawResult.scanTime;
        } else {
            files = rawResult.files.slice(startIndex, endIndex);
            totalFiles = rawResult.totalFiles;
            totalSize = rawResult.totalSize;
            categories = rawResult.categories;
            scanTime = rawResult.scanTime;
        }

        return {
            success: true,
            data: {
                directory: options.directoryPath || 'Unknown',
                files,
                totalFiles,
                totalSize,
                scanTime,
                categories: this.formatCategories(categories),
                pagination: {
                    page: options.page,
                    pageSize: options.pageSize,
                    totalPages: Math.ceil(totalFiles / options.pageSize),
                    hasNextPage: endIndex < totalFiles,
                    hasPrevPage: options.page > 1,
                    totalFiles
                }
            }
        };
    }

    formatCategories(categories) {
        const formatted = {};
        for (const [name, info] of Object.entries(categories)) {
            formatted[name] = {
                count: info.count || 0,
                size: info.size || 0
            };
        }
        return formatted;
    }

    calculatePerformance(result) {
        const files = result.data.totalFiles;
        const size = result.data.totalSize;
        const time = result.data.scanTime || 1;

        return {
            filesPerSecond: Math.round(files / (time / 1000)),
            bytesPerSecond: Math.round(size / (time / 1000)),
            avgFileSize: files > 0 ? Math.round(size / files) : 0,
            scanTime: time
        };
    }

    getAvailableScanners() {
        return {
            rust: !!this.rustScanner,
            cpp: !!this.cppScanner,
            fallback: true
        };
    }

    async getSystemInfo() {
        const info = {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            cpus: require('os').cpus().length,
            totalMemory: require('os').totalmem(),
            freeMemory: require('os').freemem()
        };

        // Add Rust system info if available
        if (this.rustScanner) {
            try {
                const rustInfo = this.rustScanner.get_system_info();
                info.rust = rustInfo;
            } catch (error) {
                console.warn('Could not get Rust system info:', error.message);
            }
        }
    };
}

class FallbackScanner {
    async scan(directoryPath, options) {
        const fs = require('fs').promises;
        const path = require('path');
        
        console.log('🔄 Using JavaScript fallback scanner');
        
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
                        category: this.categorizeFile(file),
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
                files: results,
                totalFiles: results.length,
                totalSize: results.reduce((sum, f) => sum + f.size, 0),
                categories: {},
                scanTime: Date.now()
            };
        } catch (error) {
            throw error;
        }
    }

    categorizeFile(filename) {
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
module.exports = new PolyglotScanner();
