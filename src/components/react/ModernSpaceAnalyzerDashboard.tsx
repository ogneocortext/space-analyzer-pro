import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, 
  Settings, 
  Moon, 
  Sun, 
  Grid3X3, 
  List, 
  Filter,
  Download,
  Upload,
  RefreshCw,
  Zap,
  Brain,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff
} from 'lucide-react';
import { AIService } from '../services/AIService';
import './ModernSpaceAnalyzerDashboard.css';

interface ModernSpaceAnalyzerDashboardProps {
  files: any[];
  onAnalysisStart?: () => void;
  onAnalysisComplete?: (results: any) => void;
}

interface AIInsight {
  id: string;
  type: 'recommendation' | 'warning' | 'optimization' | 'pattern';
  title: string;
  description: string;
  confidence: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  actionable: boolean;
  action?: string;
  source: 'ollama' | 'gemini';
  timestamp: number;
}

interface UsageMetrics {
  ollama: {
    requests: number;
    tokens: number;
    avgResponseTime: number;
  };
  gemini: {
    requests: number;
    tokens: number;
    cost: number;
    avgResponseTime: number;
  };
  total: {
    insights: number;
    accuracy: number;
    userSatisfaction: number;
  };
}

export const ModernSpaceAnalyzerDashboard: React.FC<ModernSpaceAnalyzerDashboardProps> = ({
  files,
  onAnalysisStart,
  onAnalysisComplete
}) => {
  // State management
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [usageMetrics, setUsageMetrics] = useState<UsageMetrics>({
    ollama: { requests: 0, tokens: 0, avgResponseTime: 0 },
    gemini: { requests: 0, tokens: 0, cost: 0, avgResponseTime: 0 },
    total: { insights: 0, accuracy: 0, userSatisfaction: 0 }
  });
  const [showUsageMetrics, setShowUsageMetrics] = useState(false);
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());
  const [filterPriority, setFilterPriority] = useState<'all' | 'low' | 'medium' | 'high' | 'critical'>('all');
  const [filterType, setFilterType] = useState<'all' | 'recommendation' | 'warning' | 'optimization' | 'pattern'>('all');

  // Refs
  const aiServiceRef = useRef<AIService | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | undefined>(undefined);

  // Initialize AI service
  useEffect(() => {
    aiServiceRef.current = new AIService({
      ollamaEndpoint: 'http://localhost:11434',
      geminiApiKey: process.env.GEMINI_API_KEY || '', // Use environment variable
      usageTracking: true,
      fallbackStrategy: 'ollama-first'
    });

    // Load saved preferences
    const savedTheme = localStorage.getItem('spaceAnalyzer-theme');
    if (savedTheme === 'dark') setIsDarkMode(true);

    const savedViewMode = localStorage.getItem('spaceAnalyzer-viewMode');
    if (savedViewMode) setViewMode(savedViewMode as 'grid' | 'list');
  }, []);

  // Save preferences
  useEffect(() => {
    localStorage.setItem('spaceAnalyzer-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    localStorage.setItem('spaceAnalyzer-viewMode', viewMode);
  }, [viewMode]);

  // AI-powered analysis
  const analyzeWithAI = useCallback(async () => {
    if (!aiServiceRef.current) return;

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    onAnalysisStart?.();

    try {
      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      // Get AI insights
      const insights = await aiServiceRef.current.analyzeProject(files, {
        signal: abortControllerRef.current.signal,
        onProgress: (progress) => setAnalysisProgress(progress),
        includeRecommendations: true,
        includePatterns: true,
        includeOptimizations: true
      });

      setAiInsights(insights);
      onAnalysisComplete?.(insights);

      // Update usage metrics
      const metrics = await aiServiceRef.current.getUsageMetrics();
      setUsageMetrics(metrics);

    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('AI analysis failed:', error);
      }
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress(0);
      abortControllerRef.current = undefined;
    }
  }, [files, onAnalysisStart, onAnalysisComplete]);

  // Cancel analysis
  const cancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Toggle insight expansion
  const toggleInsightExpansion = useCallback((insightId: string) => {
    const newExpanded = new Set(expandedInsights);
    if (newExpanded.has(insightId)) {
      newExpanded.delete(insightId);
    } else {
      newExpanded.add(insightId);
    }
    setExpandedInsights(newExpanded);
  }, [expandedInsights]);

  // Execute AI action
  const executeAIAction = useCallback(async (insight: AIInsight) => {
    if (!aiServiceRef.current || !insight.action) return;

    try {
      await aiServiceRef.current.executeAction(insight.action, files);
      
      // Mark insight as executed
      setAiInsights(prev => prev.map(i => 
        i.id === insight.id ? { ...i, actionable: false } : i
      ));
    } catch (error) {
      console.error('Failed to execute AI action:', error);
    }
  }, [files]);

  // Filter insights
  const filteredInsights = aiInsights.filter(insight => {
    const matchesPriority = filterPriority === 'all' || insight.priority === filterPriority;
    const matchesType = filterType === 'all' || insight.type === filterType;
    const matchesSearch = searchTerm === '' || 
      insight.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      insight.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesPriority && matchesType && matchesSearch;
  });

  // Get insight icon
  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'recommendation': return <Brain className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'optimization': return <TrendingUp className="w-4 h-4" />;
      case 'pattern': return <Grid3X3 className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  // Get insight color
  const getInsightColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-500 bg-red-50 border-red-200';
      case 'high': return 'text-orange-500 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-500 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-500 bg-green-50 border-green-200';
      default: return 'text-gray-500 bg-gray-50 border-gray-200';
    }
  };

  // Get source badge
  const getSourceBadge = (source: string) => {
    return source === 'ollama' 
      ? <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">Ollama</span>
      : <span className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">Gemini</span>;
  };

  return (
    <div className={`modern-space-analyzer ${isDarkMode ? 'dark' : 'light'}`}>
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1 className="app-title">
            <Zap className="w-6 h-6" />
            Space Analyzer
          </h1>
          <div className="file-count">
            {files.length.toLocaleString()} files analyzed
          </div>
        </div>

        <div className="header-right">
          {/* Search */}
          <div className="search-container">
            <Search className="w-4 h-4" />
            <input
              type="text"
              placeholder="Search insights..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="view-toggle">
            <button
              onClick={() => setViewMode('grid')}
              className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Theme Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="theme-toggle"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Usage Metrics */}
          <button
            onClick={() => setShowUsageMetrics(!showUsageMetrics)}
            className="usage-metrics-btn"
          >
            <Brain className="w-4 h-4" />
            Usage
          </button>

          {/* Settings */}
          <button className="settings-btn">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* AI Analysis Controls */}
      <div className="ai-controls">
        <div className="controls-left">
          <button
            onClick={analyzeWithAI}
            disabled={isAnalyzing || files.length === 0}
            className="analyze-btn"
          >
            <Brain className="w-4 h-4" />
            {isAnalyzing ? 'Analyzing...' : 'AI Analysis'}
          </button>

          {isAnalyzing && (
            <button
              onClick={cancelAnalysis}
              className="cancel-btn"
            >
              Cancel
            </button>
          )}

          {/* Progress Bar */}
          {isAnalyzing && (
            <div className="progress-container">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${analysisProgress}%` }}
                />
              </div>
              <span className="progress-text">{analysisProgress}%</span>
            </div>
          )}
        </div>

        <div className="controls-right">
          {/* Filters */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">All Types</option>
            <option value="recommendation">Recommendations</option>
            <option value="warning">Warnings</option>
            <option value="optimization">Optimizations</option>
            <option value="pattern">Patterns</option>
          </select>
        </div>
      </div>

      {/* Usage Metrics Panel */}
      {showUsageMetrics && (
        <div className="usage-metrics-panel">
          <div className="metrics-header">
            <h3>AI Usage Metrics</h3>
            <button
              onClick={() => setShowUsageMetrics(false)}
              className="close-btn"
            >
              ×
            </button>
          </div>

          <div className="metrics-grid">
            <div className="metric-card">
              <h4>Ollama (Local)</h4>
              <div className="metric-stats">
                <div className="stat">
                  <span className="stat-label">Requests:</span>
                  <span className="stat-value">{usageMetrics.ollama.requests}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Tokens:</span>
                  <span className="stat-value">{usageMetrics.ollama.tokens.toLocaleString()}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Avg Response:</span>
                  <span className="stat-value">{usageMetrics.ollama.avgResponseTime.toFixed(0)}ms</span>
                </div>
              </div>
            </div>

            <div className="metric-card">
              <h4>Gemini (Cloud)</h4>
              <div className="metric-stats">
                <div className="stat">
                  <span className="stat-label">Requests:</span>
                  <span className="stat-value">{usageMetrics.gemini.requests}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Tokens:</span>
                  <span className="stat-value">{usageMetrics.gemini.tokens.toLocaleString()}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Cost:</span>
                  <span className="stat-value">${usageMetrics.gemini.cost.toFixed(4)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Avg Response:</span>
                  <span className="stat-value">{usageMetrics.gemini.avgResponseTime.toFixed(0)}ms</span>
                </div>
              </div>
            </div>

            <div className="metric-card">
              <h4>Total Performance</h4>
              <div className="metric-stats">
                <div className="stat">
                  <span className="stat-label">Insights:</span>
                  <span className="stat-value">{usageMetrics.total.insights}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Accuracy:</span>
                  <span className="stat-value">{(usageMetrics.total.accuracy * 100).toFixed(1)}%</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Satisfaction:</span>
                  <span className="stat-value">{(usageMetrics.total.userSatisfaction * 100).toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Insights */}
      <div className="insights-container">
        <div className="insights-header">
          <h2>AI Insights</h2>
          <div className="insights-stats">
            <span className="stat">{filteredInsights.length} insights</span>
            <span className="stat">{filteredInsights.filter(i => i.priority === 'critical').length} critical</span>
            <span className="stat">{filteredInsights.filter(i => i.priority === 'high').length} high</span>
          </div>
        </div>

        {filteredInsights.length === 0 ? (
          <div className="empty-state">
            <Brain className="w-12 h-12" />
            <h3>No AI insights available</h3>
            <p>Run an AI analysis to get intelligent recommendations and insights about your codebase.</p>
            <button onClick={analyzeWithAI} className="analyze-btn">
              <Brain className="w-4 h-4" />
              Start AI Analysis
            </button>
          </div>
        ) : (
          <div className={`insights-grid ${viewMode}`}>
            {filteredInsights.map((insight) => (
              <div
                key={insight.id}
                className={`insight-card ${getInsightColor(insight.priority)}`}
              >
                <div className="insight-header">
                  <div className="insight-title">
                    {getInsightIcon(insight.type)}
                    <h3>{insight.title}</h3>
                  </div>
                  <div className="insight-meta">
                    {getSourceBadge(insight.source)}
                    <span className="confidence">
                      {(insight.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="insight-content">
                  <p>{insight.description}</p>
                  
                  {insight.action && insight.actionable && (
                    <button
                      onClick={() => executeAIAction(insight)}
                      className="action-btn"
                    >
                      Execute Action
                    </button>
                  )}
                </div>

                <div className="insight-footer">
                  <button
                    onClick={() => toggleInsightExpansion(insight.id)}
                    className="expand-btn"
                  >
                    {expandedInsights.has(insight.id) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    Details
                  </button>

                  <div className="insight-priority">
                    <span className={`priority-badge ${insight.priority}`}>
                      {insight.priority}
                    </span>
                  </div>
                </div>

                {expandedInsights.has(insight.id) && (
                  <div className="insight-details">
                    <div className="detail-row">
                      <span className="detail-label">Type:</span>
                      <span className="detail-value">{insight.type}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Confidence:</span>
                      <span className="detail-value">{(insight.confidence * 100).toFixed(1)}%</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Source:</span>
                      <span className="detail-value">{insight.source}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Timestamp:</span>
                      <span className="detail-value">{new Date(insight.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};