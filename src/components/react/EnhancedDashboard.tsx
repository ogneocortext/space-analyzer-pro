import React, { useState, useEffect, useCallback } from "react";
// @ts-ignore - react-router-dom
import { useNavigate } from "react-router-dom";
import { useAnalysisStore, useUIStore, useErrorStore } from "../store";
import { useErrorHandler } from "./ErrorBoundary";
import {
  LayoutDashboard,
  BrainCircuit,
  MessageSquare,
  BarChart3,
  Folder,
  FileText,
  Settings,
  AlertTriangle,
  TrendingUp,
  Database,
  Cpu,
  Activity,
  Play,
  RefreshCw,
  Clock,
  Users,
  Globe2,
  Info,
  CheckCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Database as DatabaseIcon,
  Cpu as CpuIcon,
  Activity as ActivityIcon,
  TrendingUp as TrendingUpIcon,
  Clock as ClockIcon,
  Users as UsersIcon,
  Globe2 as Globe2Icon,
  Play as PlayIcon,
  RefreshCw as RefreshCwIcon,
  AlertTriangle as AlertTriangleIcon,
  BarChart3 as BarChart3Icon,
  Folder as FolderIcon,
  FileText as FileTextIcon,
  Settings as SettingsIcon,
  MessageSquare as MessageSquareIcon,
  BrainCircuit as BrainCircuitIcon,
} from "lucide-react";

interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  beta?: boolean;
}

interface SystemStatus {
  status: "healthy" | "warning" | "error";
  message: string;
  lastCheck: Date;
}

const EnhancedDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { analysisResult, isAnalyzing, analysisProgress, analysisError } = useAnalysisStore();
  const { theme, fontSize } = useUIStore();
  const { addError } = useErrorStore();
  const { error } = useErrorHandler();

  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    status: "healthy",
    message: "All systems operational",
    lastCheck: new Date(),
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [recentActivity, setRecentActivity] = useState<
    Array<{
      id: string;
      action: string;
      timestamp: Date;
      status: "success" | "warning" | "error";
    }>
  >([
    {
      id: "1",
      action: "Analysis completed",
      timestamp: new Date(Date.now() - 60000),
      status: "success",
    },
    {
      id: "2",
      action: "AI insights generated",
      timestamp: new Date(Date.now() - 300000),
      status: "success",
    },
    {
      id: "3",
      action: "File scan started",
      timestamp: new Date(Date.now() - 3600000),
      status: "success",
    },
  ]);

  const quickActions: QuickAction[] = [
    {
      id: "analyze",
      label: "Start Analysis",
      description: "Analyze a directory or file",
      icon: PlayIcon,
      onClick: () => navigate("/file-browser"),
      disabled: isAnalyzing,
    },
    {
      id: "ai-chat",
      label: "AI Assistant",
      description: "Chat with AI about your files",
      icon: MessageSquareIcon,
      onClick: () => navigate("/ai-chat"),
    },
    {
      id: "neural-view",
      label: "Neural View",
      description: "View AI-powered relationships",
      icon: BrainCircuitIcon,
      onClick: () => navigate("/neural"),
      beta: true,
    },
    {
      id: "visualizations",
      label: "Visualizations",
      description: "Interactive data charts",
      icon: BarChart3Icon,
      onClick: () => navigate("/treemap"),
    },
    {
      id: "file-browser",
      label: "File Browser",
      description: "Browse and manage files",
      icon: FolderIcon,
      onClick: () => navigate("/file-browser"),
    },
    {
      id: "export-data",
      label: "Export Data",
      description: "Export analysis results",
      icon: FileTextIcon,
      onClick: () => navigate("/export"),
    },
    {
      id: "settings",
      label: "Settings",
      description: "Configure application",
      icon: SettingsIcon,
      onClick: () => navigate("/settings"),
    },
  ];

  // Extract semantic context from analysis result
  const extractSemanticContext = useCallback(() => {
    const files = (analysisResult as any)?.files || [];
    const semanticTags = new Set<string>();
    const categories = new Set<string>();

    files.forEach((file: any) => {
      if (file.semantic_tags) {
        file.semantic_tags.forEach((tag: string) => semanticTags.add(tag));
      }
      if (file.category) {
        categories.add(file.category);
      }
    });

    const allTags = Array.from(semanticTags);

    return {
      technologies: allTags
        .filter((tag) =>
          [
            "javascript",
            "typescript",
            "python",
            "rust",
            "cpp",
            "java",
            "go",
            "php",
            "ruby",
            "swift",
            "kotlin",
            "scala",
            "csharp",
            "haskell",
            "dart",
            "lua",
            "r",
          ].includes(tag)
        )
        .slice(0, 5),
      platforms: allTags
        .filter((tag) =>
          [
            "windows",
            "linux",
            "macos",
            "ios",
            "android",
            "jvm",
            ".net",
            "apple",
            "microsoft",
            "unix",
          ].includes(tag)
        )
        .slice(0, 5),
      categories: Array.from(categories).slice(0, 5),
    };
  }, [analysisResult]);

  const semanticContext = extractSemanticContext();

  const stats = [
    {
      label: "Total Files",
      value: ((analysisResult as any)?.totalFiles || 0).toLocaleString(),
      icon: DatabaseIcon,
      trend: "+12%",
      trendType: "positive" as const,
    },
    {
      label: "Total Size",
      value: `${((analysisResult?.totalSize || 0) / 1024 / 1024).toFixed(2)} MB`,
      icon: CpuIcon,
      trend: "+8%",
      trendType: "positive" as const,
    },
    {
      label: "Analysis Time",
      value: analysisResult?.analysisTime || "0s",
      icon: ClockIcon,
      trend: "-15%",
      trendType: "negative" as const,
    },
    {
      label: "AI Insights",
      value: ((analysisResult as any)?.insights?.length || 0) as number,
      icon: UsersIcon,
      trend: "+25%",
      trendType: "positive" as const,
    },
  ];

  // Update system status based on analysis state
  useEffect(() => {
    if (analysisError) {
      setSystemStatus({
        status: "error",
        message: "Analysis error detected",
        lastCheck: new Date(),
      });
    } else if (isAnalyzing) {
      setSystemStatus({
        status: "warning",
        message: "Analysis in progress",
        lastCheck: new Date(),
      });
    } else {
      setSystemStatus({
        status: "healthy",
        message: "All systems operational",
        lastCheck: new Date(),
      });
    }
  }, [analysisError, isAnalyzing]);

  const handleActionClick = (action: QuickAction) => {
    if (action.disabled) return;

    try {
      action.onClick();

      // Add to recent activity
      setRecentActivity((prev) => [
        {
          id: Date.now().toString(),
          // @ts-ignore - action property
          action: (action as any).action,
          timestamp: new Date(),
          status: "success",
        },
        ...prev.slice(0, 4),
      ]);
    } catch (err) {
      error(err as Error, `Action ${action.label}`);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getStatusColor = (status: SystemStatus["status"]) => {
    switch (status) {
      case "healthy":
        return "text-green-400";
      case "warning":
        return "text-yellow-400";
      case "error":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  const getStatusIcon = (status: SystemStatus["status"]) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "warning":
        return <AlertTriangleIcon className="w-4 h-4 text-yellow-400" />;
      case "error":
        return <AlertTriangleIcon className="w-4 h-4 text-red-400" />;
      default:
        return <Info className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#00B4D8] to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                <LayoutDashboard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Analysis Insights</h1>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search files, insights, or actions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/20 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8] transition-all"
                />
              </div>
            </div>

            {/* System Status */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-lg border border-white/20">
                {getStatusIcon(systemStatus.status)}
                <span className={`text-sm font-medium ${getStatusColor(systemStatus.status)}`}>
                  {systemStatus.message}
                </span>
              </div>
              <button
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/20 text-white rounded-lg transition-colors"
                title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isSidebarCollapsed ? (
                  <ChevronRight className="w-4 h-4" />
                ) : (
                  <ChevronLeft className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-4 py-2 bg-[#00B4D8]/20 hover:bg-[#00B4D8]/30 border border-[#00B4D8]/40 text-[#00B4D8] rounded-lg transition-colors"
              >
                <RefreshCwIcon className="w-4 h-4" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Analysis Progress */}
        {isAnalyzing && (
          <div className="mb-8 bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#00B4D8]/20 rounded-full flex items-center justify-center animate-spin">
                  <ActivityIcon className="w-4 h-4 text-[#00B4D8]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Analysis in Progress</h3>
                  <p className="text-slate-200">Scanning files and generating insights...</p>
                </div>
              </div>
              <span className="text-lg font-bold text-[#00B4D8]">{analysisProgress}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div
                className="bg-gradient-to-r from-[#00B4D8] to-purple-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Display */}
        {analysisError && (
          <div className="mb-8 bg-red-500/20 border border-red-500/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <AlertTriangleIcon className="w-5 h-5 text-red-400" />
              <div className="flex-1">
                <h3 className="text-white font-semibold">Analysis Error</h3>
                <p className="text-red-300 text-sm">{analysisError}</p>
              </div>
              <button
                onClick={() => useAnalysisStore.getState().setAnalysisError(null)}
                className="text-red-400 hover:text-red-300"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-8">
          {/* Main Content */}
          <div
            className={`flex-1 space-y-8 transition-all duration-300 ${isSidebarCollapsed ? "lg:col-span-3" : "lg:col-span-2"}`}
          >
            {/* Quick Actions */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Quick Actions</h2>
                <span className="text-sm text-slate-200">Get started in seconds</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {quickActions.slice(0, 6).map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleActionClick(action)}
                    disabled={action.disabled}
                    className={`p-3 rounded-lg border transition-all duration-200 hover:scale-105 flex flex-col items-center gap-2 ${
                      action.disabled
                        ? "bg-slate-800/50 border-slate-700 text-slate-500 cursor-not-allowed"
                        : "bg-white/5 border-white/20 text-white hover:bg-white/10 hover:border-white/40"
                    } ${action.beta ? "relative" : ""}`}
                  >
                    <action.icon
                      className={`w-5 h-5 ${action.disabled ? "text-slate-500" : "text-[#00B4D8]"}`}
                    />
                    <span className="text-xs font-medium text-center">{action.label}</span>
                    {action.beta && (
                      <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-[#00B4D8]/20 text-[#00B4D8] text-[10px] rounded-full border border-[#00B4D8]/30">
                        Beta
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Statistics */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">System Statistics</h2>
                <span className="text-sm text-slate-200">
                  Last updated: {systemStatus.lastCheck.toLocaleTimeString()}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {stats.map((stat, index) => (
                  <div key={index} className="bg-white/5 border border-white/20 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <stat.icon className="w-6 h-6 text-[#00B4D8]" />
                        <div>
                          <div className="text-sm text-slate-200">{stat.label}</div>
                          <div className="text-2xl font-bold text-white">{stat.value}</div>
                        </div>
                      </div>
                      <div
                        className={`text-sm font-medium ${
                          stat.trendType === "positive" ? "text-[#00B4D8]" : "text-amber-400"
                        }`}
                      >
                        {stat.trend}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Recent Activity</h2>
                <button
                  onClick={() => setRecentActivity([])}
                  className="text-sm text-slate-200 hover:text-white"
                >
                  Clear
                </button>
              </div>
              <div className="space-y-3">
                {recentActivity.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center justify-between p-3 bg-white/5 border border-white/20 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          activity.status === "success"
                            ? "bg-[#00B4D8]"
                            : activity.status === "warning"
                              ? "bg-amber-400"
                              : "bg-red-400"
                        }`}
                      />
                      <div>
                        <div className="text-white font-medium">{activity.action}</div>
                        <div className="text-xs text-slate-300">
                          {activity.timestamp.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        activity.status === "success"
                          ? "bg-[#00B4D8]/20 text-[#00B4D8]"
                          : activity.status === "warning"
                            ? "bg-amber-400/20 text-amber-300"
                            : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {activity.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div
            className={`space-y-8 transition-all duration-300 ${isSidebarCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-80"}`}
          >
            {/* Analysis Summary */}
            {analysisResult && (
              <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Analysis Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">Total Files:</span>
                    <span className="text-white font-medium">
                      {(analysisResult as any)?.totalFiles || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">Total Size:</span>
                    <span className="text-white font-medium">
                      {formatFileSize(analysisResult.totalSize || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">File Types:</span>
                    {/* @ts-ignore - fileTypes property */}
                    <span className="text-white font-medium">
                      {(analysisResult as any).fileTypes?.length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">Analysis Time:</span>
                    <span className="text-white font-medium">{analysisResult.analysisTime}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Semantic Context */}
            {analysisResult &&
              (semanticContext.technologies.length > 0 || semanticContext.platforms.length > 0) && (
                <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Semantic Context</h3>

                  {semanticContext.technologies.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs text-slate-300 mb-2 uppercase tracking-wide">
                        Technologies
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {semanticContext.technologies.map((tech, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-[#00B4D8]/20 text-[#00B4D8] text-xs rounded-md border border-[#00B4D8]/30"
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {semanticContext.platforms.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs text-slate-300 mb-2 uppercase tracking-wide">
                        Platforms
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {semanticContext.platforms.map((platform, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-purple-500/20 text-purple-300 text-xs rounded-md border border-purple-500/30"
                          >
                            {platform}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {semanticContext.categories.length > 0 && (
                    <div>
                      <div className="text-xs text-slate-300 mb-2 uppercase tracking-wide">
                        Categories
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {semanticContext.categories.map((category, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs rounded-md border border-amber-500/30"
                          >
                            {category}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            {/* AI Insights */}
            {/* @ts-ignore - insights property */}
            {(analysisResult as any)?.insights && (analysisResult as any).insights.length > 0 ? (
              <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">AI Insights</h3>
                  <button
                    onClick={() => navigate("/ai-chat")}
                    className="text-sm text-[#00B4D8] hover:text-[#00B4D8]/80"
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {/* @ts-ignore - insights property */}
                  {(analysisResult as any).insights
                    .slice(0, 3)
                    .map((insight: any, index: number) => (
                      <div key={index} className="p-3 bg-white/5 border border-white/20 rounded-lg">
                        <div className="flex items-start gap-3">
                          <BrainCircuitIcon className="w-4 h-4 text-purple-400 mt-0.5" />
                          <div>
                            <div className="text-sm text-white font-medium">{insight.title}</div>
                            <div className="text-xs text-slate-300 mt-1">{insight.description}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">AI Insights</h3>
                </div>
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 bg-[#00B4D8]/20 rounded-full flex items-center justify-center mb-4 animate-pulse">
                    <BrainCircuitIcon className="w-6 h-6 text-[#00B4D8]" />
                  </div>
                  <p className="text-slate-300 text-sm mb-2">Waiting for analysis to complete...</p>
                  <p className="text-slate-400 text-xs">
                    AI insights will appear here after scanning
                  </p>
                </div>
              </div>
            )}

            {/* Tips */}
            <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Tips</h3>
              <div className="space-y-3 text-sm text-slate-200">
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-[#00B4D8] rounded-full mt-2 flex-shrink-0" />
                  <span>
                    Use keyboard shortcuts for faster navigation (Ctrl+D for Dashboard, Ctrl+N for
                    Neural View)
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-amber-400 rounded-full mt-2 flex-shrink-0" />
                  <span>Enable AI features for intelligent file analysis and recommendations</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="w-2 h-2 bg-purple-400 rounded-full mt-2 flex-shrink-0" />
                  <span>Regularly export your analysis data for backup and sharing</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedDashboard;
