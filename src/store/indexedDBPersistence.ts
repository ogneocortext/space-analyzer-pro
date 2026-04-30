/**
 * IndexedDB Persistence for Self-Learning System
 * Provides scalable storage for patterns, events, and recommendations
 */

import { LearningPattern, UsageEvent, Recommendation } from './selfLearning'

export class IndexedDBPersistence {
  private dbName = 'SelfLearningDB'
  private version = 1
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create object stores
        if (!db.objectStoreNames.contains('patterns')) {
          const patternStore = db.createObjectStore('patterns', { keyPath: 'id' })
          patternStore.createIndex('type', 'type', { unique: false })
          patternStore.createIndex('confidence', 'confidence', { unique: false })
          patternStore.createIndex('frequency', 'frequency', { unique: false })
          patternStore.createIndex('createdAt', 'createdAt', { unique: false })
        }

        if (!db.objectStoreNames.contains('usageEvents')) {
          const eventStore = db.createObjectStore('usageEvents', { keyPath: 'id' })
          eventStore.createIndex('type', 'type', { unique: false })
          eventStore.createIndex('timestamp', 'timestamp', { unique: false })
          eventStore.createIndex('userId', 'userId', { unique: false })
        }

        if (!db.objectStoreNames.contains('recommendations')) {
          const recommendationStore = db.createObjectStore('recommendations', { keyPath: 'id' })
          recommendationStore.createIndex('type', 'type', { unique: false })
          recommendationStore.createIndex('score', 'score', { unique: false })
          recommendationStore.createIndex('priority', 'priority', { unique: false })
          recommendationStore.createIndex('createdAt', 'createdAt', { unique: false })
        }

        if (!db.objectStoreNames.contains('mlModel')) {
          const modelStore = db.createObjectStore('mlModel', { keyPath: 'key' })
          modelStore.createIndex('updatedAt', 'updatedAt', { unique: false })
        }

        if (!db.objectStoreNames.contains('analytics')) {
          const analyticsStore = db.createObjectStore('analytics', { keyPath: 'id' })
          analyticsStore.createIndex('date', 'date', { unique: false })
          analyticsStore.createIndex('type', 'type', { unique: false })
        }
      }
    })
  }

  async savePatterns(patterns: LearningPattern[]): Promise<void> {
    if (!this.db) await this.init()

    const transaction = this.db!.transaction(['patterns'], 'readwrite')
    const store = transaction.objectStore('patterns')

    // Clear existing patterns
    await store.clear()

    // Save new patterns
    for (const pattern of patterns) {
      await store.add(pattern)
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async loadPatterns(): Promise<LearningPattern[]> {
    if (!this.db) await this.init()

    const transaction = this.db!.transaction(['patterns'], 'readonly')
    const store = transaction.objectStore('patterns')

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async saveUsageEvents(events: UsageEvent[]): Promise<void> {
    if (!this.db) await this.init()

    const transaction = this.db!.transaction(['usageEvents'], 'readwrite')
    const store = transaction.objectStore('usageEvents')

    // Save events (append mode - don't clear existing)
    for (const event of events) {
      await store.add(event)
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async loadUsageEvents(limit: number = 10000): Promise<UsageEvent[]> {
    if (!this.db) await this.init()

    const transaction = this.db!.transaction(['usageEvents'], 'readonly')
    const store = transaction.objectStore('usageEvents')

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => {
        const allEvents = request.result
        // Return most recent events
        const sortedEvents = allEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        resolve(sortedEvents.slice(0, limit))
      }
      request.onerror = () => reject(request.error)
    })
  }

  async saveRecommendations(recommendations: Recommendation[]): Promise<void> {
    if (!this.db) await this.init()

    const transaction = this.db!.transaction(['recommendations'], 'readwrite')
    const store = transaction.objectStore('recommendations')

    // Clear existing recommendations
    await store.clear()

    // Save new recommendations
    for (const recommendation of recommendations) {
      await store.add(recommendation)
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
  }

  async loadRecommendations(): Promise<Recommendation[]> {
    if (!this.db) await this.init()

    const transaction = this.db!.transaction(['recommendations'], 'readonly')
    const store = transaction.objectStore('recommendations')

    return new Promise((resolve, reject) => {
      const request = store.getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async saveMLModelData(key: string, data: any): Promise<void> {
    if (!this.db) await this.init()

    const transaction = this.db!.transaction(['mlModel'], 'readwrite')
    const store = transaction.objectStore('mlModel')

    const modelData = {
      key,
      data,
      updatedAt: new Date()
    }

    return new Promise((resolve, reject) => {
      const request = store.put(modelData)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async loadMLModelData(key: string): Promise<any> {
    if (!this.db) await this.init()

    const transaction = this.db!.transaction(['mlModel'], 'readonly')
    const store = transaction.objectStore('mlModel')

    return new Promise((resolve, reject) => {
      const request = store.get(key)
      request.onsuccess = () => resolve(request.result?.data)
      request.onerror = () => reject(request.error)
    })
  }

  async saveAnalyticsData(data: any): Promise<void> {
    if (!this.db) await this.init()

    const transaction = this.db!.transaction(['analytics'], 'readwrite')
    const store = transaction.objectStore('analytics')

    const analyticsEntry = {
      id: Date.now().toString(),
      date: new Date(),
      type: data.type || 'general',
      data
    }

    return new Promise((resolve, reject) => {
      const request = store.add(analyticsEntry)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async loadAnalyticsData(type?: string, limit: number = 100): Promise<any[]> {
    if (!this.db) await this.init()

    const transaction = this.db!.transaction(['analytics'], 'readonly')
    const store = transaction.objectStore('analytics')

    return new Promise((resolve, reject) => {
      let request: IDBRequest

      if (type) {
        const index = store.index('type')
        request = index.getAll(type)
      } else {
        request = store.getAll()
      }

      request.onsuccess = () => {
        const allData = request.result
        const sortedData = allData.sort((a, b) => b.date.getTime() - a.date.getTime())
        resolve(sortedData.slice(0, limit))
      }
      request.onerror = () => reject(request.error)
    })
  }

  async cleanupOldData(maxAge: number = 30 * 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.db) await this.init()

    const cutoffDate = new Date(Date.now() - maxAge)
    
    // Clean up old usage events
    await this.cleanupObjectStore('usageEvents', 'timestamp', cutoffDate)
    
    // Clean up old analytics data
    await this.cleanupObjectStore('analytics', 'date', cutoffDate)
  }

  private async cleanupObjectStore(storeName: string, indexName: string, cutoffDate: Date): Promise<void> {
    const transaction = this.db!.transaction([storeName], 'readwrite')
    const store = transaction.objectStore(storeName)
    const index = store.index(indexName)

    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.upperBound(cutoffDate))
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        if (cursor) {
          cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
      
      request.onerror = () => reject(request.error)
    })
  }

  async getStorageStats(): Promise<any> {
    if (!this.db) await this.init()

    const stores = ['patterns', 'usageEvents', 'recommendations', 'mlModel', 'analytics']
    const stats: any = {}

    for (const storeName of stores) {
      try {
        const count = await this.getObjectStoreCount(storeName)
        stats[storeName] = count
      } catch (error) {
        stats[storeName] = 0
      }
    }

    return stats
  }

  private async getObjectStoreCount(storeName: string): Promise<number> {
    const transaction = this.db!.transaction([storeName], 'readonly')
    const store = transaction.objectStore(storeName)

    return new Promise((resolve, reject) => {
      const request = store.count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async exportData(): Promise<any> {
    const patterns = await this.loadPatterns()
    const events = await this.loadUsageEvents()
    const recommendations = await this.loadRecommendations()
    const stats = await this.getStorageStats()

    return {
      patterns,
      events,
      recommendations,
      stats,
      exportedAt: new Date()
    }
  }

  async importData(data: any): Promise<void> {
    if (data.patterns) await this.savePatterns(data.patterns)
    if (data.events) await this.saveUsageEvents(data.events)
    if (data.recommendations) await this.saveRecommendations(data.recommendations)
  }

  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}

// Singleton instance
export const indexedDBPersistence = new IndexedDBPersistence()
