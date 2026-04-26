// AI-Powered File Recommendations Engine
class AIFileRecommendations {
    constructor() {
        this.filePatterns = new Map();
        this.userBehavior = new Map();
        this.categories = {
            'code': ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.cs', '.go', '.rs'],
            'config': ['.json', '.yaml', '.yml', '.toml', '.ini', '.conf', '.env'],
            'docs': ['.md', '.txt', '.rst', '.doc', '.docx', '.pdf'],
            'media': ['.jpg', '.jpeg', '.png', '.gif', '.svg', '.mp4', '.mp3', '.wav'],
            'data': ['.csv', '.json', '.xml', '.sql', '.db', '.sqlite'],
            'build': ['.lock', '.log', '.cache', '.tmp', '.build', '.dist'],
            'test': ['.test.js', '.spec.js', '.test.ts', '.spec.ts', '__tests__'],
            'ai_models': ['.safetensors', '.pt', '.ckpt', '.pth', '.pkl', '.h5', '.pb', '.onnx', '.tflite'],
            'ml_data': ['.npz', '.npy', '.mat', '.arff', '.libsvm', '.pkl'],
            'archives': ['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz'],
            'executables': ['.exe', '.msi', '.app', '.deb', '.rpm', '.dmg', '.pkg'],
            'styles': ['.css', '.scss', '.sass', '.less', '.styl'],
            'images': ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp', '.ico', '.tiff', '.psd'],
            'videos': ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'],
            'audio': ['.mp3', '.wav', '.flac', '.aac', '.ogg', '.wma', '.m4a'],
            'documents': ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf', '.odt', 'pages']
        };
        this.initializeMLModel();
    }

    initializeMLModel() {
        // Simple ML model for file categorization
        this.mlModel = {
            features: ['extension', 'path_depth', 'name_pattern', 'size_category'],
            weights: {
                extension: 0.4,
                path_depth: 0.2,
                name_pattern: 0.3,
                size_category: 0.1
            }
        };
    }

    categorizeFile(filePath, size, name) {
        const ext = this.getExtension(filePath);
        const pathDepth = filePath.split('/').length;
        const namePattern = this.analyzeNamePattern(name);
        const sizeCategory = this.categorizeSize(size);

        // Calculate category scores
        const scores = {};
        for (const [category, extensions] of Object.entries(this.categories)) {
            let score = 0;
            
            // Extension matching (highest weight)
            if (extensions.includes(ext)) {
                score += this.mlModel.weights.extension * 100;
            }
            
            // Path pattern analysis
            if (this.matchesPathPattern(filePath, category)) {
                score += this.mlModel.weights.path_depth * 50;
            }
            
            // Name pattern analysis
            score += this.mlModel.weights.name_pattern * namePattern[category] || 0;
            
            // Size category
            score += this.mlModel.weights.size_category * sizeCategory[category] || 0;
            
            scores[category] = score;
        }

        return Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b)[0];
    }

    getExtension(filePath) {
        return filePath.split('.').pop().toLowerCase();
    }

    analyzeNamePattern(name) {
        const patterns = {
            'code': /app|main|index|lib|util|service|controller|model|view/i.test(name) ? 30 : 0,
            'config': /config|setting|env|package|requirements|setup/i.test(name) ? 30 : 0,
            'docs': /readme|doc|guide|manual|changelog|license/i.test(name) ? 25 : 0,
            'build': /lock|cache|tmp|temp|build|dist|out/i.test(name) ? 35 : 0,
            'test': /test|spec|mock|fixture|benchmark/i.test(name) ? 40 : 0,
            'ai_models': /model|network|encoder|decoder|generator|discriminator|checkpoint|safetensors|\.pt|\.ckpt|\.pth/i.test(name) ? 50 : 0,
            'ml_data': /dataset|training|validation|test|labels|features|samples|\.npz|\.npy|\.mat/i.test(name) ? 45 : 0,
            'archives': /archive|backup|compressed|zip|tar|rar/i.test(name) ? 35 : 0,
            'executables': /install|setup|launcher|run|start/i.test(name) ? 30 : 0,
            'styles': /style|theme|css|scss|sass|less/i.test(name) ? 25 : 0,
            'images': /image|img|photo|picture|icon|logo|banner|thumbnail/i.test(name) ? 30 : 0,
            'videos': /video|movie|clip|animation|recording/i.test(name) ? 30 : 0,
            'audio': /audio|sound|music|voice|speech|track/i.test(name) ? 25 : 0,
            'documents': /document|doc|report|paper|article|note|letter/i.test(name) ? 25 : 0
        };
        return patterns;
    }

    categorizeSize(size) {
        const categories = {
            'code': size < 100000 ? 10 : 5, // Prefer smaller files for code
            'config': size < 10000 ? 15 : 5, // Config files are usually small
            'docs': size < 1000000 ? 10 : 5,
            'media': size > 100000 ? 20 : 5, // Media files are larger
            'data': size > 10000 ? 15 : 5,
            'build': size > 50000 ? 25 : 10, // Build artifacts can be large
            'ai_models': size > 1000000 ? 30 : 20, // AI models are typically large (1MB+)
            'ml_data': size > 100000 ? 25 : 15, // ML datasets can be large
            'archives': size > 1000000 ? 30 : 20, // Archives are typically large
            'executables': size > 1000000 ? 25 : 15, // Executables are typically large
            'styles': size < 100000 ? 10 : 5, // Style files are usually small-medium
            'images': size > 50000 ? 20 : 10, // Images can vary in size
            'videos': size > 1000000 ? 30 : 20, // Videos are typically large
            'audio': size > 1000000 ? 25 : 15, // Audio files can be large
            'documents': size < 10000000 ? 15 : 10 // Documents are usually medium sized
        };
        return categories;
    }

    matchesPathPattern(filePath, category) {
        const patterns = {
            'code': /src|lib|components|utils|services/i,
            'config': /config|etc|settings/i,
            'docs': /docs|documentation|readme/i,
            'media': /assets|images|media|static/i,
            'data': /data|db|database/i,
            'build': /build|dist|out|target|cache/i,
            'test': /test|spec|__tests__/i,
            'ai_models': /models|checkpoints|weights|networks|safetensors|pytorch|tensorflow|onnx|huggingface/i,
            'ml_data': /datasets|training|validation|test|labels|features|samples|data|ml/i,
            'archives': /archive|backup|compressed/i,
            'executables': /install|setup|bin/i,
            'styles': /styles|css|scss|sass/i,
            'images': /images|img|photos|pictures|icons/i,
            'videos': /videos|movies|clips|animations/i,
            'audio': /audio|sound|music|voice/i,
            'documents': /docs|documents|papers|articles/i
        };
        return patterns[category]?.test(filePath) || false;
    }

    generateRecommendations(analysisData) {
        const recommendations = [];
        const { files = [], categories = {}, totalSize = 0 } = analysisData;

        // 1. Large file recommendations
        const largeFiles = files
            .filter(f => f.size > 10 * 1024 * 1024) // > 10MB
            .sort((a, b) => b.size - a.size)
            .slice(0, 5);

        if (largeFiles.length > 0) {
            recommendations.push({
                type: 'cleanup',
                priority: 'high',
                title: 'Large Files Detected',
                description: `Found ${largeFiles.length} files larger than 10MB`,
                action: 'review_large_files',
                files: largeFiles,
                potentialSavings: largeFiles.reduce((sum, f) => sum + f.size, 0)
            });
        }

        // 2. Duplicate file recommendations
        const duplicateExtensions = this.findPotentialDuplicates(files);
        if (duplicateExtensions.length > 0) {
            recommendations.push({
                type: 'organization',
                priority: 'medium',
                title: 'Potential Duplicate Files',
                description: `Found files with similar names that might be duplicates`,
                action: 'review_duplicates',
                files: duplicateExtensions,
                potentialSavings: duplicateExtensions.reduce((sum, f) => sum + f.size, 0) * 0.5
            });
        }

        // 3. Unused file recommendations
        const oldFiles = files
            .filter(f => {
                const daysSinceModified = (Date.now() - new Date(f.modified).getTime()) / (1000 * 60 * 60 * 24);
                return daysSinceModified > 365; // Older than 1 year
            })
            .sort((a, b) => new Date(a.modified) - new Date(b.modified))
            .slice(0, 10);

        if (oldFiles.length > 0) {
            recommendations.push({
                type: 'cleanup',
                priority: 'low',
                title: 'Old Unused Files',
                description: `Found ${oldFiles.length} files not modified in over a year`,
                action: 'review_old_files',
                files: oldFiles,
                potentialSavings: oldFiles.reduce((sum, f) => sum + f.size, 0)
            });
        }

        // 4. Code organization recommendations
        const codeFiles = files.filter(f => this.categories.code.includes(this.getExtension(f.path)));
        const unorganizedCode = this.findUnorganizedFiles(codeFiles);
        
        if (unorganizedCode.length > 0) {
            recommendations.push({
                type: 'organization',
                priority: 'medium',
                title: 'Code Organization',
                description: 'Some code files could be better organized',
                action: 'organize_code',
                files: unorganizedCode,
                suggestions: this.generateOrganizationSuggestions(unorganizedCode)
            });
        }

        // 5. Build artifact cleanup
        const buildArtifacts = files.filter(f => 
            this.categories.build.includes(this.getExtension(f.path)) ||
            /build|dist|cache|tmp/i.test(f.path)
        );

        if (buildArtifacts.length > 0) {
            const buildSize = buildArtifacts.reduce((sum, f) => sum + f.size, 0);
            recommendations.push({
                type: 'cleanup',
                priority: 'medium',
                title: 'Build Artifacts',
                description: `Build artifacts taking up ${this.formatBytes(buildSize)}`,
                action: 'cleanup_build_artifacts',
                files: buildArtifacts,
                potentialSavings: buildSize * 0.8 // 80% can usually be cleaned
            });
        }

        return recommendations.sort((a, b) => {
            const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    findPotentialDuplicates(files) {
        const nameGroups = new Map();
        
        files.forEach(file => {
            const baseName = file.name.toLowerCase().replace(/\.[^/.]+$/, ""); // Remove extension
            const key = baseName.replace(/[\d_-]/g, ''); // Remove numbers, dashes, underscores
            
            if (!nameGroups.has(key)) {
                nameGroups.set(key, []);
            }
            nameGroups.get(key).push(file);
        });

        const duplicates = [];
        for (const [key, group] of nameGroups) {
            if (group.length > 1) {
                duplicates.push(...group);
            }
        }

        return duplicates;
    }

    findUnorganizedFiles(codeFiles) {
        // Files in root or poorly organized locations
        return codeFiles.filter(file => {
            const pathParts = file.path.split('/');
            const depth = pathParts.length;
            
            // Files in root directory
            if (depth <= 2) return true;
            
            // Files with generic names in wrong locations
            const genericNames = ['index.js', 'app.js', 'main.js', 'utils.js', 'helper.js'];
            const name = pathParts[pathParts.length - 1];
            
            return genericNames.includes(name) && depth > 3;
        });
    }

    generateOrganizationSuggestions(unorganizedFiles) {
        const suggestions = [];
        const fileTypes = new Map();
        
        unorganizedFiles.forEach(file => {
            const ext = this.getExtension(file.path);
            if (!fileTypes.has(ext)) {
                fileTypes.set(ext, []);
            }
            fileTypes.get(ext).push(file);
        });

        for (const [ext, files] of fileTypes) {
            suggestions.push({
                extension: ext,
                count: files.length,
                suggestedLocation: this.getSuggestedLocation(ext),
                files: files.map(f => f.name)
            });
        }

        return suggestions;
    }

    getSuggestedLocation(extension) {
        const locations = {
            '.js': 'src/components/',
            '.ts': 'src/types/',
            '.jsx': 'src/components/',
            '.tsx': 'src/components/',
            '.css': 'src/styles/',
            '.scss': 'src/styles/',
            '.json': 'src/config/',
            '.md': 'docs/',
            '.test.js': 'tests/unit/',
            '.spec.js': 'tests/unit/',
            '.test.ts': 'tests/unit/',
            '.spec.ts': 'tests/unit/'
        };
        return locations[extension] || 'src/misc/';
    }

    formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
    }

    trackUserBehavior(action, fileData) {
        const timestamp = Date.now();
        if (!this.userBehavior.has(action)) {
            this.userBehavior.set(action, []);
        }
        this.userBehavior.get(action).push({
            timestamp,
            fileData
        });
        
        // Keep only last 100 actions per type
        const actions = this.userBehavior.get(action);
        if (actions.length > 100) {
            this.userBehavior.set(action, actions.slice(-100));
        }
    }

    getSmartSuggestions() {
        const suggestions = [];
        
        // Analyze user behavior patterns
        for (const [action, history] of this.userBehavior) {
            if (history.length > 5) {
                const recent = history.slice(-10);
                const patterns = this.analyzePatterns(recent);
                
                if (patterns.frequency > 0.7) {
                    suggestions.push({
                        type: 'habit',
                        action: action,
                        confidence: patterns.frequency,
                        suggestion: `You frequently ${action}, consider creating a shortcut`
                    });
                }
            }
        }
        
        return suggestions;
    }

    analyzePatterns(history) {
        const timeWindows = history.map(h => h.timestamp);
        const intervals = [];
        
        for (let i = 1; i < timeWindows.length; i++) {
            intervals.push(timeWindows[i] - timeWindows[i-1]);
        }
        
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const frequency = Math.min(1, history.length / 10); // Normalize to 0-1
        
        return {
            frequency,
            avgInterval,
            pattern: frequency > 0.5 ? 'regular' : 'occasional'
        };
    }

    // Optimized batch categorization for large datasets
    async categorizeFilesOptimized(files, options = {}) {
        const batchSize = options.batchSize || 50;
        const useCache = options.useCache !== false;
        const onProgress = options.onProgress || (() => {});
        const cache = new Map();
        
        console.log(`🔄 Starting optimized categorization of ${files.length} files...`);
        const startTime = Date.now();
        
        // Process files in batches for better memory management
        const batches = [];
        for (let i = 0; i < files.length; i += batchSize) {
            batches.push(files.slice(i, i + batchSize));
        }
        
        const results = [];
        let processedCount = 0;
        
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            
            // Report batch start progress
            onProgress(processedCount, files.length, `Processing batch ${batchIndex + 1}/${batches.length}...`);
            
            const batchPromises = batch.map((file, index) => {
                return new Promise(resolve => {
                    // Use caching for repeated files
                    const cacheKey = `${file.path}-${file.size}-${file.name}`;
                    if (useCache && cache.has(cacheKey)) {
                        return cache.get(cacheKey);
                    }
                    
                    // Simulate some processing time for better progress visibility
                    setTimeout(() => {
                        const category = this.categorizeFile(file.path, file.size, file.name);
                        const result = { ...file, category };
                        
                        if (useCache) {
                            cache.set(cacheKey, result);
                        }
                        
                        // Report individual file progress
                        const currentProcessed = processedCount + index + 1;
                        const fileName = file.name || file.path.split('/').pop() || 'unknown';
                        onProgress(currentProcessed, files.length, fileName);
                        
                        resolve(result);
                    }, Math.random() * 10); // Small random delay for visibility
                });
            });
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
            processedCount += batch.length;
            
            // Brief pause between batches for UI updates
            if (batchIndex < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }
        
        const categorizationTime = Date.now() - startTime;
        console.log(`✅ Optimized categorization completed: ${files.length} files in ${categorizationTime}ms`);
        
        // Aggregate categories
        const categories = {};
        results.forEach(file => {
            if (!categories[file.category]) {
                categories[file.category] = {
                    count: 0,
                    size: 0,
                    files: []
                };
            }
            categories[file.category].count++;
            categories[file.category].size += file.size || 0;
            categories[file.category].files.push(file);
        });
        
        // Calculate total size
        const totalSize = results.reduce((sum, file) => sum + (file.size || 0), 0);
        
        return {
            categorizedFiles: results,
            categories,
            totalSize,
            categorizationTime,
            performance: {
                filesPerSecond: Math.round(files.length / (categorizationTime / 1000)),
                cacheHitRate: useCache ? (cache.size / files.length) : 0,
                batchesProcessed: batches.length
            }
        };
    }
}

module.exports = AIFileRecommendations;
