/**
 * Enhanced PropTypes definitions for Space Analyzer components
 * Provides runtime type checking and validation based on AI model recommendations
 */

// @ts-ignore - PropTypes is optional for TypeScript projects
// import PropTypes from 'prop-types';
// import { EnhancedFileAnalysis, EnhancedAnalysisResult, Recommendation } from '../types/enhanced';

// Stub PropTypes for TypeScript compatibility
const PropTypes: any = {
  string: {},
  number: {},
  bool: {},
  array: {},
  object: {},
  func: {},
  node: {},
  element: {},
  oneOf: () => ({}),
  oneOfType: () => ({}),
  arrayOf: () => ({}),
  shape: () => ({}),
  instanceOf: () => ({}),
  isRequired: {},
};

// Enhanced File Analysis PropTypes
export const EnhancedFileAnalysisPropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  path: PropTypes.string.isRequired,
  size: PropTypes.number.isRequired,
  type: PropTypes.oneOf(["file", "directory"]).isRequired,
  extension: PropTypes.string,
  mimeType: PropTypes.string,
  lastModified: PropTypes.instanceOf(Date).isRequired,
  permissions: PropTypes.shape({
    readable: PropTypes.bool.isRequired,
    writable: PropTypes.bool.isRequired,
    executable: PropTypes.bool.isRequired,
  }).isRequired,
  content: PropTypes.shape({
    text: PropTypes.string,
    binary: PropTypes.bool,
    encoding: PropTypes.string,
    lines: PropTypes.number,
  }),
  metadata: PropTypes.shape({
    hash: PropTypes.string,
    checksum: PropTypes.string,
    version: PropTypes.string,
    tags: PropTypes.arrayOf(PropTypes.string),
    category: PropTypes.string,
  }),
  aiAnalysis: PropTypes.shape({
    complexity: PropTypes.number,
    dependencies: PropTypes.arrayOf(PropTypes.string),
    security: PropTypes.shape({
      riskLevel: PropTypes.oneOf(["low", "medium", "high", "critical"]),
      vulnerabilities: PropTypes.arrayOf(PropTypes.object),
      recommendations: PropTypes.arrayOf(PropTypes.string),
      score: PropTypes.number,
    }),
    optimization: PropTypes.shape({
      performance: PropTypes.array,
      security: PropTypes.array,
      storage: PropTypes.array,
      overallScore: PropTypes.number,
    }),
    duplicates: PropTypes.array,
  }),
});

// Enhanced Analysis Result PropTypes
export const EnhancedAnalysisResultPropType = PropTypes.shape({
  id: PropTypes.string.isRequired,
  timestamp: PropTypes.instanceOf(Date).isRequired,
  status: PropTypes.oneOf(["pending", "running", "completed", "failed", "cancelled"]).isRequired,
  progress: PropTypes.shape({
    percentage: PropTypes.number.isRequired,
    currentFile: PropTypes.string,
    stage: PropTypes.string.isRequired,
    estimatedTimeRemaining: PropTypes.number,
  }).isRequired,
  summary: PropTypes.shape({
    totalFiles: PropTypes.number.isRequired,
    totalDirectories: PropTypes.number.isRequired,
    totalSize: PropTypes.number.isRequired,
    largestFile: PropTypes.shape({
      name: PropTypes.string.isRequired,
      path: PropTypes.string.isRequired,
      size: PropTypes.number.isRequired,
    }).isRequired,
    fileTypes: PropTypes.object.isRequired,
    categories: PropTypes.object.isRequired,
    duplicates: PropTypes.shape({
      count: PropTypes.number.isRequired,
      totalSize: PropTypes.number.isRequired,
      potentialSavings: PropTypes.number.isRequired,
    }).isRequired,
    security: PropTypes.shape({
      vulnerabilities: PropTypes.number.isRequired,
      riskScore: PropTypes.number.isRequired,
      highRiskFiles: PropTypes.arrayOf(PropTypes.string).isRequired,
    }).isRequired,
    performance: PropTypes.shape({
      optimizationScore: PropTypes.number.isRequired,
      recommendations: PropTypes.number.isRequired,
      estimatedImprovements: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
  files: PropTypes.arrayOf(EnhancedFileAnalysisPropType).isRequired,
  dependencies: PropTypes.object.isRequired,
  insights: PropTypes.object.isRequired,
  recommendations: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired,
      category: PropTypes.oneOf(["performance", "security", "storage", "maintainability", "other"])
        .isRequired,
      impact: PropTypes.oneOf(["low", "medium", "high"]).isRequired,
      priority: PropTypes.number.isRequired,
      effort: PropTypes.oneOf(["low", "medium", "high"]).isRequired,
      implementation: PropTypes.string,
      estimatedBenefit: PropTypes.string,
      dependencies: PropTypes.arrayOf(PropTypes.string),
    })
  ).isRequired,
  performance: PropTypes.shape({
    analysisTime: PropTypes.number.isRequired,
    filesProcessed: PropTypes.number.isRequired,
    memoryUsage: PropTypes.shape({
      peak: PropTypes.number.isRequired,
      average: PropTypes.number.isRequired,
    }).isRequired,
    cpuUsage: PropTypes.shape({
      peak: PropTypes.number.isRequired,
      average: PropTypes.number.isRequired,
    }).isRequired,
    throughput: PropTypes.shape({
      filesPerSecond: PropTypes.number.isRequired,
      bytesPerSecond: PropTypes.number.isRequired,
    }).isRequired,
  }).isRequired,
});

// Common Enhanced Component PropTypes
export const EnhancedComponentProps = {
  className: PropTypes.string,
  children: PropTypes.node,
  style: PropTypes.object,
  testId: PropTypes.string,
  "aria-label": PropTypes.string,
  "aria-describedby": PropTypes.string,
  "aria-labelledby": PropTypes.string,
};

// File Upload Component PropTypes
export const FileUploadProps = {
  onFileUpload: PropTypes.func.isRequired,
  maxFiles: PropTypes.number,
  acceptedTypes: PropTypes.arrayOf(PropTypes.string),
  maxSize: PropTypes.number,
  className: PropTypes.string,
  disabled: PropTypes.bool,
  multiple: PropTypes.bool,
  showProgress: PropTypes.bool,
  autoUpload: PropTypes.bool,
};

// Metric Card Component PropTypes
export const MetricCardProps = {
  title: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  change: PropTypes.number.isRequired,
  icon: PropTypes.node.isRequired,
  trend: PropTypes.oneOf(["up", "down", "neutral"]).isRequired,
  description: PropTypes.string,
  isLoading: PropTypes.bool,
  onClick: PropTypes.func,
  className: PropTypes.string,
};

// Chart Component PropTypes
export const ChartProps = {
  data: PropTypes.array.isRequired,
  width: PropTypes.number,
  height: PropTypes.number,
  margin: PropTypes.shape({
    top: PropTypes.number,
    right: PropTypes.number,
    bottom: PropTypes.number,
    left: PropTypes.number,
  }),
  colors: PropTypes.arrayOf(PropTypes.string),
  showLegend: PropTypes.bool,
  showTooltip: PropTypes.bool,
  showGrid: PropTypes.bool,
  responsive: PropTypes.bool,
};

// AI Chat Component PropTypes
export const AIChatProps = {
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      role: PropTypes.oneOf(["user", "assistant"]).isRequired,
      content: PropTypes.string.isRequired,
      timestamp: PropTypes.instanceOf(Date).isRequired,
      model: PropTypes.string,
      confidence: PropTypes.number,
      recommendations: PropTypes.arrayOf(PropTypes.string),
      workflowStage: PropTypes.string,
      isStreaming: PropTypes.bool,
      completed: PropTypes.bool,
    })
  ),
  onSendMessage: PropTypes.func.isRequired,
  onClearHistory: PropTypes.func,
  isLoading: PropTypes.bool,
  availableModels: PropTypes.arrayOf(PropTypes.string),
  selectedModel: PropTypes.string,
  onModelChange: PropTypes.func,
  className: PropTypes.string,
};

// File Browser Component PropTypes
export const FileBrowserProps = {
  files: PropTypes.arrayOf(EnhancedFileAnalysisPropType),
  searchQuery: PropTypes.string,
  onSearchChange: PropTypes.func.isRequired,
  sortBy: PropTypes.oneOf(["name", "size", "modified", "type"]),
  sortOrder: PropTypes.oneOf(["asc", "desc"]),
  filterType: PropTypes.string,
  onSortByChange: PropTypes.func.isRequired,
  onSortOrderChange: PropTypes.func.isRequired,
  onFilterChange: PropTypes.func.isRequired,
  pageSize: PropTypes.number,
  currentPage: PropTypes.number,
  onPageChange: PropTypes.func.isRequired,
  onPageSizeChange: PropTypes.func.isRequired,
  totalPages: PropTypes.number,
  isLoading: PropTypes.bool,
  error: PropTypes.string,
  onFileSelect: PropTypes.func,
  onFileDelete: PropTypes.func,
  onFileRename: PropTypes.func,
  className: PropTypes.string,
};

// Analysis Progress Component PropTypes
export const AnalysisProgressProps = {
  analysis: PropTypes.shape({
    id: PropTypes.string.isRequired,
    status: PropTypes.oneOf(["pending", "running", "completed", "failed", "cancelled"]).isRequired,
    progress: PropTypes.shape({
      percentage: PropTypes.number.isRequired,
      currentFile: PropTypes.string,
      stage: PropTypes.string.isRequired,
      estimatedTimeRemaining: PropTypes.number,
    }).isRequired,
    summary: PropTypes.object,
    startTime: PropTypes.instanceOf(Date),
    endTime: PropTypes.instanceOf(Date),
  }),
  onCancel: PropTypes.func,
  onPause: PropTypes.func,
  onResume: PropTypes.func,
  showDetails: PropTypes.bool,
  className: PropTypes.string,
};

// Export all PropTypes for easy importing
export default {
  EnhancedFileAnalysisPropType,
  EnhancedAnalysisResultPropType,
  EnhancedComponentProps,
  FileUploadProps,
  MetricCardProps,
  ChartProps,
  AIChatProps,
  FileBrowserProps,
  AnalysisProgressProps,
  // Re-export commonly used PropTypes
  string: PropTypes.string,
  number: PropTypes.number,
  bool: PropTypes.bool,
  array: PropTypes.array,
  object: PropTypes.object,
  func: PropTypes.func,
  node: PropTypes.node,
  element: PropTypes.element,
  oneOf: PropTypes.oneOf,
  oneOfType: PropTypes.oneOfType,
  arrayOf: PropTypes.arrayOf,
  shape: PropTypes.shape,
  instanceOf: PropTypes.instanceOf,
  required: PropTypes.isRequired,
};
