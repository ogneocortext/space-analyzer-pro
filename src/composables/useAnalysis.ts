/**
 * Analysis Composable - Manages analysis state and operations
 * Extracted from analysis components for better state management
 */

import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { analysisService, type AnalysisResult, type AnalysisConfig, type AnalyzerDefinition } from '../services/AnalysisService';
import { useDebugLogger } from '../utils/DebugUtils';
import { useDataPersistence } from '../utils/DataPersistence';

const logger = useDebugLogger('useAnalysis');
const dataPersistence = useDataPersistence();

export interface UseAnalysisOptions {
  autoSave?: boolean;
  maxHistory?: number;
  enableNotifications?: boolean;
}

export interface AnalysisState {
  activeAnalysis: AnalysisResult | null;
  history: AnalysisResult[];
  availableAnalyzers: AnalyzerDefinition[];
  isLoading: boolean;
  error: string | null;
  config: AnalysisConfig;
  selectedAnalyzers: string[];
  progress: number;
  currentStep: string;
}

/**
 * Analysis Composable
 */
export function useAnalysis(options: UseAnalysisOptions = {}) {
  // State
  const activeAnalysis = ref<AnalysisResult | null>(null);
  const history = ref<AnalysisResult[]>([]);
  const availableAnalyzers = ref<AnalyzerDefinition[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const config = ref<AnalysisConfig>({
    projectPath: '',
    selectedAnalyzers: [],
    maxDepth: 10,
    includeHidden: false,
    followSymlinks: false,
    enableAI: false,
    analysisType: 'standard',
  });
  const selectedAnalyzers = ref<string[]>([]);
  const progress = ref(0);
  const currentStep = ref('');

  // Configuration
  const autoSave = options.autoSave !== false;
  const maxHistory = options.maxHistory || 50;
  const enableNotifications = options.enableNotifications !== false;

  // Computed properties
  const hasActiveAnalysis = computed(() => activeAnalysis.value !== null);
  const isAnalysisRunning = computed(() => 
    activeAnalysis.value?.status === 'running'
  );
  const isAnalysisCompleted = computed(() => 
    activeAnalysis.value?.status === 'completed'
  );
  const hasError = computed(() => error.value !== null);
  const canStartAnalysis = computed(() => 
    config.value.projectPath && 
    selectedAnalyzers.value.length > 0 && 
    !isAnalysisRunning.value
  );
  
  const analysisStats = computed(() => activeAnalysis.value?.stats);
  const analysisInsights = computed(() => activeAnalysis.value?.insights || []);
  const analysisRecommendations = computed(() => activeAnalysis.value?.recommendations || []);
  const analysisPerformance = computed(() => activeAnalysis.value?.performance);

  const analyzersByCategory = computed(() => {
    const categories: Record<string, AnalyzerDefinition[]> = {};
    availableAnalyzers.value.forEach(analyzer => {
      if (!categories[analyzer.category]) {
        categories[analyzer.category] = [];
      }
      categories[analyzer.category].push(analyzer);
    });
    return categories;
  });

  const selectedAnalyzersInfo = computed(() => 
    availableAnalyzers.value.filter(analyzer => 
      selectedAnalyzers.value.includes(analyzer.id)
    )
  );

  const recentAnalyses = computed(() => 
    history.value
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 10)
  );

  const insightsByType = computed(() => {
    const insights: Record<string, typeof analysisInsights.value> = {};
    analysisInsights.value.forEach(insight => {
      if (!insights[insight.type]) {
        insights[insight.type] = [];
      }
      insights[insight.type].push(insight);
    });
    return insights;
  });

  const recommendationsByCategory = computed(() => {
    const recommendations: Record<string, typeof analysisRecommendations.value> = {};
    analysisRecommendations.value.forEach(rec => {
      if (!recommendations[rec.category]) {
        recommendations[rec.category] = [];
      }
      recommendations[rec.category].push(rec);
    });
    return recommendations;
  });

  // Actions
  const initialize = async () => {
    try {
      logger.info('Initializing analysis composable');
      
      // Load available analyzers
      availableAnalyzers.value = analysisService.getAvailableAnalyzers();
      
      // Load analysis history from persistence
      if (autoSave) {
        loadHistoryFromPersistence();
      }
      
      // Load active analysis from service
      activeAnalysis.value = analysisService.getActiveAnalysis();
      
      logger.info('Analysis composable initialized', {
        analyzerCount: availableAnalyzers.value.length,
        historyCount: history.value.length,
        hasActiveAnalysis: hasActiveAnalysis.value,
      });
      
    } catch (error) {
      logger.error('Failed to initialize analysis composable', error);
      error.value = error instanceof Error ? error.message : 'Initialization failed';
    }
  };

  const startAnalysis = async (analysisConfig?: Partial<AnalysisConfig>) => {
    try {
      logger.info('Starting analysis', { config: analysisConfig });
      
      if (!canStartAnalysis.value) {
        throw new Error('Cannot start analysis: invalid configuration or analysis already running');
      }
      
      // Merge config
      const finalConfig = { ...config.value, ...analysisConfig };
      finalConfig.selectedAnalyzers = selectedAnalyzers.value;
      
      isLoading.value = true;
      error.value = null;
      progress.value = 0;
      currentStep.value = 'Initializing...';
      
      // Start analysis
      const result = await analysisService.startAnalysis(finalConfig);
      
      activeAnalysis.value = result;
      config.value = finalConfig;
      
      // Save to history
      addToHistory(result);
      
      // Save to persistence
      if (autoSave) {
        saveHistoryToPersistence();
      }
      
      // Show notification
      if (enableNotifications) {
        showNotification('Analysis completed', 'success');
      }
      
      logger.info('Analysis started successfully', { 
        analysisId: result.id,
        analyzerCount: result.config.selectedAnalyzers.length,
      });
      
      return result;
      
    } catch (error) {
      logger.error('Failed to start analysis', error);
      error.value = error instanceof Error ? error.message : 'Analysis failed';
      isLoading.value = false;
      
      // Show error notification
      if (enableNotifications) {
        showNotification('Analysis failed', 'error');
      }
      
      throw error;
    } finally {
      isLoading.value = false;
      progress.value = 0;
      currentStep.value = '';
    }
  };

  const cancelAnalysis = (): boolean => {
    try {
      logger.info('Cancelling analysis');
      
      const cancelled = analysisService.cancelAnalysis();
      
      if (cancelled) {
        activeAnalysis.value = null;
        isLoading.value = false;
        progress.value = 0;
        currentStep.value = '';
        
        // Show notification
        if (enableNotifications) {
          showNotification('Analysis cancelled', 'warning');
        }
        
        logger.info('Analysis cancelled successfully');
      }
      
      return cancelled;
      
    } catch (error) {
      logger.error('Failed to cancel analysis', error);
      return false;
    }
  };

  const updateConfig = (newConfig: Partial<AnalysisConfig>) => {
    config.value = { ...config.value, ...newConfig };
    logger.info('Analysis config updated', newConfig);
  };

  const selectAnalyzer = (analyzerId: string) => {
    if (!selectedAnalyzers.value.includes(analyzerId)) {
      selectedAnalyzers.value.push(analyzerId);
      logger.info('Analyzer selected', { analyzerId });
    }
  };

  const deselectAnalyzer = (analyzerId: string) => {
    const index = selectedAnalyzers.value.indexOf(analyzerId);
    if (index > -1) {
      selectedAnalyzers.value.splice(index, 1);
      logger.info('Analyzer deselected', { analyzerId });
    }
  };

  const toggleAnalyzer = (analyzerId: string) => {
    if (selectedAnalyzers.value.includes(analyzerId)) {
      deselectAnalyzer(analyzerId);
    } else {
      selectAnalyzer(analyzerId);
    }
  };

  const selectAllAnalyzers = () => {
    selectedAnalyzers.value = availableAnalyzers.value.map(analyzer => analyzer.id);
    logger.info('All analyzers selected');
  };

  const clearAnalyzers = () => {
    selectedAnalyzers.value = [];
    logger.info('All analyzers cleared');
  };

  const selectAnalyzersByCategory = (category: string) => {
    const categoryAnalyzers = analyzersByCategory.value[category] || [];
    selectedAnalyzers.value = [
      ...selectedAnalyzers.value,
      ...categoryAnalyzers.map(analyzer => analyzer.id)
        .filter(id => !selectedAnalyzers.value.includes(id))
    ];
    logger.info('Analyzers selected by category', { category, count: categoryAnalyzers.length });
  };

  const loadAnalysis = (id: string) => {
    try {
      logger.info('Loading analysis', { analysisId: id });
      
      const analysis = analysisService.getAnalysis(id);
      if (analysis) {
        activeAnalysis.value = analysis;
        config.value = analysis.config;
        selectedAnalyzers.value = analysis.config.selectedAnalyzers;
        logger.info('Analysis loaded successfully', { analysisId: id });
      } else {
        throw new Error('Analysis not found');
      }
      
    } catch (error) {
      logger.error('Failed to load analysis', error);
      error.value = error instanceof Error ? error.message : 'Failed to load analysis';
    }
  };

  const deleteAnalysis = (id: string): boolean => {
    try {
      logger.info('Deleting analysis', { analysisId: id });
      
      const deleted = analysisService.deleteAnalysis(id);
      
      if (deleted) {
        // Remove from history
        const index = history.value.findIndex(analysis => analysis.id === id);
        if (index > -1) {
          history.value.splice(index, 1);
        }
        
        // Clear active analysis if it was the deleted one
        if (activeAnalysis.value?.id === id) {
          activeAnalysis.value = null;
        }
        
        // Save to persistence
        if (autoSave) {
          saveHistoryToPersistence();
        }
        
        // Show notification
        if (enableNotifications) {
          showNotification('Analysis deleted', 'info');
        }
        
        logger.info('Analysis deleted successfully', { analysisId: id });
      }
      
      return deleted;
      
    } catch (error) {
      logger.error('Failed to delete analysis', error);
      return false;
    }
  };

  const clearHistory = () => {
    try {
      logger.info('Clearing analysis history');
      
      analysisService.clearHistory();
      history.value = [];
      activeAnalysis.value = null;
      
      // Save to persistence
      if (autoSave) {
        saveHistoryToPersistence();
      }
      
      logger.info('Analysis history cleared');
      
    } catch (error) {
      logger.error('Failed to clear analysis history', error);
    }
  };

  const exportAnalysis = (id: string, format: 'json' | 'csv' | 'pdf' = 'json'): string => {
    try {
      logger.info('Exporting analysis', { analysisId: id, format });
      
      const exported = analysisService.exportAnalysis(id, format);
      
      // Show notification
      if (enableNotifications) {
        showNotification(`Analysis exported as ${format.toUpperCase()}`, 'success');
      }
      
      return exported;
      
    } catch (error) {
      logger.error('Failed to export analysis', error);
      error.value = error instanceof Error ? error.message : 'Export failed';
      throw error;
    }
  };

  const updateProgress = (currentProgress: number, step: string) => {
    progress.value = currentProgress;
    currentStep.value = step;
  };

  const clearError = () => {
    error.value = null;
  };

  // Persistence methods
  const saveHistoryToPersistence = () => {
    try {
      dataPersistence.save('analysis-history', {
        history: history.value,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('Failed to save analysis history to persistence', error);
    }
  };

  const loadHistoryFromPersistence = () => {
    try {
      const saved = dataPersistence.load('analysis-history');
      if (saved?.history && Array.isArray(saved.history)) {
        history.value = saved.history.slice(0, maxHistory);
        logger.info('Analysis history loaded from persistence', { count: history.value.length });
      }
    } catch (error) {
      logger.error('Failed to load analysis history from persistence', error);
    }
  };

  const addToHistory = (analysis: AnalysisResult) => {
    history.value.unshift(analysis);
    
    // Limit history size
    if (history.value.length > maxHistory) {
      history.value = history.value.slice(0, maxHistory);
    }
  };

  // Utility methods
  const showNotification = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    // This would integrate with a notification system
    logger.info('Notification', { message, type });
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    return `${(ms / 3600000).toFixed(1)}h`;
  };

  const getAnalyzerIcon = (analyzerId: string): string => {
    const analyzer = availableAnalyzers.value.find(a => a.id === analyzerId);
    return analyzer?.icon || 'Settings';
  };

  const getSeverityColor = (severity: string): string => {
    const colors: Record<string, string> = {
      low: '#22c55e',
      medium: '#f59e0b',
      high: '#ef4444',
      critical: '#dc2626',
    };
    return colors[severity] || '#6b7280';
  };

  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      code: '#3b82f6',
      security: '#ef4444',
      performance: '#f59e0b',
      storage: '#22c55e',
      general: '#6b7280',
    };
    return colors[category] || '#6b7280';
  };

  // Watchers
  watch(history, () => {
    if (autoSave) {
      saveHistoryToPersistence();
    }
  }, { deep: true });

  // Lifecycle
  onMounted(() => {
    initialize();
  });

  // Return reactive state and methods
  return {
    // State
    activeAnalysis,
    history,
    availableAnalyzers,
    isLoading,
    error,
    config,
    selectedAnalyzers,
    progress,
    currentStep,
    
    // Computed
    hasActiveAnalysis,
    isAnalysisRunning,
    isAnalysisCompleted,
    hasError,
    canStartAnalysis,
    analysisStats,
    analysisInsights,
    analysisRecommendations,
    analysisPerformance,
    analyzersByCategory,
    selectedAnalyzersInfo,
    recentAnalyses,
    insightsByType,
    recommendationsByCategory,
    
    // Methods
    initialize,
    startAnalysis,
    cancelAnalysis,
    updateConfig,
    selectAnalyzer,
    deselectAnalyzer,
    toggleAnalyzer,
    selectAllAnalyzers,
    clearAnalyzers,
    selectAnalyzersByCategory,
    loadAnalysis,
    deleteAnalysis,
    clearHistory,
    exportAnalysis,
    updateProgress,
    clearError,
    
    // Utilities
    formatDuration,
    getAnalyzerIcon,
    getSeverityColor,
    getCategoryColor,
    
    // Persistence
    saveHistoryToPersistence,
    loadHistoryFromPersistence,
  };
}