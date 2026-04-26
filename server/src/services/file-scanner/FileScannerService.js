/**
 * File Scanner Service
 * Handles file system scanning and analysis
 */

const fs = require('fs').promises;
const path = require('path');
const { promisify } = require('util');
const { ErrorHandler, ValidationError } = require('../../middleware/errorHandler');

class FileScannerService {
    constructor() {
        this.errorHandler = new ErrorHandler();
        this.supportedExtensions = [
            '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp',
            '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala',
            '.html', '.css', '.scss', '.sass', '.less', '.json', '.xml', '.yaml', '.yml',
            '.txt', '.md', '.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.gif', '.bmp',
            '.mp4', '.avi', '.mov', '.mp3', '.wav', '.zip', '.tar', '.gz'
        ];
    }

    /**
     * Scan directory and return file information
     */
    async scanDirectory(directoryPath, options = {}) {
        try {
            // Validate input
            await this.validatePath(directoryPath);
            
            const config = require('../../config');
            const fileProcessingConfig = config.getFileProcessingConfig();
            
            // Merge options with defaults
            const scanOptions = {
                recursive: options.recursive !== false,
                includeHidden: options.includeHidden || false,
                maxDepth: options.maxDepth || 10,
                filters: options.filters || [],
                batchSize: options.batchSize || 1000,
                ...options
            };

            const startTime = Date.now();
            const result = {
                files: [],
                categories: {},
                extensionStats: {},
                totalFiles: 0,
                totalSize: 0,
                performance: {
                    scanTime: 0,
                    filesPerSecond: 0,
                    memoryUsage: process.memoryUsage()
                },
                metadata: {
                    directory: directoryPath,
                    options: scanOptions,
                    timestamp: new Date().toISOString()
                }
            };

            // Perform the scan
            await this.scanDirectoryRecursive(directoryPath, result, scanOptions, 0);

            // Calculate performance metrics
            result.performance.scanTime = Date.now() - startTime;
            result.performance.filesPerSecond = Math.round(
                result.totalFiles / (result.performance.scanTime / 1000)
            );

            return result;
        } catch (error) {
            throw await this.errorHandler.logError(error, { directoryPath, options }, 'error');
        }
    }

    /**
     * Recursively scan directory
     */
    async scanDirectoryRecursive(directoryPath, result, options, currentDepth) {
        if (currentDepth >= options.maxDepth) {
            return;
        }

        try {
            const items = await fs.readdir(directoryPath);
            
            for (const item of items) {
                // Skip hidden files if not included
                if (!options.includeHidden && item.startsWith('.')) {
                    continue;
                }

                const fullPath = path.join(directoryPath, item);
                const stats = await fs.stat(fullPath);

                if (stats.isDirectory()) {
                    if (options.recursive) {
                        await this.scanDirectoryRecursive(fullPath, result, options, currentDepth + 1);
                    }
                } else {
                    // Process file
                    const fileInfo = await this.processFile(fullPath, stats, directoryPath);
                    
                    // Apply filters
                    if (this.applyFilters(fileInfo, options.filters)) {
                        result.files.push(fileInfo);
                        this.updateStats(result, fileInfo);
                    }
                }
            }
        } catch (error) {
            // Log directory access errors but continue scanning
            console.warn(`Warning: Cannot access directory ${directoryPath}: ${error.message}`);
        }
    }

    /**
     * Process individual file
     */
    async processFile(filePath, stats, basePath) {
        const fileName = path.basename(filePath);
        const extension = path.extname(fileName).toLowerCase();
        const category = this.categorizeFile(fileName, extension);
        
        return {
            id: this.generateFileId(filePath),
            name: fileName,
            path: filePath,
            relativePath: path.relative(basePath, filePath),
            size: stats.size,
            extension: extension || 'no-extension',
            category: category,
            modified: stats.mtime,
            created: stats.birthtime,
            isHidden: fileName.startsWith('.'),
            isExecutable: this.isExecutableFile(extension),
            isArchive: this.isArchiveFile(extension),
            isMedia: this.isMediaFile(extension),
            isDocument: this.isDocumentFile(extension),
            isCode: this.isCodeFile(extension)
        };
    }

    /**
     * Update statistics
     */
    updateStats(result, fileInfo) {
        result.totalFiles++;
        result.totalSize += fileInfo.size;

        // Update categories
        if (!result.categories[fileInfo.category]) {
            result.categories[fileInfo.category] = { count: 0, size: 0 };
        }
        result.categories[fileInfo.category].count++;
        result.categories[fileInfo.category].size += fileInfo.size;

        // Update extension stats
        if (!result.extensionStats[fileInfo.extension]) {
            result.extensionStats[fileInfo.extension] = { count: 0, size: 0 };
        }
        result.extensionStats[fileInfo.extension].count++;
        result.extensionStats[fileInfo.extension].size += fileInfo.size;
    }

    /**
     * Apply filters to file
     */
    applyFilters(fileInfo, filters) {
        if (!filters || filters.length === 0) {
            return true;
        }

        for (const filter of filters) {
            switch (filter.type) {
                case 'extension':
                    if (!filter.values.includes(fileInfo.extension)) {
                        return false;
                    }
                    break;
                case 'category':
                    if (!filter.values.includes(fileInfo.category)) {
                        return false;
                    }
                    break;
                case 'size':
                    if (fileInfo.size < filter.min || fileInfo.size > filter.max) {
                        return false;
                    }
                    break;
                case 'date':
                    const fileDate = new Date(fileInfo.modified);
                    if (filter.after && fileDate < new Date(filter.after)) {
                        return false;
                    }
                    if (filter.before && fileDate > new Date(filter.before)) {
                        return false;
                    }
                    break;
                case 'name':
                    if (!fileInfo.name.toLowerCase().includes(filter.value.toLowerCase())) {
                        return false;
                    }
                    break;
            }
        }

        return true;
    }

    /**
     * Validate directory path
     */
    async validatePath(directoryPath) {
        if (!directoryPath) {
            throw new ValidationError('Directory path is required');
        }

        // Sanitize path to prevent directory traversal
        const normalizedPath = path.normalize(directoryPath);
        if (normalizedPath.includes('..') || normalizedPath.startsWith('/')) {
            throw new ValidationError('Invalid path. Directory traversal not allowed');
        }

        try {
            const stats = await fs.stat(directoryPath);
            if (!stats.isDirectory()) {
                throw new ValidationError('Path is not a directory');
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new ValidationError('Directory does not exist');
            }
            throw error;
        }
    }

    /**
     * Categorize file based on name and extension
     */
    categorizeFile(fileName, extension) {
        // AI/ML files
        if (this.isAIModelFile(fileName)) {
            return 'AI Models';
        }

        // Media files
        if (this.isMediaFile(extension)) {
            return this.getMediaCategory(extension);
        }

        // Code files
        if (this.isCodeFile(extension)) {
            return this.getCodeCategory(extension);
        }

        // Documents
        if (this.isDocumentFile(extension)) {
            return 'Documents';
        }

        // Archives
        if (this.isArchiveFile(extension)) {
            return 'Archives';
        }

        // System files
        if (this.isSystemFile(fileName)) {
            return 'System';
        }

        // Executables
        if (this.isExecutableFile(extension)) {
            return 'Executables';
        }

        // Databases
        if (this.isDatabaseFile(extension)) {
            return 'Databases';
        }

        // Web assets
        if (this.isWebFile(extension)) {
            return 'Web Assets';
        }

        // Fonts
        if (this.isFontFile(extension)) {
            return 'Fonts';
        }

        return 'Other';
    }

    // File type detection methods
    isAIModelFile(fileName) {
        const modelKeywords = ['model', 'checkpoint', 'weights', 'transformer', 'bert', 'gpt', 'llm', 'diffusion'];
        return modelKeywords.some(keyword => fileName.toLowerCase().includes(keyword));
    }

    isMediaFile(extension) {
        const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg', '.ico',
                                '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm',
                                '.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'];
        return mediaExtensions.includes(extension);
    }

    getMediaCategory(extension) {
        const imageExt = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp', '.svg', '.ico'];
        const videoExt = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm'];
        const audioExt = ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'];

        if (imageExt.includes(extension)) return 'Images';
        if (videoExt.includes(extension)) return 'Videos';
        if (audioExt.includes(extension)) return 'Audio';
        return 'Media';
    }

    isCodeFile(extension) {
        const codeExtensions = ['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.hpp',
                               '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala',
                               '.html', '.css', '.scss', '.sass', '.less', '.json', '.xml', '.yaml', '.yml',
                               '.sh', '.bash', '.ps1', '.bat', '.cmd', '.sql', '.r', '.m', '.lua'];
        return codeExtensions.includes(extension);
    }

    getCodeCategory(extension) {
        const languageMap = {
            '.py': 'Python',
            '.js': 'JavaScript',
            '.jsx': 'React/JavaScript',
            '.ts': 'TypeScript',
            '.tsx': 'React/TypeScript',
            '.java': 'Java',
            '.cpp': 'C++',
            '.c': 'C',
            '.h': 'C/C++ Header',
            '.hpp': 'C++ Header',
            '.cs': 'C#',
            '.php': 'PHP',
            '.rb': 'Ruby',
            '.go': 'Go',
            '.rs': 'Rust',
            '.swift': 'Swift',
            '.kt': 'Kotlin',
            '.scala': 'Scala',
            '.sh': 'Shell Script',
            '.bash': 'Bash Script',
            '.ps1': 'PowerShell',
            '.bat': 'Batch Script',
            '.cmd': 'Windows Command',
            '.sql': 'SQL',
            '.r': 'R',
            '.m': 'MATLAB/Objective-C',
            '.lua': 'Lua'
        };

        if (['.html', '.css', '.scss', '.sass', '.less'].includes(extension)) {
            return 'Web Development';
        }

        if (['.json', '.xml', '.yaml', '.yml'].includes(extension)) {
            return 'Configuration/Data';
        }

        return languageMap[extension] || 'Code';
    }

    isDocumentFile(extension) {
        const docExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
                              '.txt', '.rtf', '.odt', '.ods', '.odp', '.md', '.tex'];
        return docExtensions.includes(extension);
    }

    isArchiveFile(extension) {
        const archiveExtensions = ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz',
                                  '.tgz', '.tbz2', '.txz', '.iso', '.dmg'];
        return archiveExtensions.includes(extension);
    }

    isSystemFile(fileName) {
        const systemPatterns = ['system', 'kernel', 'driver', 'boot', 'config', 'registry', 'swap'];
        return systemPatterns.some(pattern => fileName.toLowerCase().includes(pattern));
    }

    isExecutableFile(extension) {
        const exeExtensions = ['.exe', '.msi', '.app', '.dmg', '.deb', '.rpm', '.apk', '.sh', '.bat', '.cmd'];
        return exeExtensions.includes(extension);
    }

    isDatabaseFile(extension) {
        const dbExtensions = ['.db', '.sqlite', '.sqlite3', '.mdb', '.accdb', '.dbf'];
        return dbExtensions.includes(extension);
    }

    isWebFile(extension) {
        const webExtensions = ['.ico', '.svg', '.woff', '.woff2', '.ttf', '.eot'];
        return webExtensions.includes(extension);
    }

    isFontFile(extension) {
        const fontExtensions = ['.ttf', '.otf', '.woff', '.woff2', '.eot'];
        return fontExtensions.includes(extension);
    }

    /**
     * Generate unique file ID
     */
    generateFileId(filePath) {
        const crypto = require('crypto');
        return crypto.createHash('md5').update(filePath).digest('hex');
    }

    /**
     * Get file statistics
     */
    async getFileStats(directoryPath) {
        try {
            const result = await this.scanDirectory(directoryPath, { recursive: true });
            
            return {
                totalFiles: result.totalFiles,
                totalSize: result.totalSize,
                categories: result.categories,
                extensionStats: result.extensionStats,
                largestFiles: result.files
                    .sort((a, b) => b.size - a.size)
                    .slice(0, 10)
                    .map(f => ({ name: f.name, size: f.size, path: f.path })),
                oldestFiles: result.files
                    .sort((a, b) => a.modified - b.modified)
                    .slice(0, 10)
                    .map(f => ({ name: f.name, modified: f.modified, path: f.path })),
                performance: result.performance
            };
        } catch (error) {
            throw await this.errorHandler.logError(error, { directoryPath }, 'error');
        }
    }

    /**
     * Find duplicate files
     */
    async findDuplicates(directoryPath) {
        try {
            const result = await this.scanDirectory(directoryPath, { recursive: true });
            const duplicates = [];
            const fileGroups = {};

            // Group files by size
            for (const file of result.files) {
                if (!fileGroups[file.size]) {
                    fileGroups[file.size] = [];
                }
                fileGroups[file.size].push(file);
            }

            // Find potential duplicates (same size)
            for (const [size, files] of Object.entries(fileGroups)) {
                if (files.length > 1) {
                    // Group by name pattern
                    const nameGroups = {};
                    for (const file of files) {
                        const nameKey = file.name.toLowerCase();
                        if (!nameGroups[nameKey]) {
                            nameGroups[nameKey] = [];
                        }
                        nameGroups[nameKey].push(file);
                    }

                    // Add groups with multiple files
                    for (const [name, group] of Object.entries(nameGroups)) {
                        if (group.length > 1) {
                            duplicates.push({
                                name: name,
                                size: parseInt(size),
                                files: group.map(f => ({
                                    path: f.path,
                                    modified: f.modified,
                                    size: f.size
                                })),
                                potentialSavings: (group.length - 1) * parseInt(size)
                            });
                        }
                    }
                }
            }

            return {
                duplicates: duplicates.sort((a, b) => b.potentialSavings - a.potentialSavings),
                totalGroups: duplicates.length,
                totalDuplicates: duplicates.reduce((sum, group) => sum + group.files.length - 1, 0),
                totalPotentialSavings: duplicates.reduce((sum, group) => sum + group.potentialSavings, 0)
            };
        } catch (error) {
            throw await this.errorHandler.logError(error, { directoryPath }, 'error');
        }
    }

    /**
     * Search files by pattern
     */
    async searchFiles(directoryPath, pattern, options = {}) {
        try {
            const result = await this.scanDirectory(directoryPath, { 
                recursive: options.recursive !== false 
            });
            
            const regex = new RegExp(pattern, 'i');
            const matches = result.files.filter(file => regex.test(file.name));
            
            return {
                pattern: pattern,
                matches: matches.map(f => ({
                    name: f.name,
                    path: f.path,
                    size: f.size,
                    category: f.category,
                    modified: f.modified
                })),
                totalMatches: matches.length,
                totalFiles: result.totalFiles
            };
        } catch (error) {
            throw await this.errorHandler.logError(error, { directoryPath, pattern, options }, 'error');
        }
    }
}

module.exports = FileScannerService;