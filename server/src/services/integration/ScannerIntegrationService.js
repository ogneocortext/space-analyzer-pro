/**
 * Scanner Integration Service
 * Orchestrates multiple scanner implementations for optimal performance
 * Integrates polyglot scanner with the new modular backend architecture
 */

const path = require('path');
const fs = require('fs');
const { asyncHandler, ValidationError, NotFoundError } = require('../../middleware/errorHandler');
const config = require('../../config');

class ScannerIntegrationService {
    constructor() {
        this.scanners = new Map();
        this.performanceMetrics = new Map();
        this.activeScans = new Map();
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;

        console.log('🚀 Initializing Scanner Integration Service...');

        // Load all available scanners
        await this.loadScanners();
        
        // Initialize performance tracking
        this.initializePerformanceTracking();
        
        this.initialized = true;
        console.log('🎯 Scanner Integration Service ready');
    }

    async loadScanners() {
        // 1. Load Enhanced Polyglot Scanner
        try {
            const polyglotPath = path.join(__dirname, '../../../enhanced-polyglot-scanner.js');
            if (fs.existsSync(polyglotPath)) {
                const EnhancedPolyglotScanner = require(polyglotPath);
                await EnhancedPolyglotScanner.initialize();
                this.scanners.set('polyglot', EnhancedPolyglotScanner);
                console.log('✅ Enhanced Polyglot Scanner loaded');
            }
        } catch (error) {
            console.warn('⚠️ Enhanced Polyglot Scanner not available:', error.message);
        }

        // 2. Load File Scanner Service (our new implementation)
        try {
            const FileScannerService = require('./file-scanner/FileScannerService');
            const fileScanner = new FileScannerService();
            this.scanners.set('file-scanner', fileScanner);
            console.log('✅ File Scanner Service loaded');
        } catch (error) {
            console.warn('⚠️ File Scanner Service not available:', error.message);
        }

        // 3. Load Self-Learning ML Service
        try {
            const SelfLearningMLService = require('../../../SelfLearningMLService');
            await SelfLearningMLService.initialize();
            this.scanners.set('ml-service', SelfLearningMLService);
            console.log('✅ Self-Learning ML Service loaded');
        } catch (error) {
            console.warn('⚠️ Self-Learning ML Service not available:', error.message);
        }

        // 4. Load AI Integration Service
        try {
            const AIIntegrationService = require('./ai-integration/AIIntegrationService');
            const aiService = new AIIntegrationService();
            this.scanners.set('ai-integration', aiService);
            console.log('✅ AI Integration Service loaded');
        } catch (error) {
            console.warn('⚠️ AI Integration Service not available:', error.message);
        }
    }

    initializePerformanceTracking() {
        // Set up performance monitoring
        setInterval(() => {
            this.updatePerformanceMetrics();
        }, 60000); // Update every minute

        // Clean up old metrics
        setInterval(() => {
            this.cleanupOldMetrics();
        }, 300000); // Clean up every 5 minutes
    }

    /**
     * Intelligent scan orchestration
     */
    async scanDirectory(directoryPath, options = {}) {
        await this.initialize();

        const {
            strategy = 'auto', // 'auto', 'polyglot', 'file-scanner', 'hybrid'
            maxDepth = 10,
            includeHidden = false,
            enableML = true,
            optimizeFor = 'speed',
            maxFiles = null,
            streaming = false,
            timeout = 300000, // 5 minutes default
            enableAI = true,
            enableInsights = true
        } = options;

        // Validate directory path
        if (!directoryPath) {
            throw new ValidationError('Directory path is required');
        }

        const normalizedPath = path.normalize(directoryPath);
        if (normalizedPath.includes('..') || normalizedPath.startsWith('/')) {
            throw new ValidationError('Invalid path format');
        }

        // Check if directory exists and is accessible
        if (!fs.existsSync(directoryPath)) {
            throw new NotFoundError(`Directory not found: ${directoryPath}`);
        }

        if (!fs.statSync(directoryPath).isDirectory()) {
            throw new ValidationError('Path must be a directory');
        }

        console.log(`🔍 Intelligent scan: ${directoryPath}`);
        console.log(`📊 Strategy: ${strategy}, ML: ${enableML}, AI: ${enableAI}`);

        // Generate scan ID for tracking
        const scanId = require('uuid').v4();
        const startTime = Date.now();

        // Create scan context
        const scanContext = {
            id: scanId,
            directoryPath,
            startTime,
            options: { ...options, strategy, enableML, enableAI },
            active: true,
            results: null,
            errors: []
        };

        this.activeScans.set(scanId, scanContext);

        try {
            // Select optimal scanner strategy
            const selectedStrategy = await this.selectOptimalStrategy(directoryPath, options);
            
            console.log(`🎯 Selected strategy: ${selectedStrategy.type} (${selectedStrategy.confidence.toFixed(2)})`);

            // Execute scan with selected strategy
            const results = await this.executeScanStrategy(selectedStrategy, directoryPath, options);

            // Enhance results with AI and ML
            const enhancedResults = await this.enhanceResults(results, options);

            // Store learning metrics
            if (enableML && this.scanners.has('ml-service')) {
                const mlService = this.scanners.get('ml-service');
                await mlService.storeAnalysis(enhancedResults);
            }

            // Update performance metrics
            this.recordScanMetrics(scanId, enhancedResults, selectedStrategy);

            // Clean up scan context
            this.activeScans.delete(scanId);

            return {
                ...enhancedResults,
                scanId,
                strategy: selectedStrategy.type,
                duration: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            // Handle scan errors
            scanContext.errors.push(error.message);
            this.activeScans.delete(scanId);
            
            console.error(`❌ Scan failed: ${error.message}`);
            throw error;
        }
    }

    async selectOptimalStrategy(directoryPath, options) {
        const { strategy, optimizeFor } = options;

        // If specific strategy requested, use it
        if (strategy !== 'auto') {
            if (this.scanners.has(strategy)) {
                return {
                    type: strategy,
                    confidence: 1.0,
                    reasoning: `User requested ${strategy} strategy`
                };
            } else {
                throw new ValidationError(`Requested scanner strategy not available: ${strategy}`);
            }
        }

        // Auto strategy selection based on directory characteristics
        const characteristics = await this.analyzeDirectoryCharacteristics(directoryPath);
        
        // Get performance history for decision making
        const performanceHistory = this.getPerformanceHistory();
        
        // Evaluate available strategies
        const strategies = [];
        
        if (this.scanners.has('polyglot')) {
            strategies.push({
                type: 'polyglot',
                score: this.evaluatePolyglotStrategy(characteristics, performanceHistory, optimizeFor),
                reasoning: 'Enhanced Polyglot Scanner with AI/ML integration'
            });
        }

        if (this.scanners.has('file-scanner')) {
            strategies.push({
                type: 'file-scanner',
                score: this.evaluateFileScannerStrategy(characteristics, performanceHistory, optimizeFor),
                reasoning: 'New modular File Scanner Service'
            });
        }

        if (this.scanners.has('polyglot') && this.scanners.has('file-scanner')) {
            strategies.push({
                type: 'hybrid',
                score: this.evaluateHybridStrategy(characteristics, performanceHistory, optimizeFor),
                reasoning: 'Combines Polyglot and File Scanner strengths'
            });
        }

        // Select best strategy
        strategies.sort((a, b) => b.score - a.score);
        
        return {
            type: strategies[0].type,
            confidence: strategies[0].score,
            reasoning: strategies[0].reasoning,
            alternatives: strategies.slice(1).map(s => ({ type: s.type, score: s.score }))
        };
    }

    evaluatePolyglotStrategy(characteristics, performanceHistory, optimizeFor) {
        let score = 0.7; // Base score

        // File count impact
        if (characteristics.estimatedFileCount > 100000) score += 0.2; // Polyglot handles large files well
        else if (characteristics.estimatedFileCount < 10000) score += 0.1;

        // Complexity impact
        if (characteristics.complexity === 'high') score += 0.15;

        // Optimization target
        if (optimizeFor === 'speed') score += 0.2;
        else if (optimizeFor === 'memory') score -= 0.1;

        // Historical performance
        const polyglotHistory = performanceHistory.filter(h => h.strategy === 'polyglot');
        if (polyglotHistory.length > 0) {
            const avgPerformance = polyglotHistory.reduce((sum, h) => sum + h.performance, 0) / polyglotHistory.length;
            score += (avgPerformance - 0.5) * 0.3; // Normalize to 0-1 scale
        }

        return Math.max(0, Math.min(1, score));
    }

    evaluateFileScannerStrategy(characteristics, performanceHistory, optimizeFor) {
        let score = 0.6; // Base score

        // File count impact
        if (characteristics.estimatedFileCount < 50000) score += 0.2; // File scanner good for medium files
        else if (characteristics.estimatedFileCount > 200000) score -= 0.1; // May struggle with very large files

        // Complexity impact
        if (characteristics.complexity === 'medium') score += 0.1;

        // Optimization target
        if (optimizeFor === 'memory') score += 0.2;
        else if (optimizeFor === 'speed') score += 0.1;

        // Historical performance
        const fileScannerHistory = performanceHistory.filter(h => h.strategy === 'file-scanner');
        if (fileScannerHistory.length > 0) {
            const avgPerformance = fileScannerHistory.reduce((sum, h) => sum + h.performance, 0) / fileScannerHistory.length;
            score += (avgPerformance - 0.5) * 0.3;
        }

        return Math.max(0, Math.min(1, score));
    }

    evaluateHybridStrategy(characteristics, performanceHistory, optimizeFor) {
        let score = 0.8; // Base score for hybrid

        // File count impact
        if (characteristics.estimatedFileCount > 50000) score += 0.2; // Hybrid excels with large files
        else if (characteristics.estimatedFileCount < 5000) score -= 0.1; // Overkill for small files

        // Complexity impact
        if (characteristics.complexity === 'high') score += 0.2;

        // Optimization target
        if (optimizeFor === 'speed') score += 0.1;
        else if (optimizeFor === 'memory') score += 0.1; // Hybrid can optimize memory usage

        // Historical performance
        const hybridHistory = performanceHistory.filter(h => h.strategy === 'hybrid');
        if (hybridHistory.length > 0) {
            const avgPerformance = hybridHistory.reduce((sum, h) => sum + h.performance, 0) / hybridHistory.length;
            score += (avgPerformance - 0.5) * 0.3;
        }

        return Math.max(0, Math.min(1, score));
    }

    async executeScanStrategy(strategy, directoryPath, options) {
        const { type } = strategy;
        const scanner = this.scanners.get(type);

        if (!scanner) {
            throw new Error(`Scanner not available: ${type}`);
        }

        try {
            switch (type) {
                case 'polyglot':
                    return await scanner.scanDirectory(directoryPath, options);

                case 'file-scanner':
                    return await scanner.scanDirectory(directoryPath, options);

                case 'hybrid':
                    return await this.executeHybridScan(directoryPath, options);

                default:
                    throw new Error(`Unknown scan strategy: ${type}`);
            }
        } catch (error) {
            console.warn(`Scanner ${type} failed: ${error.message}`);
            
            // Fallback to alternative strategy
            if (strategy.alternatives && strategy.alternatives.length > 0) {
                console.log(`🔄 Falling back to ${strategy.alternatives[0].type}`);
                const fallbackStrategy = {
                    type: strategy.alternatives[0].type,
                    confidence: strategy.alternatives[0].score
                };
                return await this.executeScanStrategy(fallbackStrategy, directoryPath, options);
            }

            throw error;
        }
    }

    async executeHybridScan(directoryPath, options) {
        console.log('🔄 Executing hybrid scan...');

        // Run both scanners with different configurations
        const polyglotPromise = this.scanners.get('polyglot').scanDirectory(directoryPath, {
            ...options,
            strategy: 'rust', // Use Rust for speed
            maxFiles: options.maxFiles || 100000
        });

        const fileScannerPromise = this.scanners.get('file-scanner').scanDirectory(directoryPath, {
            ...options,
            strategy: 'detailed', // Use detailed analysis
            maxFiles: options.maxFiles || 50000
        });

        // Wait for both to complete or timeout
        const timeout = options.timeout || 300000; // 5 minutes
        const [polyglotResult, fileScannerResult] = await Promise.allSettled([
            this.withTimeout(polyglotPromise, timeout),
            this.withTimeout(fileScannerPromise, timeout)
        ]);

        // Merge results intelligently
        return this.mergeHybridResults(polyglotResult, fileScannerResult);
    }

    async mergeHybridResults(polyglotResult, fileScannerResult) {
        const polyglot = polyglotResult.status === 'fulfilled' ? polyglotResult.value : null;
        const fileScanner = fileScannerResult.status === 'fulfilled' ? fileScannerResult.value : null;

        if (!polyglot && !fileScanner) {
            throw new Error('Both hybrid scanners failed');
        }

        if (!polyglot) return fileScanner;
        if (!fileScanner) return polyglot;

        // Intelligent merging
        const merged = {
            files: this.mergeFileLists(polyglot.files || [], fileScanner.files || []),
            totalFiles: Math.max(polyglot.totalFiles || 0, fileScanner.totalFiles || 0),
            totalSize: Math.max(polyglot.totalSize || 0, fileScanner.totalSize || 0),
            categories: this.mergeCategories(polyglot.categories || {}, fileScanner.categories || {}),
            scanTime: Math.min(polyglot.scanTime || Infinity, fileScanner.scanTime || Infinity),
            scanner: 'hybrid',
            sources: {
                polyglot: { files: polyglot.totalFiles || 0, time: polyglot.scanTime || 0 },
                fileScanner: { files: fileScanner.totalFiles || 0, time: fileScanner.scanTime || 0 }
            }
        };

        // Enhance with AI insights if available
        if (this.scanners.has('ai-integration')) {
            const aiService = this.scanners.get('ai-integration');
            merged.aiEnhancements = await aiService.enhanceResults(merged);
        }

        return merged;
    }

    mergeFileLists(list1, list2) {
        const merged = new Map();
        
        // Add all files from first list
        list1.forEach(file => {
            merged.set(file.path || file.name, file);
        });

        // Add files from second list (avoiding duplicates)
        list2.forEach(file => {
            const key = file.path || file.name;
            if (!merged.has(key)) {
                merged.set(key, file);
            } else {
                // Merge file information if both exist
                const existing = merged.get(key);
                merged.set(key, { ...existing, ...file });
            }
        });

        return Array.from(merged.values());
    }

    mergeCategories(cat1, cat2) {
        const merged = {};

        // Get all category names
        const allCategories = new Set([...Object.keys(cat1), ...Object.keys(cat2)]);

        allCategories.forEach(category => {
            const c1 = cat1[category] || { count: 0, size: 0 };
            const c2 = cat2[category] || { count: 0, size: 0 };

            merged[category] = {
                count: Math.max(c1.count, c2.count),
                size: Math.max(c1.size, c2.size),
                sources: {
                    scanner1: c1.count > 0,
                    scanner2: c2.count > 0
                }
            };
        });

        return merged;
    }

    async enhanceResults(results, options) {
        const { enableAI = true, enableInsights = true } = options;

        let enhancedResults = { ...results };

        // Add AI enhancements
        if (enableAI && this.scanners.has('ai-integration')) {
            const aiService = this.scanners.get('ai-integration');
            enhancedResults = await aiService.enhanceResults(enhancedResults);
        }

        // Add ML insights
        if (enableInsights && this.scanners.has('ml-service')) {
            const mlService = this.scanners.get('ml-service');
            const insights = await mlService.generatePredictiveInsights();
            enhancedResults.predictiveInsights = insights;
        }

        // Add performance analysis
        enhancedResults.performanceAnalysis = this.analyzePerformance(results);

        return enhancedResults;
    }

    analyzePerformance(results) {
        const files = results.totalFiles || 0;
        const size = results.totalSize || 0;
        const time = results.scanTime || 1;

        return {
            filesPerSecond: Math.round(files / (time / 1000)),
            bytesPerSecond: Math.round(size / (time / 1000)),
            avgFileSize: files > 0 ? Math.round(size / files) : 0,
            efficiency: this.calculateEfficiencyScore(results),
            recommendations: this.generatePerformanceRecommendations(results)
        };
    }

    calculateEfficiencyScore(results) {
        const baseScore = (results.totalFiles || 0) / ((results.scanTime || 1) / 1000);
        return Math.min(100, Math.max(0, Math.round(baseScore / 100)));
    }

    generatePerformanceRecommendations(results) {
        const recommendations = [];
        const filesPerSec = results.performanceAnalysis?.filesPerSecond || 0;
        const totalFiles = results.totalFiles || 0;

        if (filesPerSec < 1000) {
            recommendations.push({
                type: 'performance',
                message: 'Scan performance is below optimal. Consider using hybrid strategy for large directories.',
                priority: 'medium'
            });
        }

        if (totalFiles > 100000) {
            recommendations.push({
                type: 'scalability',
                message: 'Large directory detected. Consider implementing streaming mode for better memory usage.',
                priority: 'high'
            });
        }

        return recommendations;
    }

    async analyzeDirectoryCharacteristics(directoryPath) {
        try {
            const stats = fs.statSync(directoryPath);
            const files = fs.readdirSync(directoryPath);
            
            // Quick sample analysis
            const sampleSize = Math.min(100, files.length);
            const sample = files.slice(0, sampleSize);
            
            let estimatedTotalFiles = files.length;
            let hasSubDirectories = false;
            let fileTypes = new Set();
            
            for (const file of sample) {
                const filePath = path.join(directoryPath, file);
                try {
                    const fileStat = fs.statSync(filePath);
                    if (fileStat.isDirectory()) {
                        hasSubDirectories = true;
                        estimatedTotalFiles += fileStat.nlink || 10;
                    } else {
                        const ext = path.extname(file).toLowerCase();
                        fileTypes.add(ext);
                    }
                } catch (e) {
                    // Skip inaccessible files
                }
            }

            return {
                estimatedFileCount: estimatedTotalFiles,
                hasSubDirectories,
                fileTypes: Array.from(fileTypes),
                complexity: hasSubDirectories ? 'high' : 'medium',
                estimatedSize: this.estimateDirectorySize(estimatedTotalFiles),
                path: directoryPath
            };
        } catch (error) {
            console.warn('Could not analyze directory characteristics:', error.message);
            return {
                estimatedFileCount: 1000,
                hasSubDirectories: true,
                fileTypes: [],
                complexity: 'unknown',
                estimatedSize: 1024 * 1024 * 100,
                path: directoryPath
            };
        }
    }

    estimateDirectorySize(fileCount) {
        const avgFileSize = 1024 * 50; // 50KB average
        return fileCount * avgFileSize;
    }

    getPerformanceHistory() {
        return Array.from(this.performanceMetrics.values());
    }

    recordScanMetrics(scanId, results, strategy) {
        const metrics = {
            scanId,
            strategy: strategy.type,
            performance: this.calculatePerformanceScore(results),
            timestamp: Date.now(),
            fileCount: results.totalFiles || 0,
            scanTime: results.scanTime || 0,
            success: true
        };

        this.performanceMetrics.set(scanId, metrics);
    }

    calculatePerformanceScore(results) {
        if (!results || results.scanTime === 0) return 0;
        return (results.totalFiles || 0) / (results.scanTime / 1000);
    }

    updatePerformanceMetrics() {
        // Update performance tracking based on recent scans
        const recentScans = Array.from(this.performanceMetrics.values())
            .filter(scan => Date.now() - scan.timestamp < 300000); // Last 5 minutes

        if (recentScans.length > 0) {
            console.log(`📊 Performance update: ${recentScans.length} recent scans`);
        }
    }

    cleanupOldMetrics() {
        const cutoff = Date.now() - (60 * 60 * 1000); // 1 hour ago
        for (const [scanId, metrics] of this.performanceMetrics.entries()) {
            if (metrics.timestamp < cutoff) {
                this.performanceMetrics.delete(scanId);
            }
        }
    }

    async withTimeout(promise, timeout) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Scan timeout'));
            }, timeout);

            promise.then(resolve, reject).finally(() => {
                clearTimeout(timer);
            });
        });
    }

    // Get service statistics
    getStats() {
        return {
            initialized: this.initialized,
            availableScanners: Array.from(this.scanners.keys()),
            activeScans: this.activeScans.size,
            performanceHistory: this.performanceMetrics.size,
            lastScan: this.getLastScanInfo()
        };
    }

    getLastScanInfo() {
        const recentScans = Array.from(this.performanceMetrics.values())
            .sort((a, b) => b.timestamp - a.timestamp);
        
        return recentScans[0] || null;
    }

    // Health check
    async healthCheck() {
        const health = {
            status: 'healthy',
            scanners: {},
            performance: this.getPerformanceSummary()
        };

        for (const [name, scanner] of this.scanners.entries()) {
            try {
                health.scanners[name] = {
                    status: 'available',
                    type: scanner.constructor.name
                };
            } catch (error) {
                health.scanners[name] = {
                    status: 'error',
                    error: error.message
                };
                health.status = 'degraded';
            }
        }

        return health;
    }

    getPerformanceSummary() {
        const recentScans = Array.from(this.performanceMetrics.values())
            .filter(scan => Date.now() - scan.timestamp < 3600000); // Last hour

        if (recentScans.length === 0) return { avgPerformance: 0, scanCount: 0 };

        const avgPerformance = recentScans.reduce((sum, scan) => sum + scan.performance, 0) / recentScans.length;

        return {
            avgPerformance: Math.round(avgPerformance),
            scanCount: recentScans.length,
            successRate: 100 // Assume all recorded scans are successful
        };
    }
}

module.exports = ScannerIntegrationService;