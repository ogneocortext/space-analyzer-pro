import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { AnalysisResult } from "../services/analysis/AnalysisBridge";

// Analysis store
export const useAnalysisStore = defineStore("analysis", () => {
  const analysisResult = ref<AnalysisResult | null>(null);
  const isAnalyzing = ref(false);
  const analysisProgress = ref(0);
  const analysisError = ref<string | null>(null);
  const currentFile = ref("");
  const filesScanned = ref(0);

  // Analysis controls
  const startAnalysis = async (path: string) => {
    isAnalyzing.value = true;
    analysisProgress.value = 0;
    analysisError.value = null;
    try {
      // Import bridge dynamically to avoid circular dependencies
      const { AnalysisBridge } = await import("../services/analysis/AnalysisBridge");

      const result = await bridge.analyzeDirectoryWithProgress(path, (progress) => {
        console.warn("Progress callback:", progress);
        analysisProgress.value = progress.percentage;
        currentFile.value = progress.currentFile || "";
        filesScanned.value = progress.files || 0;
      });

      analysisResult.value = result.result;
      isAnalyzing.value = false;
      analysisProgress.value = 100;
      currentFile.value = "Analysis complete";
      filesScanned.value = result.result?.totalFiles || 0;
    } catch (error: any) {
      analysisError.value = error.message;
      isAnalyzing.value = false;
    }
  };

  const cancelAnalysis = () => {
    isAnalyzing.value = false;
    analysisProgress.value = 0;
    currentFile.value = "";
    filesScanned.value = 0;
  };

  const clearAnalysis = () => {
    analysisResult.value = null;
    analysisProgress.value = 0;
    analysisError.value = null;
    currentFile.value = "";
    filesScanned.value = 0;
  };

  const updateProgress = (progress: number) => {
    analysisProgress.value = progress;
  };

  const setAnalysisError = (error: string | null) => {
    analysisError.value = error;
  };

  return {
    // State
    analysisResult,
    isAnalyzing,
    analysisProgress,
    analysisError,
    currentFile,
    filesScanned,
    // Actions
    startAnalysis,
    cancelAnalysis,
    clearAnalysis,
    updateProgress,
    setAnalysisError,
  };
});

// AI store
export const useAIStore = defineStore("ai", () => {
  const messages = ref<
    Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      timestamp: Date;
    }>
  >([]);

  const isChatLoading = ref(false);
  const chatError = ref<string | null>(null);

  const insights = ref<
    Array<{
      id: string;
      type: "recommendation" | "warning" | "info";
      title: string;
      description: string;
      priority: "low" | "medium" | "high";
      timestamp: Date;
    }>
  >([]);

  // AI controls
  const addMessage = (message: { role: "user" | "assistant"; content: string }) => {
    messages.value.push({
      id: Date.now().toString(),
      ...message,
      timestamp: new Date(),
    });
  };

  const clearChat = () => {
    messages.value = [];
  };

  const setChatLoading = (loading: boolean) => {
    isChatLoading.value = loading;
  };

  const addInsight = (insight: Omit<(typeof insights.value)[0], "id" | "timestamp">) => {
    insights.value.push({
      id: Date.now().toString(),
      ...insight,
      timestamp: new Date(),
    });
  };

  const clearInsights = () => {
    insights.value = [];
  };

  return {
    // State
    messages,
    isChatLoading,
    chatError,
    insights,
    // Actions
    addMessage,
    clearChat,
    setChatLoading,
    addInsight,
    clearInsights,
  };
});

// Error store
// Notification store
export const useNotificationStore = defineStore("notifications", () => {
  const notifications = ref<
    Array<{
      id: string;
      message: string;
      type: "info" | "success" | "warning" | "error";
      timestamp: Date;
      read: boolean;
    }>
  >([]);

  const unreadCount = computed(() => notifications.value.filter((n) => !n.read).length);

  const addNotification = (notification: {
    message: string;
    type: "info" | "success" | "warning" | "error";
  }) => {
    notifications.value.push({
      id: Date.now().toString(),
      ...notification,
      timestamp: new Date(),
      read: false,
    });
  };

  const markAsRead = (id: string) => {
    const notification = notifications.value.find((n) => n.id === id);
    if (notification) {
      notification.read = true;
    }
  };

  const markAllAsRead = () => {
    notifications.value.forEach((n) => (n.read = true));
  };

  const clearNotifications = () => {
    notifications.value = [];
  };

  return {
    // State
    notifications,
    unreadCount,
    // Actions
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotifications,
  };
});

// Self-learning store
export const useSelfLearningStore = defineStore("selfLearning", () => {
  const learningData = ref<
    Array<{
      id: string;
      pattern: string;
      frequency: number;
      lastSeen: Date;
      confidence: number;
    }>
  >([]);

  const userPreferences = ref<
    Array<{
      id: string;
      key: string;
      value: any;
      timestamp: Date;
    }>
  >([]);

  const addLearningData = (data: { pattern: string; frequency: number; confidence: number }) => {
    learningData.value.push({
      id: Date.now().toString(),
      ...data,
      lastSeen: new Date(),
    });
  };

  const updateUserPreference = (key: string, value: any) => {
    const existingIndex = userPreferences.value.findIndex((p) => p.key === key);
    if (existingIndex >= 0) {
      userPreferences.value[existingIndex] = {
        id: userPreferences.value[existingIndex].id,
        key,
        value,
        timestamp: new Date(),
      };
    } else {
      userPreferences.value.push({
        id: Date.now().toString(),
        key,
        value,
        timestamp: new Date(),
      });
    }
  };

  const clearLearningData = () => {
    learningData.value = [];
  };

  return {
    // State
    learningData,
    userPreferences,
    // Actions
    addLearningData,
    updateUserPreference,
    clearLearningData,
  };
});

// IndexedDB persistence utilities
export const indexedDBPersistence = {
  dbName: "spaceAnalyzerDB",
  version: 1,

  async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("learningData")) {
          db.createObjectStore("learningData", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("userPreferences")) {
          db.createObjectStore("userPreferences", { keyPath: "id" });
        }
      };
    });
  },

  async saveData(storeName: string, data: any[]): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);

      // Clear existing data
      store.clear();

      // Add new data
      data.forEach((item) => store.add(item));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  async loadData(storeName: string): Promise<any[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readonly");
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
};

// A/B Testing framework
export const abTestingFramework = {
  tests: new Map<string, { variants: string[]; weights: number[] }>(),

  defineTest(testId: string, variants: string[], weights: number[] = []) {
    this.tests.set(testId, { variants, weights });
  },

  getVariant(testId: string): string {
    const test = this.tests.get(testId);
    if (!test) return "control";

    const random = Math.random();
    let cumulative = 0;

    for (let i = 0; i < test.variants.length; i++) {
      const weight = test.weights[i] || 1 / test.variants.length;
      cumulative += weight;
      if (random <= cumulative) {
        return test.variants[i];
      }
    }

    return test.variants[test.variants.length - 1];
  },

  recordImpression(testId: string, variant: string) {
    // In a real implementation, this would send data to analytics
    console.log(`A/B Test Impression: ${testId} - ${variant}`);
  },

  recordConversion(testId: string, variant: string) {
    // In a real implementation, this would send data to analytics
    console.log(`A/B Test Conversion: ${testId} - ${variant}`);
  },
};

export const useErrorStore = defineStore("errors", () => {
  const errors = ref<
    Array<{
      id: string;
      message: string;
      type?: "error" | "warning" | "info";
      persistent?: boolean;
    }>
  >([]);

  const addError = (error: {
    message: string;
    type?: "error" | "warning" | "info";
    persistent?: boolean;
  }) => {
    errors.value.push({
      id: Date.now().toString(),
      ...error,
    });
  };

  const removeError = (id: string) => {
    const index = errors.value.findIndex((err) => err.id === id);
    if (index > -1) {
      errors.value.splice(index, 1);
    }
  };

  const clearErrors = () => {
    errors.value = [];
  };

  const clearPersistentErrors = () => {
    errors.value = errors.value.filter((err) => !err.persistent);
  };

  return {
    // State
    errors,
    // Actions
    addError,
    removeError,
    clearErrors,
    clearPersistentErrors,
  };
});
