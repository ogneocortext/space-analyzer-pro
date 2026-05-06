import { ref, onMounted, onUnmounted } from "vue";

interface ScanSnapshot {
  id: string;
  name: string;
  timestamp: number;
  path: string;
  totalSize: number;
  totalFiles: number;
  totalDirectories: number;
  fileTypes: Record<string, number>;
  largestFiles: Array<{
    name: string;
    size: number;
    path: string;
  }>;
}

interface UseIndexedDBReturn {
  snapshots: ScanSnapshot[];
  saveSnapshot: (snapshot: Omit<ScanSnapshot, 'id'>) => Promise<void>;
  loadSnapshots: () => Promise<ScanSnapshot[]>;
  deleteSnapshot: (id: string) => Promise<void>;
  clearSnapshots: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export const useIndexedDB = (): UseIndexedDBReturn => {
  const snapshots = ref<ScanSnapshot[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const db = ref<IDBDatabase | null>(null);

  const DB_NAME = 'SpaceAnalyzerDB';
  const DB_VERSION = 1;
  const STORE_NAME = 'scanSnapshots';

  const initDB = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => {
        error.value = 'Failed to open database';
        reject(request.error);
      };
      
      request.onsuccess = () => {
        db.value = request.result;
        
        // Create object store if it doesn't exist
        if (!db.value.objectStoreNames.contains(STORE_NAME)) {
          const store = db.value.createObjectStore(STORE_NAME, { 
            keyPath: 'id',
            autoIncrement: true 
          });
          
          // Create indexes
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('path', 'path', { unique: false });
        }
        
        resolve();
      };
      
      request.onupgradeneeded = () => {
        db.value = request.result;
        
        if (!db.value.objectStoreNames.contains(STORE_NAME)) {
          const store = db.value.createObjectStore(STORE_NAME, { 
            keyPath: 'id',
            autoIncrement: true 
          });
          
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('path', 'path', { unique: false });
        }
      };
    });
  };

  const saveSnapshot = async (snapshot: Omit<ScanSnapshot, 'id'>): Promise<void> => {
    if (!db.value) return;
    
    isLoading.value = true;
    error.value = null;
    
    try {
      const transaction = db.value!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.add({
        ...snapshot,
        id: Date.now().toString(),
      });
      
      request.onsuccess = () => {
        isLoading.value = false;
        loadSnapshots(); // Refresh snapshots
      };
      
      request.onerror = () => {
        error.value = 'Failed to save snapshot';
        isLoading.value = false;
      };
    } catch (err: any) {
      error.value = err.message || 'Failed to save snapshot';
      isLoading.value = false;
    }
  };

  const loadSnapshots = async (): Promise<ScanSnapshot[]> => {
    if (!db.value) return [];
    
    return new Promise((resolve, reject) => {
      const transaction = db.value!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        snapshots.value = request.result.sort((a, b) => b.timestamp - a.timestamp);
        resolve(request.result);
      };
      
      request.onerror = () => {
        reject(request.error);
      };
    });
  };

  const deleteSnapshot = async (id: string): Promise<void> => {
    if (!db.value) return;
    
    const transaction = db.value!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => {
      loadSnapshots(); // Refresh snapshots
    };
    
    request.onerror = () => {
      error.value = 'Failed to delete snapshot';
    };
  };

  const clearSnapshots = async (): Promise<void> => {
    if (!db.value) return;
    
    const transaction = db.value!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();
    
    request.onsuccess = () => {
      snapshots.value = [];
    };
    
    request.onerror = () => {
      error.value = 'Failed to clear snapshots';
    };
  };

  onMounted(() => {
    initDB().then(() => {
      loadSnapshots();
    }).catch((err) => {
      error.value = err.message || 'Failed to initialize database';
    });
  });

  onUnmounted(() => {
    if (db.value) {
      db.value.close();
    }
  });

  return {
    snapshots,
    saveSnapshot,
    loadSnapshots,
    deleteSnapshot,
    clearSnapshots,
    isLoading,
    error,
  };
};
