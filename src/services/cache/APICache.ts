export interface CacheItem<T = any> {
  data: T;
  timestamp: number;
  ttl?: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of items in cache
}

export class APICache {
  private cache = new Map<string, CacheItem>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes
  private maxSize = 100;

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = options.ttl ?? this.defaultTTL;
    this.maxSize = options.maxSize ?? this.maxSize;
  }

  /**
   * Set data in cache with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTTL
    });
  }

  /**
   * Get data from cache if not expired
   */
  get<T>(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) return null;

    const isExpired = Date.now() - item.timestamp > (item.ttl || this.defaultTTL);

    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    // Update access timestamp for LRU
    item.timestamp = Date.now();
    return item.data;
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const item = this.cache.get(key);
    if (!item) return false;

    const isExpired = Date.now() - item.timestamp > (item.ttl || this.defaultTTL);
    if (isExpired) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete specific key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear cache or invalidate by pattern
   */
  invalidate(pattern?: string | RegExp): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (typeof pattern === 'string') {
        if (key.includes(pattern)) {
          keysToDelete.push(key);
        }
      } else {
        if (pattern.test(key)) {
          keysToDelete.push(key);
        }
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now();
    let expiredCount = 0;
    let validCount = 0;

    for (const [key, item] of this.cache.entries()) {
      const isExpired = now - item.timestamp > (item.ttl || this.defaultTTL);
      if (isExpired) {
        expiredCount++;
      } else {
        validCount++;
      }
    }

    return {
      total: this.cache.size,
      valid: validCount,
      expired: expiredCount,
      maxSize: this.maxSize,
      hitRate: this.calculateHitRate()
    };
  }

  /**
   * Get all cache keys
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Clean up expired items
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, item] of this.cache.entries()) {
      const isExpired = now - item.timestamp > (item.ttl || this.defaultTTL);
      if (isExpired) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Set default TTL for all future items
   */
  setDefaultTTL(ttl: number): void {
    this.defaultTTL = ttl;
  }

  /**
   * Set maximum cache size
   */
  setMaxSize(maxSize: number): void {
    this.maxSize = maxSize;

    // Evict items if current size exceeds new max
    while (this.cache.size > maxSize) {
      this.evictLRU();
    }
  }

  /**
   * Evict least recently used item
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Calculate cache hit rate (simplified)
   */
  private calculateHitRate(): number {
    // This is a simplified calculation
    // In a real implementation, you'd track hits/misses
    const validItems = Array.from(this.cache.values()).filter(item => {
      const isExpired = Date.now() - item.timestamp > (item.ttl || this.defaultTTL);
      return !isExpired;
    });

    return validItems.length / this.cache.size || 0;
  }
}

// Default cache instance
export const apiCache = new APICache({
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 100
});

// Specialized cache for file operations
export const fileCache = new APICache({
  ttl: 10 * 60 * 1000, // 10 minutes for file data
  maxSize: 50
});

// Specialized cache for analysis results
export const analysisCache = new APICache({
  ttl: 15 * 60 * 1000, // 15 minutes for analysis data
  maxSize: 25
});