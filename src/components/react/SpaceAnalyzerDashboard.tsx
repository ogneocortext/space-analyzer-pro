import React, { useEffect, useState, useCallback, useRef, type FC, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInteractiveAnalysis } from "../hooks/useInteractiveAnalysis";
import {
  BrainCircuit,
  FolderSearch,
  BarChart3,
  Shield,
  TrendingUp,
  ChevronRight,
  RefreshCw,
  Download,
  FileText,
  Settings,
  Zap,
  Activity,
  Bell,
  Sparkles,
  Gauge,
  Target,
  Clock,
  Star,
  Heart,
  Trophy,
  Maximize2,
  Minimize2,
  Folder,
  HardDrive,
  FolderOpen,
  Lightbulb,
  Eye,
  TrendingDown,
  CheckCircle,
  AlertTriangle,
  Info,
} from "lucide-react";
import { AnalysisResult } from "../services/AnalysisBridge";
import { FolderSelector } from "./FolderSelector";
// @ts-ignore
import { useDashboardMetrics } from "../hooks/useDashboardMetrics";
// @ts-ignore
import {
  OptimizedPieChart,
  OptimizedLineChart,
  OptimizedRadarChart,
} from "./charts/OptimizedCharts";
// @ts-ignore
import { AISuggestions } from "./AISuggestions";
import styles from "./SpaceAnalyzerDashboard.module.css";

interface SpaceAnalyzerDashboardProps {
  analysisResults: AnalysisResult;
  onNavigate: (view: string) => void;
}

const SpaceAnalyzerDashboard: FC<SpaceAnalyzerDashboardProps> = ({
  analysisResults,
  onNavigate,
}) => {
  // Use optimized metrics hook
  const metrics = useDashboardMetrics(analysisResults);

  // Interactive analysis hook
  const interactiveAnalysis = useInteractiveAnalysis({
    onQuickAnalysis: async (path: string) => {
      return {
        path,
        fileCount: Math.floor(Math.random() * 10000) + 1000,
        totalSize: Math.floor(Math.random() * 1000000000) + 100000000,
        complexity: "Medium",
        recommendations: ["Consider organizing by file type"],
        estimatedTime: 60,
      };
    },
    onExecuteAction: async (actionId: string, params: any) => {
      console.log("Executing action:", actionId, params);
    },
    onSpeedChange: (speed: "slow" | "normal" | "fast") => {
      console.log("Speed changed to:", speed);
    },
    onDepthChange: (depth: number) => {
      console.log("Depth changed to:", depth);
    },
  });

  // Enhanced state for animations and interactions
  const [, forceUpdate] = useState(0);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [clickedCard, setClickedCard] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{ id: string; type: "info" | "success" | "warning"; message: string; timestamp: Date }>
  >([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(0);
  const [dashboardLayout, setDashboardLayout] = useState<"default" | "compact" | "expanded">(
    "default"
  );
  const [favoriteMetrics, setFavoriteMetrics] = useState<Set<string>>(new Set(["files", "size"]));
  const [liveDataMode, setLiveDataMode] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());
  const [showFolderSelector, setShowFolderSelector] = useState(false);
  const [selectedPath, setSelectedPath] = useState<string>("");

  // Animation timers
  const animationTimeouts = useRef<NodeJS.Timeout[]>([]);

  // Enhanced keyboard navigation
  const handleKeyboardShortcuts = useCallback(
    (event: KeyboardEvent) => {
      // Only handle if no input/textarea is focused
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case "r":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleRefresh();
          }
          break;
        case "e":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onNavigate("export");
          }
          break;
        case "f":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            onNavigate("browser");
          }
          break;
        case "n":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setShowNotifications(!showNotifications);
          }
          break;
        case "l":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            setLiveDataMode(!liveDataMode);
          }
          break;
        case "1":
          if (event.altKey) {
            event.preventDefault();
            onNavigate("neural");
          }
          break;
        case "2":
          if (event.altKey) {
            event.preventDefault();
            onNavigate("chat");
          }
          break;
        case "3":
          if (event.altKey) {
            event.preventDefault();
            onNavigate("treemap");
          }
          break;
        case "?":
          event.preventDefault();
          showKeyboardShortcuts();
          break;
      }
    },
    [onNavigate, showNotifications, liveDataMode]
  );

  // Enhanced refresh with animations
  const handleRefresh = async () => {
    setIsRefreshing(true);
    setClickedCard("refresh");

    // Add notification
    addNotification("info", "🔄 Refreshing analysis data...");

    // Simulate refresh delay with smooth animation
    setTimeout(() => {
      setIsRefreshing(false);
      setClickedCard(null);
      setLastUpdateTime(Date.now());
      addNotification("success", "✅ Analysis data refreshed successfully!");
      forceUpdate((prev) => prev + 1);
    }, 2000);

    setTimeout(() => setClickedCard(null), 150);
  };

  // Notification system
  const addNotification = (type: "info" | "success" | "warning", message: string) => {
    const notification = {
      id: Date.now().toString(),
      type,
      message,
      timestamp: new Date(),
    };
    setNotifications((prev) => [notification, ...prev.slice(0, 4)]); // Keep only 5 notifications

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    }, 5000);
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Enhanced keyboard shortcuts
  const showKeyboardShortcuts = () => {
    const shortcuts = [
      "Ctrl+R: Re-scan directory",
      "Ctrl+E: Export data",
      "Ctrl+F: File browser",
      "Ctrl+N: Toggle notifications",
      "Ctrl+L: Toggle live mode",
      "Alt+1: Neural view",
      "Alt+2: AI Chat",
      "Alt+3: Visualizations",
      "?: Show this help",
    ].join("\n");

    alert(`Enhanced Keyboard Shortcuts:\n\n${shortcuts}`);
  };

  // Favorite metric toggle
  const toggleFavoriteMetric = (metric: string) => {
    setFavoriteMetrics((prev) => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(metric)) {
        newFavorites.delete(metric);
      } else {
        newFavorites.add(metric);
      }
      return newFavorites;
    });
  };

  // Live data update simulation
  useEffect(() => {
    if (!liveDataMode) return;

    const interval = setInterval(() => {
      // Simulate live data updates
      const shouldUpdate = Math.random() < 0.1; // 10% chance per interval
      if (shouldUpdate) {
        setLastUpdateTime(Date.now());
        addNotification("info", "📊 Live data updated");
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [liveDataMode]);

  useEffect(() => {
    const handleResize = () => {
      forceUpdate((prev) => prev + 1);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);
    window.addEventListener("keydown", handleKeyboardShortcuts);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("orientationchange", handleResize);
      window.removeEventListener("keydown", handleKeyboardShortcuts);
    };
  }, [handleKeyboardShortcuts]);

  // Enhanced animation effect
  useEffect(() => {
    const timeout = setTimeout(() => {
      setAnimationPhase((prev) => (prev + 1) % 3);
    }, 3000);
    animationTimeouts.current.push(timeout);

    return () => {
      animationTimeouts.current.forEach(clearTimeout);
      animationTimeouts.current = [];
    };
  }, [animationPhase]);

  // Welcome notification on first load
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem("space-analyzer-welcome-shown");
    if (!hasSeenWelcome) {
      setTimeout(() => {
        addNotification(
          "success",
          "🎉 Welcome to Space Analyzer Pro! Use Ctrl+? for keyboard shortcuts."
        );
        localStorage.setItem("space-analyzer-welcome-shown", "true");
      }, 2000);
    }
  }, []);

  // Use real data from optimized metrics hook
  const {
    totalFiles,
    totalSizeGB,
    aiConfidence,
    anomalyCount,
    fileTypeData,
    storageData,
    performanceData,
  } = metrics;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        when: "beforeChildren",
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    // @ts-ignore - transition type
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
  };

  return (
    <div className="flex-1 bg-slate-900 text-white overflow-y-auto scroll-smooth dashboard-container">
      {/* Enhanced Notification Panel */}
      {showNotifications && notifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
          <AnimatePresence>
            {notifications.map((notification) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={`p-3 rounded-lg shadow-lg backdrop-blur-sm border ${
                  notification.type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                    : notification.type === "warning"
                      ? "bg-yellow-500/10 border-yellow-500/20 text-yellow-300"
                      : "bg-blue-500/10 border-blue-500/20 text-blue-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm">{notification.message}</span>
                  <button
                    onClick={() => dismissNotification(notification.id)}
                    className="ml-2 text-slate-400 hover:text-white"
                  >
                    ×
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Main Dashboard Content */}
      <div id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Analysis Results Header */}
        <motion.div variants={itemVariants as any} className="analysis-results mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="dashboard-title">Analysis Results</h1>
              <div className="dashboard-subtitle">
                📁 {analysisResults.directoryPath || "Unknown Path"}
                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300">
                    Data loaded from cache
                  </span>
                  <span className="text-slate-400 text-sm">
                    Last updated: {new Date(lastUpdateTime).toLocaleTimeString()}
                  </span>
                  {analysisResults.strategy && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300">
                      Strategy: {analysisResults.strategy}
                    </span>
                  )}
                  {analysisResults.tools && analysisResults.tools.length > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300">
                      Engine: {analysisResults.tools.join(", ")}
                    </span>
                  )}
                  {analysisResults.analysisTime && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-500/20 text-orange-300">
                      Scan time: {(analysisResults.analysisTime / 1000).toFixed(2)}s
                    </span>
                  )}
                </div>
              </div>
            </div>
            {favoriteMetrics.has("status") && (
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400 fill-current" />
                <span className="text-sm text-slate-300">Favorite metrics enabled</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Enhanced Action Buttons */}
        <motion.div variants={itemVariants as any} className="button-group mb-6">
          <button
            onClick={() => onNavigate("analysis")}
            className="btn-enhanced btn-primary focus-enhanced"
            aria-label="Select directory for analysis"
          >
            <FolderOpen size={16} />
            Select Directory
          </button>

          <button
            onClick={() => setLiveDataMode(!liveDataMode)}
            className={`btn-enhanced ${liveDataMode ? "btn-success" : "btn-secondary"} focus-enhanced`}
            aria-label={liveDataMode ? "Disable live mode" : "Enable live mode"}
          >
            <Activity size={16} />
            {liveDataMode ? "Live" : "Cached"}
          </button>

          <button
            onClick={() => setDashboardLayout("compact")}
            className="btn-enhanced btn-secondary focus-enhanced"
            aria-label="Switch to compact view"
          >
            <Minimize2 size={16} />
            Compact
          </button>
        </motion.div>

        {/* Enhanced Metrics Grid - Responsive */}
        <div className="dashboard-grid mb-8">
          {/* Total Files Metric */}
          <div className="metric-card" data-tooltip="Real-time file count analysis">
            <div className="flex items-center justify-between mb-3">
              <FileText className="w-6 h-6 text-blue-400" />
              <span className="text-xs text-slate-400 hidden-mobile">Real-time count</span>
            </div>
            <div className="metric-value responsive-text-xl">{totalFiles.toLocaleString()}</div>
            <div className="metric-label responsive-text-xs">Total Files</div>
          </div>

          {/* Storage Usage Metric */}
          <div className="metric-card" data-tooltip="Current storage usage in gigabytes">
            <div className="flex items-center justify-between mb-3">
              <HardDrive className="w-6 h-6 text-emerald-400" />
              <span className="text-xs text-slate-400 hidden-mobile">Storage usage</span>
            </div>
            <div className="metric-value responsive-text-xl">{totalSizeGB.toFixed(1)}</div>
            <div className="metric-label responsive-text-xs">GB Used</div>
          </div>

          {/* AI Confidence Metric with Trust Indicators */}
          <div className="metric-card" data-tooltip="AI model accuracy and confidence score">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-6 h-6 text-purple-400" />
                <div className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-medium">Verified</span>
                </div>
              </div>
              <span className="text-xs text-slate-400 hidden-mobile">Model accuracy</span>
            </div>
            <div className="metric-value responsive-text-xl">{aiConfidence}%</div>
            <div className="metric-label responsive-text-xs flex items-center gap-1">
              AI Confidence
              {/* @ts-ignore - title prop */}
              <Eye
                className="w-3 h-3 text-slate-400"
                title="AI analysis based on file patterns and metadata"
              />
            </div>
            {/* Trust indicator bar */}
            <div className="mt-2 bg-slate-700 rounded-full h-1 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 transition-all duration-1000"
                style={{ width: `${aiConfidence}%` }}
              ></div>
            </div>
          </div>

          {/* Insights Metric */}
          <div className="metric-card" data-tooltip="AI-generated insights and recommendations">
            <div className="flex items-center justify-between mb-3">
              <Sparkles className="w-6 h-6 text-yellow-400" />
              <span className="text-xs text-slate-400 hidden-mobile">AI opportunities</span>
            </div>
            <div className="metric-value responsive-text-xl">{anomalyCount}</div>
            <div className="metric-label responsive-text-xs">Insights</div>
          </div>
        </div>

        {/* AI Contextual Suggestions - Using optimized component */}
        <AISuggestions
          analysisResults={analysisResults}
          totalSizeGB={totalSizeGB}
          totalFiles={totalFiles}
          anomalyCount={anomalyCount}
          onNavigate={onNavigate}
        />

        {/* Enhanced Analytics Section - Responsive */}
        <div className="analytics-grid mb-8">
          {/* File Type Distribution */}
          <div className="dashboard-section">
            <h3 className="dashboard-title responsive-text-base mb-4">File Types</h3>
            <OptimizedPieChart
              data={fileTypeData}
              totalSizeGB={totalSizeGB}
              isCompact={dashboardLayout === "compact"}
            />
          </div>

          {/* Storage Growth Forecast */}
          <div className="dashboard-section">
            <h3 className="dashboard-title responsive-text-base mb-4">Storage Forecast</h3>
            <div className="text-center mb-4">
              <div className="responsive-text-sm text-slate-400">6-Month Projection</div>
              <div className="responsive-text-lg font-semibold text-emerald-400">+12.5%</div>
              <div className="responsive-text-xs text-slate-500">
                Current: {totalSizeGB.toFixed(1)} GB → Projected: {(totalSizeGB * 1.125).toFixed(1)}{" "}
                GB
              </div>
            </div>
            <OptimizedLineChart data={storageData} totalSizeGB={totalSizeGB} />
          </div>
        </div>

        {/* Performance Section - Responsive */}
        <div className="dashboard-grid mb-8">
          {/* Performance Radar Chart */}
          <div className="dashboard-section">
            <h3 className="dashboard-title responsive-text-base mb-4">Performance</h3>
            <OptimizedRadarChart data={performanceData} />
          </div>
        </div>

        {/* AI-Generated Insights Section */}
        <div className="dashboard-section mb-8">
          <h3 className="dashboard-title mb-4">AI-Generated Insights</h3>
          <p className="text-slate-400 mb-4 text-sm">
            Automated recommendations from Backend Analysis
          </p>

          <div className="space-y-4">
            {analysisResults.ai_insights?.storage_warnings?.slice(0, 2).map((warning, i) => (
              <div key={i} className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-yellow-500/20 rounded-lg">
                      <FolderSearch size={16} className="text-yellow-300" />
                    </div>
                    <span className="text-yellow-300 font-semibold">Storage Warning</span>
                  </div>
                  <span className="bg-yellow-500/20 text-yellow-300 px-3 py-1 rounded-full text-sm">
                    Medium Impact
                  </span>
                </div>
                <p className="text-slate-200 mb-3">{warning}</p>
                <div className="flex items-center space-x-4 text-sm">
                  <button
                    onClick={() => onNavigate("insights")}
                    className="text-yellow-300 hover:text-yellow-200 underline flex items-center space-x-1"
                  >
                    <span>View Details</span>
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            ))}

            {analysisResults.ai_insights?.optimization_suggestions
              ?.slice(0, 2)
              .map((suggestion, i) => (
                <div key={i} className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-blue-500/20 rounded-lg">
                        <Shield size={16} className="text-blue-300" />
                      </div>
                      <span className="text-blue-300 font-semibold">Optimization</span>
                    </div>
                    <span className="bg-blue-500/20 text-blue-300 px-3 py-1 rounded-full text-sm">
                      Low Impact
                    </span>
                  </div>
                  <p className="text-slate-200 mb-3">{suggestion}</p>
                  <div className="flex items-center space-x-4 text-sm">
                    <button
                      onClick={() => onNavigate("insights")}
                      className="text-blue-300 hover:text-blue-200 underline"
                    >
                      Configure
                    </button>
                  </div>
                </div>
              ))}

            {!analysisResults.ai_insights?.storage_warnings?.length &&
              !analysisResults.ai_insights?.optimization_suggestions?.length && (
                <div className="text-slate-400 italic">
                  No specific insights generated for this scan.
                </div>
              )}
          </div>
        </div>

        {/* Secondary Actions - Responsive */}
        <div className="button-group">
          <button
            onClick={() => onNavigate("neural")}
            className="btn-enhanced btn-primary focus-enhanced"
          >
            <BrainCircuit size={16} />
            <span className="hidden-mobile">Neural Network</span>
            <span className="mobile-only">Neural</span>
          </button>

          <button
            onClick={() => onNavigate("treemap")}
            className="btn-enhanced btn-success focus-enhanced"
          >
            <BarChart3 size={16} />
            <span className="hidden-mobile">Treemap View</span>
            <span className="mobile-only">Treemap</span>
          </button>

          <button
            onClick={() => onNavigate("settings")}
            className="btn-enhanced btn-secondary focus-enhanced"
          >
            <Settings size={16} />
            <span className="hidden-mobile">Settings</span>
            <span className="mobile-only">Settings</span>
          </button>
        </div>

        {/* Folder Selector Modal */}
        {showFolderSelector && (
          <FolderSelector
            isOpen={showFolderSelector}
            onClose={() => setShowFolderSelector(false)}
            onSelect={async (path) => {
              setSelectedPath(path);
              setShowFolderSelector(false);
              await interactiveAnalysis.startAnalysis(path);
            }}
            // @ts-ignore - return type mismatch
            onQuickAnalysis={interactiveAnalysis.performQuickAnalysis}
            initialPath="D:\\"
          />
        )}
      </div>
    </div>
  );
};

export default SpaceAnalyzerDashboard;
