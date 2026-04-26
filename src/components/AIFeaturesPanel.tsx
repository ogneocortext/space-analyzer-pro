import React, { useState, useEffect, type FC } from 'react';
import {
  BrainCircuit,
  Zap,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  FileText,
  Settings,
  RefreshCw,
  Download,
  Search,
  Filter,
  ChevronRight,
  Star,
  Shield,
  Activity
} from 'lucide-react';
import { bridge } from '../services/AnalysisBridge';

interface AIFeaturesPanelProps {
  directoryPath?: string;
  onNavigate?: (view: string) => void;
}

interface AIRecommendation {
  type: string;
  priority: string;
  title: string;
  description: string;
  action: string;
  files?: any[];
  potentialSavings?: number;
  suggestions?: any[];
}

interface PerformanceMetrics {
  filesPerSecond: number;
  cacheHitRate: number;
  batchesProcessed: number;
  categorizationTime: number;
  totalFiles: number;
}

const AIFeaturesPanel: FC<AIFeaturesPanelProps> = ({ directoryPath, onNavigate }) => {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'recommendations' | 'performance' | 'search'>('recommendations');

  // Load AI recommendations
  const loadRecommendations = async () => {
    if (!directoryPath) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await bridge.getAIRecommendations(directoryPath);
      if (result.success) {
        setRecommendations(result.recommendations);
        setLastUpdate(new Date());
      } else {
        setError('Failed to load recommendations');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Load performance metrics
  const loadPerformanceMetrics = async () => {
    if (!directoryPath) return;
    
    try {
      const result = await bridge.categorizeFilesOptimized(directoryPath, { 
        batchSize: 100, 
        useCache: true 
      });
      
      if (result.success) {
        setPerformanceMetrics({
          filesPerSecond: result.results.performance.filesPerSecond,
          cacheHitRate: result.results.performance.cacheHitRate,
          batchesProcessed: result.results.performance.batchesProcessed,
          categorizationTime: result.metadata.totalTime,
          totalFiles: result.metadata.totalFiles
        });
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error('Failed to load performance metrics:', err);
    }
  };

  // Load data on mount and when directory changes
  useEffect(() => {
    if (directoryPath) {
      loadRecommendations();
      loadPerformanceMetrics();
    }
  }, [directoryPath]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (directoryPath) {
        loadRecommendations();
        loadPerformanceMetrics();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [directoryPath]);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-green-400';
      default: return 'text-slate-400';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return AlertTriangle;
      case 'medium': return Target;
      case 'low': return CheckCircle;
      default: return FileText;
    }
  };

  const formatSavings = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatSpeed = (filesPerSecond: number) => {
    if (filesPerSecond < 1000) return `${filesPerSecond.toFixed(0)} files/sec`;
    return `${(filesPerSecond / 1000).toFixed(1)}K files/sec`;
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 sm:p-5 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-xl font-semibold text-white leading-tight flex items-center gap-2">
          <BrainCircuit className="w-5 h-5 text-purple-400" />
          AI Features
        </h3>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <div className="text-xs text-slate-400 flex items-center gap-1">
              <Clock size={12} />
              {lastUpdate.toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={() => {
              loadRecommendations();
              loadPerformanceMetrics();
            }}
            disabled={isLoading}
            className="text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            aria-label="Refresh AI data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 sm:mb-6 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('recommendations')}
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'recommendations'
              ? 'text-purple-400 border-purple-400'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Star size={16} />
            Recommendations
            {recommendations.length > 0 && (
              <span className="bg-purple-400 text-purple-900 text-xs px-2 py-1 rounded-full">
                {recommendations.length}
              </span>
            )}
          </div>
        </button>
        <button
          onClick={() => setActiveTab('performance')}
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'performance'
              ? 'text-emerald-400 border-emerald-400'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Activity size={16} />
            Performance
          </div>
        </button>
        <button
          onClick={() => onNavigate?.('chat')}
          className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 ${
            activeTab === 'search'
              ? 'text-blue-400 border-blue-400'
              : 'text-slate-400 border-transparent hover:text-white'
          }`}
        >
          <div className="flex items-center gap-2">
            <Search size={16} />
            Advanced Search
          </div>
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[200px]">
        {activeTab === 'recommendations' && (
          <div className="space-y-3 sm:space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
                <span className="ml-2 text-slate-400">Loading recommendations...</span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-8">
                <AlertTriangle className="w-6 h-6 text-red-400" />
                <span className="ml-2 text-red-400">{error}</span>
              </div>
            ) : recommendations.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <CheckCircle className="w-6 h-6 text-green-400" />
                <span className="ml-2 text-slate-400">No recommendations - your files are well organized!</span>
              </div>
            ) : (
              recommendations.map((rec, index) => {
                const IconComponent = getPriorityIcon(rec.priority);
                return (
                  <div
                    key={index}
                    className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 sm:p-4 hover:bg-slate-700/70 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg bg-slate-800 ${getPriorityColor(rec.priority)}`}>
                        <IconComponent size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-white font-medium truncate">{rec.title}</h4>
                          <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(rec.priority)}`}>
                            {rec.priority}
                          </span>
                        </div>
                        <p className="text-slate-300 text-sm mb-2">{rec.description}</p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            {rec.files && (
                              <span>{rec.files.length} files</span>
                            )}
                            {rec.potentialSavings && (
                              <span>Potential savings: {formatSavings(rec.potentialSavings)}</span>
                            )}
                          </div>
                          <button
                            onClick={() => onNavigate?.('browser')}
                            className="text-purple-400 hover:text-purple-300 text-xs flex items-center gap-1 transition-colors"
                          >
                            View Files
                            <ChevronRight size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-4 sm:space-y-6">
            {performanceMetrics ? (
              <>
                {/* Performance Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-4 h-4 text-emerald-400" />
                      <span className="text-slate-400 text-xs">Speed</span>
                    </div>
                    <div className="text-white font-semibold">{formatSpeed(performanceMetrics.filesPerSecond)}</div>
                  </div>
                  <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-4 h-4 text-blue-400" />
                      <span className="text-slate-400 text-xs">Cache Hit</span>
                    </div>
                    <div className="text-white font-semibold">{(performanceMetrics.cacheHitRate * 100).toFixed(1)}%</div>
                  </div>
                  <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="w-4 h-4 text-purple-400" />
                      <span className="text-slate-400 text-xs">Batches</span>
                    </div>
                    <div className="text-white font-semibold">{performanceMetrics.batchesProcessed}</div>
                  </div>
                  <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-3 sm:p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-yellow-400" />
                      <span className="text-slate-400 text-xs">Total Time</span>
                    </div>
                    <div className="text-white font-semibold">{performanceMetrics.categorizationTime}ms</div>
                  </div>
                </div>

                {/* Performance Summary */}
                <div className="bg-slate-700/50 border border-slate-600 rounded-lg p-4">
                  <h4 className="text-white font-medium mb-3">Performance Summary</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-sm">Total Files Processed</span>
                      <span className="text-white font-medium">{performanceMetrics.totalFiles.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-sm">Average Time per File</span>
                      <span className="text-white font-medium">
                        {(performanceMetrics.categorizationTime / performanceMetrics.totalFiles).toFixed(2)}ms
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-sm">Processing Efficiency</span>
                      <span className="text-white font-medium">
                        {performanceMetrics.filesPerSecond > 10000 ? 'Excellent' : 
                         performanceMetrics.filesPerSecond > 5000 ? 'Good' : 'Fair'}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Activity className="w-6 h-6 text-slate-400 animate-pulse" />
                <span className="ml-2 text-slate-400">Loading performance metrics...</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Search className="w-12 h-12 text-blue-400 mx-auto mb-4" />
              <h4 className="text-white font-medium mb-2">Advanced Search</h4>
              <p className="text-slate-400 text-sm mb-4">
                Use AI-powered search to find files with intelligent matching and relevance scoring
              </p>
              <button
                onClick={() => onNavigate?.('chat')}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2 mx-auto"
              >
                <Search size={16} />
                Open Advanced Search
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIFeaturesPanel;
