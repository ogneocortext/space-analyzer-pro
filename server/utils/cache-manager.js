/**
 * Cache Manager
 * Multi-layer caching system for analysis results with LRU eviction
 * Combines in-memory cache with database persistence
 */

const crypto = require("crypto");

class CacheManager {
  constructor(options = {}) {
    // In-memory cache with TTL
    this.memoryCache = new Map();
    this.ttls = new Map();
    this.accessTimes = new Map();

    // Configuration
    this.maxSize = options.maxSize || 100; // Max cached analyses
    this.defaultTTL = options.defaultTTL || 24 * 60 * 60 * 1000; // 24 hours
    this.cleanupInterval = options.cleanupInterval || 5 * 60 * 1000; // 5 minutes

    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      dbSaves: 0,
      dbLoads: 0,
    };

    // Start cleanup interval
    this.startCleanupInterval();

    console.log("📦 Cache Manager initialized");
    console.log(`   Max size: ${this.maxSize}, TTL: ${this.defaultTTL / 1000 / 60} minutes`);
  }

  /**
   * Generate cache key from directory path
   */
  generateKey(directoryPath, options = {}) {
    const normalizedPath = directoryPath.toLowerCase().replace(/\\/g, "/");
    const optionsHash = Object.keys(options).length > 0
      ? crypto.createHash("md5").update(JSON.stringify(options)).digest("hex").slice(0, 8)
      : "default";
    return `${normalizedPath}:${optionsHash}`;
  }

  /**
   * Get item from cache (memory first, then try callback)
   */
  async get(key, dbLoader = null) {
    // Check memory cache
    if (this.memoryCache.has(key)) {
      const ttl = this.ttls.get(key);
      if (ttl && Date.now() > ttl) {
        // Expired
        this.delete(key);
      } else {
        // Cache hit
        this.accessTimes.set(key, Date.now());
        this.stats.hits++;
        return {
          data: this.memoryCache.get(key),
          source: "memory",
        };
      }
    }

    // Cache miss - try database loader
    this.stats.misses++;

    if (dbLoader) {
      try {
        const dbData = await dbLoader();
        if (dbData) {
          this.stats.dbLoads++;
          // Store in memory cache
          this.set(key, dbData);
          return {
            data: dbData,
            source: "database",
          };
        }
      } catch (error) {
        console.warn("Cache DB loader failed:", error.message);
      }
    }

    return null;
  }

  /**
   * Store item in cache
   */
  set(key, data, ttl = null) {
    // Enforce max size with LRU eviction
    if (this.memoryCache.size >= this.maxSize && !this.memoryCache.has(key)) {
      this.evictLRU();
    }

    // Store in memory
    this.memoryCache.set(key, data);
    this.ttls.set(key, Date.now() + (ttl || this.defaultTTL));
    this.accessTimes.set(key, Date.now());

    return true;
  }

  /**
   * Delete item from cache
   */
  delete(key) {
    this.memoryCache.delete(key);
    this.ttls.delete(key);
    this.accessTimes.delete(key);
  }

  /**
   * Evict least recently used item
   */
  evictLRU() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, time] of this.accessTimes.entries()) {
      if (time < oldestTime) {
        oldestTime = time;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
      this.stats.evictions++;
      console.log(`🗑️ Cache eviction: ${oldestKey}`);
    }
  }

  /**
   * Clear expired items
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, ttl] of this.ttls.entries()) {
      if (now > ttl) {
        this.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 Cache cleanup: ${cleaned} expired items removed`);
    }

    return cleaned;
  }

  /**
   * Start automatic cleanup interval
   */
  startCleanupInterval() {
    setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(1)
      : 0;

    return {
      ...this.stats,
      size: this.memoryCache.size,
      maxSize: this.maxSize,
      hitRate: `${hitRate}%`,
    };
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.memoryCache.clear();
    this.ttls.clear();
    this.accessTimes.clear();
    console.log("🧹 Cache cleared");
  }

  /**
   * Check if key exists in cache (and not expired)
   */
  has(key) {
    if (!this.memoryCache.has(key)) return false;

    const ttl = this.ttls.get(key);
    if (ttl && Date.now() > ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }
}

module.exports = CacheManager;
