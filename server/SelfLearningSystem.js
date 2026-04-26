const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class SelfLearningSystem {
    constructor(baseDir) {
        this.baseDir = baseDir || path.join(__dirname, 'learning');
        this.cacheFile = path.join(this.baseDir, 'cache.json');
        this.historyFile = path.join(this.baseDir, 'history.json');
        
        // Ensure directories exist
        if (!fs.existsSync(this.baseDir)) fs.mkdirSync(this.baseDir, { recursive: true });
        
        // Load data
        this.cache = this.loadJSON(this.cacheFile) || {};
        this.history = this.loadJSON(this.historyFile) || [];
        
        console.log(`🧠 SelfLearningSystem initialized. Cache size: ${Object.keys(this.cache).length}`);
    }

    loadJSON(filepath) {
        try {
            if (fs.existsSync(filepath)) {
                return JSON.parse(fs.readFileSync(filepath, 'utf8'));
            }
        } catch (e) {
            console.error(`Failed to load ${filepath}:`, e);
        }
        return null;
    }

    saveJSON(filepath, data) {
        try {
            fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        } catch (e) {
            console.error(`Failed to save ${filepath}:`, e);
        }
    }

    generateHash(text) {
        return crypto.createHash('md5').update(text).digest('hex');
    }

    /**
     * Get a cached response if valid
     */
    async getCachedResponse(question, contextHash) {
        const key = this.generateHash(question + (contextHash || ''));
        const entry = this.cache[key];
        
        if (entry) {
            // Optional: Check expiry or relevance score
            console.log(`🧠 Cache HIT for: "${question.substring(0, 30)}..."`);
            entry.lastAccessed = Date.now();
            entry.hits = (entry.hits || 0) + 1;
            await this.saveCache(); // Persist hit count
            return entry.response;
        }
        
        console.log(`🧠 Cache MISS for: "${question.substring(0, 30)}..."`);
        return null;
    }

    /**
     * Add a Q&A pair to the cache
     */
    async addQA(question, response, contextHash, modelName) {
        const key = this.generateHash(question + (contextHash || ''));
        
        this.cache[key] = {
            question,
            response,
            contextHash,
            model: modelName,
            timestamp: Date.now(),
            lastAccessed: Date.now(),
            hits: 1
        };
        
        await this.saveCache();
        await this.addToHistory(question, response, modelName);
    }

    /**
     * Add to conversation history log
     */
    async addToHistory(question, response, model) {
        this.history.push({
            timestamp: Date.now(),
            question,
            responseLength: response.length,
            model
        });
        
        // Limit history to last 1000 entries
        if (this.history.length > 1000) {
            this.history = this.history.slice(-1000);
        }
        
        await this.saveHistory();
    }

    async saveCache() {
        this.saveJSON(this.cacheFile, this.cache);
    }

    async saveHistory() {
        this.saveJSON(this.historyFile, this.history);
    }

    getStats() {
        return {
            cacheSize: Object.keys(this.cache).length,
            historySize: this.history.length,
            totalHits: Object.values(this.cache).reduce((sum, item) => sum + (item.hits || 0), 0)
        };
    }
}

module.exports = SelfLearningSystem;
