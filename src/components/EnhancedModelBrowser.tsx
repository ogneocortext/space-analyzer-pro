import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Search, Filter, Grid3X3, List, Layers, ChevronDown,
  ChevronRight, X, Check, Clock, HardDrive, Tag,
  ArrowUpDown, MoreVertical, Eye, EyeOff, Download, Trash2,
  Cpu, Zap, AlertTriangle, TrendingUp, TrendingDown
} from 'lucide-react';
import { useEnhancedVirtualScroll } from '../hooks/useEnhancedVirtualScroll';
import { useGPUMemoryVisualization } from '../hooks/useGPUMemoryVisualization';
import './EnhancedModelBrowser.css';

interface ModelData {
  name: string;
  path: string;
  size: number;
  type: 'pytorch' | 'tensorflow' | 'onnx' | 'custom';
  framework: string;
  accuracy: number;
  parameters: number;
  lastUsed: Date;
  downloadDate: Date;
  tags: string[];
  gpuMemory: number;
  inferenceTime: number;
  status: 'loaded' | 'loading' | 'error' | 'unloaded';
  description: string;
  version: string;
  license: string;
}

interface EnhancedModelBrowserProps {
  models: ModelData[];
  onModelAction: (action: string, model: ModelData) => void;
}

const EnhancedModelBrowser: React.FC<EnhancedModelBrowserProps> = ({
  models,
  onModelAction
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'compact'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModels, setSelectedModels] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'accuracy' | 'lastUsed'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    types: [] as string[],
    frameworks: [] as string[],
    status: [] as string[],
    minAccuracy: 0,
    maxGpuMemory: Infinity
  });

  // Enhanced virtual scrolling hook
  const {
    parentRef,
    virtualizer,
    filteredItems,
    visibleRange,
    isScrolling,
    performanceMetrics,
    filterByMetadata,
    scrollToItem,
    batchSelectItems
  } = useEnhancedVirtualScroll({
    items: models,
    estimateSize: () => viewMode === 'grid' ? 200 : viewMode === 'list' ? 80 : 40,
    enableDynamicSizing: true
  });

  // GPU memory visualization hook
  const {
    gpuMemoryStats,
    memoryEfficiencyScore,
    optimizationSuggestions,
    getMemoryUsageForModel
  } = useGPUMemoryVisualization(models);

  // Apply filters and search
  const processedModels = useMemo(() => {
    let filtered = filterByMetadata(filters);
    
    if (searchQuery) {
      filtered = filtered.filter(model =>
        model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        model.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'accuracy':
          comparison = a.accuracy - b.accuracy;
          break;
        case 'lastUsed':
          comparison = a.lastUsed.getTime() - b.lastUsed.getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [filteredItems, searchQuery, sortBy, sortOrder, filterByMetadata, filters]);

  const handleModelSelection = useCallback((modelPath: string, multiSelect = false) => {
    setSelectedModels(prev => {
      const newSelection = new Set(prev);
      if (multiSelect) {
        if (newSelection.has(modelPath)) {
          newSelection.delete(modelPath);
        } else {
          newSelection.add(modelPath);
        }
      } else {
        if (newSelection.has(modelPath)) {
          newSelection.clear();
        } else {
          newSelection.clear();
          newSelection.add(modelPath);
        }
      }
      return newSelection;
    });
  }, []);

  const handleBatchAction = useCallback((action: string) => {
    selectedModels.forEach(modelPath => {
      const model = models.find(m => m.path === modelPath);
      if (model) {
        onModelAction(action, model);
      }
    });
    setSelectedModels(new Set());
  }, [selectedModels, models, onModelAction]);

  const formatSize = useCallback((bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }, []);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'loaded': return '#10b981';
      case 'loading': return '#f59e0b';
      case 'error': return '#ef4444';
      case 'unloaded': return '#6b7280';
      default: return '#6b7280';
    }
  }, []);

  const renderModelCard = useCallback((model: ModelData, index: number) => {
    const isSelected = selectedModels.has(model.path);
    const memoryUsage = getMemoryUsageForModel(model);

    if (viewMode === 'grid') {
      return (
        <motion.div
          key={model.path}
          className={`model-card ${isSelected ? 'selected' : ''}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => handleModelSelection(model.path)}
        >
          <div className="model-header">
            <div className="model-type-badge">{model.type.toUpperCase()}</div>
            <div className="model-status" style={{ color: getStatusColor(model.status) }}>
              {model.status}
            </div>
          </div>
          
          <div className="model-content">
            <h4 className="model-name">{model.name}</h4>
            <p className="model-description">{model.description}</p>
            
            <div className="model-metrics">
              <div className="metric">
                <Cpu size={14} />
                <span>{formatSize(model.gpuMemory)} GPU</span>
              </div>
              <div className="metric">
                <Zap size={14} />
                <span>{model.inferenceTime}ms</span>
              </div>
              <div className="metric">
                <TrendingUp size={14} />
                <span>{model.accuracy}%</span>
              </div>
            </div>
            
            <div className="model-footer">
              <span className="model-size">{formatSize(model.size)}</span>
              <span className="model-params">{(model.parameters / 1e9).toFixed(1)}B params</span>
            </div>
          </div>
          
          <div className="model-actions">
            <button onClick={(e) => { e.stopPropagation(); onModelAction('load', model); }}>
              <Eye size={14} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onModelAction('download', model); }}>
              <Download size={14} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onModelAction('delete', model); }}>
              <Trash2 size={14} />
            </button>
          </div>
        </motion.div>
      );
    }

    if (viewMode === 'list') {
      return (
        <motion.div
          key={model.path}
          className={`model-list-item ${isSelected ? 'selected' : ''}`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.02 }}
          onClick={() => handleModelSelection(model.path)}
        >
          <div className="model-info">
            <div className="model-name">{model.name}</div>
            <div className="model-details">
              <span className="model-type">{model.type}</span>
              <span className="model-framework">{model.framework}</span>
              <span className="model-version">{model.version}</span>
            </div>
          </div>
          
          <div className="model-stats">
            <div className="stat">
              <span>Accuracy: {model.accuracy}%</span>
            </div>
            <div className="stat">
              <span>GPU: {formatSize(model.gpuMemory)}</span>
            </div>
            <div className="stat">
              <span>Speed: {model.inferenceTime}ms</span>
            </div>
            <div className="stat">
              <span>Size: {formatSize(model.size)}</span>
            </div>
          </div>
          
          <div className="model-status-indicator" style={{ color: getStatusColor(model.status) }}>
            {model.status}
          </div>
        </motion.div>
      );
    }

    // Compact view
    return (
      <motion.div
        key={model.path}
        className={`model-compact-item ${isSelected ? 'selected' : ''}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: index * 0.01 }}
        onClick={() => handleModelSelection(model.path)}
      >
        <span className="model-name">{model.name}</span>
        <span className="model-size">{formatSize(model.size)}</span>
        <span className="model-accuracy">{model.accuracy}%</span>
        <span className="model-status" style={{ color: getStatusColor(model.status) }}>
          {model.status}
        </span>
      </motion.div>
    );
  }, [viewMode, selectedModels, handleModelSelection, onModelAction, formatSize, getStatusColor, getMemoryUsageForModel]);

  return (
    <div className="enhanced-model-browser">
      {/* Header */}
      <div className="browser-header">
        <div className="header-top">
          <div className="title-section">
            <h3>Model Browser ({processedModels.length})</h3>
            <div className="performance-indicator">
              <span className="metric">
                <TrendingUp size={14} />
                {performanceMetrics.renderTime}ms render
              </span>
              <span className="metric">
                <HardDrive size={14} />
                {memoryEfficiencyScore}% efficiency
              </span>
            </div>
          </div>
          
          <div className="view-controls">
            <div className="view-mode-buttons">
              <button
                onClick={() => setViewMode('grid')}
                className={viewMode === 'grid' ? 'active' : ''}
                title="Grid view"
              >
                <Grid3X3 size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={viewMode === 'list' ? 'active' : ''}
                title="List view"
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode('compact')}
                className={viewMode === 'compact' ? 'active' : ''}
                title="Compact view"
              >
                <Layers size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="search-section">
          <div className="search-bar">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search models by name, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search models"
              title="Search models"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} title="Clear search">
                <X size={14} />
              </button>
            )}
          </div>
          
          <div className="filter-controls">
            <button onClick={() => setShowFilters(!showFilters)} className="filter-toggle">
              <Filter size={16} />
              Filters
            </button>
            
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              <option value="name">Name</option>
              <option value="size">Size</option>
              <option value="accuracy">Accuracy</option>
              <option value="lastUsed">Last Used</option>
            </select>
            
            <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}>
              <ArrowUpDown size={16} />
            </button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="advanced-filters">
            <div className="filter-group">
              <h4>Type</h4>
              {['pytorch', 'tensorflow', 'onnx', 'custom'].map(type => (
                <label key={type}>
                  <input
                    type="checkbox"
                    checked={filters.types.includes(type)}
                    onChange={(e) => {
                      const newTypes = e.target.checked
                        ? [...filters.types, type]
                        : filters.types.filter(t => t !== type);
                      setFilters(prev => ({ ...prev, types: newTypes }));
                    }}
                  />
                  {type}
                </label>
              ))}
            </div>
            
            <div className="filter-group">
              <h4>Status</h4>
              {['loaded', 'loading', 'error', 'unloaded'].map(status => (
                <label key={status}>
                  <input
                    type="checkbox"
                    checked={filters.status.includes(status)}
                    onChange={(e) => {
                      const newStatus = e.target.checked
                        ? [...filters.status, status]
                        : filters.status.filter(s => s !== status);
                      setFilters(prev => ({ ...prev, status: newStatus }));
                    }}
                  />
                  {status}
                </label>
              ))}
            </div>
            
            <div className="filter-group">
              <h4>Accuracy Range</h4>
              <input
                type="range"
                min="0"
                max="100"
                value={filters.minAccuracy}
                onChange={(e) => setFilters(prev => ({ ...prev, minAccuracy: Number(e.target.value) }))}
              />
              <span>{filters.minAccuracy}%+</span>
            </div>
          </div>
        )}
      </div>

      {/* Selection Toolbar */}
      {selectedModels.size > 0 && (
        <div className="selection-toolbar">
          <div className="selection-info">
            <Check size={16} />
            {selectedModels.size} models selected
          </div>
          <div className="selection-actions">
            <button onClick={() => handleBatchAction('load')}>
              <Eye size={14} />
              Load Selected
            </button>
            <button onClick={() => handleBatchAction('unload')}>
              <EyeOff size={14} />
              Unload Selected
            </button>
            <button onClick={() => handleBatchAction('delete')}>
              <Trash2 size={14} />
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Models Grid/List */}
      <div className="models-container" ref={parentRef}>
        <div className={`models-grid ${viewMode}-view`}>
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const model = processedModels[virtualItem.index];
            if (!model) return null;
            
            return (
              <div
                key={virtualItem.index}
                className="virtual-item"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`
                }}
              >
                {renderModelCard(model, virtualItem.index)}
              </div>
            );
          })}
        </div>
      </div>

      {/* GPU Memory Summary */}
      <div className="gpu-memory-summary">
        <h4>GPU Memory Usage</h4>
        <div className="memory-stats">
          <div className="stat">
            <span>Total Used:</span>
            <span>{formatSize(gpuMemoryStats.totalUsed)}</span>
          </div>
          <div className="stat">
            <span>Available:</span>
            <span>{formatSize(gpuMemoryStats.available)}</span>
          </div>
          <div className="stat">
            <span>Efficiency:</span>
            <span>{memoryEfficiencyScore}%</span>
          </div>
        </div>
        
        {optimizationSuggestions.length > 0 && (
          <div className="optimization-suggestions">
            <h5><AlertTriangle size={14} /> Optimization Suggestions</h5>
            <ul>
              {optimizationSuggestions.slice(0, 3).map((suggestion, index) => (
                // @ts-ignore - suggestion type
                <li key={index}>{String(suggestion)}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedModelBrowser;