import { DebugLogger } from './DebugLogger';
import { errorHandler } from './ErrorHandler';

export interface AnalysisState {
  isAnalyzing: boolean;
  progress: {
    files: number;
    percentage: number;
    currentFile: string;
    startTime: number;
    elapsedTime: number;
  };
  result: AnalysisResult | null;
  error: string | null;
  dataSource: 'cli' | 'fallback' | 'file-system-api';
}

export interface AnalysisResult {
  totalFiles: number;
  totalSize: number;
  files: Array<{
    name: string;
    size: number;
    path: string;
    extension: string;
    category: string;
  }>;
  categories: { [key: string]: { count: number; size: number } };
  extensionStats: { [key: string]: { count: number; size: number } };
  analysisType: string;
  analysisTime: number;
  directoryPath?: string;
}

export interface UIState {
  activeTab: string;
  selectedCategory: string | null;
  searchQuery: string;
  sortBy: 'name' | 'size' | 'extension' | 'category';
  sortOrder: 'asc' | 'desc';
  filterExtension: string;
  currentPage: number;
  pageSize: number;
  viewMode: 'list' | 'grid';
  showHidden: boolean;
  selectedFiles: Set<string>;
}

export type StateListener<T> = (state: T, previousState: T) => void;

export class StateManager {
  private static instance: StateManager;
  private logger = DebugLogger.getInstance();
  
  private analysisState: AnalysisState = {
    isAnalyzing: false,
    progress: {
      files: 0,
      percentage: 0,
      currentFile: '',
      startTime: 0,
      elapsedTime: 0
    },
    result: null,
    error: null,
    dataSource: 'cli'
  };
  
  private uiState: UIState = {
    activeTab: 'analysis',
    selectedCategory: null,
    searchQuery: '',
    sortBy: 'name',
    sortOrder: 'asc',
    filterExtension: '',
    currentPage: 1,
    pageSize: 50,
    viewMode: 'list',
    showHidden: false,
    selectedFiles: new Set()
  };

  private analysisListeners: StateListener<AnalysisState>[] = [];
  private uiListeners: StateListener<UIState>[] = [];
  private stateHistory: Array<{ timestamp: number; analysisState: AnalysisState; uiState: UIState }> = [];
  private maxHistorySize = 20;

  private constructor() {
    this.setupStatePersistence();
  }

  static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  // Analysis State Management
  getAnalysisState(): AnalysisState {
    return { ...this.analysisState };
  }

  updateAnalysisState(updates: Partial<AnalysisState>): void {
    const previousState = { ...this.analysisState };
    this.analysisState = { ...this.analysisState, ...updates };
    
    this.logger.debug('StateManager', 'Analysis state updated', { 
      updates, 
      newState: this.analysisState 
    });
    
    this.notifyAnalysisListeners(previousState);
    this.saveToHistory();
  }

  // Generic state getters/setters for compatibility
  get(key: string): any {
    if (key in this.analysisState) {
      return (this.analysisState as any)[key];
    }
    if (key in this.uiState) {
      return (this.uiState as any)[key];
    }
    return undefined;
  }

  set(key: string, value: any): void {
    if (key in this.analysisState) {
      this.updateAnalysisState({ [key]: value } as any);
    } else if (key in this.uiState) {
      this.updateUIState({ [key]: value } as any);
    } else {
      // Store in a generic key-value map
      (this as any)[key] = value;
    }
  }

  // UI State Management
  getUIState(): UIState {
    return { ...this.uiState };
  }

  updateUIState(updates: Partial<UIState>): void {
    const previousState = { ...this.uiState };
    this.uiState = { ...this.uiState, ...updates };
    
    this.logger.debug('StateManager', 'UI state updated', { 
      updates, 
      newState: this.uiState 
    });
    
    this.notifyUIListeners(previousState);
    this.saveToHistory();
  }

  // Specific state setters for better type safety
  setAnalyzing(isAnalyzing: boolean): void {
    this.updateAnalysisState({ 
      isAnalyzing,
      error: isAnalyzing ? null : this.analysisState.error
    });
  }

  setProgress(progress: Partial<AnalysisState['progress']>): void {
    const currentProgress = this.analysisState.progress;
    const updatedProgress = { ...currentProgress, ...progress };
    
    // Calculate elapsed time
    if (progress.startTime && !currentProgress.startTime) {
      updatedProgress.elapsedTime = 0;
    } else if (currentProgress.startTime) {
      updatedProgress.elapsedTime = Date.now() - currentProgress.startTime;
    }
    
    this.updateAnalysisState({ progress: updatedProgress });
  }

  setResult(result: AnalysisResult | null): void {
    this.updateAnalysisState({ 
      result,
      isAnalyzing: false,
      error: null
    });
  }

  setError(error: string | null): void {
    this.updateAnalysisState({ 
      error,
      isAnalyzing: false
    });
  }

  setDataSource(dataSource: AnalysisState['dataSource']): void {
    this.updateAnalysisState({ dataSource });
  }

  // UI specific setters
  setActiveTab(tab: string): void {
    this.updateUIState({ activeTab: tab });
  }

  setSelectedCategory(category: string | null): void {
    this.updateUIState({ selectedCategory: category });
  }

  setSearchQuery(query: string): void {
    this.updateUIState({ searchQuery: query, currentPage: 1 });
  }

  setSorting(sortBy: UIState['sortBy'], sortOrder: UIState['sortOrder']): void {
    this.updateUIState({ sortBy, sortOrder });
  }

  setFilterExtension(extension: string): void {
    this.updateUIState({ filterExtension: extension, currentPage: 1 });
  }

  setCurrentPage(page: number): void {
    this.updateUIState({ currentPage: page });
  }

  setViewMode(mode: UIState['viewMode']): void {
    this.updateUIState({ viewMode: mode });
  }

  toggleShowHidden(): void {
    this.updateUIState({ showHidden: !this.uiState.showHidden });
  }

  toggleFileSelection(filePath: string): void {
    const newSelectedFiles = new Set(this.uiState.selectedFiles);
    if (newSelectedFiles.has(filePath)) {
      newSelectedFiles.delete(filePath);
    } else {
      newSelectedFiles.add(filePath);
    }
    this.updateUIState({ selectedFiles: newSelectedFiles });
  }

  selectAllFiles(filePaths: string[]): void {
    this.updateUIState({ selectedFiles: new Set(filePaths) });
  }

  clearFileSelection(): void {
    this.updateUIState({ selectedFiles: new Set() });
  }

  // Event Listeners
  onAnalysisStateChange(listener: StateListener<AnalysisState>): () => void {
    this.analysisListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.analysisListeners.indexOf(listener);
      if (index > -1) {
        this.analysisListeners.splice(index, 1);
      }
    };
  }

  onUIStateChange(listener: StateListener<UIState>): () => void {
    this.uiListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.uiListeners.indexOf(listener);
      if (index > -1) {
        this.uiListeners.splice(index, 1);
      }
    };
  }

  private notifyAnalysisListeners(previousState: AnalysisState): void {
    this.analysisListeners.forEach(listener => {
      try {
        listener(this.analysisState, previousState);
      } catch (error) {
        errorHandler.handleUIError(error as Error, {
          component: 'StateManager',
          action: 'notifyAnalysisListeners'
        });
      }
    });
  }

  private notifyUIListeners(previousState: UIState): void {
    this.uiListeners.forEach(listener => {
      try {
        listener(this.uiState, previousState);
      } catch (error) {
        errorHandler.handleUIError(error as Error, {
          component: 'StateManager',
          action: 'notifyUIListeners'
        });
      }
    });
  }

  // State History
  private saveToHistory(): void {
    this.stateHistory.push({
      timestamp: Date.now(),
      analysisState: { ...this.analysisState },
      uiState: { ...this.uiState }
    });

    // Maintain history size
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
    }
  }

  getStateHistory(): Array<{ timestamp: number; analysisState: AnalysisState; uiState: UIState }> {
    return [...this.stateHistory];
  }

  // State Persistence
  private setupStatePersistence(): void {
    // Load saved state on initialization
    this.loadState();
    
    // Save state periodically
    setInterval(() => {
      this.saveState();
    }, 30000); // Save every 30 seconds
    
    // Save state before page unload
    window.addEventListener('beforeunload', () => {
      this.saveState();
    });
  }

  private saveState(): void {
    try {
      const stateToSave = {
        uiState: this.uiState,
        timestamp: Date.now()
      };
      
      localStorage.setItem('space-analyzer-state', JSON.stringify(stateToSave));
      this.logger.debug('StateManager', 'State saved to localStorage');
    } catch (error) {
      errorHandler.handleUIError(error as Error, {
        component: 'StateManager',
        action: 'saveState'
      });
    }
  }

  private loadState(): void {
    try {
      const savedState = localStorage.getItem('space-analyzer-state');
      if (savedState) {
        const parsed = JSON.parse(savedState);
        
        // Only restore UI state, not analysis state (analysis should start fresh)
        if (parsed.uiState) {
          // Convert selectedFiles back to Set
          if (parsed.uiState.selectedFiles) {
            parsed.uiState.selectedFiles = new Set(parsed.uiState.selectedFiles);
          }
          
          this.uiState = { ...this.uiState, ...parsed.uiState };
          this.logger.debug('StateManager', 'State loaded from localStorage');
        }
      }
    } catch (error) {
      errorHandler.handleUIError(error as Error, {
        component: 'StateManager',
        action: 'loadState'
      });
    }
  }

  // Reset functions
  resetAnalysisState(): void {
    this.analysisState = {
      isAnalyzing: false,
      progress: {
        files: 0,
        percentage: 0,
        currentFile: '',
        startTime: 0,
        elapsedTime: 0
      },
      result: null,
      error: null,
      dataSource: 'cli'
    };
    
    this.notifyAnalysisListeners(this.analysisState);
    this.saveToHistory();
  }

  resetUIState(): void {
    this.uiState = {
      activeTab: 'analysis',
      selectedCategory: null,
      searchQuery: '',
      sortBy: 'name',
      sortOrder: 'asc',
      filterExtension: '',
      currentPage: 1,
      pageSize: 50,
      viewMode: 'list',
      showHidden: false,
      selectedFiles: new Set()
    };
    
    this.notifyUIListeners(this.uiState);
    this.saveToHistory();
  }

  resetAllState(): void {
    this.resetAnalysisState();
    this.resetUIState();
  }

  // Utility functions
  getFilteredFiles(): AnalysisResult['files'] {
    if (!this.analysisState.result) return [];
    
    let files = [...this.analysisState.result.files];
    
    // Apply search filter
    if (this.uiState.searchQuery) {
      const query = this.uiState.searchQuery.toLowerCase();
      files = files.filter(file => 
        file.name.toLowerCase().includes(query) || 
        file.path.toLowerCase().includes(query)
      );
    }
    
    // Apply category filter
    if (this.uiState.selectedCategory) {
      files = files.filter(file => file.category === this.uiState.selectedCategory);
    }
    
    // Apply extension filter
    if (this.uiState.filterExtension) {
      files = files.filter(file => file.extension === this.uiState.filterExtension);
    }
    
    // Apply hidden files filter
    if (!this.uiState.showHidden) {
      files = files.filter(file => !file.name.startsWith('.'));
    }
    
    // Apply sorting
    files.sort((a, b) => {
      let comparison = 0;
      
      switch (this.uiState.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'extension':
          comparison = a.extension.localeCompare(b.extension);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
      }
      
      return this.uiState.sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return files;
  }

  getPaginatedFiles(): AnalysisResult['files'] {
    const filteredFiles = this.getFilteredFiles();
    const startIndex = (this.uiState.currentPage - 1) * this.uiState.pageSize;
    const endIndex = startIndex + this.uiState.pageSize;
    
    return filteredFiles.slice(startIndex, endIndex);
  }

  getTotalPages(): number {
    const filteredFiles = this.getFilteredFiles();
    return Math.ceil(filteredFiles.length / this.uiState.pageSize);
  }
}

// Export singleton instance
export const stateManager = StateManager.getInstance();
