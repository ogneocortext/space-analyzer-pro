/**
 * Node.js Integration Example for Enhanced Polyglot Scanner
 * Shows how to integrate with AI/ML features and web services
 */

const express = require('express');
const enhancedScanner = require('./enhanced-polyglot-scanner');
const path = require('path');
const fs = require('fs');

class SpaceAnalyzerService {
    constructor() {
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
        this.scanHistory = [];
        this.mlInsights = new Map();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static(path.join(__dirname, 'public')));
        
        // CORS for API access
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type');
            next();
        });
    }

    setupRoutes() {
        // Main scan endpoint
        this.app.post('/api/scan', async (req, res) => {
            try {
                const { directory, options = {} } = req.body;
                
                if (!directory) {
                    return res.status(400).json({ error: 'Directory path required' });
                }

                console.log(`🔍 API Scan Request: ${directory}`);
                
                const result = await enhancedScanner.scanDirectory(directory, {
                    strategy: options.strategy || 'adaptive',
                    enableML: options.enableML !== false,
                    optimizeFor: options.optimizeFor || 'speed',
                    maxFiles: options.maxFiles || null,
                    maxDepth: options.maxDepth || 10,
                    includeHidden: options.includeHidden || false
                });

                // Store in history
                this.scanHistory.push({
                    timestamp: new Date(),
                    directory,
                    options,
                    result: {
                        scanner: result.scanner,
                        totalFiles: result.totalFiles,
                        scanTime: result.scanTime,
                        performance: result.metadata.performance
                    }
                });

                // Limit history size
                if (this.scanHistory.length > 100) {
                    this.scanHistory = this.scanHistory.slice(-100);
                }

                res.json({
                    success: true,
                    data: result,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Scan error:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Real-time scan endpoint with Server-Sent Events
        this.app.get('/api/scan/stream', async (req, res) => {
            const { directory, strategy = 'adaptive' } = req.query;
            
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });

            try {
                // Send progress updates
                res.write(`data: ${JSON.stringify({ type: 'start', message: 'Starting scan...' })}\n\n`);

                const result = await enhancedScanner.scanDirectory(directory, {
                    strategy,
                    enableML: true,
                    optimizeFor: 'speed'
                });

                // Send final result
                res.write(`data: ${JSON.stringify({ type: 'complete', result })}\n\n`);
                res.end();

            } catch (error) {
                res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
                res.end();
            }
        });

        // ML insights endpoint
        this.app.get('/api/insights', (req, res) => {
            const insights = this.generateMLInsights();
            res.json(insights);
        });

        // Performance comparison endpoint
        this.app.get('/api/performance', (req, res) => {
            const performance = this.analyzePerformance();
            res.json(performance);
        });

        // System info endpoint
        this.app.get('/api/system', (req, res) => {
            res.json(enhancedScanner.systemInfo);
        });

        // Scan history endpoint
        this.app.get('/api/history', (req, res) => {
            res.json(this.scanHistory);
        });

        // AI recommendations endpoint
        this.app.post('/api/recommendations', async (req, res) => {
            try {
                const { directory, context } = req.body;
                
                // Analyze directory characteristics
                const characteristics = await enhancedScanner.analyzeDirectoryCharacteristics(directory);
                
                // Generate AI-powered recommendations
                const recommendations = await this.generateAIRecommendations(characteristics, context);
                
                res.json({
                    success: true,
                    recommendations,
                    characteristics
                });

            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Serve main dashboard
        this.app.get('/', (req, res) => {
            res.send(this.generateDashboard());
        });
    }

    generateMLInsights() {
        const recentScans = this.scanHistory.slice(-10);
        
        if (recentScans.length === 0) {
            return { insights: [], message: 'No scan data available' };
        }

        // Analyze patterns
        const avgPerformance = recentScans.reduce((sum, scan) => 
            sum + scan.result.performance.filesPerSecond, 0) / recentScans.length;
        
        const preferredScanner = this.getMostUsedScanner(recentScans);
        const commonStrategies = this.getCommonStrategies(recentScans);
        
        return {
            insights: [
                {
                    type: 'performance',
                    title: 'Average Performance',
                    value: `${Math.round(avgPerformance).toLocaleString()} files/sec`,
                    trend: this.calculatePerformanceTrend(recentScans)
                },
                {
                    type: 'scanner',
                    title: 'Preferred Scanner',
                    value: preferredScanner,
                    confidence: this.calculateScannerConfidence(recentScans, preferredScanner)
                },
                {
                    type: 'strategy',
                    title: 'Common Strategies',
                    value: commonStrategies
                }
            ],
            recommendations: this.generateRecommendations(recentScans),
            lastUpdated: new Date().toISOString()
        };
    }

    analyzePerformance() {
        const scannerStats = {};
        
        // Group by scanner type
        for (const scan of this.scanHistory) {
            const scanner = scan.result.scanner;
            if (!scannerStats[scanner]) {
                scannerStats[scanner] = {
                    scans: 0,
                    totalFiles: 0,
                    totalTime: 0,
                    avgPerformance: 0
                };
            }
            
            scannerStats[scanner].scans++;
            scannerStats[scanner].totalFiles += scan.result.totalFiles;
            scannerStats[scanner].totalTime += scan.result.scanTime;
        }

        // Calculate averages
        for (const [scanner, stats] of Object.entries(scannerStats)) {
            stats.avgPerformance = stats.totalFiles / (stats.totalTime / 1000);
            stats.avgFilesPerScan = stats.totalFiles / stats.scans;
            stats.avgTimePerScan = stats.totalTime / stats.scans;
        }

        return {
            scannerStats,
            totalScans: this.scanHistory.length,
            bestPerformer: this.getBestPerformingScanner(scannerStats),
            recommendations: this.getPerformanceRecommendations(scannerStats)
        };
    }

    async generateAIRecommendations(characteristics, context) {
        const recommendations = [];
        
        // Get system info safely
        const systemInfo = enhancedScanner.systemInfo || {};
        
        // File organization recommendations
        if (characteristics.estimatedFileCount > 100000) {
            recommendations.push({
                type: 'organization',
                priority: 'high',
                title: 'Large Directory Detected',
                description: 'Consider organizing into subdirectories for better performance',
                action: 'create_subdirectories',
                expectedImprovement: '30-50% faster scans'
            });
        }

        // Scanner recommendations
        if (characteristics.complexity === 'high') {
            recommendations.push({
                type: 'strategy',
                priority: 'medium',
                title: 'Complex Directory Structure',
                description: 'Use hybrid scanning for complex directories',
                action: 'hybrid_strategy',
                expectedImprovement: 'Better accuracy and speed'
            });
        }

        // Memory recommendations
        if (systemInfo.totalMemory && systemInfo.freeMemory) {
            const memoryUsage = (systemInfo.totalMemory - systemInfo.freeMemory) / systemInfo.totalMemory;
            
            if (memoryUsage > 0.8) {
                recommendations.push({
                    type: 'memory',
                    priority: 'high',
                    title: 'High Memory Usage',
                    description: 'Use memory-optimized scanning with file limits',
                    action: 'memory_optimization',
                    expectedImprovement: 'Reduced memory footprint'
                });
            }
        }

        // Context-aware recommendations
        if (context) {
            if (context.purpose === 'development') {
                recommendations.push({
                    type: 'development',
                    priority: 'low',
                    title: 'Development Environment',
                    description: 'Focus on source code files and exclude build artifacts',
                    action: 'dev_focused_scan',
                    expectedImprovement: 'More relevant results'
                });
            }
        }

        return recommendations;
    }

    generateDashboard() {
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Enhanced Polyglot Scanner Dashboard</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        .scanner-card { @apply bg-white rounded-lg shadow-lg p-6 mb-4; }
        .metric { @apply text-2xl font-bold text-blue-600; }
        .status-online { @apply text-green-500; }
        .status-offline { @apply text-red-500; }
    </style>
</head>
<body class="bg-gray-100">
    <div class="container mx-auto p-4">
        <h1 class="text-3xl font-bold mb-6 text-center">🚀 Enhanced Polyglot Scanner Dashboard</h1>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div class="scanner-card">
                <h3 class="text-lg font-semibold mb-2">🦀 Rust Scanner</h3>
                <div class="status-online">● Online</div>
                <p class="text-sm text-gray-600 mt-2">High-performance native scanner</p>
            </div>
            
            <div class="scanner-card">
                <h3 class="text-lg font-semibold mb-2">⚙️ C++ Scanner</h3>
                <div class="status-online">● Online</div>
                <p class="text-sm text-gray-600 mt-2">Memory-efficient native scanner</p>
            </div>
            
            <div class="scanner-card">
                <h3 class="text-lg font-semibold mb-2">🤖 ML Analyzer</h3>
                <div class="status-online">● Active</div>
                <p class="text-sm text-gray-600 mt-2">AI-powered insights and optimization</p>
            </div>
        </div>

        <div class="scanner-card">
            <h2 class="text-xl font-bold mb-4">Quick Scan</h2>
            <form id="scanForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium mb-1">Directory Path</label>
                    <input type="text" id="directory" 
                           class="w-full p-2 border rounded" 
                           placeholder="Enter directory path..."
                           value="D:/Backup of Important Data for Windows 11 Upgrade/Native Media AI Studio">
                </div>
                
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">Strategy</label>
                        <select id="strategy" class="w-full p-2 border rounded">
                            <option value="adaptive">🎯 Adaptive (Recommended)</option>
                            <option value="hybrid">🔄 Hybrid</option>
                            <option value="rust">🦀 Rust (Fastest)</option>
                            <option value="cpp">⚙️ C++ (Memory Efficient)</option>
                        </select>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">Optimize For</label>
                        <select id="optimizeFor" class="w-full p-2 border rounded">
                            <option value="speed">⚡ Speed</option>
                            <option value="memory">💾 Memory</option>
                            <option value="accuracy">🎯 Accuracy</option>
                        </select>
                    </div>
                </div>
                
                <div class="flex items-center space-x-4">
                    <label class="flex items-center">
                        <input type="checkbox" id="enableML" checked class="mr-2">
                        <span class="text-sm">Enable AI/ML Features</span>
                    </label>
                    
                    <label class="flex items-center">
                        <input type="number" id="maxFiles" placeholder="Max files" 
                               class="w-24 p-2 border rounded text-sm">
                        <span class="text-sm ml-1">Max Files</span>
                    </label>
                </div>
                
                <button type="submit" 
                        class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition">
                    🚀 Start Scan
                </button>
            </form>
        </div>

        <div class="scanner-card">
            <h2 class="text-xl font-bold mb-4">Scan Results</h2>
            <div id="results" class="hidden">
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div class="text-center">
                        <div class="metric" id="totalFiles">-</div>
                        <div class="text-sm text-gray-600">Total Files</div>
                    </div>
                    <div class="text-center">
                        <div class="metric" id="totalSize">-</div>
                        <div class="text-sm text-gray-600">Total Size</div>
                    </div>
                    <div class="text-center">
                        <div class="metric" id="scanTime">-</div>
                        <div class="text-sm text-gray-600">Scan Time</div>
                    </div>
                    <div class="text-center">
                        <div class="metric" id="performance">-</div>
                        <div class="text-sm text-gray-600">Files/Sec</div>
                    </div>
                </div>
                
                <div id="scannerInfo" class="bg-blue-50 p-4 rounded mb-4">
                    <h3 class="font-semibold mb-2">Scanner Information</h3>
                    <div id="scannerDetails"></div>
                </div>
                
                <div id="mlInsights" class="bg-green-50 p-4 rounded">
                    <h3 class="font-semibold mb-2">🤖 ML Insights</h3>
                    <div id="mlDetails"></div>
                </div>
            </div>
            
            <div id="loading" class="hidden text-center py-8">
                <div class="text-lg">🔄 Scanning in progress...</div>
                <div class="text-sm text-gray-600 mt-2">Please wait</div>
            </div>
        </div>

        <div class="scanner-card">
            <h2 class="text-xl font-bold mb-4">Performance History</h2>
            <canvas id="performanceChart" width="400" height="200"></canvas>
        </div>
    </div>

    <script>
        let currentScan = null;
        
        document.getElementById('scanForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const directory = document.getElementById('directory').value;
            const strategy = document.getElementById('strategy').value;
            const optimizeFor = document.getElementById('optimizeFor').value;
            const enableML = document.getElementById('enableML').checked;
            const maxFiles = document.getElementById('maxFiles').value || null;
            
            if (!directory) {
                alert('Please enter a directory path');
                return;
            }
            
            // Show loading
            document.getElementById('loading').classList.remove('hidden');
            document.getElementById('results').classList.add('hidden');
            
            try {
                const response = await fetch('/api/scan', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        directory,
                        options: { strategy, optimizeFor, enableML, maxFiles }
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    displayResults(result.data);
                } else {
                    alert('Scan failed: ' + result.error);
                }
            } catch (error) {
                alert('Error: ' + error.message);
            } finally {
                document.getElementById('loading').classList.add('hidden');
            }
        });
        
        function displayResults(data) {
            document.getElementById('results').classList.remove('hidden');
            
            // Update metrics
            document.getElementById('totalFiles').textContent = data.totalFiles.toLocaleString();
            document.getElementById('totalSize').textContent = formatBytes(data.totalSize);
            document.getElementById('scanTime').textContent = data.scanTime + 'ms';
            document.getElementById('performance').textContent = 
                Math.round(data.totalFiles / (data.scanTime / 1000)).toLocaleString();
            
            // Update scanner info
            const scannerInfo = document.getElementById('scannerDetails');
            scannerInfo.innerHTML = \`
                <p><strong>Scanner Used:</strong> \${data.scanner}</p>
                <p><strong>Strategy:</strong> \${data.metadata.strategy}</p>
                <p><strong>Performance Grade:</strong> \${data.metadata.performance?.grade || 'N/A'}</p>
                <p><strong>Efficiency Score:</strong> \${data.metadata.performance?.efficiency || 'N/A'}</p>
            \`;
            
            // Update ML insights
            if (data.mlAnalysis) {
                const mlDetails = document.getElementById('mlDetails');
                mlDetails.innerHTML = \`
                    <p><strong>Performance Grade:</strong> \${data.mlAnalysis.performanceScore.grade}</p>
                    <p><strong>Recommendations:</strong> \${data.mlAnalysis.recommendations.length} suggestions</p>
                    <p><strong>Patterns Detected:</strong> \${data.mlAnalysis.patterns.length}</p>
                \`;
            }
            
            currentScan = data;
        }
        
        function formatBytes(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
        
        // Load performance data
        loadPerformanceChart();
    </script>
</body>
</html>`;
    }

    // Utility methods
    getMostUsedScanner(scans) {
        const counts = {};
        for (const scan of scans) {
            counts[scan.result.scanner] = (counts[scan.result.scanner] || 0) + 1;
        }
        return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    }

    getCommonStrategies(scans) {
        const strategies = {};
        for (const scan of scans) {
            const strategy = scan.options.strategy || 'adaptive';
            strategies[strategy] = (strategies[strategy] || 0) + 1;
        }
        return Object.entries(strategies)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([strategy]) => strategy);
    }

    calculatePerformanceTrend(scans) {
        if (scans.length < 2) return 'insufficient_data';
        
        const recent = scans.slice(-3);
        const avgRecent = recent.reduce((sum, scan) => 
            sum + scan.result.performance.filesPerSecond, 0) / recent.length;
        const older = scans.slice(-6, -3);
        const avgOlder = older.length > 0 ? 
            older.reduce((sum, scan) => sum + scan.result.performance.filesPerSecond, 0) / older.length : avgRecent;
        
        return avgRecent > avgOlder ? 'improving' : avgRecent < avgOlder ? 'declining' : 'stable';
    }

    calculateScannerConfidence(scans, scanner) {
        const scannerScans = scans.filter(scan => scan.result.scanner === scanner);
        return scannerScans.length / scans.length;
    }

    getBestPerformingScanner(stats) {
        return Object.entries(stats).reduce((best, [scanner, stats]) => {
            if (!best || stats.avgPerformance > best[1].avgPerformance) {
                return [scanner, stats];
            }
            return best;
        }, null);
    }

    getPerformanceRecommendations(scannerStats) {
        const recommendations = [];
        
        if (!scannerStats) {
            return recommendations;
        }
        
        for (const [scanner, stats] of Object.entries(scannerStats)) {
            if (stats.avgPerformance < 50000) {
                recommendations.push({
                    scanner,
                    issue: 'Below optimal performance',
                    suggestion: 'Consider different strategy or optimization settings'
                });
            }
        }
        
        return recommendations;
    }

    generateRecommendations(scans) {
        const recommendations = [];
        
        // Performance recommendations
        const avgPerformance = scans.reduce((sum, scan) => 
            sum + scan.result.performance.filesPerSecond, 0) / scans.length;
        
        if (avgPerformance < 30000) {
            recommendations.push({
                type: 'performance',
                message: 'Consider using adaptive strategy for better performance'
            });
        }
        
        return recommendations;
    }

    loadPerformanceChart() {
        // This would load performance data into a chart
        // Implementation depends on chart library preferences
    }

    start(port = 3000) {
        this.app.listen(port, () => {
            console.log(`🚀 Enhanced Polyglot Scanner API running on port ${port}`);
            console.log(`📊 Dashboard available at http://localhost:${port}`);
            console.log('🤖 AI/ML features enabled');
        });
    }
}

// Start the service
if (require.main === module) {
    const service = new SpaceAnalyzerService();
    service.start(3000);
}

module.exports = SpaceAnalyzerService;
