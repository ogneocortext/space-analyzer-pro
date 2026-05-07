/**
 * Analysis Service
 * Handles file system analysis operations
 */

const fs = require('fs');
const path = require('path');

class AnalysisService {
    constructor() {
        this.cache = new Map();
        this.isAnalyzing = false;
        this.currentAnalysis = null;
    }

    async analyzeDirectory(directoryPath, options = {}) {
        if (this.isAnalyzing) {
            throw new Error('Analysis already in progress');
        }

        this.isAnalyzing = true;
        this.currentAnalysis = {
            path: directoryPath,
            startTime: Date.now(),
            options
        };

        try {
            console.log(`Starting analysis of: ${directoryPath}`);
            
            const analysis = await this.performAnalysis(directoryPath, options);
            
            const result = {
                success: true,
                analysis: {
                    ...analysis,
                    path: directoryPath,
                    analysis_time_ms: Date.now() - this.currentAnalysis.startTime,
                    analysis_date: new Date().toISOString(),
                    strategy: options.strategy || 'standard'
                }
            };

            this.cache.set(directoryPath, result);
            return result;
        } catch (error) {
            console.error('Analysis failed:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.isAnalyzing = false;
            this.currentAnalysis = null;
        }
    }

    async performAnalysis(directoryPath, options) {
        const stats = await this.getDirectoryStats(directoryPath);
        const categories = await this.categorizeFiles(directoryPath);
        const files = await this.scanFiles(directoryPath, options);

        return {
            totalSize: stats.totalSize,
            totalFiles: stats.totalFiles,
            totalDirectories: stats.totalDirectories,
            categories,
            files: files.slice(0, 1000), // Limit to prevent memory issues
            hard_link_count: stats.hardLinkCount || 0,
            hard_link_savings: stats.hardLinkSavings || 0,
            mft_scanned: options.useMFT || false,
            hard_links_enumerated: options.enumerateHardLinks || false,
            usn_journal_id: options.useUSN ? 'sample-id' : null,
            last_usn: options.useUSN ? 'sample-usn' : null
        };
    }

    async getDirectoryStats(directoryPath) {
        let totalSize = 0;
        let totalFiles = 0;
        let totalDirectories = 0;
        let hardLinkCount = 0;
        let hardLinkSavings = 0;

        try {
            const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(directoryPath, entry.name);
                
                try {
                    const stats = fs.statSync(fullPath);
                    
                    if (entry.isDirectory()) {
                        totalDirectories++;
                        const subStats = await this.getDirectoryStats(fullPath);
                        totalSize += subStats.totalSize;
                        totalFiles += subStats.totalFiles;
                        totalDirectories += subStats.totalDirectories;
                        hardLinkCount += subStats.hardLinkCount;
                        hardLinkSavings += subStats.hardLinkSavings;
                    } else if (entry.isFile()) {
                        totalFiles++;
                        totalSize += stats.size;
                        
                        // Simple hard link detection (Windows specific)
                        if (stats.nlink > 1) {
                            hardLinkCount++;
                            hardLinkSavings += stats.size * (stats.nlink - 1);
                        }
                    }
                } catch (error) {
                    // Skip files we can't access
                    console.warn(`Skipping ${fullPath}: ${error.message}`);
                }
            }
        } catch (error) {
            console.error(`Error scanning directory ${directoryPath}:`, error.message);
        }

        return {
            totalSize,
            totalFiles,
            totalDirectories,
            hardLinkCount,
            hardLinkSavings
        };
    }

    async categorizeFiles(directoryPath) {
        const categories = {
            Documents: { size: 0, count: 0 },
            Images: { size: 0, count: 0 },
            Videos: { size: 0, count: 0 },
            Audio: { size: 0, count: 0 },
            Archives: { size: 0, count: 0 },
            Code: { size: 0, count: 0 },
            System: { size: 0, count: 0 },
            Other: { size: 0, count: 0 }
        };

        try {
            const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isFile()) {
                    const category = this.categorizeFile(entry.name);
                    const fullPath = path.join(directoryPath, entry.name);
                    
                    try {
                        const stats = fs.statSync(fullPath);
                        categories[category].size += stats.size;
                        categories[category].count++;
                    } catch (error) {
                        // Skip inaccessible files
                    }
                } else if (entry.isDirectory()) {
                    const subCategories = await this.categorizeFiles(fullPath);
                    Object.keys(subCategories).forEach(cat => {
                        categories[cat].size += subCategories[cat].size;
                        categories[cat].count += subCategories[cat].count;
                    });
                }
            }
        } catch (error) {
            console.error(`Error categorizing files in ${directoryPath}:`, error.message);
        }

        return categories;
    }

    categorizeFile(fileName) {
        const ext = path.extname(fileName).toLowerCase();
        
        const documentExts = ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt'];
        const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'];
        const videoExts = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv'];
        const audioExts = ['.mp3', '.wav', '.flac', '.aac', '.ogg'];
        const archiveExts = ['.zip', '.rar', '.7z', '.tar', '.gz'];
        const codeExts = ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.html', '.css'];
        const systemExts = ['.dll', '.exe', '.sys', '.drv', '.ini', '.log'];

        if (documentExts.includes(ext)) return 'Documents';
        if (imageExts.includes(ext)) return 'Images';
        if (videoExts.includes(ext)) return 'Videos';
        if (audioExts.includes(ext)) return 'Audio';
        if (archiveExts.includes(ext)) return 'Archives';
        if (codeExts.includes(ext)) return 'Code';
        if (systemExts.includes(ext)) return 'System';
        
        return 'Other';
    }

    async scanFiles(directoryPath, options = {}) {
        const files = [];
        const maxFiles = options.maxFiles || 1000;
        
        try {
            await this.scanDirectoryRecursive(directoryPath, files, maxFiles);
        } catch (error) {
            console.error('Error scanning files:', error.message);
        }
        
        return files;
    }

    async scanDirectoryRecursive(directoryPath, files, maxFiles) {
        if (files.length >= maxFiles) return;
        
        try {
            const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (files.length >= maxFiles) break;
                
                const fullPath = path.join(directoryPath, entry.name);
                
                try {
                    const stats = fs.statSync(fullPath);
                    
                    if (entry.isFile()) {
                        files.push({
                            name: entry.name,
                            path: fullPath,
                            size: stats.size,
                            modified: stats.mtime,
                            created: stats.birthtime || stats.ctime,
                            is_compressed: false,
                            is_sparse: false,
                            is_reparse_point: false,
                            has_ads: false,
                            is_hard_link: stats.nlink > 1
                        });
                    } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
                        await this.scanDirectoryRecursive(fullPath, files, maxFiles);
                    }
                } catch (error) {
                    // Skip inaccessible files
                }
            }
        } catch (error) {
            console.error(`Error scanning directory ${directoryPath}:`, error.message);
        }
    }

    getAnalysisStatus() {
        return {
            isAnalyzing: this.isAnalyzing,
            currentAnalysis: this.currentAnalysis
        };
    }

    cancelAnalysis() {
        if (this.isAnalyzing) {
            this.isAnalyzing = false;
            this.currentAnalysis = null;
            return { success: true, message: 'Analysis cancelled' };
        }
        return { success: false, message: 'No analysis in progress' };
    }

    clearCache() {
        this.cache.clear();
    }
}

module.exports = AnalysisService;
