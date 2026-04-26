// Advanced Search Engine with Fuzzy Search and AI Relevance Ranking
class AdvancedSearchEngine {
    constructor() {
        this.searchHistory = [];
        this.userPreferences = new Map();
        this.aiWeights = {
            exactMatch: 1.0,
            fuzzyMatch: 0.8,
            pathMatch: 0.6,
            categoryMatch: 0.4,
            recentAccess: 0.3,
            userPreference: 0.5
        };
        this.initializeFuzzySearch();
    }

    initializeFuzzySearch() {
        // Simple fuzzy search implementation
        this.fuzzyOptions = {
            includeScore: true,
            threshold: 0.3,
            ignoreCase: true,
            ignoreLocation: true,
            distance: 100,
            keys: ['name', 'path', 'category', 'extension']
        };
    }

    // Fuzzy search implementation
    fuzzySearch(query, items) {
        console.log(`🔍 Fuzzy search: query="${query}", items=${items.length}`);
        const results = [];
        const queryLower = query.toLowerCase();
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item) {
                console.log(`⚠️  Skipping null item at index ${i}`);
                continue;
            }
            
            if (!item.name) {
                console.log(`⚠️  Skipping item without name at index ${i}:`, Object.keys(item));
                continue;
            }
            
            try {
                const score = this.calculateFuzzyScore(queryLower, item);
                if (score > 0) {
                    results.push({
                        ...item,
                        _searchScore: score,
                        _matchType: this.getMatchType(queryLower, item)
                    });
                }
            } catch (error) {
                console.error(`❌ Error processing item ${i}:`, error.message);
                continue;
            }
        }
        
        console.log(`🔍 Fuzzy search results: ${results.length} items`);
        return results.sort((a, b) => b._searchScore - a._searchScore);
    }

    calculateFuzzyScore(query, item) {
        if (!item || !item.name) {
            console.log(`⚠️  calculateFuzzyScore: invalid item or name`);
            return 0;
        }
        
        let score = 0;
        
        // Exact name match
        if (item.name.toLowerCase() === query) {
            score += this.aiWeights.exactMatch * 100;
            console.log(`🔍 Exact name match: ${item.name} (score: ${score})`);
        }
        
        // Partial name match
        if (item.name.toLowerCase().includes(query)) {
            score += this.aiWeights.fuzzyMatch * 50;
            console.log(`🔍 Partial name match: ${item.name} (score: ${score})`);
        }
        
        // Fuzzy name match (character by character)
        const fuzzyScore = this.levenshteinDistance(query, item.name.toLowerCase());
        if (fuzzyScore < query.length * 0.6) {
            score += this.aiWeights.fuzzyMatch * (60 - fuzzyScore);
            console.log(`🔍 Fuzzy name match: ${item.name} (score: ${score})`);
        }
        
        // Path match
        if (item.path.toLowerCase().includes(query)) {
            score += this.aiWeights.pathMatch * 40;
            console.log(`🔍 Path match: ${item.path} (score: ${score})`);
        }
        
        // Category match
        if (item.category && item.category.toLowerCase().includes(query)) {
            score += this.aiWeights.categoryMatch * 30;
        }
        
        // Extension match
        if (item.extension && item.extension.toLowerCase().includes(query)) {
            score += this.aiWeights.categoryMatch * 20;
        }
        
        return Math.max(0, score);
    }

    getMatchType(query, item) {
        if (item.name.toLowerCase() === query) return 'exact';
        if (item.name.toLowerCase().includes(query)) return 'partial';
        if (item.path.toLowerCase().includes(query)) return 'path';
        if (item.category && item.category.toLowerCase().includes(query)) return 'category';
        return 'fuzzy';
    }

    // Levenshtein distance for fuzzy matching
    levenshteinDistance(str1, str2) {
        // Handle edge cases
        if (!str1 || !str2) {
            return str1 ? str1.length : str2 ? str2.length : 0;
        }
        
        if (str1 === str2) return 0;
        
        const matrix = [];
        
        // Initialize first row (for str2)
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        // Initialize first column (for str1) - ensure matrix[0] exists
        if (!matrix[0]) {
            matrix[0] = [];
        }
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str1.length; i++) {
            // Ensure matrix[i] exists
            if (!matrix[i]) {
                matrix[i] = [];
            }
            
            for (let j = 1; j <= str2.length; j++) {
                if (str1.charAt(i - 1) === str2.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str1.length][str2.length];
    }

    // AI-powered relevance ranking
    rankByRelevance(searchResults, query, userContext = {}) {
        return searchResults.map(result => {
            let relevanceScore = result._searchScore || 0;
            
            // File size relevance (smaller files often more relevant for code)
            if (result.size) {
                const sizeScore = this.calculateSizeRelevance(result.size, query);
                relevanceScore += sizeScore * 0.2;
            }
            
            // Recent access boost
            const accessScore = this.calculateAccessRelevance(result, userContext);
            relevanceScore += accessScore * 0.3;
            
            // User preference boost
            const preferenceScore = this.calculatePreferenceRelevance(result, query);
            relevanceScore += preferenceScore * 0.5;
            
            // AI semantic relevance (if available)
            const semanticScore = this.calculateSemanticRelevance(query, result);
            relevanceScore += semanticScore * 0.4;
            
            return {
                ...result,
                _relevanceScore: relevanceScore,
                _relevanceFactors: {
                    search: result._searchScore,
                    size: this.calculateSizeRelevance(result.size, query),
                    access: accessScore,
                    preference: preferenceScore,
                    semantic: semanticScore
                }
            };
        }).sort((a, b) => b._relevanceScore - a._relevanceScore);
    }

    calculateSizeRelevance(size, query) {
        // Different queries have different size preferences
        const sizeKB = size / 1024;
        
        if (query.includes('config') || query.includes('setting')) {
            // Config files are usually small
            return sizeKB < 10 ? 20 : Math.max(0, 10 - sizeKB);
        }
        
        if (query.includes('test') || query.includes('spec')) {
            // Test files are usually small to medium
            return sizeKB < 50 ? 15 : Math.max(0, 15 - sizeKB / 10);
        }
        
        if (query.includes('image') || query.includes('media')) {
            // Media files are usually larger
            return sizeKB > 100 ? 15 : Math.min(15, sizeKB / 10);
        }
        
        // Default: slight preference for smaller files
        return Math.max(0, 10 - Math.log10(sizeKB + 1));
    }

    calculateAccessRelevance(result, userContext) {
        const now = Date.now();
        const lastAccess = new Date(result.lastAccessed || result.modified || 0).getTime();
        const daysSinceAccess = (now - lastAccess) / (1000 * 60 * 60 * 24);
        
        // Recent files get higher scores
        if (daysSinceAccess < 1) return 20;
        if (daysSinceAccess < 7) return 15;
        if (daysSinceAccess < 30) return 10;
        if (daysSinceAccess < 90) return 5;
        return 0;
    }

    calculatePreferenceRelevance(result, query) {
        if (!result) return 0;
        
        const ext = result.extension || '';
        const preferences = this.userPreferences.get(ext) || {};
        
        let score = 0;
        
        // User's preferred file types
        if (preferences.preferred) {
            score += preferences.preferred ? 10 : 0;
        }
        
        // User's frequently accessed files
        if (preferences.frequency && preferences.frequency > 5) {
            score += Math.min(10, preferences.frequency);
        }
        
        // User's search history
        if (Array.isArray(this.searchHistory) && this.searchHistory.length > 0) {
            const recentSearches = this.searchHistory.slice(-10);
            const similarSearches = recentSearches.filter(search => 
                search && search.query && this.levenshteinDistance(search.query.toLowerCase(), query.toLowerCase()) < 2
            );
            
            if (similarSearches.length > 0) {
                score += 5;
            }
        }
        
        return score;
    }

    calculateSemanticRelevance(query, result) {
        // Simple semantic analysis based on keywords and context
        const queryWords = query.toLowerCase().split(/\s+/);
        const resultWords = [
            result.name.toLowerCase(),
            result.path.toLowerCase(),
            result.category ? result.category.toLowerCase() : ''
        ].join(' ');
        
        let semanticScore = 0;
        
        // Keyword matching
        for (const queryWord of queryWords) {
            for (const resultWord of resultWords.split(/\s+/)) {
                if (resultWord.includes(queryWord)) {
                    semanticScore += 2;
                }
                
                // Synonym matching (simplified)
                const synonyms = this.getSynonyms(queryWord);
                for (const synonym of synonyms) {
                    if (resultWord.includes(synonym)) {
                        semanticScore += 1;
                    }
                }
            }
        }
        
        // Context matching
        if (this.matchesContext(query, result)) {
            semanticScore += 10;
        }
        
        return Math.min(20, semanticScore);
    }

    getSynonyms(word) {
        const synonymMap = {
            'config': ['setting', 'option', 'parameter'],
            'test': ['spec', 'mock', 'fixture'],
            'image': ['picture', 'photo', 'graphic'],
            'document': ['doc', 'file', 'text'],
            'component': ['part', 'module', 'widget'],
            'style': ['css', 'stylesheet', 'design'],
            'script': ['code', 'js', 'function'],
            'data': ['info', 'content', 'information']
        };
        
        return synonymMap[word] || [];
    }

    matchesContext(query, result) {
        // Context-aware matching
        const contexts = {
            'src': ['component', 'module', 'service', 'util'],
            'test': ['spec', 'mock', 'fixture'],
            'config': ['setting', 'option', 'env'],
            'docs': ['readme', 'guide', 'manual'],
            'build': ['dist', 'output', 'target']
        };
        
        for (const [context, keywords] of Object.entries(contexts)) {
            if (result.path.includes(context) && 
                keywords.some(keyword => query.includes(keyword))) {
                return true;
            }
        }
        
        return false;
    }

    // Smart search suggestions
    getSearchSuggestions(query, allFiles) {
        const suggestions = [];
        const queryLower = query.toLowerCase();
        
        // 1. Autocomplete suggestions
        const fileNames = [...new Set(allFiles.map(f => f.name.toLowerCase()))];
        const matches = fileNames.filter(name => name.startsWith(queryLower));
        
        suggestions.push(...matches.slice(0, 5).map(name => ({
            type: 'autocomplete',
            text: name,
            description: 'File name match'
        })));
        
        // 2. Spelling corrections
        const corrections = this.getSpellingCorrections(queryLower, fileNames);
        suggestions.push(...corrections.slice(0, 3).map(correction => ({
            type: 'correction',
            text: correction,
            description: 'Did you mean?'
        })));
        
        // 3. Related searches
        const related = this.getRelatedSearches(query);
        suggestions.push(...related.slice(0, 3).map(related => ({
            type: 'related',
            text: related,
            description: 'Related search'
        })));
        
        return suggestions.slice(0, 8);
    }

    getSpellingCorrections(query, fileNames) {
        if (!query) return [];
        const corrections = [];
        const minDistance = 2;
        
        for (const name of fileNames) {
            const distance = this.levenshteinDistance(query, name);
            if (distance > 0 && distance <= minDistance) {
                corrections.push({
                    name,
                    distance
                });
            }
        }
        
        return corrections
            .sort((a, b) => a.distance - b.distance)
            .map(c => c.name);
    }

    getRelatedSearches(query) {
        // Extract common patterns and suggest related searches
        const patterns = {
            'config': ['setting', 'option', 'parameter', 'env'],
            'test': ['spec', 'mock', 'fixture', 'unit'],
            'component': ['module', 'part', 'widget', 'element'],
            'service': ['api', 'handler', 'controller', 'route'],
            'util': ['helper', 'function', 'method', 'tool']
        };
        
        const related = [];
        for (const [pattern, suggestions] of Object.entries(patterns)) {
            if (query.includes(pattern)) {
                related.push(...suggestions);
            }
        }
        
        return [...new Set(related)];
    }

    // Search with AI enhancement - optimized for large datasets
    async search(query, files, options = {}) {
        const {
            limit = 50,
            includeSemantic = true,
            userContext = {},
            filters = {},
            batchSize = 500  // Reduced batch size for better memory management
        } = options;
        
        // Validate inputs
        if (!query || typeof query !== 'string') {
            return {
                results: [],
                suggestions: [],
                total: 0,
                query: query || '',
                timestamp: new Date().toISOString(),
                searchId: this.generateSearchId(),
                error: 'Invalid query'
            };
        }
        
        if (!files || !Array.isArray(files)) {
            return {
                results: [],
                suggestions: [],
                total: 0,
                query: query,
                timestamp: new Date().toISOString(),
                searchId: this.generateSearchId(),
                error: 'Invalid files array'
            };
        }
        
        console.log(`🔍 Search: "${query}" with ${files.length} files`);
        
        // Record search
        this.recordSearch(query);
        
        // Apply filters
        let filteredFiles = files.filter(file => file && typeof file === 'object' && file.name);
        console.log(`📊 Filtered to ${filteredFiles.length} valid files`);
        
        if (filters.category) {
            filteredFiles = filteredFiles.filter(f => f.category === filters.category);
        }
        if (filters.extension) {
            filteredFiles = filteredFiles.filter(f => f.extension === filters.extension);
        }
        if (filters.size) {
            filteredFiles = filteredFiles.filter(f => {
                switch (filters.size) {
                    case 'small': return f.size < 1024 * 10; // < 10KB
                    case 'medium': return f.size >= 1024 * 10 && f.size < 1024 * 1024; // 10KB - 1MB
                    case 'large': return f.size >= 1024 * 1024; // > 1MB
                    default: return true;
                }
            });
        }
        
        // Optimized batch processing for large datasets
        let allResults = [];
        const totalBatches = Math.ceil(filteredFiles.length / batchSize);
        let processedBatches = 0;
        
        // Early exit optimization - if we have enough results, stop early
        const targetResults = Math.min(limit * 3, 1000); // Get more than needed but cap at 1000
        
        for (let i = 0; i < totalBatches; i++) {
            const startIdx = i * batchSize;
            const endIdx = Math.min(startIdx + batchSize, filteredFiles.length);
            const batch = filteredFiles.slice(startIdx, endIdx);
            
            console.log(`🔄 Processing batch ${i + 1}/${totalBatches} (${batch.length} files)`);
            
            // Process batch with optimized fuzzy search
            const batchResults = this.optimizedFuzzySearch(query, batch);
            
            // Safety check: ensure batchResults is an array
            if (batchResults && Array.isArray(batchResults)) {
                allResults.push(...batchResults);
            } else {
                console.log(`⚠️  Batch ${i + 1} returned invalid results:`, typeof batchResults);
            }
            
            processedBatches++;
            
            // Early exit if we have enough results
            if (allResults.length >= targetResults) {
                console.log(`📊 Found sufficient results (${allResults.length}), stopping early`);
                break;
            }
            
            // Allow garbage collection between batches
            if (i % 10 === 0) { // Every 10 batches
                if (global.gc) {
                    global.gc();
                }
                // Small delay to allow event loop processing
                await new Promise(resolve => setImmediate(resolve));
            }
        }
        
        console.log(`🔍 Fuzzy search found ${allResults.length} total results`);
        
        // Apply AI relevance ranking (with memory optimization)
        let results = allResults;
        if (includeSemantic && results.length > 0) {
            try {
                // Only rank the top results to save memory
                const rankingLimit = Math.min(results.length, 500);
                const toRank = results.slice(0, rankingLimit);
                const ranked = this.rankByRelevance(toRank, query, userContext);
                
                // Combine ranked and unranked results
                results = [...ranked, ...results.slice(rankingLimit)];
                console.log(`🤖 Applied relevance ranking to ${toRank.length} results`);
            } catch (error) {
                console.error('❌ Relevance ranking failed:', error.message);
                // Continue without ranking
            }
        }
        
        // Apply limit
        results = results.slice(0, limit);
        
        // Get suggestions (use smaller sample for memory efficiency)
        const suggestionSample = filteredFiles.slice(0, 500);
        const suggestions = this.getSearchSuggestions(query, suggestionSample);
        
        return {
            results,
            suggestions,
            total: results.length,
            query,
            timestamp: new Date().toISOString(),
            searchId: this.generateSearchId(),
            metadata: {
                totalFilesProcessed: filteredFiles.length,
                batchesProcessed: processedBatches,
                batchSize: batchSize,
                earlyExit: allResults.length >= targetResults
            }
        };
    }

    // Optimized fuzzy search for large datasets
    optimizedFuzzySearch(query, items) {
        const results = [];
        const queryLower = query.toLowerCase();
        
        console.log(`🔍 Optimized search: query="${query}", items=${items.length}`);
        
        try {
            // Handle OR operators - split by OR and process each term
            // Use non-capturing regex to avoid undefined elements
            console.log(`🔍 Splitting query by OR...`);
            const orTerms = queryLower.split(/\s+or\s+/i);
            console.log(`🔍 OR terms:`, orTerms);
            
            const allQueryWords = [];
            
            orTerms.forEach((term, index) => {
                console.log(`🔍 Processing term ${index}: "${term}"`);
                const words = term.trim().split(/\s+/).filter(word => word && word.length > 0);
                console.log(`🔍 Words from term ${index}:`, words);
                allQueryWords.push(...words);
            });
            
            console.log(`🔍 All query words before filtering:`, allQueryWords);
            
            // Remove duplicates and empty strings
            const queryWords = [...new Set(allQueryWords)].filter(word => word && word !== 'or');
            
            console.log(`🔍 Final query words: [${queryWords.join(', ')}]`);
            
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (!item || !item.name) {
                    console.log(`⚠️  Skipping invalid item ${i}`);
                    continue;
                }
                
                // Quick pre-filter using simple includes check
                const hasMatch = queryWords.some(word => {
                    try {
                        return item.name.toLowerCase().includes(word) ||
                               item.path.toLowerCase().includes(word) ||
                               (item.category && item.category.toLowerCase().includes(word));
                    } catch (error) {
                        console.error(`❌ Error checking match for item ${i}:`, error.message);
                        return false;
                    }
                });
                
                if (!hasMatch) continue;
                
                try {
                    const score = this.calculateOptimizedFuzzyScore(queryLower, item);
                    if (score > 0) {
                        results.push({
                            ...item,
                            _searchScore: score,
                            _matchType: this.getMatchType(queryLower, item)
                        });
                    }
                } catch (error) {
                    console.error(`❌ Error processing item ${i}:`, error.message);
                    continue;
                }
            }
            
            console.log(`🔍 Optimized search results: ${results.length} items`);
            return results.sort((a, b) => b._searchScore - a._searchScore);
            
        } catch (error) {
            console.error('❌ Error in optimizedFuzzySearch:', error);
            console.error('❌ Stack trace:', error.stack);
            return []; // Return empty array on error
        }
    }

    // Optimized fuzzy score calculation
    calculateOptimizedFuzzyScore(query, item) {
        if (!item || !item.name) return 0;
        
        let score = 0;
        const queryLower = query.toLowerCase();
        const nameLower = item.name.toLowerCase();
        
        // Exact name match (highest priority)
        if (nameLower === queryLower) {
            score += 100;
        }
        
        // Partial name match
        if (nameLower.includes(queryLower)) {
            score += 50;
        }
        
        // Path match
        if (item.path.toLowerCase().includes(queryLower)) {
            score += 30;
        }
        
        // Category match
        if (item.category && item.category.toLowerCase().includes(queryLower)) {
            score += 20;
        }
        
        // Extension match
        if (item.extension && item.extension.toLowerCase().includes(queryLower)) {
            score += 15;
        }
        
        // Only use Levenshtein for short strings to avoid performance issues
        if (query.length <= 20 && item.name.length <= 50) {
            try {
                const fuzzyScore = this.levenshteinDistance(queryLower, nameLower);
                if (fuzzyScore < query.length * 0.6) {
                    score += Math.max(0, 30 - fuzzyScore);
                }
            } catch (error) {
                // Skip Levenshtein if it fails
            }
        }
        
        return Math.max(0, score);
    }

    recordSearch(query) {
        this.searchHistory.push({
            query,
            timestamp: Date.now()
        });
        
        // Keep only last 100 actions per type
        if (this.searchHistory.length > 100) {
            this.searchHistory = this.searchHistory.slice(-100);
        }
    }

    updateUserPreferences(fileExtension, preferences) {
        const current = this.userPreferences.get(fileExtension) || {};
        this.userPreferences.set(fileExtension, {
            ...current,
            ...preferences,
            lastUpdated: Date.now()
        });
    }

    generateSearchId() {
        return 'search_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Advanced search operators
    parseAdvancedQuery(query) {
        const operators = {
            exact: /"([^"]+)"/g,
            exclude: /-([^\s]+)/g,
            extension: /ext:([^\s]+)/g,
            size: /size:(>[^\s]+)/g,
            path: /path:([^\s]+)/g
        };
        
        const parsed = {
            query: query,
            exact: [],
            exclude: [],
            extension: null,
            size: null,
            path: null
        };
        
        let match;
        while ((match = operators.exact.exec(query)) !== null) {
            parsed.exact.push(match[1]);
            parsed.query = parsed.query.replace(match[0], '');
        }
        
        while ((match = operators.exclude.exec(query)) !== null) {
            parsed.exclude.push(match[1]);
            parsed.query = parsed.query.replace(match[0], '');
        }
        
        while ((match = operators.extension.exec(query)) !== null) {
            parsed.extension = match[1];
            parsed.query = parsed.query.replace(match[0], '');
        }
        
        while ((match = operators.size.exec(query)) !== null) {
            parsed.size = match[1];
            parsed.query = parsed.query.replace(match[0], '');
        }
        
        while ((match = operators.path.exec(query)) !== null) {
            parsed.path = match[1];
            parsed.query = parsed.query.replace(match[0], '');
        }
        
        parsed.query = parsed.query.trim();
        return parsed;
    }
}

module.exports = AdvancedSearchEngine;
