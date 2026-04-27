import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { AnalysisResult } from "../services/AnalysisBridge";

// UI State Interface
interface UIState {
  theme: "dark" | "light" | "auto";
  sidebarCollapsed: boolean;
  focusMode: boolean;
  commandPaletteOpen: boolean;
  loadingStates: Record<string, boolean>;
  notifications: Notification[];
  activeModal: string | null;
}

// Analysis State Interface
interface AnalysisState {
  currentDirectory: string;
  analysisData: AnalysisResult | null;
  analysisHistory: AnalysisResult[];
  snapshots: AnalysisSnapshot[];
  isAnalyzing: boolean;
  analysisProgress: {
    files: number;
    percentage: number;
    currentFile: string;
    analysisId?: string;
  } | null;
}

// AI State Interface
interface AIState {
  availableProviders: string[];
  activeProvider: string;
  chatHistory: ChatMessage[];
  insights: AIInsight[];
  modelConfigs: Record<string, ModelConfig>;
}

// Performance State Interface
interface PerformanceState {
  metrics: {
    renderTime: number;
    memoryUsage: number;
    cacheHitRate: number;
    lastUpdated: Date;
  };
  cacheStats: {
    totalQueries: number;
    cachedQueries: number;
    staleQueries: number;
  };
}

// Combined App State
interface AppState extends UIState, AnalysisState, AIState, PerformanceState {
  // Computed getters
  totalFiles: number;
  totalSize: number;
  cacheEfficiency: number;
}

// Actions Interface
interface AppActions {
  // UI Actions
  setTheme: (theme: AppState["theme"]) => void;
  toggleSidebar: () => void;
  setFocusMode: (active: boolean) => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  addNotification: (notification: Omit<Notification, "id" | "timestamp">) => void;
  removeNotification: (id: string) => void;
  setActiveModal: (modal: string | null) => void;

  // Analysis Actions
  setCurrentDirectory: (path: string) => void;
  setAnalysisData: (data: AnalysisResult | null) => void;
  addToHistory: (data: AnalysisResult) => void;
  setAnalyzing: (analyzing: boolean) => void;
  setAnalysisProgress: (progress: AppState["analysisProgress"]) => void;
  createSnapshot: (name: string, data: AnalysisResult) => void;
  deleteSnapshot: (id: string) => void;

  // AI Actions
  setActiveProvider: (provider: string) => void;
  addChatMessage: (message: ChatMessage) => void;
  clearChatHistory: () => void;
  addInsight: (insight: AIInsight) => void;
  updateModelConfig: (provider: string, config: Partial<ModelConfig>) => void;

  // Performance Actions
  updateMetrics: (metrics: Partial<AppState["metrics"]>) => void;
  updateCacheStats: (stats: Partial<AppState["cacheStats"]>) => void;

  // Utility Actions
  reset: () => void;
  hydrate: (state: Partial<AppState>) => void;
}

// Supporting Types
interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  timestamp: Date;
  autoClose?: boolean;
  duration?: number;
}

interface AnalysisSnapshot {
  id: string;
  name: string;
  data: AnalysisResult;
  createdAt: Date;
  size: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface AIInsight {
  id: string;
  type: "warning" | "optimization" | "security" | "performance";
  title: string;
  description: string;
  confidence: number;
  data?: any;
  timestamp: Date;
}

interface ModelConfig {
  temperature: number;
  maxTokens: number;
  model: string;
  enabled: boolean;
  priority: number;
}

// Create the optimized store
export const useAppStore = create<AppState & AppActions>()(
  subscribeWithSelector((set, get) => ({
    // Initial UI State
    theme: "dark",
    sidebarCollapsed: false,
    focusMode: false,
    commandPaletteOpen: false,
    loadingStates: {},
    notifications: [],
    activeModal: null,

    // Initial Analysis State
    currentDirectory: "D:\\Backup of Important Data for Windows 11 Upgrade\\Native Media AI Studio",
    analysisData: null,
    analysisHistory: [],
    snapshots: [],
    isAnalyzing: false,
    analysisProgress: null,

    // Initial AI State
    availableProviders: ["ollama", "google", "openai"],
    activeProvider: "ollama",
    chatHistory: [],
    insights: [],
    modelConfigs: {
      ollama: {
        temperature: 0.7,
        maxTokens: 2048,
        model: "mistral:7b-instruct",
        enabled: true,
        priority: 1,
      },
      google: {
        temperature: 0.7,
        maxTokens: 2048,
        model: "gemini-pro",
        enabled: true,
        priority: 2,
      },
      openai: {
        temperature: 0.7,
        maxTokens: 2048,
        model: "gpt-4",
        enabled: false,
        priority: 3,
      },
    },

    // Initial Performance State
    metrics: {
      renderTime: 0,
      memoryUsage: 0,
      cacheHitRate: 0,
      lastUpdated: new Date(),
    },
    cacheStats: {
      totalQueries: 0,
      cachedQueries: 0,
      staleQueries: 0,
    },

    // Computed Getters
    get totalFiles() {
      return get().analysisData?.totalFiles || 0;
    },
    get totalSize() {
      return get().analysisData?.totalSize || 0;
    },
    get cacheEfficiency() {
      const stats = get().cacheStats;
      return stats.totalQueries > 0 ? (stats.cachedQueries / stats.totalQueries) * 100 : 0;
    },

    // UI Actions
    setTheme: (theme) => set({ theme }),
    toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    setFocusMode: (active) => set({ focusMode: active }),
    openCommandPalette: () => set({ commandPaletteOpen: true }),
    closeCommandPalette: () => set({ commandPaletteOpen: false }),
    addNotification: (notification) =>
      set((state) => ({
        notifications: [
          ...state.notifications,
          {
            ...notification,
            id: Date.now().toString(),
            timestamp: new Date(),
            autoClose: notification.autoClose ?? true,
            duration: notification.duration ?? 5000,
          },
        ],
      })),
    removeNotification: (id) =>
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      })),
    setActiveModal: (modal) => set({ activeModal: modal }),

    // Analysis Actions
    setCurrentDirectory: (path) => set({ currentDirectory: path }),
    setAnalysisData: (data) => set({ analysisData: data }),
    addToHistory: (data) =>
      set((state) => ({
        analysisHistory: [data, ...state.analysisHistory.slice(0, 9)], // Keep last 10
      })),
    setAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),
    setAnalysisProgress: (progress) => set({ analysisProgress: progress }),
    createSnapshot: (name, data) =>
      set((state) => ({
        snapshots: [
          ...state.snapshots,
          {
            id: Date.now().toString(),
            name,
            data,
            createdAt: new Date(),
            size: JSON.stringify(data).length,
          },
        ],
      })),
    deleteSnapshot: (id) =>
      set((state) => ({
        snapshots: state.snapshots.filter((s) => s.id !== id),
      })),

    // AI Actions
    setActiveProvider: (provider) => set({ activeProvider: provider }),
    addChatMessage: (message) =>
      set((state) => ({
        chatHistory: [
          ...state.chatHistory,
          {
            ...message,
            id: Date.now().toString(),
            timestamp: new Date(),
          },
        ],
      })),
    clearChatHistory: () => set({ chatHistory: [] }),
    addInsight: (insight) =>
      set((state) => ({
        insights: [
          ...state.insights,
          {
            ...insight,
            id: Date.now().toString(),
            timestamp: new Date(),
          },
        ],
      })),
    updateModelConfig: (provider, config) =>
      set((state) => ({
        modelConfigs: {
          ...state.modelConfigs,
          [provider]: { ...state.modelConfigs[provider], ...config },
        },
      })),

    // Performance Actions
    updateMetrics: (metrics) =>
      set((state) => ({
        metrics: { ...state.metrics, ...metrics, lastUpdated: new Date() },
      })),
    updateCacheStats: (stats) =>
      set((state) => ({
        cacheStats: { ...state.cacheStats, ...stats },
      })),

    // Utility Actions
    reset: () =>
      set({
        // Reset to initial state
        theme: "dark",
        sidebarCollapsed: false,
        focusMode: false,
        commandPaletteOpen: false,
        loadingStates: {},
        notifications: [],
        activeModal: null,
        analysisData: null,
        analysisHistory: [],
        isAnalyzing: false,
        analysisProgress: null,
        chatHistory: [],
        insights: [],
      }),
    hydrate: (state) => set(state),
  }))
);

// Selectors for optimized re-renders
export const useUIState = () =>
  useAppStore((state) => ({
    theme: state.theme,
    sidebarCollapsed: state.sidebarCollapsed,
    focusMode: state.focusMode,
    commandPaletteOpen: state.commandPaletteOpen,
    activeModal: state.activeModal,
  }));

export const useAnalysisState = () =>
  useAppStore((state) => ({
    currentDirectory: state.currentDirectory,
    analysisData: state.analysisData,
    analysisHistory: state.analysisHistory,
    snapshots: state.snapshots,
    isAnalyzing: state.isAnalyzing,
    analysisProgress: state.analysisProgress,
    totalFiles: state.totalFiles,
    totalSize: state.totalSize,
  }));

export const useAIState = () =>
  useAppStore((state) => ({
    availableProviders: state.availableProviders,
    activeProvider: state.activeProvider,
    chatHistory: state.chatHistory,
    insights: state.insights,
    modelConfigs: state.modelConfigs,
  }));

export const usePerformanceState = () =>
  useAppStore((state) => ({
    metrics: state.metrics,
    cacheStats: state.cacheStats,
    cacheEfficiency: state.cacheEfficiency,
  }));

export const useNotifications = () => useAppStore((state) => state.notifications);

// Action hooks
export const useUIActions = () =>
  useAppStore((state) => ({
    setTheme: state.setTheme,
    toggleSidebar: state.toggleSidebar,
    setFocusMode: state.setFocusMode,
    openCommandPalette: state.openCommandPalette,
    closeCommandPalette: state.closeCommandPalette,
    setActiveModal: state.setActiveModal,
  }));

export const useAnalysisActions = () =>
  useAppStore((state) => ({
    setCurrentDirectory: state.setCurrentDirectory,
    setAnalysisData: state.setAnalysisData,
    addToHistory: state.addToHistory,
    setAnalyzing: state.setAnalyzing,
    setAnalysisProgress: state.setAnalysisProgress,
    createSnapshot: state.createSnapshot,
    deleteSnapshot: state.deleteSnapshot,
  }));

export const useAIActions = () =>
  useAppStore((state) => ({
    setActiveProvider: state.setActiveProvider,
    addChatMessage: state.addChatMessage,
    clearChatHistory: state.clearChatHistory,
    addInsight: state.addInsight,
    updateModelConfig: state.updateModelConfig,
  }));

export const useNotificationActions = () =>
  useAppStore((state) => ({
    addNotification: state.addNotification,
    removeNotification: state.removeNotification,
  }));
