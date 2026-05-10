/**
 * Data Persistence Utilities - Handles localStorage and data caching
 * Extracted from analysis store for better maintainability
 */

export interface StorageOptions {
  version?: string;
  encrypt?: boolean;
  compress?: boolean;
  expires?: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
  expires?: number;
}

export interface StorageStats {
  totalSize: number;
  itemCount: number;
  oldestEntry?: number;
  newestEntry?: number;
}

/**
 * Data Persistence Manager
 */
export class DataPersistenceManager {
  private prefix: string;

  constructor(prefix: string = "space-analyzer") {
    this.prefix = prefix;
  }

  /**
   * Save data to localStorage
   */
  save<T>(key: string, data: T, options: StorageOptions = {}): boolean {
    try {
      const storageKey = this.getStorageKey(key, options.version);

      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        version: options.version || "1.0",
        expires: options.expires,
      };

      let serialized = JSON.stringify(entry);

      // Optional compression (basic)
      if (options.compress) {
        serialized = this.basicCompress(serialized);
      }

      // Optional encryption (basic obfuscation)
      if (options.encrypt) {
        serialized = this.basicEncrypt(serialized);
      }

      localStorage.setItem(storageKey, serialized);
      return true;
    } catch (error) {
      console.error(`Failed to save data to localStorage (key: ${key}):`, error);
      return false;
    }
  }

  /**
   * Load data from localStorage
   */
  load<T>(key: string, options: StorageOptions = {}): T | null {
    try {
      const storageKey = this.getStorageKey(key, options.version);
      const serialized = localStorage.getItem(storageKey);

      if (!serialized) {
        return null;
      }

      let deserialized = serialized;

      // Optional decryption
      if (options.encrypt) {
        deserialized = this.basicDecrypt(deserialized);
      }

      // Optional decompression
      if (options.compress) {
        deserialized = this.basicDecompress(deserialized);
      }

      const entry: CacheEntry<T> = JSON.parse(deserialized);

      // Check expiration
      if (options.expires && entry.timestamp && Date.now() - entry.timestamp > options.expires) {
        this.remove(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.error(`Failed to load data from localStorage (key: ${key}):`, error);
      return null;
    }
  }

  /**
   * Remove data from localStorage
   */
  remove(key: string, version?: string): boolean {
    try {
      const storageKey = this.getStorageKey(key, version);
      localStorage.removeItem(storageKey);
      return true;
    } catch (error) {
      console.error(`Failed to remove data from localStorage (key: ${key}):`, error);
      return false;
    }
  }

  /**
   * Clear all data with the current prefix
   */
  clear(): boolean {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));
      return true;
    } catch (error) {
      console.error("Failed to clear localStorage data:", error);
      return false;
    }
  }

  /**
   * Get storage statistics
   */
  getStats(version?: string): StorageStats {
    const stats: StorageStats = {
      totalSize: 0,
      itemCount: 0,
    };

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.prefix)) {
          const value = localStorage.getItem(key);
          if (value) {
            stats.totalSize += value.length;
            stats.itemCount++;

            // Track timestamps for expiration
            try {
              const parsed = JSON.parse(value);
              if (parsed.timestamp) {
                if (!stats.oldestEntry || parsed.timestamp < stats.oldestEntry) {
                  stats.oldestEntry = parsed.timestamp;
                }
                if (!stats.newestEntry || parsed.timestamp > stats.newestEntry) {
                  stats.newestEntry = parsed.timestamp;
                }
              }
            } catch {
              // Ignore parsing errors
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to get storage stats:", error);
    }

    return stats;
  }

  /**
   * Check if data exists
   */
  exists(key: string, version?: string): boolean {
    const storageKey = this.getStorageKey(key, version);
    return localStorage.getItem(storageKey) !== null;
  }

  /**
   * Get all keys with the current prefix
   */
  getKeys(version?: string): string[] {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keys.push(key);
      }
    }
    return keys;
  }

  /**
   * Migrate data between versions
   */
  migrate(fromVersion: string, toVersion: string, migrator: (data: any) => any): boolean {
    try {
      const oldData = this.load("analysisResult", { version: fromVersion });

      if (oldData !== null) {
        const newData = migrator(oldData);
        this.save("analysisResult", newData, { version: toVersion });
        this.remove("analysisResult", fromVersion);
        return true;
      }
    } catch (error) {
      console.error("Failed to migrate data:", error);
    }
    return false;
  }

  /**
   * Generate storage key with prefix
   */
  private getStorageKey(key: string, version?: string): string {
    const versionSuffix = version ? `_${version}` : "";
    return `${this.prefix}_${key}${versionSuffix}`;
  }

  /**
   * Basic compression (simple character replacement)
   */
  private basicCompress(data: string): string {
    return data.replace(/\//g, "_").replace(/\//g, "_").replace(/\//g, "_");
  }

  /**
   * Basic decompression (reverse of compression)
   */
  private basicDecompress(data: string): string {
    return data.replace(/_/g, "/").replace(/_/g, "/").replace(/_/g, "/");
  }

  /**
   * Basic encryption (simple character shifting)
   */
  private basicEncrypt(data: string): string {
    return btoa(data)
      .split("")
      .map((char) => String.fromCharCode(char.charCodeAt(0) + 1))
      .join("");
  }

  /**
   * Basic decryption (reverse of encryption)
   */
  private basicDecrypt(data: string): string {
    return atob(data)
      .split("")
      .map((char) => String.fromCharCode(char.charCodeAt(0) - 1))
      .join("");
  }
}

// Create singleton instance for app-wide use
export const dataPersistence = new DataPersistenceManager();

/**
 * Composable for easy use in Vue components
 */
export function useDataPersistence() {
  return {
    save: dataPersistence.save.bind(dataPersistence),
    load: dataPersistence.load.bind(dataPersistence),
    remove: dataPersistence.remove.bind(dataPersistence),
    clear: dataPersistence.clear.bind(dataPersistence),
    exists: dataPersistence.exists.bind(dataPersistence),
    getKeys: dataPersistence.getKeys.bind(dataPersistence),
    getStats: dataPersistence.getStats.bind(dataPersistence),
    migrate: dataPersistence.migrate.bind(dataPersistence),
  };
}
