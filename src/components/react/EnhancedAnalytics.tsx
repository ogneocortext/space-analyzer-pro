import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  BarChart3,
  PieChart,
  TrendingUp,
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle,
  Zap,
  Target,
  Code,
  Eye,
  Layers,
} from "lucide-react";

interface AnalyticsData {
  totalAnalyses: number;
  successfulAnalyses: number;
  failedAnalyses: number;
  averageResponseTime: number;
  visionAnalyses: number;
  codeAnalyses: number;
  combinedAnalyses: number;
  pagesAnalyzed: string[];
  modelsUsed: string[];
  lastAnalysis: string;
}

interface EnhancedAnalyticsProps {
  data?: AnalyticsData;
  onRunAnalysis?: () => void;
}

/**
 * Enhanced Analytics Component
 * Implements comprehensive analytics dashboard based on MoE analysis
 * Priority 1: Visual hierarchy and data visualization
 */
const EnhancedAnalytics: React.FC<EnhancedAnalyticsProps> = ({
  data = {
    totalAnalyses: 15,
    successfulAnalyses: 12,
    failedAnalyses: 3,
    averageResponseTime: 15243,
    visionAnalyses: 6,
    codeAnalyses: 6,
    combinedAnalyses: 3,
    pagesAnalyzed: ["Landing", "Dashboard", "Explorer"],
    modelsUsed: [
      "llava:7b",
      "deepseek-coder:6.7b",
      "codegemma:7b-instruct",
      "qwen2.5-coder:7b-instruct",
      "codellama:7b-python",
    ],
    lastAnalysis: new Date().toISOString(),
  },
  onRunAnalysis = () => {},
}) => {
  const [selectedTab, setSelectedTab] = useState<
    "overview" | "performance" | "models" | "insights"
  >("overview");
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Priority 1: Visual hierarchy improvements
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 500);
    return () => clearTimeout(timer);
  }, [selectedTab]);

  const successRate =
    data.totalAnalyses > 0 ? (data.successfulAnalyses / data.totalAnalyses) * 100 : 0;
  const avgResponseTimeSeconds = (data.averageResponseTime / 1000).toFixed(1);

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "performance", label: "Performance", icon: TrendingUp },
    { id: "models", label: "Models", icon: Layers },
    { id: "insights", label: "Insights", icon: Target },
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Key Metrics Grid - Priority 1: Visual hierarchy */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">{data.totalAnalyses}</span>
          </div>
          <h3 className="text-sm font-medium text-gray-600">Total Analyses</h3>
          <p className="text-xs text-gray-500 mt-1">Across all pages and models</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-2xl font-bold text-green-600">{successRate.toFixed(1)}%</span>
          </div>
          <h3 className="text-sm font-medium text-gray-600">Success Rate</h3>
          <p className="text-xs text-gray-500 mt-1">
            {data.successfulAnalyses}/{data.totalAnalyses} successful
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">{avgResponseTimeSeconds}s</span>
          </div>
          <h3 className="text-sm font-medium text-gray-600">Avg Response Time</h3>
          <p className="text-xs text-gray-500 mt-1">Per analysis</p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Zap className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">{data.modelsUsed.length}</span>
          </div>
          <h3 className="text-sm font-medium text-gray-600">AI Models</h3>
          <p className="text-xs text-gray-500 mt-1">Active in analysis</p>
        </div>
      </div>

      {/* Analysis Types Breakdown */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Analysis Types</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg">
            <Eye className="w-5 h-5 text-blue-600" />
            <div>
              <p className="font-medium text-blue-900">Vision Analysis</p>
              <p className="text-sm text-blue-700">{data.visionAnalyses} analyses</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg">
            <Code className="w-5 h-5 text-green-600" />
            <div>
              <p className="font-medium text-green-900">Code Analysis</p>
              <p className="text-sm text-green-700">{data.codeAnalyses} analyses</p>
            </div>
          </div>
          <div className="flex items-center space-x-3 p-4 bg-purple-50 rounded-lg">
            <Layers className="w-5 h-5 text-purple-600" />
            <div>
              <p className="font-medium text-purple-900">Combined Analysis</p>
              <p className="text-sm text-purple-700">{data.combinedAnalyses} analyses</p>
            </div>
          </div>
        </div>
      </div>

      {/* Pages Analyzed */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Pages Analyzed</h3>
        <div className="flex flex-wrap gap-2">
          {data.pagesAnalyzed.map((page, index) => (
            <span
              key={page}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium"
            >
              {page}
            </span>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPerformance = () => (
    <div className="space-y-6">
      {/* Performance Metrics */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Average Response Time</p>
              <p className="text-sm text-gray-600">Time per analysis</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">{avgResponseTimeSeconds}s</p>
              <p className="text-sm text-gray-600">Optimal: &lt;30s</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Success Rate</p>
              <p className="text-sm text-gray-600">Analysis completion rate</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-600">{successRate.toFixed(1)}%</p>
              <p className="text-sm text-gray-600">Target: &gt;90%</p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">Total Execution Time</p>
              <p className="text-sm text-gray-600">Complete analysis cycle</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">11.2m</p>
              <p className="text-sm text-gray-600">For 15 analyses</p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Recommendations */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Recommendations</h3>
        <div className="space-y-3">
          <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="font-medium text-yellow-900">Optimize Response Time</p>
              <p className="text-sm text-yellow-700">
                Current average is {avgResponseTimeSeconds}s - consider optimizing model selection
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium text-green-900">Good Success Rate</p>
              <p className="text-sm text-green-700">
                {successRate.toFixed(1)}% success rate is acceptable
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg">
            <Zap className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900">Enable Parallel Processing</p>
              <p className="text-sm text-blue-700">
                Run multiple models simultaneously to reduce total time
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderModels = () => (
    <div className="space-y-6">
      {/* Model Performance */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Model Performance</h3>
        <div className="space-y-4">
          {data.modelsUsed.map((model, index) => {
            const modelData = {
              "llava:7b": { type: "Vision", success: true, avgTime: 15.2 },
              "deepseek-coder:6.7b": { type: "Code", success: false, avgTime: 0 },
              "codegemma:7b-instruct": { type: "Combined", success: true, avgTime: 15.3 },
              "qwen2.5-coder:7b-instruct": { type: "Vision", success: true, avgTime: 15.5 },
              "codellama:7b-python": { type: "Code", success: true, avgTime: 31.4 },
            };

            const info = modelData[model as keyof typeof modelData];

            return (
              <div
                key={model}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-2 h-2 rounded-full ${info.success ? "bg-green-500" : "bg-red-500"}`}
                  ></div>
                  <div>
                    <p className="font-medium text-gray-900">{model}</p>
                    <p className="text-sm text-gray-600">{info.type} Analysis</p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-medium ${info.success ? "text-green-600" : "text-red-600"}`}
                  >
                    {info.success ? "✅ Working" : "⚠️ Issues"}
                  </p>
                  <p className="text-xs text-gray-500">{info.avgTime}s avg</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Model Recommendations */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Model Optimization</h3>
        <div className="space-y-3">
          <div className="p-3 bg-red-50 rounded-lg">
            <p className="font-medium text-red-900 mb-1">Fix deepseek-coder:6.7b</p>
            <p className="text-sm text-red-700">
              Technical Architect model experiencing response format issues
            </p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="font-medium text-blue-900 mb-1">Optimize codellama:7b-python</p>
            <p className="text-sm text-blue-700">Consider faster alternatives for code analysis</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg">
            <p className="font-medium text-green-900 mb-1">Excellent Vision Models</p>
            <p className="text-sm text-green-700">llava:7b and qwen2.5-coder performing well</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderInsights = () => (
    <div className="space-y-6">
      {/* Key Insights */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">AI-Powered Insights</h3>
        <div className="space-y-4">
          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">🎯 Priority 1: Visual Hierarchy</h4>
            <p className="text-sm text-blue-700">
              Enhanced typography, spacing, and layout structure implemented
            </p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg">
            <h4 className="font-medium text-green-900 mb-2">🏗️ Priority 2: Code Architecture</h4>
            <p className="text-sm text-green-700">
              Modular component structure with performance optimizations
            </p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg">
            <h4 className="font-medium text-purple-900 mb-2">🔗 Priority 3: Integration</h4>
            <p className="text-sm text-purple-700">Unified design system with consistent styling</p>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <h4 className="font-medium text-orange-900 mb-2">🎨 Priority 4: UX Enhancements</h4>
            <p className="text-sm text-orange-700">
              Accessibility improvements and interaction design
            </p>
          </div>
        </div>
      </div>

      {/* Implementation Status */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Implementation Status</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-900">Visual Improvements</span>
            </div>
            <span className="text-sm text-green-700">✅ Complete</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="font-medium text-green-900">Performance Optimization</span>
            </div>
            <span className="text-sm text-green-700">✅ Complete</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
              <span className="font-medium text-yellow-900">Model Fixes</span>
            </div>
            <span className="text-sm text-yellow-700">⚠️ In Progress</span>
          </div>
        </div>
      </div>

      {/* Action Items */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Next Actions</h3>
        <div className="space-y-2">
          <button
            onClick={onRunAnalysis}
            className="w-full p-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Run Enhanced Analysis
          </button>
          <button className="w-full p-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
            View Detailed Report
          </button>
          <button className="w-full p-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors">
            Export Analytics Data
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div
      ref={containerRef}
      className={`enhanced-analytics space-y-6 ${isAnimating ? "animate-pulse" : ""}`}
    >
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Enhanced Analytics</h2>
            <p className="text-gray-600">
              Comprehensive MoE analysis insights and performance metrics
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
              Live
            </span>
            <span className="text-sm text-gray-500">
              Last: {new Date(data.lastAnalysis).toLocaleTimeString()}
            </span>
          </div>
        </div>

        {/* Tab Navigation - Priority 1: Visual hierarchy */}
        <div className="flex space-x-1 border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id as any)}
                className={`flex items-center space-x-2 px-4 py-2 border-b-2 font-medium text-sm transition-colors ${
                  selectedTab === tab.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="transition-all duration-300 ease-in-out">
        {selectedTab === "overview" && renderOverview()}
        {selectedTab === "performance" && renderPerformance()}
        {selectedTab === "models" && renderModels()}
        {selectedTab === "insights" && renderInsights()}
      </div>
    </div>
  );
};

export default EnhancedAnalytics;
