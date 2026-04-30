/**
 * 3D File System Browser Cache Manager
 * Handles intelligent caching, memory management, and performance optimization
 */

// Cache Types
export type CacheType = 'geometry' | 'material' | 'texture' | 'layout' | 'analytics' | 'filesystem'

// Cache Entry
interface CacheEntry<T> {
  data: T
  timestamp: number
  accessCount: number
  lastAccessed: number
  size: number
  priority: 'low' | 'medium' | 'high'
  ttl?: number // Time to live in milliseconds
}

// Cache Configuration
interface CacheConfig {
  maxSize: number // Maximum size in bytes
  maxEntries: number // Maximum number of entries
  defaultTTL: number // Default time to live
  cleanupInterval: number // Cleanup interval in milliseconds
  enableLRU: boolean // Enable Least Recently Used eviction
  enablePriority: boolean // Enable priority-based eviction
}

// Cache Statistics
export interface CacheStatistics {
  totalEntries: number
  totalSize: number
  hitRate: number
  missRate: number
  evictionCount: number
  lastCleanup: number
  entriesByType: Record<CacheType, number>
  sizeByType: Record<CacheType, number>
}

// Cache Manager Class
export class CacheManager {
  private caches: Map<CacheType, Map<string, CacheEntry<any>>>
  private configs: Map<CacheType, CacheConfig>
  private statistics: Map<CacheType, CacheStatistics>
  private cleanupTimers: Map<CacheType, number>
  private globalStats: {
    hits: number
    misses: number
    evictions: number
  }

  constructor() {
    this.caches = new Map()
    this.configs = new Map()
    this.statistics = new Map()
    this.cleanupTimers = new Map()
    this.globalStats = {
      hits: 0,
      misses: 0,
      evictions: 0
    }

    this.initializeCaches()
    this.startGlobalCleanup()
  }

  // Initialize Caches
  private initializeCaches(): void {
    const defaultConfigs: Record<CacheType, CacheConfig> = {
      geometry: {
        maxSize: 50 * 1024 * 1024, // 50MB
        maxEntries: 1000,
        defaultTTL: 30 * 60 * 1000, // 30 minutes
        cleanupInterval: 5 * 60 * 1000, // 5 minutes
        enableLRU: true,
        enablePriority: true
      },
      material: {
        maxSize: 20 * 1024 * 1024, // 20MB
        maxEntries: 500,
        defaultTTL: 60 * 60 * 1000, // 1 hour
        cleanupInterval: 10 * 60 * 1000, // 10 minutes
        enableLRU: true,
        enablePriority: true
      },
      texture: {
        maxSize: 100 * 1024 * 1024, // 100MB
        maxEntries: 200,
        defaultTTL: 2 * 60 * 60 * 1000, // 2 hours
        cleanupInterval: 15 * 60 * 1000, // 15 minutes
        enableLRU: true,
        enablePriority: true
      },
      layout: {
        maxSize: 10 * 1024 * 1024, // 10MB
        maxEntries: 100,
        defaultTTL: 15 * 60 * 1000, // 15 minutes
        cleanupInterval: 5 * 60 * 1000, // 5 minutes
        enableLRU: true,
        enablePriority: false
      },
      analytics: {
        maxSize: 5 * 1024 * 1024, // 5MB
        maxEntries: 50,
        defaultTTL: 5 * 60 * 1000, // 5 minutes
        cleanupInterval: 2 * 60 * 1000, // 2 minutes
        enableLRU: true,
        enablePriority: false
      },
      filesystem: {
        maxSize: 20 * 1024 * 1024, // 20MB
        maxEntries: 200,
        defaultTTL: 10 * 60 * 1000, // 10 minutes
        cleanupInterval: 3 * 60 * 1000, // 3 minutes
        enableLRU: true,
        enablePriority: false
      }
    }

    Object.entries(defaultConfigs).forEach(([type, config]) => {
      this.configs.set(type as CacheType, config)
      this.caches.set(type as CacheType, new Map())
      this.statistics.set(type as CacheType, this.createInitialStatistics())
      this.startCleanup(type as CacheType)
    })
  }

  // Create Initial Statistics
  private createInitialStatistics(): CacheStatistics {
    return {
      totalEntries: 0,
      totalSize: 0,
      hitRate: 0,
      missRate: 0,
      evictionCount: 0,
      lastCleanup: Date.now(),
      entriesByType: {} as Record<CacheType, number>,
      sizeByType: {} as Record<CacheType, number>
    }
  }

  // Get from Cache
  public get<T>(type: CacheType, key: string): T | null {
    const cache = this.caches.get(type)
    if (!cache) return null

    const entry = cache.get(key)
    if (!entry) {
      this.globalStats.misses++
      this.updateStatistics(type)
      return null
    }

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      cache.delete(key)
      this.globalStats.misses++
      this.updateStatistics(type)
      return null
    }

    // Update access information
    entry.accessCount++
    entry.lastAccessed = Date.now()
    this.globalStats.hits++
    this.updateStatistics(type)

    return entry.data
  }

  // Set in Cache
  public set<T>(
    type: CacheType,
    key: string,
    data: T,
    options: {
      priority?: 'low' | 'medium' | 'high'
      ttl?: number
      size?: number
    } = {}
  ): boolean {
    const cache = this.caches.get(type)
    const config = this.configs.get(type)
    if (!cache || !config) return false

    const size = options.size || this.estimateSize(data)
    const priority = options.priority || 'medium'
    const ttl = options.ttl || config.defaultTTL

    // Check if we need to evict entries
    if (!this.canAddEntry(type, size)) {
      this.evictEntries(type, size)
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
      size,
      priority,
      ttl
    }

    cache.set(key, entry)
    this.updateStatistics(type)
    return true
  }

  // Delete from Cache
  public delete(type: CacheType, key: string): boolean {
    const cache = this.caches.get(type)
    if (!cache) return false

    const deleted = cache.delete(key)
    if (deleted) {
      this.updateStatistics(type)
    }
    return deleted
  }

  // Clear Cache
  public clear(type: CacheType): void {
    const cache = this.caches.get(type)
    if (cache) {
      cache.clear()
      this.updateStatistics(type)
    }
  }

  // Clear All Caches
  public clearAll(): void {
    this.caches.forEach((cache, type) => {
      cache.clear()
      this.updateStatistics(type)
    })
  }

  // Check if Entry Exists
  public has(type: CacheType, key: string): boolean {
    const cache = this.caches.get(type)
    if (!cache) return false

    const entry = cache.get(key)
    if (!entry) return false

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      cache.delete(key)
      this.updateStatistics(type)
      return false
    }

    return true
  }

  // Get Cache Size
  public getCacheSize(type: CacheType): number {
    const cache = this.caches.get(type)
    if (!cache) return 0

    let size = 0
    cache.forEach(entry => {
      size += entry.size
    })
    return size
  }

  // Get Cache Entry Count
  public getCacheEntryCount(type: CacheType): number {
    const cache = this.caches.get(type)
    return cache ? cache.size : 0
  }

  // Can Add Entry
  private canAddEntry(type: CacheType, size: number): boolean {
    const cache = this.caches.get(type)
    const config = this.configs.get(type)
    if (!cache || !config) return false

    const currentSize = this.getCacheSize(type)
    const currentEntries = cache.size

    return currentSize + size <= config.maxSize && currentEntries < config.maxEntries
  }

  // Evict Entries
  private evictEntries(type: CacheType, requiredSize: number): void {
    const cache = this.caches.get(type)
    const config = this.configs.get(type)
    if (!cache || !config) return

    const entries = Array.from(cache.entries())
    
    // Sort entries for eviction
    if (config.enablePriority) {
      entries.sort((a, b) => {
        // Priority-based eviction
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        const priorityDiff = priorityOrder[b[1].priority] - priorityOrder[a[1].priority]
        
        if (priorityDiff !== 0) return priorityDiff
        
        // If same priority, use LRU
        if (config.enableLRU) {
          return a[1].lastAccessed - b[1].lastAccessed
        }
        
        return a[1].accessCount - b[1].accessCount
      })
    } else if (config.enableLRU) {
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
    } else {
      entries.sort((a, b) => a[1].accessCount - b[1].accessCount)
    }

    let freedSize = 0
    for (const [key, entry] of entries) {
      cache.delete(key)
      freedSize += entry.size
      this.globalStats.evictions++

      if (freedSize >= requiredSize) break
    }

    this.updateStatistics(type)
  }

  // Start Cleanup
  private startCleanup(type: CacheType): void {
    const config = this.configs.get(type)
    if (!config) return

    const timer = window.setInterval(() => {
      this.cleanup(type)
    }, config.cleanupInterval)

    this.cleanupTimers.set(type, timer)
  }

  // Start Global Cleanup
  private startGlobalCleanup(): void {
    // Global cleanup runs every 5 minutes
    window.setInterval(() => {
      this.globalCleanup()
    }, 5 * 60 * 1000)
  }

  // Cleanup Expired Entries
  private cleanup(type: CacheType): void {
    const cache = this.caches.get(type)
    if (!cache) return

    const now = Date.now()
    let cleanedCount = 0

    for (const [key, entry] of cache.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        cache.delete(key)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      this.updateStatistics(type)
    }
  }

  // Global Cleanup
  private globalCleanup(): void {
    // Check memory pressure
    const totalSize = this.getTotalSize()
    const maxTotalSize = Array.from(this.configs.values()).reduce((sum, config) => sum + config.maxSize, 0)

    if (totalSize > maxTotalSize * 0.8) {
      // Memory pressure is high, aggressive cleanup
      this.aggressiveCleanup()
    }

    // Update global statistics
    this.updateGlobalStatistics()
  }

  // Aggressive Cleanup
  private aggressiveCleanup(): void {
    this.caches.forEach((cache, type) => {
      const config = this.configs.get(type)
      if (!config) return

      // Remove entries with low priority and old access time
      const entries = Array.from(cache.entries())
      const now = Date.now()

      for (const [key, entry] of entries) {
        const isOld = now - entry.lastAccessed > config.defaultTTL / 2
        const isLowPriority = entry.priority === 'low'

        if (isOld && isLowPriority) {
          cache.delete(key)
        }
      }

      this.updateStatistics(type)
    })
  }

  // Update Statistics
  private updateStatistics(type: CacheType): void {
    const cache = this.caches.get(type)
    const stats = this.statistics.get(type)
    if (!cache || !stats) return

    let totalSize = 0
    cache.forEach(entry => {
      totalSize += entry.size
    })

    stats.totalEntries = cache.size
    stats.totalSize = totalSize
    stats.lastCleanup = Date.now()

    // Update hit/miss rates
    const totalRequests = this.globalStats.hits + this.globalStats.misses
    stats.hitRate = totalRequests > 0 ? this.globalStats.hits / totalRequests : 0
    stats.missRate = totalRequests > 0 ? this.globalStats.misses / totalRequests : 0
    stats.evictionCount = this.globalStats.evictions
  }

  // Update Global Statistics
  private updateGlobalStatistics(): void {
    // This is called during global cleanup
    // Can be extended to log statistics or trigger events
  }

  // Get Total Size
  public getTotalSize(): number {
    let totalSize = 0
    this.caches.forEach((cache, type) => {
      totalSize += this.getCacheSize(type)
    })
    return totalSize
  }

  // Get Total Entries
  public getTotalEntries(): number {
    let totalEntries = 0
    this.caches.forEach((cache) => {
      totalEntries += cache.size
    })
    return totalEntries
  }

  // Get Statistics
  public getStatistics(type?: CacheType): CacheStatistics | Record<CacheType, CacheStatistics> {
    if (type) {
      return this.statistics.get(type) || this.createInitialStatistics()
    }

    const allStats: Record<CacheType, CacheStatistics> = {} as Record<CacheType, CacheStatistics>
    this.statistics.forEach((stats, cacheType) => {
      allStats[cacheType] = stats
    })
    return allStats
  }

  // Get Global Statistics
  public getGlobalStatistics(): {
    totalHits: number
    totalMisses: number
    totalEvictions: number
    overallHitRate: number
    totalSize: number
    totalEntries: number
  } {
    const totalRequests = this.globalStats.hits + this.globalStats.misses
    
    return {
      totalHits: this.globalStats.hits,
      totalMisses: this.globalStats.misses,
      totalEvictions: this.globalStats.evictions,
      overallHitRate: totalRequests > 0 ? this.globalStats.hits / totalRequests : 0,
      totalSize: this.getTotalSize(),
      totalEntries: this.getTotalEntries()
    }
  }

  // Optimize Cache
  public optimize(): void {
    this.caches.forEach((cache, type) => {
      const config = this.configs.get(type)
      if (!config) return

      // Remove expired entries
      this.cleanup(type)

      // Remove low-priority entries if cache is full
      if (this.getCacheSize(type) > config.maxSize * 0.8) {
        this.evictEntries(type, config.maxSize * 0.2)
      }
    })
  }

  // Estimate Size
  private estimateSize(data: any): number {
    if (data === null || data === undefined) return 0
    
    if (typeof data === 'string') {
      return data.length * 2 // UTF-16
    }
    
    if (typeof data === 'number') {
      return 8 // 64-bit number
    }
    
    if (typeof data === 'boolean') {
      return 4
    }
    
    if (data instanceof ArrayBuffer) {
      return data.byteLength
    }
    
    if (data instanceof Blob) {
      return data.size
    }
    
    if (data instanceof ImageData) {
      return data.width * data.height * 4 // RGBA
    }
    
    // For objects, estimate based on serialization
    try {
      const serialized = JSON.stringify(data)
      return serialized.length * 2
    } catch {
      return 1024 // Default estimate for complex objects
    }
  }

  // Preload Data
  public async preload<T>(
    type: CacheType,
    keys: string[],
    loader: (key: string) => Promise<T>,
    options: {
      priority?: 'low' | 'medium' | 'high'
      ttl?: number
      concurrency?: number
    } = {}
  ): Promise<void> {
    const { priority = 'medium', ttl, concurrency = 5 } = options
    const semaphore = new Array(concurrency).fill(null)
    
    const loadOne = async (key: string): Promise<void> => {
      // Wait for available slot
      await new Promise(resolve => {
        const index = semaphore.findIndex(slot => slot === null)
        if (index !== -1) {
          semaphore[index] = key
          resolve(index)
        } else {
          semaphore.push(key)
          resolve(semaphore.length - 1)
        }
      })
      
      try {
        const data = await loader(key)
        this.set(type, key, data, { priority, ttl })
      } catch (error) {
        console.warn(`Failed to preload ${key}:`, error)
      } finally {
        // Release slot
        const index = semaphore.indexOf(key)
        if (index !== -1) {
          semaphore[index] = null
        }
      }
    }
    
    await Promise.all(keys.map(loadOne))
  }

  // Warm Up Cache
  public async warmUp(type: CacheType, loader: (key: string) => Promise<any>): Promise<void> {
    const commonKeys = this.getCommonKeys(type)
    await this.preload(type, commonKeys, loader, { priority: 'high' })
  }

  // Get Common Keys
  private getCommonKeys(type: CacheType): string[] {
    // Return commonly accessed keys for each cache type
    switch (type) {
      case 'geometry':
        return ['sphere-1.0', 'box-1.0', 'cylinder-1.0']
      case 'material':
        return ['standard-default', 'basic-default']
      case 'layout':
        return ['tree-default', 'sphere-default']
      case 'analytics':
        return ['recent-activity', 'file-types']
      case 'filesystem':
        return ['root-structure', 'recent-files']
      default:
        return []
    }
  }

  // Export Cache State
  public exportCacheState(type?: CacheType): Record<string, any> {
    const caches = type ? { [type]: this.caches.get(type) } : Object.fromEntries(this.caches)
    const exported: Record<string, any> = {}

    Object.entries(caches).forEach(([cacheType, cache]) => {
      if (cache) {
        exported[cacheType] = {}
        cache.forEach((entry, key) => {
          // Only export serializable data
          if (this.isSerializable(entry.data)) {
            exported[cacheType][key] = {
              data: entry.data,
              timestamp: entry.timestamp,
              accessCount: entry.accessCount,
              lastAccessed: entry.lastAccessed,
              size: entry.size,
              priority: entry.priority,
              ttl: entry.ttl
            }
          }
        })
      }
    })

    return exported
  }

  // Import Cache State
  public importCacheState(state: Record<string, any>): void {
    Object.entries(state).forEach(([cacheType, entries]) => {
      const type = cacheType as CacheType
      const cache = this.caches.get(type)
      
      if (cache) {
        Object.entries(entries).forEach(([key, entry]) => {
          if (this.isValidEntry(entry)) {
            cache.set(key, entry)
          }
        })
        this.updateStatistics(type)
      }
    })
  }

  // Check if Data is Serializable
  private isSerializable(data: any): boolean {
    try {
      JSON.stringify(data)
      return true
    } catch {
      return false
    }
  }

  // Validate Entry
  private isValidEntry(entry: any): boolean {
    return entry &&
           typeof entry === 'object' &&
           typeof entry.data !== 'undefined' &&
           typeof entry.timestamp === 'number' &&
           typeof entry.accessCount === 'number' &&
           typeof entry.lastAccessed === 'number' &&
           typeof entry.size === 'number' &&
           ['low', 'medium', 'high'].includes(entry.priority)
  }

  // Dispose
  public dispose(): void {
    // Clear all caches
    this.clearAll()

    // Clear cleanup timers
    this.cleanupTimers.forEach(timer => {
      clearInterval(timer)
    })
    this.cleanupTimers.clear()

    // Clear other data
    this.configs.clear()
    this.statistics.clear()
  }
}

// Cache Factory
export class CacheFactory {
  private static instance: CacheManager

  // Get Singleton Instance
  public static getInstance(): CacheManager {
    if (!CacheFactory.instance) {
      CacheFactory.instance = new CacheManager()
    }
    return CacheFactory.instance
  }

  // Create Specialized Cache
  public static createCache<T>(
    type: CacheType,
    config: Partial<CacheConfig>
  ): {
    get: (key: string) => T | null
    set: (key: string, data: T, options?: any) => boolean
    delete: (key: string) => boolean
    clear: () => void
    has: (key: string) => boolean
    getStatistics: () => CacheStatistics
  } {
    const manager = CacheFactory.getInstance()
    
    return {
      get: (key: string) => manager.get<T>(type, key),
      set: (key: string, data: T, options?: any) => manager.set(type, key, data, options),
      delete: (key: string) => manager.delete(type, key),
      clear: () => manager.clear(type),
      has: (key: string) => manager.has(type, key),
      getStatistics: () => manager.getStatistics(type)
    }
  }
}

// Cache Utilities
export class CacheUtils {
  // Create Cache Key
  public static createKey(parts: string[], separator: string = ':'): string {
    return parts.join(separator)
  }

  // Parse Cache Key
  public static parseKey(key: string, separator: string = ':'): string[] {
    return key.split(separator)
  }

  // Generate Hash Key
  public static hashKey(data: any): string {
    const str = typeof data === 'string' ? data : JSON.stringify(data)
    let hash = 0
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36)
  }

  // Time to Live Helper
  public static ttl(seconds: number): number {
    return seconds * 1000
  }

  public static ttlMinutes(minutes: number): number {
    return minutes * 60 * 1000
  }

  public static ttlHours(hours: number): number {
    return hours * 60 * 60 * 1000
  }

  public static ttlDays(days: number): number {
    return days * 24 * 60 * 60 * 1000
  }

  // Size Helper
  public static sizeKB(kb: number): number {
    return kb * 1024
  }

  public static sizeMB(mb: number): number {
    return mb * 1024 * 1024
  }

  public static sizeGB(gb: number): number {
    return gb * 1024 * 1024 * 1024
  }
}

// Global Cache Instance
export const globalCacheManager = CacheFactory.getInstance()
