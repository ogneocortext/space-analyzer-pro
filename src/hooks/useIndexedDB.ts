import { useState, useCallback, useEffect } from 'react';

interface ScanSnapshot {
  id: string;
  name: string;
  timestamp: number;
  path: string;
  totalSize: number;
  totalFiles: number;
  totalDirectories: number;
  data: any; // The actual scan data
  metadata: {
    scanDuration: number;
    version: string;
    platform: string;
    excludedPaths?: string[];
    options?: any;
  };
}

interface UseIndexedDBReturn {
  snapshots: ScanSnapshot[];
  isLoading: boolean;
  error: string | null;
  saveSnapshot: (name: string, data: any, metadata?: any) => Promise<string | null>;
  loadSnapshot: (id: string) => Promise<ScanSnapshot | null>;
  deleteSnapshot: (id: string) => Promise<boolean>;
  compareSnapshots: (id1: string, id2: string) => Promise<any>;
  clearAllSnapshots: () => Promise<boolean>;
  getSnapshotById: (id: string) => ScanSnapshot | null;
  getLatestSnapshot: () => ScanSnapshot | null;
}

const DB_NAME = 'SpaceAnalyzerDB';
const DB_VERSION = 1;
const STORE_NAME = 'scanSnapshots';

class IndexedDBManager {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('path', 'path', { unique: false });
          store.createIndex('name', 'name', { unique: false });
        }
      };
    });
  }

  async save(snapshot: ScanSnapshot): Promise<string> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(snapshot);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(snapshot.id);
    });
  }

  async load(id: string): Promise<ScanSnapshot | null> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }

  async loadAll(): Promise<ScanSnapshot[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  async delete(id: string): Promise<boolean> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(true);
    });
  }

  async clear(): Promise<boolean> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(true);
    });
  }

  async getByIndex(indexName: string, value: any): Promise<ScanSnapshot[]> {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }
}

const dbManager = new IndexedDBManager();

export const useIndexedDB = (): UseIndexedDBReturn => {
  const [snapshots, setSnapshots] = useState<ScanSnapshot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all snapshots on mount
  useEffect(() => {
    const loadSnapshots = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const allSnapshots = await dbManager.loadAll();
        // Sort by timestamp (newest first)
        allSnapshots.sort((a, b) => b.timestamp - a.timestamp);
        setSnapshots(allSnapshots);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load snapshots');
      } finally {
        setIsLoading(false);
      }
    };

    loadSnapshots();
  }, []);

  const saveSnapshot = useCallback(async (
    name: string,
    data: any,
    metadata?: any
  ): Promise<string | null> => {
    setError(null);
    
    try {
      const id = `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const snapshot: ScanSnapshot = {
        id,
        name,
        timestamp: Date.now(),
        path: data.path || 'Unknown',
        totalSize: data.totalSize || 0,
        totalFiles: data.totalFiles || 0,
        totalDirectories: data.totalDirectories || 0,
        data,
        metadata: {
          scanDuration: metadata?.scanDuration || 0,
          version: '2.0.1',
          platform: navigator.platform,
          excludedPaths: metadata?.excludedPaths || [],
          options: metadata?.options || {}
        }
      };

      await dbManager.save(snapshot);
      
      // Update local state
      setSnapshots(prev => [snapshot, ...prev]);
      
      return id;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save snapshot';
      setError(errorMessage);
      return null;
    }
  }, []);

  const loadSnapshot = useCallback(async (id: string): Promise<ScanSnapshot | null> => {
    setError(null);
    
    try {
      const snapshot = await dbManager.load(id);
      return snapshot;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load snapshot';
      setError(errorMessage);
      return null;
    }
  }, []);

  const deleteSnapshot = useCallback(async (id: string): Promise<boolean> => {
    setError(null);
    
    try {
      await dbManager.delete(id);
      
      // Update local state
      setSnapshots(prev => prev.filter(s => s.id !== id));
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete snapshot';
      setError(errorMessage);
      return false;
    }
  }, []);

  const compareSnapshots = useCallback(async (id1: string, id2: string): Promise<any> => {
    setError(null);
    
    try {
      const [snapshot1, snapshot2] = await Promise.all([
        dbManager.load(id1),
        dbManager.load(id2)
      ]);

      if (!snapshot1 || !snapshot2) {
        throw new Error('One or both snapshots not found');
      }

      // Calculate differences
      const timeDiff = snapshot2.timestamp - snapshot1.timestamp;
      const sizeDiff = snapshot2.totalSize - snapshot1.totalSize;
      const filesDiff = snapshot2.totalFiles - snapshot1.totalFiles;
      const dirsDiff = snapshot2.totalDirectories - snapshot1.totalDirectories;

      // Detailed comparison would require analyzing the actual file trees
      // For now, return basic comparison
      return {
        timeDifference: timeDiff,
        sizeDifference: sizeDiff,
        filesDifference: filesDiff,
        directoriesDifference: dirsDiff,
        percentageChange: snapshot1.totalSize > 0 ? (sizeDiff / snapshot1.totalSize) * 100 : 0,
        snapshot1: {
          name: snapshot1.name,
          timestamp: snapshot1.timestamp,
          totalSize: snapshot1.totalSize,
          totalFiles: snapshot1.totalFiles
        },
        snapshot2: {
          name: snapshot2.name,
          timestamp: snapshot2.timestamp,
          totalSize: snapshot2.totalSize,
          totalFiles: snapshot2.totalFiles
        }
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to compare snapshots';
      setError(errorMessage);
      return null;
    }
  }, []);

  const clearAllSnapshots = useCallback(async (): Promise<boolean> => {
    setError(null);
    
    try {
      await dbManager.clear();
      setSnapshots([]);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to clear snapshots';
      setError(errorMessage);
      return false;
    }
  }, []);

  const getSnapshotById = useCallback((id: string): ScanSnapshot | null => {
    return snapshots.find(s => s.id === id) || null;
  }, [snapshots]);

  const getLatestSnapshot = useCallback((): ScanSnapshot | null => {
    return snapshots.length > 0 ? snapshots[0] : null;
  }, [snapshots]);

  return {
    snapshots,
    isLoading,
    error,
    saveSnapshot,
    loadSnapshot,
    deleteSnapshot,
    compareSnapshots,
    clearAllSnapshots,
    getSnapshotById,
    getLatestSnapshot
  };
};

// Hook for automatic snapshot management
export const useAutoSnapshot = () => {
  const indexedDB = useIndexedDB();
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [lastAutoSave, setLastAutoSave] = useState<number | null>(null);

  const autoSave = useCallback(async (data: any, name?: string) => {
    if (!autoSaveEnabled) return null;

    const snapshotName = name || `Auto Save ${new Date().toLocaleString()}`;
    const id = await indexedDB.saveSnapshot(snapshotName, data, {
      autoSave: true,
      timestamp: Date.now()
    });

    if (id) {
      setLastAutoSave(Date.now());
    }

    return id;
  }, [autoSaveEnabled, indexedDB]);

  const cleanupOldSnapshots = useCallback(async (keepCount: number = 10) => {
    const snapshots = indexedDB.snapshots.filter(s => 
      // @ts-ignore - autoSave property
      s.metadata.autoSave === true
    );

    if (snapshots.length > keepCount) {
      const toDelete = snapshots.slice(keepCount);
      for (const snapshot of toDelete) {
        await indexedDB.deleteSnapshot(snapshot.id);
      }
    }
  }, [indexedDB]);

  return {
    autoSaveEnabled,
    setAutoSaveEnabled,
    lastAutoSave,
    autoSave,
    cleanupOldSnapshots
  };
};

export default useIndexedDB;
