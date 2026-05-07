/**
 * AI Service
 * Handles AI integration for file analysis
 */

class AIService {
    constructor() {
        this.enabled = process.env.AI_SERVICE_ENABLED === 'true';
        this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        try {
            if (this.enabled) {
                // Test Ollama connection
                const response = await fetch(`${this.ollamaUrl}/api/tags`);
                if (response.ok) {
                    console.log('✅ AI Service initialized with Ollama');
                    this.initialized = true;
                } else {
                    console.warn('⚠️ Ollama not available, AI features disabled');
                    this.enabled = false;
                }
            } else {
                console.log('ℹ️ AI Service disabled');
            }
        } catch (error) {
            console.warn('⚠️ Failed to initialize AI Service:', error.message);
            this.enabled = false;
        }
        
        this.initialized = true;
    }

    async analyzeFiles(files, options = {}) {
        if (!this.enabled || !this.initialized) {
            return {
                success: false,
                message: 'AI Service not available'
            };
        }

        try {
            // Simple AI analysis implementation
            const analysis = {
                insights: [],
                recommendations: [],
                patterns: [],
                summary: this.generateSummary(files)
            };

            return {
                success: true,
                data: analysis
            };
        } catch (error) {
            console.error('AI analysis failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    generateSummary(files) {
        if (!files || files.length === 0) {
            return 'No files to analyze';
        }

        const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
        const fileTypes = {};
        
        files.forEach(file => {
            const ext = file.name?.split('.').pop()?.toLowerCase() || 'unknown';
            fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        });

        const mostCommonType = Object.entries(fileTypes)
            .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown';

        return `Analyzed ${files.length} files totaling ${this.formatBytes(totalSize)}. ` +
               `Most common file type: ${mostCommonType}.`;
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
    }

    async getRecommendations(analysisData) {
        if (!this.enabled) {
            return [];
        }

        const recommendations = [];

        // Generate basic recommendations based on analysis data
        if (analysisData.categories) {
            const largeCategories = Object.entries(analysisData.categories)
                .filter(([, data]) => data.size > 1024 * 1024 * 100) // > 100MB
                .map(([name]) => name);

            if (largeCategories.length > 0) {
                recommendations.push({
                    type: 'cleanup',
                    priority: 'medium',
                    message: `Consider cleaning up large categories: ${largeCategories.join(', ')}`
                });
            }
        }

        return recommendations;
    }

    async detectPatterns(files) {
        if (!this.enabled) {
            return [];
        }

        const patterns = [];
        const fileNames = files.map(f => f.name).filter(Boolean);

        // Detect duplicate files
        const nameCounts = {};
        fileNames.forEach(name => {
            const baseName = name?.split('.')[0] || '';
            nameCounts[baseName] = (nameCounts[baseName] || 0) + 1;
        });

        const duplicates = Object.entries(nameCounts)
            .filter(([, count]) => count > 1)
            .map(([name]) => name);

        if (duplicates.length > 0) {
            patterns.push({
                type: 'duplicates',
                count: duplicates.length,
                files: duplicates.slice(0, 10) // Limit to first 10
            });
        }

        return patterns;
    }

    isEnabled() {
        return this.enabled && this.initialized;
    }

    getStatus() {
        return {
            enabled: this.enabled,
            initialized: this.initialized,
            ollamaUrl: this.ollamaUrl
        };
    }
}

module.exports = AIService;
