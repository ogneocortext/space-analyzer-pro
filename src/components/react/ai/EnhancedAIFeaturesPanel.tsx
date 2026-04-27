import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Activity,
  Play,
  Pause,
  SkipForward,
  Eye,
  EyeOff,
  Grid3x3,
  List,
  HelpCircle,
  X,
  Bell,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Info,
  Sparkles
} from 'lucide-react';
// @ts-ignore - AnalysisBridge module
import { bridge } from '../services/AnalysisBridge';
import styles from './EnhancedAIFeaturesPanel.module.css';

interface EnhancedAIFeaturesPanelProps {
  directoryPath?: string;
  onNavigate?: (view: string) => void;
  data?: any;
}

interface AIRecommendation {
  id: string;
  type: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  action: string;
  files?: any[];
  potentialSavings?: number;
  suggestions?: any[];
  status?: 'pending' | 'in_progress' | 'completed';
  progress?: number;
  category?: 'storage' | 'performance' | 'security' | 'organization';
  impact?: 'high' | 'medium' | 'low';
}

interface PerformanceMetrics {
  filesPerSecond: number;
  cacheHitRate: number;
  batchesProcessed: number;
  categorizationTime: number;
  totalFiles: number;
  memoryUsage?: number;
  cpuUsage?: number;
  accuracy?: number;
  efficiency?: number;
}

interface RealTimeMetrics {
  timestamp: Date;
  activeRecommendations: number;
  completedRecommendations: number;
  processingSpeed: number;
  systemHealth: 'excellent' | 'good' | 'fair' | 'poor';
}

const EnhancedAIFeaturesPanel: React.FC<EnhancedAIFeaturesPanelProps> = ({
  directoryPath,
  onNavigate,
  data
}) => {
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'recommendations' | 'performance' | 'realtime' | 'search'>('recommendations');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showDetails, setShowDetails] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRecommendations, setExpandedRecommendations] = useState<Set<string>>(new Set());
  
  // @ts-ignore - useRef with no initial value
  const refreshIntervalRef = useRef<NodeJS.Timeout>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Enhanced recommendation loading with caching
  const loadRecommendations = useCallback(async () => {
    if (!directoryPath) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await bridge.getAIRecommendations(directoryPath);
      if (result.success) {
        const enhancedRecommendations = result.recommendations.map((rec: any, index: number) => ({
          ...rec,
          id: rec.id || `rec-${index}`,
          status: 'pending',
          progress: 0,
          category: rec.category || 'storage',
          impact: rec.impact || 'medium'
        }));
        setRecommendations(enhancedRecommendations);
        setLastUpdate(new Date());
      } else {
        setError('Failed to load recommendations');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [directoryPath]);

  // Enhanced performance metrics loading
  const loadPerformanceMetrics = useCallback(async () => {
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
          totalFiles: result.metadata.totalFiles,
          memoryUsage: result.results.performance.memoryUsage || 0,
          cpuUsage: result.results.performance.cpuUsage || 0,
          accuracy: result.results.performance.accuracy || 0,
          efficiency: result.results.performance.efficiency || 0
        });
        setLastUpdate(new Date());
      }
    } catch (err) {
      console.error('Failed to load performance metrics:', err);
    }
  }, [directoryPath]);

  // Real-time metrics simulation
  const updateRealTimeMetrics = useCallback(() => {
    if (!performanceMetrics) return;
    
    const activeRecs = recommendations.filter(r => r.status === 'pending').length;
    const completedRecs = recommendations.filter(r => r.status === 'completed').length;
    const health = performanceMetrics.filesPerSecond > 10000 ? 'excellent' : 
                  performanceMetrics.filesPerSecond > 5000 ? 'good' : 
                  performanceMetrics.filesPerSecond > 1000 ? 'fair' : 'poor';
    
    setRealTimeMetrics({
      timestamp: new Date(),
      activeRecommendations: activeRecs,
      completedRecommendations: completedRecs,
      processingSpeed: performanceMetrics.filesPerSecond,
      systemHealth: health
    });
  }, [recommendations, performanceMetrics]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh && !isPaused) {
      refreshIntervalRef.current = setInterval(() => {
        loadRecommendations();
        loadPerformanceMetrics();
        updateRealTimeMetrics();
      }, 30000); // Refresh every 30 seconds
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    }
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, isPaused, loadRecommendations, loadPerformanceMetrics, updateRealTimeMetrics]);

  // Initial data load
  useEffect(() => {
    loadRecommendations();
    loadPerformanceMetrics();
    updateRealTimeMetrics();
  }, [loadRecommendations, loadPerformanceMetrics, updateRealTimeMetrics]);

  // Filter and sort recommendations
  const filteredRecommendations = useMemo(() => {
    let filtered = recommendations;
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(rec => 
        rec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rec.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(rec => rec.category === selectedCategory);
    }
    
    // Apply priority filter
    if (selectedPriority !== 'all') {
      filtered = filtered.filter(rec => rec.priority === selectedPriority);
    }
    
    // Sort by priority and impact
    return filtered.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const impactOrder = { high: 3, medium: 2, low: 1 };
      
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      return impactOrder[b.impact] - impactOrder[a.impact];
    });
  }, [recommendations, selectedCategory, selectedPriority, searchQuery]);

  // Statistics calculations
  const statistics = useMemo(() => {
    const total = recommendations.length;
    const completed = recommendations.filter(r => r.status === 'completed').length;
    const inProgress = recommendations.filter(r => r.status === 'in_progress').length;
    const pending = recommendations.filter(r => r.status === 'pending').length;
    const highPriority = recommendations.filter(r => r.priority === 'high').length;
    const totalSavings = recommendations.reduce((sum, r) => sum + (r.potentialSavings || 0), 0);
    
    return {
      total,
      completed,
      inProgress,
      pending,
      highPriority,
      totalSavings,
      completionRate: total > 0 ? (completed / total) * 100 : 0
    };
  }, [recommendations]);

  // Format utilities
  const formatSavings = useCallback((bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }, []);

  const formatSpeed = useCallback((speed: number) => {
    if (speed > 1000) {
      return `${(speed / 1000).toFixed(1)}k files/s`;
    }
    return `${speed.toFixed(0)} files/s`;
  }, []);

  const getPriorityIcon = useCallback((priority: string) => {
    switch (priority) {
      case 'high': return AlertTriangle;
      case 'medium': return Target;
      case 'low': return CheckCircle;
      default: return Info;
    }
  }, []);

  const getPriorityColor = useCallback((priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'medium': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'low': return 'text-green-400 bg-green-400/10 border-green-400/20';
      default: return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
    }
  }, []);

  const getCategoryIcon = useCallback((category: string) => {
    switch (category) {
      case 'storage': return FileText;
      case 'performance': return Zap;
      case 'security': return Shield;
      case 'organization': return Settings;
      default: return Info;
    }
  }, []);

  // Event handlers
  const handleRecommendationAction = useCallback((rec: AIRecommendation) => {
    setRecommendations(prev => prev.map(r => 
      r.id === rec.id ? { ...r, status: 'in_progress', progress: 0 } : r
    ));
    
    // Simulate action progress
    setTimeout(() => {
      setRecommendations(prev => prev.map(r => 
        r.id === rec.id ? { ...r, status: 'completed', progress: 100 } : r
      ));
    }, 2000);
  }, []);

  const handleBatchAction = useCallback(() => {
    const pendingRecs = recommendations.filter(r => r.status === 'pending');
    pendingRecs.forEach((rec, index) => {
      setTimeout(() => {
        setRecommendations(prev => prev.map(r => 
          r.id === rec.id ? { ...r, status: 'in_progress', progress: 0 } : r
        ));
        
        setTimeout(() => {
          setRecommendations(prev => prev.map(r => 
            r.id === rec.id ? { ...r, status: 'completed', progress: 100 } : r
          ));
        }, 1000);
      }, index * 500);
    });
  }, [recommendations]);

  const toggleRecommendationExpansion = useCallback((id: string) => {
    setExpandedRecommendations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const handleRefresh = useCallback(() => {
    loadRecommendations();
    loadPerformanceMetrics();
    updateRealTimeMetrics();
  }, [loadRecommendations, loadPerformanceMetrics, updateRealTimeMetrics]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'r':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            handleRefresh();
          }
          break;
        case ' ':
          event.preventDefault();
          setIsPaused(prev => !prev);
          break;
        case 'g':
          setViewMode(prev => prev === 'grid' ? 'list' : 'grid');
          break;
        case 'd':
          setShowDetails(prev => !prev);
          break;
        case 'a':
          setAutoRefresh(prev => !prev);
          break;
        case '/':
          event.preventDefault();
          // Focus search input
          break;
        case 'Escape':
          setShowHelp(false);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleRefresh]);

  return (
    <div className={styles.enhancedAIFeaturesPanel} ref={containerRef}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerTitle}>
            <BrainCircuit className={styles.headerIcon} />
            <h1>AI Features</h1>
            <div className={styles.headerSubtitle}>Advanced AI-powered analysis tools</div>
          </div>
        </div>
        
        <div className={styles.headerRight}>
          <div className={styles.headerControls}>
            <div className={styles.searchContainer}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search recommendations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className={styles.controlButton}
              title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
            >
              {viewMode === 'grid' ? <List size={16} /> : <Grid3x3 size={16} />}
            </button>
            
            <button
              onClick={() => setShowDetails(!showDetails)}
              className={`${styles.controlButton} ${showDetails ? styles.active : ''}`}
              title="Toggle details"
            >
              {showDetails ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`${styles.controlButton} ${autoRefresh ? styles.active : ''}`}
              title="Toggle auto-refresh"
            >
              <RefreshCw className={autoRefresh ? styles.spinning : ''} size={16} />
            </button>
            
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`${styles.controlButton} ${isPaused ? styles.paused : ''}`}
              title={isPaused ? 'Resume updates' : 'Pause updates'}
            >
              {isPaused ? <Play size={16} /> : <Pause size={16} />}
            </button>
            
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className={styles.controlButton}
              title="Refresh data"
            >
              <RefreshCw className={isLoading ? styles.spinning : ''} size={16} />
            </button>
            
            <button
              onClick={() => setShowHelp(!showHelp)}
              className={styles.controlButton}
              title="Help"
            >
              <HelpCircle size={16} />
            </button>
          </div>
          
          {lastUpdate && (
            <div className={styles.lastUpdate}>
              <Clock size={12} />
              <span>{lastUpdate.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Statistics Bar */}
      <div className={styles.statsBar}>
        <div className={styles.statItem}>
          <div className={styles.statValue}>{statistics.total}</div>
          <div className={styles.statLabel}>Total</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statValue}>{statistics.completed}</div>
          <div className={styles.statLabel}>Completed</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statValue}>{statistics.highPriority}</div>
          <div className={styles.statLabel}>High Priority</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statValue}>{formatSavings(statistics.totalSavings)}</div>
          <div className={styles.statLabel}>Potential Savings</div>
        </div>
        <div className={styles.statItem}>
          <div className={styles.statValue}>{statistics.completionRate.toFixed(1)}%</div>
          <div className={styles.statLabel}>Completion Rate</div>
        </div>
        <button
          onClick={handleBatchAction}
          disabled={statistics.pending === 0}
          className={styles.batchActionButton}
        >
          <Play size={16} />
          Apply All ({statistics.pending})
        </button>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          onClick={() => setActiveTab('recommendations')}
          className={`${styles.tab} ${activeTab === 'recommendations' ? styles.active : ''}`}
        >
          <Star size={16} />
          Recommendations
          {statistics.total > 0 && (
            <span className={styles.tabBadge}>{statistics.total}</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('performance')}
          className={`${styles.tab} ${activeTab === 'performance' ? styles.active : ''}`}
        >
          <Activity size={16} />
          Performance
        </button>
        <button
          onClick={() => setActiveTab('realtime')}
          className={`${styles.tab} ${activeTab === 'realtime' ? styles.active : ''}`}
        >
          <TrendingUp size={16} />
          Real-time
        </button>
        <button
          onClick={() => onNavigate?.('chat')}
          className={`${styles.tab} ${activeTab === 'search' ? styles.active : ''}`}
        >
          <Search size={16} />
          Advanced Search
        </button>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Category:</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Categories</option>
            <option value="storage">Storage</option>
            <option value="performance">Performance</option>
            <option value="security">Security</option>
            <option value="organization">Organization</option>
          </select>
        </div>
        
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Priority:</label>
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* Tab Content */}
      <div className={styles.content}>
        {activeTab === 'recommendations' && (
          <div className={styles.recommendationsContent}>
            {isLoading ? (
              <div className={styles.loadingState}>
                <RefreshCw className={styles.loadingSpinner} />
                <span>Loading recommendations...</span>
              </div>
            ) : error ? (
              <div className={styles.errorState}>
                <AlertTriangle className={styles.errorIcon} />
                <span>{error}</span>
              </div>
            ) : filteredRecommendations.length === 0 ? (
              <div className={styles.emptyState}>
                <CheckCircle className={styles.emptyIcon} />
                <h3>No recommendations found</h3>
                <p>Your files are well organized!</p>
              </div>
            ) : (
              <div className={viewMode === 'grid' ? styles.gridContainer : styles.listContainer}>
                {filteredRecommendations.map((rec) => {
                  const IconComponent = getPriorityIcon(rec.priority);
                  const CategoryIcon = getCategoryIcon(rec.category || 'storage');
                  const isExpanded = expandedRecommendations.has(rec.id);
                  
                  return (
                    <motion.div
                      key={rec.id}
                      className={`${styles.recommendationCard} ${styles[rec.priority]} ${styles[rec.status]}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ scale: 1.02 }}
                    >
                      <div className={styles.cardHeader}>
                        <div className={styles.cardLeft}>
                          <div className={styles.cardIcon}>
                            <IconComponent size={20} />
                          </div>
                          <div className={styles.cardTitle}>
                            <h3>{rec.title}</h3>
                            <div className={styles.cardMeta}>
                              <span className={`${styles.priority} ${styles[rec.priority]}`}>
                                {rec.priority}
                              </span>
                              <span className={`${styles.category} ${styles[rec.category || 'storage']}`}>
                                <CategoryIcon size={12} />
                                {rec.category || 'storage'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className={styles.cardRight}>
                          <div className={styles.cardActions}>
                            <button
                              onClick={() => toggleRecommendationExpansion(rec.id)}
                              className={styles.expandButton}
                            >
                              <ChevronRight className={isExpanded ? styles.rotated : ''} size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className={styles.cardContent}>
                        <p className={styles.description}>{rec.description}</p>
                        
                        {showDetails && (
                          <div className={styles.details}>
                            <div className={styles.detailRow}>
                              <span className={styles.detailLabel}>Impact:</span>
                              <span className={`${styles.detailValue} ${styles[rec.impact || 'medium']}`}>
                                {rec.impact || 'medium'}
                              </span>
                            </div>
                            
                            {rec.files && (
                              <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Files:</span>
                                <span className={styles.detailValue}>{rec.files.length}</span>
                              </div>
                            )}
                            
                            {rec.potentialSavings && (
                              <div className={styles.detailRow}>
                                <span className={styles.detailLabel}>Savings:</span>
                                <span className={styles.detailValue}>{formatSavings(rec.potentialSavings)}</span>
                              </div>
                            )}
                            
                            <div className={styles.detailRow}>
                              <span className={styles.detailLabel}>Status:</span>
                              <span className={`${styles.detailValue} ${styles[rec.status]}`}>
                                {rec.status === 'completed' ? '✓ Completed' :
                                 rec.status === 'in_progress' ? '⏳ In Progress' : '⏸ Pending'}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {rec.status === 'in_progress' && (
                          <div className={styles.progressBar}>
                            <div 
                              className={styles.progressFill}
                              style={{ width: `${rec.progress || 0}%` }}
                            />
                          </div>
                        )}
                      </div>
                      
                      <div className={styles.cardFooter}>
                        <div className={styles.footerLeft}>
                          <button
                            onClick={() => handleRecommendationAction(rec)}
                            disabled={rec.status === 'completed'}
                            className={styles.actionButton}
                          >
                            {rec.status === 'completed' ? '✓ Applied' : 'Apply Recommendation'}
                          </button>
                        </div>
                        
                        <div className={styles.footerRight}>
                          <button
                            onClick={() => onNavigate?.('browser')}
                            className={styles.viewButton}
                          >
                            View Files
                            <ChevronRight size={12} />
                          </button>
                        </div>
                      </div>
                      
                      {isExpanded && rec.suggestions && (
                        <div className={styles.expandedContent}>
                          <h4>Suggestions:</h4>
                          <ul className={styles.suggestionsList}>
                            {rec.suggestions.map((suggestion, index) => (
                              <li key={index}>{suggestion}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'performance' && (
          <div className={styles.performanceContent}>
            {performanceMetrics ? (
              <>
                {/* Performance Metrics Grid */}
                <div className={styles.metricsGrid}>
                  <div className={styles.metricCard}>
                    <div className={styles.metricIcon}>
                      <Zap size={24} />
                    </div>
                    <div className={styles.metricContent}>
                      <div className={styles.metricValue}>{formatSpeed(performanceMetrics.filesPerSecond)}</div>
                      <div className={styles.metricLabel}>Processing Speed</div>
                      <div className={styles.metricTrend}>
                        <TrendingUp size={16} />
                        <span>Excellent</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.metricCard}>
                    <div className={styles.metricIcon}>
                      <Shield size={24} />
                    </div>
                    <div className={styles.metricContent}>
                      <div className={styles.metricValue}>{(performanceMetrics.cacheHitRate * 100).toFixed(1)}%</div>
                      <div className={styles.metricLabel}>Cache Hit Rate</div>
                      <div className={styles.metricTrend}>
                        <TrendingUp size={16} />
                        <span>Optimal</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.metricCard}>
                    <div className={styles.metricIcon}>
                      <BarChart3 size={24} />
                    </div>
                    <div className={styles.metricContent}>
                      <div className={styles.metricValue}>{performanceMetrics.batchesProcessed}</div>
                      <div className={styles.metricLabel}>Batches Processed</div>
                      <div className={styles.metricTrend}>
                        <ArrowUp size={16} />
                        <span>Active</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.metricCard}>
                    <div className={styles.metricIcon}>
                      <Clock size={24} />
                    </div>
                    <div className={styles.metricContent}>
                      <div className={styles.metricValue}>{performanceMetrics.categorizationTime}ms</div>
                      <div className={styles.metricLabel}>Total Time</div>
                      <div className={styles.metricTrend}>
                        <TrendingDown size={16} />
                        <span>Fast</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance Summary */}
                <div className={styles.performanceSummary}>
                  <h3>Performance Summary</h3>
                  <div className={styles.summaryGrid}>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Total Files Processed</span>
                      <span className={styles.summaryValue}>{performanceMetrics.totalFiles.toLocaleString()}</span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Average Time per File</span>
                      <span className={styles.summaryValue}>
                        {(performanceMetrics.categorizationTime / performanceMetrics.totalFiles).toFixed(2)}ms
                      </span>
                    </div>
                    <div className={styles.summaryItem}>
                      <span className={styles.summaryLabel}>Processing Efficiency</span>
                      <span className={styles.summaryValue}>
                        {performanceMetrics.filesPerSecond > 10000 ? 'Excellent' : 
                         performanceMetrics.filesPerSecond > 5000 ? 'Good' : 'Fair'}
                      </span>
                    </div>
                    {performanceMetrics.memoryUsage && (
                      <div className={styles.summaryItem}>
                        <span className={styles.summaryLabel}>Memory Usage</span>
                        <span className={styles.summaryValue}>
                          {(performanceMetrics.memoryUsage / 1024 / 1024).toFixed(1)}MB
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.loadingState}>
                <RefreshCw className={styles.loadingSpinner} />
                <span>Loading performance metrics...</span>
              </div>
            )}
          </div>
        )}

        {activeTab === 'realtime' && (
          <div className={styles.realtimeContent}>
            {realTimeMetrics ? (
              <>
                <div className={styles.realtimeHeader}>
                  <div className={styles.realtimeTitle}>
                    <Activity className={styles.realtimeIcon} />
                    <h3>Real-time Monitoring</h3>
                  </div>
                  <div className={styles.realtimeStatus}>
                    <div className={`${styles.statusIndicator} ${styles[realTimeMetrics.systemHealth]}`} />
                    <span>System Health: {realTimeMetrics.systemHealth}</span>
                  </div>
                </div>
                
                <div className={styles.realtimeMetrics}>
                  <div className={styles.realtimeMetric}>
                    <div className={styles.realtimeLabel}>Active Recommendations</div>
                    <div className={styles.realtimeValue}>{realTimeMetrics.activeRecommendations}</div>
                  </div>
                  <div className={styles.realtimeMetric}>
                    <div className={styles.realtimeLabel}>Completed Recommendations</div>
                    <div className={styles.realtimeValue}>{realTimeMetrics.completedRecommendations}</div>
                  </div>
                  <div className={styles.realtimeMetric}>
                    <div className={styles.realtimeLabel}>Processing Speed</div>
                    <div className={styles.realtimeValue}>{formatSpeed(realTimeMetrics.processingSpeed)}</div>
                  </div>
                  <div className={styles.realtimeMetric}>
                    <div className={styles.realtimeLabel}>Last Update</div>
                    <div className={styles.realtimeValue}>{realTimeMetrics.timestamp.toLocaleTimeString()}</div>
                  </div>
                </div>
                
                <div className={styles.realtimeChart}>
                  <div className={styles.chartPlaceholder}>
                    <BarChart3 size={48} />
                    <h4>Real-time Performance Chart</h4>
                    <p>Advanced visualization coming soon</p>
                  </div>
                </div>
              </>
            ) : (
              <div className={styles.loadingState}>
                <RefreshCw className={styles.loadingSpinner} />
                <span>Initializing real-time monitoring...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Help Overlay */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            className={styles.helpOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className={styles.helpContent}>
              <div className={styles.helpHeader}>
                <h3>AI Features Help</h3>
                <button
                  onClick={() => setShowHelp(false)}
                  className={styles.helpClose}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className={styles.helpSections}>
                <div className={styles.helpSection}>
                  <h4>Keyboard Shortcuts</h4>
                  <ul>
                    <li><kbd>Ctrl+R</kbd> - Refresh data</li>
                    <li><kbd>Space</kbd> - Pause/Resume updates</li>
                    <li><kbd>G</kbd> - Toggle grid/list view</li>
                    <li><kbd>D</kbd> - Toggle details</li>
                    <li><kbd>A</kbd> - Toggle auto-refresh</li>
                    <li><kbd>/</kbd> - Focus search</li>
                  </ul>
                </div>
                
                <div className={styles.helpSection}>
                  <h4>Features</h4>
                  <ul>
                    <li><strong>Smart Recommendations:</strong> AI-powered file optimization suggestions</li>
                    <li><strong>Performance Monitoring:</strong> Real-time processing metrics</li>
                    <li><strong>Batch Actions:</strong> Apply multiple recommendations at once</li>
                    <li><strong>Auto-refresh:</strong> Automatic data updates every 30 seconds</li>
                  </ul>
                </div>
                
                <div className={styles.helpSection}>
                  <h4>Status Indicators</h4>
                  <ul>
                    <li><span className={styles.statusHigh}>High Priority</span> - Critical recommendations</li>
                    <li><span className={styles.statusMedium}>Medium Priority</span> - Important suggestions</li>
                    <li><span className={styles.statusLow}>Low Priority</span> - Optional improvements</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EnhancedAIFeaturesPanel;
