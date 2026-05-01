/**
 * Web Storage API Cache for Server-Side Caching
 * Uses Node.js v25+ experimental Web Storage API for efficient caching
 * Falls back to in-memory Map for older Node.js versions
 */

class WebStorageCache {
  constructor() {
    this.useNativeStorage = false;
    this.memoryCache = new Map();
    this.localStorage = null;
    this.sessionStorage = null;

    this.initialize();
  }

  initialize() {
    try {
      // Check if Web Storage API is available (Node.js v25+)
      if (typeof localStorage !== 'undefined' && typeof sessionStorage !== 'undefined') {
        this.localStorage = localStorage;
        this.sessionStorage = sessionStorage;
        this.useNativeStorage = true;
        console.log('✅ Using native Web Storage API for caching');
      } else {
        console.log('⚠️  Web Storage API not available, using in-memory Map cache');
      }
    } catch (error) {
      console.log('⚠️  Web Storage API initialization failed, using in-memory Map cache:', error.message);
    }
  }

  /**
   * Set item in cache with optional expiration
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds (optional)
   * @param {boolean} useSession - Use sessionStorage instead of localStorage (default: false)
   */
  set(key, value, ttl = null, useSession = false) {
    try {
      const item = {
        value,
        timestamp: Date.now(),
        ttl: ttl ? Date.now() + ttl : null
      };

      const serialized = JSON.stringify(item);

      if (this.useNativeStorage) {
        const storage = useSession ? this.sessionStorage : this.localStorage;
        storage.setItem(key, serialized);
      } else {
        this.memoryCache.set(key, item);
      }
    } catch (error) {
      console.error('❌ Cache set error:', error);
    }
  }

  /**
   * Get item from cache
   * @param {string} key - Cache key
   * @param {boolean} useSession - Use sessionStorage instead of localStorage (default: false)
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(key, useSession = false) {
    try {
      let item;

      if (this.useNativeStorage) {
        const storage = useSession ? this.sessionStorage : this.localStorage;
        const serialized = storage.getItem(key);
        if (!serialized) return null;
        item = JSON.parse(serialized);
      } else {
        item = this.memoryCache.get(key);
        if (!item) return null;
      }

      // Check expiration
      if (item.ttl && Date.now() > item.ttl) {
        this.delete(key, useSession);
        return null;
      }

      return item.value;
    } catch (error) {
      console.error('❌ Cache get error:', error);
      return null;
    }
  }

  /**
   * Delete item from cache
   * @param {string} key - Cache key
   * @param {boolean} useSession - Use sessionStorage instead of localStorage (default: false)
   */
  delete(key, useSession = false) {
    try {
      if (this.useNativeStorage) {
        const storage = useSession ? this.sessionStorage : this.localStorage;
        storage.removeItem(key);
      } else {
        this.memoryCache.delete(key);
      }
    } catch (error) {
      console.error('❌ Cache delete error:', error);
    }
  }

  /**
   * Clear all items from cache
   * @param {boolean} useSession - Clear sessionStorage instead of localStorage (default: false)
   */
  clear(useSession = false) {
    try {
      if (this.useNativeStorage) {
        const storage = useSession ? this.sessionStorage : this.localStorage;
        storage.clear();
      } else {
        this.memoryCache.clear();
      }
    } catch (error) {
      console.error('❌ Cache clear error:', error);
    }
  }

  /**
   * Get all keys in cache
   * @param {boolean} useSession - Use sessionStorage instead of localStorage (default: false)
   * @returns {string[]} Array of keys
   */
  keys(useSession = false) {
    try {
      if (this.useNativeStorage) {
        const storage = useSession ? this.sessionStorage : this.localStorage;
        return Object.keys(storage);
      } else {
        return Array.from(this.memoryCache.keys());
      }
    } catch (error) {
      console.error('❌ Cache keys error:', error);
      return [];
    }
  }

  /**
   * Get cache size
   * @param {boolean} useSession - Use sessionStorage instead of localStorage (default: false)
   * @returns {number} Number of items in cache
   */
  size(useSession = false) {
    try {
      if (this.useNativeStorage) {
        const storage = useSession ? this.sessionStorage : this.localStorage;
        return Object.keys(storage).length;
      } else {
        return this.memoryCache.size;
      }
    } catch (error) {
      console.error('❌ Cache size error:', error);
      return 0;
    }
  }

  /**
   * Clean up expired items
   * @param {boolean} useSession - Use sessionStorage instead of localStorage (default: false)
   */
  cleanup(useSession = false) {
    try {
      const keys = this.keys(useSession);
      let cleaned = 0;

      for (const key of keys) {
        const item = this.get(key, useSession);
        if (item === null) {
          cleaned++;
        }
      }

      return cleaned;
    } catch (error) {
      console.error('❌ Cache cleanup error:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   * @returns {object} Cache statistics
   */
  getStats() {
    return {
      useNativeStorage: this.useNativeStorage,
      localStorageSize: this.size(false),
      sessionStorageSize: this.size(true),
      memoryCacheSize: this.memoryCache.size,
      totalKeys: this.keys(false).length + this.keys(true).length
    };
  }
}

// Export singleton instance
const webStorageCache = new WebStorageCache();

module.exports = webStorageCache;
