import React, { useState, useCallback, type FC } from 'react';
import {
  Search, Filter, Grid3X3, List, FolderOpen, File, ChevronDown,
  ChevronRight, X, Check, Clock, HardDrive, Tag, Layers,
  ArrowUpDown, MoreVertical, Eye, EyeOff, Download, Trash2
} from 'lucide-react';
// @ts-ignore - missing hook
import { useFileBrowserFilters } from '../hooks/useFileBrowserFilters';
// @ts-ignore - missing hook
import { useOptimizedVirtualScroll, useFileSelection } from '../hooks/useOptimizedVirtualScroll';
import './EnhancedFileBrowser.css';

interface EnhancedFileBrowserProps {
  files: Array<{
    name: string;
    size: number;
    path: string;
    extension: string;
    category: string;
    subcategory?: string;
    semantic_tags?: string[];
    modified?: Date;
    created?: Date;
  }>;
  categories?: { [key: string]: { count: number; size: number } };
  onFileAction?: (action: string, file: any) => void;
}

interface ViewState {
  searchQuery: string;
  sortBy: 'name' | 'size' | 'modified' | 'category' | 'extension';
  sortOrder: 'asc' | 'desc';
  filters: {
    categories: string[];
    extensions: string[];
    sizeRange: [number, number];
    dateRange: [Date | null, Date | null];
  };
  viewMode: 'list' | 'grid' | 'tree' | 'compact';
  groupBy: 'none' | 'category' | 'extension' | 'size' | 'folder';
  showHidden: boolean;
  selectedFiles: Set<string>;
  expandedGroups: Set<string>;
}

export const EnhancedFileBrowser: FC<EnhancedFileBrowserProps> = ({
  files,
  categories,
  onFileAction
}) => {
  // Simplified state with optimized hooks
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [focusedFile, setFocusedFile] = useState<string | null>(null);
  
  // View state
  const [viewState, setViewState] = useState<ViewState>({
    searchQuery: '',
    sortBy: 'name',
    sortOrder: 'asc',
    filters: {
      categories: [],
      extensions: [],
      sizeRange: [0, Number.MAX_SAFE_INTEGER],
      dateRange: [null, null]
    },
    viewMode: 'list',
    groupBy: 'none',
    showHidden: false,
    selectedFiles: new Set(),
    expandedGroups: new Set()
  });

  // Use optimized hooks
  const {
    filterOptions: filterOptionsValues,
    filteredFiles,
    sortedFiles,
    groupedFiles,
    formatSize
  } = useFileBrowserFilters(files, viewState);

  const {
    parentRef,
    virtualizer,
    scrollToIndex,
    visibleRange,
    isItemVisible
  } = useOptimizedVirtualScroll({
    count: sortedFiles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => viewState.viewMode === 'compact' ? 32 : 56
  });

  const {
    selectedFiles,
    selectedCount,
    isAllSelected,
    toggleFileSelection,
    selectAll,
    clearSelection,
    isSelected
  } = useFileSelection({
    onSelectionChange: (newSelected) => {
      setViewState(prev => ({ ...prev, selectedFiles: newSelected }));
    }
  });

  // Update view state
  const updateViewState = useCallback((updates: Partial<ViewState>) => {
    setViewState(prev => ({ ...prev, ...updates }));
  }, []);

  // Render file item based on view mode
  const renderFileItem = useCallback((file: any, index: number) => {
    const isFocused = focusedFile === file.path;

    if (viewState.viewMode === 'compact') {
      return (
        <div
          key={file.path}
          className={`compact-file-item ${isSelected(file.path) ? 'selected' : ''} ${isFocused ? 'focused' : ''}`}
          onClick={() => toggleFileSelection(file.path, index, false)}
          onDoubleClick={() => onFileAction?.('open', file)}
        >
          <input
            type="checkbox"
            checked={isSelected(file.path)}
            onChange={(e) => {
              e.stopPropagation();
              toggleFileSelection(file.path, index, true);
            }}
            onClick={(e) => e.stopPropagation()}
          />
          <File size={14} />
          <span className="file-name">{file.name}</span>
          <span className="file-size">{formatSize(file.size)}</span>
          <span className="file-category">{file.category}</span>
        </div>
      );
    }

    if (viewState.viewMode === 'grid') {
      return (
        <div
          key={file.path}
          className={`grid-file-item ${isSelected(file.path) ? 'selected' : ''}`}
          onClick={() => toggleFileSelection(file.path, index, false)}
        >
          <div className="file-icon">
            <File size={24} />
          </div>
          <div className="file-info">
            <div className="file-name" title={file.name}>{file.name}</div>
            <div className="file-meta">
              <span>{formatSize(file.size)}</span>
              <span className="category-tag">{file.category}</span>
            </div>
          </div>
          <input
            type="checkbox"
            checked={isSelected(file.path)}
            onChange={(e) => {
              e.stopPropagation();
              toggleFileSelection(file.path, index, true);
            }}
            className="file-checkbox"
          />
        </div>
      );
    }

    // List view (default)
    return (
      <div
        key={file.path}
        className={`list-file-item ${isSelected(file.path) ? 'selected' : ''} ${isFocused ? 'focused' : ''}`}
        onClick={() => toggleFileSelection(file.path, index, false)}
      >
        <input
          type="checkbox"
          checked={isSelected(file.path)}
          onChange={(e) => {
            e.stopPropagation();
            toggleFileSelection(file.path, index, true);
          }}
        />
        <File size={18} />
        <div className="file-details">
          <div className="file-name">{file.name}</div>
          <div className="file-path">{file.path}</div>
          {file.semantic_tags && file.semantic_tags.length > 0 && (
            <div className="semantic-tags">
              {file.semantic_tags.slice(0, 3).map((tag, idx) => (
                <span key={idx} className="semantic-tag">{tag}</span>
              ))}
              {file.semantic_tags.length > 3 && (
                <span className="semantic-tag more">+{file.semantic_tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
        <span className="file-size">{formatSize(file.size)}</span>
        <span className="file-extension">{file.extension || 'none'}</span>
        <span className="file-category">
          {file.category}
          {file.subcategory && file.subcategory !== file.category && (
            <span className="subcategory"> / {file.subcategory}</span>
          )}
        </span>
        <div className="file-actions">
          <button onClick={(e) => { e.stopPropagation(); onFileAction?.('open', file); }} title="Open file">
            <Eye size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onFileAction?.('delete', file); }} title="Delete file">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  }, [viewState.viewMode, focusedFile, isSelected, toggleFileSelection, formatSize, onFileAction]);

  return (
    <div className="enhanced-file-browser">
      {/* Header with stats and controls */}
      <div className="browser-header">
        <div className="header-top">
          <div className="title-section">
            <h3>File Explorer</h3>
            <div className="stats">
              <span className="stat">
                <HardDrive size={14} />
                {filteredFiles.length.toLocaleString()} files
              </span>
              <span className="stat">
                {formatSize(filteredFiles.reduce((sum, f) => sum + f.size, 0))}
              </span>
              <span className="stat">
                <Layers size={14} />
                {Object.keys(groupedFiles).length} groups
              </span>
            </div>
          </div>
          
          <div className="view-controls">
            <div className="view-mode-buttons">
              <button
                onClick={() => updateViewState({ viewMode: 'list' })}
                className={viewState.viewMode === 'list' ? 'active' : ''}
                title="List view"
              >
                <List size={16} />
              </button>
              <button
                onClick={() => updateViewState({ viewMode: 'grid' })}
                className={viewState.viewMode === 'grid' ? 'active' : ''}
                title="Grid view"
              >
                <Grid3X3 size={16} />
              </button>
              <button
                onClick={() => updateViewState({ viewMode: 'compact' })}
                className={viewState.viewMode === 'compact' ? 'active' : ''}
                title="Compact view"
              >
                <Layers size={16} />
              </button>
            </div>
            
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`filter-toggle ${showAdvancedFilters ? 'active' : ''}`}
            >
              <Filter size={16} />
              Filters
            </button>
            
            <button
              onClick={() => updateViewState({ showHidden: !viewState.showHidden })}
              className={viewState.showHidden ? 'active' : ''}
            >
              {viewState.showHidden ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Search and quick filters */}
        <div className="search-section">
          <div className="search-bar">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search files by name or path..."
              value={viewState.searchQuery}
              onChange={(e) => updateViewState({ searchQuery: e.target.value })}
              aria-label="Search files"
              title="Search files"
            />
            {viewState.searchQuery && (
              <button onClick={() => updateViewState({ searchQuery: '' })} title="Clear search">
                <X size={14} />
              </button>
            )}
          </div>
          
          <div className="quick-filters">
            <select
              value={viewState.groupBy}
              onChange={(e) => updateViewState({ groupBy: e.target.value as any })}
              aria-label="Group files by"
              title="Group files by"
            >
              <option value="none">No Grouping</option>
              <option value="category">Group by Category</option>
              <option value="extension">Group by Extension</option>
              <option value="size">Group by Size</option>
              <option value="folder">Group by Folder</option>
            </select>
            
            <select
              value={`${viewState.sortBy}-${viewState.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split('-');
                updateViewState({ sortBy: sortBy as any, sortOrder: sortOrder as any });
              }}
              aria-label="Sort files"
              title="Sort files"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="size-asc">Size (Smallest)</option>
              <option value="size-desc">Size (Largest)</option>
              <option value="modified-desc">Recently Modified</option>
              <option value="modified-asc">Oldest First</option>
              <option value="category-asc">Category (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="advanced-filters">
          <div className="filter-section">
            <h4>Categories</h4>
            <div className="filter-options">
              {(filterOptionsValues?.categories || []).map(category => (
                <label key={category} className="filter-option">
                  <input
                    type="checkbox"
                    checked={viewState.filters.categories.includes(category)}
                    onChange={(e) => {
                      const newCategories = e.target.checked
                        ? [...viewState.filters.categories, category]
                        : viewState.filters.categories.filter(c => c !== category);
                      updateViewState({
                        filters: { ...viewState.filters, categories: newCategories }
                      });
                    }}
                  />
                  <span>{category}</span>
                  <span className="count">
                    {categories?.[category]?.count || 0}
                  </span>
                </label>
              ))}
            </div>
          </div>
          
          <div className="filter-section">
            <h4>Extensions</h4>
            <div className="filter-options">
              {(filterOptionsValues?.extensions || []).slice(0, 10).map(extension => (
                <label key={extension} className="filter-option">
                  <input
                    type="checkbox"
                    checked={viewState.filters.extensions.includes(extension)}
                    onChange={(e) => {
                      const newExtensions = e.target.checked
                        ? [...viewState.filters.extensions, extension]
                        : viewState.filters.extensions.filter(e => e !== extension);
                      updateViewState({
                        filters: { ...viewState.filters, extensions: newExtensions }
                      });
                    }}
                  />
                  <span>.{extension}</span>
                </label>
              ))}
              {(filterOptionsValues?.extensions?.length || 0) > 10 && (
                <button className="show-more">
                  +{(filterOptionsValues?.extensions?.length || 0) - 10} more
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Selection Toolbar */}
      {selectedCount > 0 && (
        <div className="selection-toolbar">
          <div className="selection-info">
            <Check size={16} />
            {selectedCount} files selected
          </div>
          <div className="selection-actions">
            <button onClick={() => selectAll(sortedFiles)}>Select All Visible</button>
            <button onClick={clearSelection}>Clear Selection</button>
            {onFileAction && (
              <>
                <button onClick={() => onFileAction('delete', Array.from(selectedFiles))}>
                  <Trash2 size={14} />
                  Delete
                </button>
                <button onClick={() => onFileAction('export', Array.from(selectedFiles))}>
                  <Download size={14} />
                  Export
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* File Display */}
      <div className="file-display">
        {viewState.groupBy === 'none' ? (
          // Ungrouped view with virtual scrolling
          <div ref={parentRef} className="virtual-scroll-container">
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map((virtualItem) => {
                const file = sortedFiles[virtualItem.index];
                return (
                  <div
                    key={virtualItem.key}
                    className="virtual-file-item"
                    style={{
                      ...virtualItem.style,
                      transform: `translateY(${virtualItem.start}px)`
                    }}
                  >
                    {renderFileItem(file, virtualItem.index)}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          // Grouped view
          <div className="grouped-files">
            {Object.entries(groupedFiles).map(([groupName, groupFiles]) => {
              const isExpanded = viewState.expandedGroups.has(groupName);
              // @ts-ignore - groupFiles type
              const groupSize = groupFiles.reduce((sum: number, f: any) => sum + f.size, 0);
              
              return (
                <div key={groupName} className="file-group">
                  <div
                    className="group-header"
                    // @ts-ignore - toggleGroupExpansion
                    onClick={() => toggleGroupExpansion(groupName)}
                  >
                    <div className="group-toggle">
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                    <div className="group-info">
                      <FolderOpen size={16} />
                      <span className="group-name">{groupName || 'Root'}</span>
                      <span className="group-stats">
                        {/* @ts-ignore - groupFiles type */}
                        {(groupFiles as any).length} files • {formatSize(groupSize)}
                      </span>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="group-content">
                      {/* @ts-ignore - groupFiles type */}
                      {(groupFiles as any).map((file: any, index: number) => renderFileItem(file, index))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedFileBrowser;