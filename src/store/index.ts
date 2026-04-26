import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AnalysisResult } from '../services/AnalysisBridge';

// State interfaces
interface AnalysisState {
  // Analysis data
  analysisResult: AnalysisResult | null;
  isAnalyzing: boolean;
  analysisProgress: number;
  analysisError: string | null;
  currentFile: string;
  filesScanned: number;
  
  // Analysis controls
  startAnalysis: (path: string) => Promise<void>;
  cancelAnalysis: () => void;
  clearAnalysis: () => void;
  updateProgress: (progress: number) => void;
  setAnalysisError: (error: string | null) => void;
}

interface AIState {
  // AI chat state
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }>;
  isChatLoading: boolean;
  chatError: string | null;
  
  // AI insights
  insights: Array<{
    id: string;
    type: 'recommendation' | 'warning' | 'info';
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    timestamp: Date;
  }>;
  
  // AI controls
  addMessage: (message: { role: 'user' | 'assistant'; content: string }) => void;
  clearChat: () => void;
  setChatLoading: (loading: boolean) => void;
  addInsight: (insight: Omit<AIState['insights'][0], 'id' | 'timestamp'>) => void;
  clearInsights: () => void;
}

interface UIState {
  // Navigation state
  activePage: string;
  sidebarOpen: boolean;
  mobileMenuOpen: boolean;
  
  // Modal state
  modals: {
    aiChat: boolean;
    fileBrowser: boolean;
    settings: boolean;
    export: boolean;
  };
  
  // Theme and accessibility
  theme: 'light' | 'dark' | 'system';
  highContrast: boolean;
  fontSize: 'small' | 'medium' | 'large';
  
  // UI controls
  setActivePage: (page: string) => void;
  toggleSidebar: () => void;
  setMobileMenu: (open: boolean) => void;
  openModal: (modal: keyof UIState['modals']) => void;
  closeModal: (modal: keyof UIState['modals']) => void;
  setTheme: (theme: UIState['theme']) => void;
  toggleHighContrast: () => void;
  setFontSize: (size: UIState['fontSize']) => void;
}

interface NavigationState {
  // Breadcrumb navigation
  breadcrumbs: Array<{
    label: string;
    path: string;
    active: boolean;
  }>;
  
  // Navigation history
  history: string[];
  canGoBack: boolean;
  canGoForward: boolean;
  
  // Navigation controls
  updateBreadcrumbs: (path: string, label: string) => void;
  navigate: (path: string) => void;
  goBack: () => void;
  goForward: () => void;
}

interface ErrorState {
  // Global errors
  globalErrors: Array<{
    id: string;
    message: string;
    type: 'error' | 'warning' | 'info';
    timestamp: Date;
    persistent: boolean;
  }>;
  
  // Error handling
  addError: (error: {
    message: string;
    type?: 'error' | 'warning' | 'info';
    persistent?: boolean;
  }) => void;
  removeError: (id: string) => void;
  clearErrors: () => void;
  clearPersistentErrors: () => void;
}

// Create stores
export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  analysisResult: null,
  isAnalyzing: false,
  analysisProgress: 0,
  analysisError: null,
  currentFile: '',
  filesScanned: 0,
  
  startAnalysis: async (path: string) => {
    set({ isAnalyzing: true, analysisProgress: 0, analysisError: null, currentFile: 'Starting analysis...', filesScanned: 0 });
    
    try {
      // Import bridge dynamically to avoid circular dependencies
      const { bridge } = await import('../services/AnalysisBridge');
      
      const result = await bridge.analyzeDirectoryWithProgress(
        path,
        (progress) => {
          console.log('📊 Progress callback:', progress);
          set({ 
            analysisProgress: progress.percentage,
            currentFile: progress.currentFile || '',
            filesScanned: progress.files || 0
          });
        }
      );
      
      set({ 
        analysisResult: result.result, 
        isAnalyzing: false, 
        analysisProgress: 100,
        currentFile: 'Analysis complete',
        filesScanned: result.result?.totalFiles || 0
      });
    } catch (error) {
      set({ 
        isAnalyzing: false, 
        analysisError: error instanceof Error ? error.message : 'Analysis failed',
        currentFile: '',
        filesScanned: 0
      });
    }
  },
  
  cancelAnalysis: () => {
    set({ isAnalyzing: false, analysisProgress: 0, currentFile: '', filesScanned: 0 });
  },
  
  clearAnalysis: () => {
    set({ analysisResult: null, analysisProgress: 0, analysisError: null, currentFile: '', filesScanned: 0 });
  },
  
  updateProgress: (progress: number) => {
    set({ analysisProgress: progress });
  },
  
  setAnalysisError: (error: string | null) => {
    set({ analysisError: error });
  }
}));

export const useAIStore = create<AIState>((set, get) => ({
  messages: [],
  isChatLoading: false,
  chatError: null,
  insights: [],
  
  addMessage: (message) => {
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: Date.now().toString(),
          ...message,
          timestamp: new Date()
        }
      ]
    }));
  },
  
  clearChat: () => {
    set({ messages: [], chatError: null });
  },
  
  setChatLoading: (loading: boolean) => {
    set({ isChatLoading: loading });
  },
  
  addInsight: (insight) => {
    set((state) => ({
      insights: [
        ...state.insights,
        {
          ...insight,
          id: Date.now().toString(),
          timestamp: new Date()
        }
      ]
    }));
  },
  
  clearInsights: () => {
    set({ insights: [] });
  }
}));

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      activePage: 'dashboard',
      sidebarOpen: true,
      mobileMenuOpen: false,
      modals: {
        aiChat: false,
        fileBrowser: false,
        settings: false,
        export: false
      },
      theme: 'dark',
      highContrast: false,
      fontSize: 'medium',
      
      setActivePage: (page: string) => set({ activePage: page }),
      
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      
      setMobileMenu: (open: boolean) => set({ mobileMenuOpen: open }),
      
      openModal: (modal: keyof UIState['modals']) => 
        set((state) => ({ modals: { ...state.modals, [modal]: true } })),
      
      closeModal: (modal: keyof UIState['modals']) => 
        set((state) => ({ modals: { ...state.modals, [modal]: false } })),
      
      setTheme: (theme: UIState['theme']) => set({ theme }),
      
      toggleHighContrast: () => set((state) => ({ highContrast: !state.highContrast })),
      
      setFontSize: (size: UIState['fontSize']) => set({ fontSize: size })
    }),
    {
      name: 'space-analyzer-ui',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        highContrast: state.highContrast,
        fontSize: state.fontSize,
        sidebarOpen: state.sidebarOpen
      })
    }
  )
);

export const useNavigationStore = create<NavigationState>((set, get) => ({
  breadcrumbs: [],
  history: [],
  canGoBack: false,
  canGoForward: false,
  
  updateBreadcrumbs: (path: string, label: string) => {
    const segments = path.split('/').filter(Boolean);
    const breadcrumbs = segments.map((segment, index) => {
      const path = segments.slice(0, index + 1).join('/');
      return {
        label: segment.charAt(0).toUpperCase() + segment.slice(1),
        path: `/${path}`,
        active: index === segments.length - 1
      };
    });
    
    set({ breadcrumbs });
  },
  
  navigate: (path: string) => {
    const state = get();
    const newHistory = [...state.history, path];
    
    set({
      history: newHistory,
      canGoBack: newHistory.length > 1,
      canGoForward: false
    });
  },
  
  goBack: () => {
    const state = get();
    if (!state.canGoBack) return;
    
    const newHistory = state.history.slice(0, -1);
    set({
      history: newHistory,
      canGoBack: newHistory.length > 1,
      canGoForward: true
    });
  },
  
  goForward: () => {
    // Implementation for forward navigation
    // This would need to be enhanced with a forward stack
  }
}));

export const useErrorStore = create<ErrorState>((set, get) => ({
  globalErrors: [],
  
  addError: (error) => {
    const newError = {
      id: Date.now().toString(),
      message: error.message,
      type: error.type || 'error',
      timestamp: new Date(),
      persistent: error.persistent || false
    };
    
    set((state) => ({
      globalErrors: [...state.globalErrors, newError]
    }));
    
    // Auto-remove non-persistent errors after 5 seconds
    if (!error.persistent) {
      setTimeout(() => {
        get().removeError(newError.id);
      }, 5000);
    }
  },
  
  removeError: (id: string) => {
    set((state) => ({
      globalErrors: state.globalErrors.filter(error => error.id !== id)
    }));
  },
  
  clearErrors: () => {
    set({ globalErrors: [] });
  },
  
  clearPersistentErrors: () => {
    set((state) => ({
      globalErrors: state.globalErrors.filter(error => !error.persistent)
    }));
  }
}));

// Combined store hook for accessing all stores
export const useAppStore = () => ({
  analysis: useAnalysisStore(),
  ai: useAIStore(),
  ui: useUIStore(),
  navigation: useNavigationStore(),
  errors: useErrorStore()
});