import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from "react";
import { PortDetector } from "../services/PortDetector";

// Types - Updated to match navigation items
export type ViewType =
  | "analysis"
  | "ai-insights"
  | "visualization"
  | "recommendations"
  | "security"
  | "duplicates"
  | "treemap"
  | "timeline"
  | "learning"
  | "development"
  | "export"
  | "system"
  | "neural"
  | "chat";

interface AnalysisData {
  totalFiles: number;
  totalSize: number;
  categories: Record<string, { count: number; size: number }>;
}

interface AppState {
  currentView: ViewType;
  sidebarCollapsed: boolean;
  analysisData: AnalysisData | null;
  isLoading: boolean;
  error: string | null;
}

interface AppContextType extends AppState {
  setCurrentView: (view: ViewType) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  refreshAnalysisData: () => Promise<void>;
  clearError: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [currentView, setCurrentViewState] = useState<ViewType>("analysis");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setCurrentView = useCallback((view: ViewType) => {
    setCurrentViewState(view);
    // Clear any existing errors when navigating
    setError(null);
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchAnalysisData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get dynamic backend URL
      const portDetector = PortDetector.getInstance();
      const config = await portDetector.detectAllServers();
      const healthUrl = `http://localhost:${config.backend}/health`;

      const response = await fetch(healthUrl);
      if (response.ok) {
        const data = await response.json();
        setAnalysisData(data);
      } else {
        // Mock data for testing
        setAnalysisData({
          totalFiles: 1250,
          totalSize: 50000000000,
          categories: {
            Documents: { count: 450, size: 15000000000 },
            Images: { count: 320, size: 8000000000 },
            Code: { count: 280, size: 12000000000 },
            Videos: { count: 85, size: 25000000000 },
            Audio: { count: 45, size: 3000000000 },
            Archives: { count: 35, size: 8000000000 },
            Other: { count: 15, size: 1000000000 },
          },
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch analysis data";
      setError(errorMessage);
      console.error("Failed to fetch analysis data:", err);

      // Fallback to mock data on error
      setAnalysisData({
        totalFiles: 1250,
        totalSize: 50000000000,
        categories: {
          Documents: { count: 450, size: 15000000000 },
          Images: { count: 320, size: 8000000000 },
          Code: { count: 280, size: 12000000000 },
        },
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshAnalysisData = useCallback(async () => {
    await fetchAnalysisData();
  }, [fetchAnalysisData]);

  // Initial data fetch
  useEffect(() => {
    fetchAnalysisData();
  }, [fetchAnalysisData]);

  const value: AppContextType = {
    currentView,
    sidebarCollapsed,
    analysisData,
    isLoading,
    error,
    setCurrentView,
    toggleSidebar,
    setSidebarCollapsed,
    refreshAnalysisData,
    clearError,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};

export default AppContext;
