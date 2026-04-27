import React, { useState, useCallback, useMemo, memo } from "react";
import {
  BarChart3,
  Download,
  RefreshCw,
  Eye,
  Code,
  Layers,
  TrendingUp,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";

// Result type constants
export const RESULT_TYPES = {
  ALL: "all",
  VISION: "vision",
  CODE: "code",
  COMBINED: "combined",
} as const;

export type ResultTypeType = (typeof RESULT_TYPES)[keyof typeof RESULT_TYPES];

// Analysis type constants
export const ANALYSIS_TYPES = {
  VISION: "vision",
  CODE: "code",
  COMBINED: "combined",
} as const;

export type AnalysisTypeType = (typeof ANALYSIS_TYPES)[keyof typeof ANALYSIS_TYPES];

interface AnalysisResult {
  id: string;
  page: string;
  model: string;
  role: string;
  type: "vision" | "code" | "combined";
  success: boolean;
  analysis?: string;
  timestamp: string;
  responseTime: number;
}

interface AnalysisResultsProps {
  results?: AnalysisResult[];
  onRefresh?: () => void;
  onExport?: () => void;
}

const AnalysisResults: React.FC<AnalysisResultsProps> = memo(
  ({ results = [], onRefresh = () => {}, onExport = () => {} }) => {
    const [selectedFilter, setSelectedFilter] = useState<ResultTypeType>(RESULT_TYPES.ALL);
    const [selectedPage, setSelectedPage] = useState<string>("all");
    const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

    // Mock data for display when no results are provided
    const mockResults = [
      {
        id: "1",
        type: "vision" as const,
        page: "dashboard",
        title: "Dashboard UI Enhancement",
        success: true,
        analysis:
          "Implemented responsive design improvements with better accessibility features and enhanced user interactions.",
        timestamp: "2026-01-19T02:03:58.114Z",
        responseTime: 2341,
      },
      {
        id: "2",
        type: "performance" as const,
        page: "neural",
        title: "Neural Network Performance",
        success: true,
        analysis:
          "Optimized neural physics calculations with Web Workers, achieving 60fps animations and reduced memory usage.",
        timestamp: "2026-01-19T02:03:58.114Z",
        responseTime: 15678,
      },
      {
        id: "3",
        type: "ai" as const,
        page: "chat",
        title: "AI Chat Integration",
        success: true,
        analysis:
          "Successfully integrated drag-and-drop functionality for file analysis with natural language processing capabilities.",
        timestamp: "2026-01-19T02:03:58.114Z",
        responseTime: 8934,
      },
      {
        id: "4",
        type: "code" as const,
        page: "development",
        title: "Code Quality Improvements",
        success: true,
        analysis:
          "Code quality improvements implemented with proper error handling and performance monitoring. TypeScript strict mode enabled for better type safety.",
        timestamp: "2026-01-19T02:03:58.114Z",
        responseTime: 47793,
      },
    ];

    const displayResults = results.length > 0 ? results : mockResults;

    // Filter results based on selected type and page
    const filteredResults = useMemo(() => {
      let filtered = displayResults;

      // Filter by type
      if (selectedFilter !== "all") {
        // @ts-ignore - result type property
        filtered = filtered.filter((result: any) => result.type === selectedFilter);
      }

      // Filter by page
      if (selectedPage !== "all") {
        // @ts-ignore - result page property
        filtered = filtered.filter((result: any) => result.page === selectedPage);
      }

      return filtered;
    }, [displayResults, selectedFilter, selectedPage]);

    // Toggle result expansion
    const toggleExpanded = useCallback((resultId: string) => {
      setExpandedResults((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(resultId)) {
          newSet.delete(resultId);
        } else {
          newSet.add(resultId);
        }
        return newSet;
      });
    }, []);

    const getTypeIcon = (type: string) => {
      switch (type) {
        case "vision":
          return <Eye className="w-4 h-4" />;
        case "code":
          return <Code className="w-4 h-4" />;
        case "combined":
          return <Layers className="w-4 h-4" />;
        default:
          return <BarChart3 className="w-4 h-4" />;
      }
    };

    const getTypeColor = (type: string) => {
      switch (type) {
        case "vision":
          return "text-blue-600 bg-blue-50";
        case "code":
          return "text-green-600 bg-green-50";
        case "combined":
          return "text-purple-600 bg-purple-50";
        default:
          return "text-gray-600 bg-gray-50";
      }
    };

    const pages = ["all", ...Array.from(new Set(displayResults.map((r) => r.page)))];

    return (
      <div className="analysis-results space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Analysis Results</h2>
              <p className="text-gray-600">Comprehensive analysis insights and recommendations</p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={onRefresh}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
              <button
                onClick={onExport}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Type:</label>
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value as any)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                aria-label="Filter by analysis type"
              >
                <option value="all">All Types</option>
                <option value="vision">Vision</option>
                <option value="code">Code</option>
                <option value="combined">Combined</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Page:</label>
              <select
                value={selectedPage}
                onChange={(e) => setSelectedPage(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-lg text-sm"
                aria-label="Filter by page"
              >
                {pages.map((page) => (
                  <option key={page} value={page}>
                    {page === "all" ? "All Pages" : page}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{filteredResults.length}</div>
              <div className="text-sm text-gray-600">Total Results</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {filteredResults.filter((r) => r.success).length}
              </div>
              <div className="text-sm text-gray-600">Successful</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {filteredResults.filter((r) => !r.success).length}
              </div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {filteredResults.length > 0
                  ? Math.round(
                      filteredResults.reduce((acc, r) => acc + r.responseTime, 0) /
                        filteredResults.length /
                        1000
                    )
                  : 0}
                s
              </div>
              <div className="text-sm text-gray-600">Avg Response</div>
            </div>
          </div>
        </div>

        {/* Results List */}
        <div className="space-y-4">
          {filteredResults.map((result) => (
            <div
              key={result.id}
              className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className={`p-2 rounded-lg ${getTypeColor(result.type)}`}>
                      {getTypeIcon(result.type)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{result.page}</h3>
                      <p className="text-sm text-gray-600">
                        {result.role} • {result.model}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                    <span className="flex items-center space-x-1">
                      {result.success ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                      <span>{result.success ? "Success" : "Failed"}</span>
                    </span>
                    <span>Response: {(result.responseTime / 1000).toFixed(1)}s</span>
                    <span>{new Date(result.timestamp).toLocaleString()}</span>
                  </div>

                  {result.success && result.analysis && (
                    <div className="mt-3">
                      <button
                        onClick={() => toggleExpanded(result.id)}
                        className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        {expandedResults.has(result.id) ? "Hide Analysis" : "Show Analysis"}
                      </button>

                      {expandedResults.has(result.id) && (
                        <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                          <p className="text-gray-700 whitespace-pre-wrap">{result.analysis}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredResults.length === 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center shadow-sm">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Results Found</h3>
            <p className="text-gray-600">Try adjusting your filters or run a new analysis.</p>
          </div>
        )}
      </div>
    );
  }
);

export default AnalysisResults;
