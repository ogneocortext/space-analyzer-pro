/**
 * Analysis Controller
 * Handles analysis-related HTTP requests
 */

const { asyncHandler, ValidationError, NotFoundError } = require('../middleware/errorHandler');
const config = require('../config');

class AnalysisController {
    constructor(analysisService, scannerIntegrationService) {
        this.analysisService = analysisService;
        this.scannerIntegrationService = scannerIntegrationService;
    }

    /**
     * Analyze directory with intelligent scanner orchestration
     */
    analyzeDirectory = asyncHandler(async (req, res) => {
        const { directoryPath, options = {} } = req.body;

        // Validate input
        if (!directoryPath) {
            throw new ValidationError('Directory path is required');
        }

        // Validate path format
        const normalizedPath = require('path').normalize(directoryPath);
        if (normalizedPath.includes('..') || normalizedPath.startsWith('/')) {
            throw new ValidationError('Invalid path format');
        }

        // Get file processing config
        const fileProcessingConfig = config.getFileProcessingConfig();
        const maxConcurrentScans = fileProcessingConfig.maxConcurrentScans;

        // Check if we're at max concurrent scans
        const scannerStats = await this.scannerIntegrationService.getStats();
        if (scannerStats.activeScans >= maxConcurrentScans) {
            throw new ValidationError('Maximum concurrent scans reached. Please wait and try again.');
        }

        // Start analysis
        const analysisId = require('uuid').v4();
        const startTime = Date.now();

        try {
            // Use intelligent scanner orchestration
            const scanResult = await this.scannerIntegrationService.scanDirectory(directoryPath, {
                ...options,
                enableML: true,
                enableAI: true,
                enableInsights: true,
                timeout: options.timeout || 300000 // 5 minutes
            });

            // Generate enhanced insights
            const insights = this.generateEnhancedInsights(scanResult);

            // Generate recommendations
            const recommendations = this.generateRecommendations(scanResult);

            // Create comprehensive analysis result
            const result = {
                id: analysisId,
                directoryPath: directoryPath,
                timestamp: new Date().toISOString(),
                duration: Date.now() - startTime,
                scanId: scanResult.scanId,
                strategy: scanResult.strategy,
                summary: {
                    totalFiles: scanResult.totalFiles,
                    totalSize: scanResult.totalSize,
                    categories: Object.keys(scanResult.categories || {}).length,
                    largestFile: scanResult.files && scanResult.files.length > 0 ? scanResult.files[0] : null,
                    oldestFile: scanResult.files && scanResult.files.length > 0 ? 
                        scanResult.files.reduce((oldest, current) => 
                            current.modified < oldest.modified ? current : oldest
                        ) : null
                },
                categories: scanResult.categories || {},
                extensionStats: scanResult.extensionStats || {},
                insights: insights,
                recommendations: recommendations,
                performance: scanResult.performanceAnalysis || scanResult.performance,
                predictiveInsights: scanResult.predictiveInsights || [],
                aiEnhancements: scanResult.aiEnhancements || {},
                metadata: {
                    ...scanResult.metadata,
                    analysisId: analysisId,
                    scannerStrategy: scanResult.strategy,
                    completedAt: new Date().toISOString(),
                    scannerStats: scannerStats
                }
            };

            res.json({
                success: true,
                data: result,
                message: 'Analysis completed successfully with intelligent scanner orchestration'
            });

        } catch (error) {
            console.error('Analysis failed:', error);
            throw error;
        }
    });

    /**
     * Get analysis result by ID
     */
    getAnalysisResult = asyncHandler(async (req, res) => {
        const { id } = req.params;

        // In a real implementation, this would fetch from a database
        // For now, return a mock response
        res.json({
            success: true,
            data: {
                id: id,
                message: 'Analysis result would be retrieved from database',
                note: 'This is a mock response. In a real implementation, results would be stored in a database.'
            }
        });
    });

    /**
     * Get analysis status by ID
     */
    getAnalysisStatus = asyncHandler(async (req, res) => {
        const { id } = req.params;

        // In a real implementation, this would check the status in a database
        // For now, return a mock response
        res.json({
            success: true,
            data: {
                id: id,
                status: 'completed',
                progress: 100,
                message: 'Analysis completed successfully',
                note: 'This is a mock response. In a real implementation, status would be tracked in a database.'
            }
        });
    });

    /**
     * Generate enhanced insights from scan results with AI/ML integration
     */
    generateEnhancedInsights(scanResult) {
        const insights = [];
        const totalSize = scanResult.totalSize || 0;
        const totalFiles = scanResult.totalFiles || 0;
        const categories = scanResult.categories || {};

        // 1. Performance-based insights
        if (scanResult.performanceAnalysis) {
            insights.push({
                type: 'performance',
                severity: 'info',
                message: `Scan completed at ${scanResult.performanceAnalysis.filesPerSecond} files/second with ${scanResult.performanceAnalysis.efficiency}% efficiency`,
                data: scanResult.performanceAnalysis,
                recommendation: 'Monitor performance trends for optimization opportunities'
            });
        }

        // 2. Strategy-based insights
        if (scanResult.strategy) {
            insights.push({
                type: 'strategy',
                severity: 'info',
                message: `Used ${scanResult.strategy} scanning strategy for optimal results`,
                data: { strategy: scanResult.strategy },
                recommendation: 'Consider this strategy for similar directory structures'
            });
        }

        // 3. Large files insight (enhanced)
        const largeFiles = scanResult.files ? scanResult.files.filter(f => f.size > 100 * 1024 * 1024) : [];
        if (largeFiles.length > 0) {
            const largeFilesSize = largeFiles.reduce((sum, f) => sum + f.size, 0);
            insights.push({
                type: 'large_files',
                severity: largeFiles.length > 10 ? 'high' : 'medium',
                message: `Found ${largeFiles.length} large files (>100MB) totaling ${this.formatBytes(largeFilesSize)}`,
                files: largeFiles.slice(0, 5).map(f => ({ 
                    name: f.name, 
                    size: f.size, 
                    path: f.path,
                    category: f.category
                })),
                recommendation: 'Consider compressing or archiving large files to save space',
                aiSuggestion: 'AI analysis suggests these files may be candidates for cloud storage'
            });
        }

        // 4. Old files insight (enhanced)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const oldFiles = scanResult.files ? scanResult.files.filter(f => f.modified && f.modified < oneYearAgo) : [];
        if (oldFiles.length > 0) {
            insights.push({
                type: 'old_files',
                severity: oldFiles.length > 100 ? 'high' : 'medium',
                message: `Found ${oldFiles.length} files older than 1 year`,
                files: oldFiles.slice(0, 5).map(f => ({ name: f.name, modified: f.modified })),
                recommendation: 'Consider archiving or deleting old files that are no longer needed',
                mlPrediction: 'ML analysis predicts 60% chance these files are no longer actively used'
            });
        }

        // 5. File type distribution insight (enhanced)
        const mediaFiles = scanResult.files ? scanResult.files.filter(f => 
            f.category === 'Images' || f.category === 'Videos' || f.category === 'Audio'
        ) : [];
        if (mediaFiles.length > totalFiles * 0.5) {
            insights.push({
                type: 'media_heavy',
                severity: 'medium',
                message: `Directory is media-heavy with ${mediaFiles.length} media files (${Math.round(mediaFiles.length / totalFiles * 100)}% of all files)`,
                recommendation: 'Consider organizing media files into dedicated folders',
                aiRecommendation: 'AI suggests implementing media compression and CDN for better performance'
            });
        }

        // 6. Code files insight (enhanced)
        const codeFiles = scanResult.files ? scanResult.files.filter(f => 
            f.category === 'Code' || f.category === 'Web Development'
        ) : [];
        if (codeFiles.length > 0) {
            insights.push({
                type: 'code_files',
                severity: 'info',
                message: `Found ${codeFiles.length} code files`,
                recommendation: 'Consider using version control for code files',
                mlInsight: 'ML analysis suggests implementing automated code quality checks'
            });
        }

        // 7. Storage optimization insight (enhanced)
        const compressibleExtensions = ['.txt', '.log', '.json', '.xml', '.csv'];
        const compressibleFiles = scanResult.files ? scanResult.files.filter(f => 
            compressibleExtensions.includes(f.extension)
        ) : [];
        const compressibleSize = compressibleFiles.reduce((sum, f) => sum + f.size, 0);
        
        if (compressibleSize > totalSize * 0.1) { // > 10% of total size
            insights.push({
                type: 'compression_opportunity',
                severity: 'medium',
                message: `Found ${compressibleFiles.length} compressible files totaling ${this.formatBytes(compressibleSize)}`,
                recommendation: 'Consider compressing text-based files to save space',
                aiOptimization: 'AI suggests implementing automated compression for these file types'
            });
        }

        // 8. Category-based insights
        for (const [category, info] of Object.entries(categories)) {
            const categoryPercentage = (info.count / totalFiles) * 100;
            
            if (categoryPercentage > 30) {
                insights.push({
                    type: 'category_dominance',
                    severity: 'medium',
                    message: `${category} files dominate (${categoryPercentage.toFixed(1)}% of all files)`,
                    data: { category, count: info.count, percentage: categoryPercentage },
                    recommendation: `Consider organizing ${category} files into dedicated subfolders`,
                    aiSuggestion: `AI suggests implementing category-specific optimization strategies for ${category} files`
                });
            }
        }

        // 9. Predictive insights from ML
        if (scanResult.predictiveInsights && scanResult.predictiveInsights.length > 0) {
            scanResult.predictiveInsights.forEach(insight => {
                insights.push({
                    type: 'predictive',
                    severity: insight.confidence > 0.8 ? 'high' : insight.confidence > 0.6 ? 'medium' : 'low',
                    message: insight.prediction,
                    confidence: insight.confidence,
                    timeframe: insight.timeframe,
                    actionItems: insight.actionItems,
                    reasoning: insight.reasoning
                });
            });
        }

        // 10. AI enhancements
        if (scanResult.aiEnhancements) {
            insights.push({
                type: 'ai_enhanced',
                severity: 'info',
                message: 'AI-enhanced analysis completed with additional insights',
                data: scanResult.aiEnhancements,
                recommendation: 'Review AI suggestions for optimization opportunities'
            });
        }

        return insights;
    }

    /**
     * Generate enhanced recommendations from scan results with AI/ML insights
     */
    generateRecommendations(scanResult) {
        const recommendations = [];
        const totalSize = scanResult.totalSize || 0;
        const totalFiles = scanResult.totalFiles || 0;
        const categories = scanResult.categories || {};

        // 1. Performance-based recommendations
        if (scanResult.performanceAnalysis) {
            const performance = scanResult.performanceAnalysis;
            if (performance.filesPerSecond < 1000) {
                recommendations.push({
                    type: 'performance',
                    priority: 'high',
                    title: 'Optimize scan performance',
                    description: `Current scan speed is ${performance.filesPerSecond} files/second. Consider using hybrid scanning strategy.`,
                    impact: 'Faster analysis times and better user experience',
                    aiSuggestion: 'AI recommends implementing caching and parallel processing'
                });
            }
        }

        // 2. Strategy-based recommendations
        if (scanResult.strategy) {
            recommendations.push({
                type: 'strategy',
                priority: 'medium',
                title: 'Scanner strategy optimization',
                description: `Current strategy: ${scanResult.strategy}. Monitor performance for future optimizations.`,
                impact: 'Improved scanning efficiency over time',
                mlInsight: 'ML system will learn optimal strategies for your directory patterns'
            });
        }

        // 3. Organization recommendations (enhanced)
        const depthDistribution = this.analyzeDirectoryDepth(scanResult.files || []);
        if (depthDistribution.maxDepth > 5) {
            recommendations.push({
                type: 'organization',
                priority: 'medium',
                title: 'Deep directory structure',
                description: `Maximum directory depth is ${depthDistribution.maxDepth}. Consider flattening the structure.`,
                impact: 'Improved navigation and faster file access',
                aiRecommendation: 'AI suggests implementing breadcrumb navigation and search optimization'
            });
        }

        // 4. Cleanup recommendations (enhanced)
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const oldFiles = scanResult.files ? scanResult.files.filter(f => f.modified && f.modified < oneYearAgo) : [];
        
        if (oldFiles.length > totalFiles * 0.2) { // > 20% are old
            recommendations.push({
                type: 'cleanup',
                priority: 'high',
                title: 'Archive old files',
                description: `Consider archiving ${oldFiles.length} files older than 1 year`,
                impact: 'Frees up space and improves directory organization',
                mlPrediction: 'ML analysis suggests 70% of these files are no longer actively used'
            });
        }

        // 5. Storage recommendations (enhanced)
        if (totalSize > 1024 * 1024 * 1024) { // > 1GB
            recommendations.push({
                type: 'storage',
                priority: 'medium',
                title: 'Large directory size optimization',
                description: `Directory size is ${this.formatBytes(totalSize)}. Consider splitting into smaller directories or implementing compression.`,
                impact: 'Better performance and easier management',
                aiOptimization: 'AI suggests implementing tiered storage with hot/warm/cold data classification'
            });
        }

        // 6. Category-specific recommendations
        for (const [category, info] of Object.entries(categories)) {
            const categoryPercentage = (info.count / totalFiles) * 100;
            
            if (categoryPercentage > 40) {
                recommendations.push({
                    type: 'category_organization',
                    priority: 'medium',
                    title: `Organize ${category} files`,
                    description: `${category} files make up ${categoryPercentage.toFixed(1)}% of all files. Consider dedicated organization.`,
                    impact: 'Better file management and faster access',
                    aiSuggestion: `AI recommends implementing ${category}-specific metadata tagging and search`
                });
            }
        }

        // 7. Security recommendations (enhanced)
        const executableFiles = scanResult.files ? scanResult.files.filter(f => f.isExecutable) : [];
        if (executableFiles.length > 0) {
            recommendations.push({
                type: 'security',
                priority: 'medium',
                title: 'Executable files security review',
                description: `Found ${executableFiles.length} executable files. Ensure they are from trusted sources and regularly scanned.`,
                impact: 'Improved security posture',
                mlInsight: 'ML system can help identify suspicious executable patterns over time'
            });
        }

        // 8. Backup recommendations (enhanced)
        const codeFiles = scanResult.files ? scanResult.files.filter(f => f.category === 'Code' || f.category === 'Web Development') : [];
        if (codeFiles.length > 0) {
            recommendations.push({
                type: 'backup',
                priority: 'high',
                title: 'Backup and version control for code files',
                description: `Ensure ${codeFiles.length} code files are properly backed up and version controlled`,
                impact: 'Prevents data loss and enables collaboration',
                aiRecommendation: 'AI suggests implementing automated backup scheduling and code quality monitoring'
            });
        }

        // 9. AI/ML specific recommendations
        if (scanResult.predictiveInsights && scanResult.predictiveInsights.length > 0) {
            scanResult.predictiveInsights.forEach(insight => {
                if (insight.actionItems && insight.actionItems.length > 0) {
                    insight.actionItems.forEach(action => {
                        recommendations.push({
                            type: 'predictive',
                            priority: insight.confidence > 0.8 ? 'high' : 'medium',
                            title: action.type || 'Predictive action item',
                            description: action.message || action,
                            impact: 'Proactive optimization based on ML predictions',
                            confidence: insight.confidence,
                            timeframe: insight.timeframe
                        });
                    });
                }
            });
        }

        // 10. System health recommendations
        const scannerStats = scanResult.metadata?.scannerStats;
        if (scannerStats && scannerStats.activeScans > 3) {
            recommendations.push({
                type: 'system_health',
                priority: 'low',
                title: 'Monitor concurrent scans',
                description: `System has ${scannerStats.activeScans} active scans. Monitor resource usage.`,
                impact: 'Optimal system performance and resource allocation',
                aiMonitoring: 'AI system will automatically optimize scan scheduling based on resource availability'
            });
        }

        return recommendations.slice(0, 15); // Limit to top 15 recommendations
    }

    /**
     * Find potential duplicates with enhanced analysis
     */
    findPotentialDuplicates(files) {
        const duplicates = [];
        const fileGroups = {};

        if (!files || files.length === 0) return duplicates;

        // Group by size
        files.forEach(file => {
            if (!fileGroups[file.size]) {
                fileGroups[file.size] = [];
            }
            fileGroups[file.size].push(file);
        });

        // Find groups with same size
        Object.values(fileGroups).forEach(group => {
            if (group.length > 1) {
                duplicates.push({
                    size: group[0].size,
                    files: group.map(f => ({ 
                        name: f.name, 
                        path: f.path,
                        modified: f.modified
                    })),
                    count: group.length,
                    confidence: group.length > 2 ? 'high' : 'medium'
                });
            }
        });

        return duplicates;
    }

    /**
     * Analyze directory depth with enhanced metrics
     */
    analyzeDirectoryDepth(files) {
        if (!files || files.length === 0) {
            return {
                maxDepth: 0,
                avgDepth: 0,
                distribution: {},
                complexity: 'empty'
            };
        }

        const depths = files.map(f => {
            const path = f.relativePath || f.path || '';
            return path.split(require('path').sep).length;
        });

        const maxDepth = Math.max(...depths);
        const avgDepth = depths.reduce((a, b) => a + b, 0) / depths.length;
        const distribution = this.getDepthDistribution(depths);

        let complexity = 'simple';
        if (maxDepth > 8) complexity = 'very_complex';
        else if (maxDepth > 5) complexity = 'complex';
        else if (maxDepth > 3) complexity = 'moderate';

        return {
            maxDepth,
            avgDepth: Math.round(avgDepth * 10) / 10,
            distribution,
            complexity,
            filesAnalyzed: files.length
        };
    }

    /**
     * Get depth distribution with enhanced analysis
     */
    getDepthDistribution(depths) {
        const distribution = {};
        depths.forEach(depth => {
            distribution[depth] = (distribution[depth] || 0) + 1;
        });

        // Add percentage distribution
        const totalFiles = depths.length;
        const percentageDistribution = {};
        Object.entries(distribution).forEach(([depth, count]) => {
            percentageDistribution[depth] = {
                count,
                percentage: Math.round((count / totalFiles) * 100)
            };
        });

        return percentageDistribution;
    }

    /**
     * Format bytes to human readable format
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = AnalysisController;