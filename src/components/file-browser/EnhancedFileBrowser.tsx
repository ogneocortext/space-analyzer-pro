import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './EnhancedFileBrowser.module.css';
import {
  Search,
  Filter,
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  Image,
  Video,
  Music,
  Code,
  Grid,
  List,
  CheckSquare,
  Square,
  MoreVertical,
  Eye,
  Download,
  Trash2,
  Copy,
  Move,
  Edit3,
  X,
  Home,
  ArrowLeft,
  ArrowRight,
  FolderOpen,
  File
} from 'lucide-react';
import { formatFileSize, getCategoryColor, getFileIcon } from '../../utils/fileUtils';

interface FileItem {
  id: string;
  name: string;
  path: string;
  size: number;
  type: 'file' | 'directory';
  category: string;
  extension?: string;
  modified: Date;
  children?: FileItem[];
  selected?: boolean;
}

interface EnhancedFileBrowserProps {
  files: FileItem[];
  onFileClick?: (file: FileItem) => void;
  onFolderSelect?: (path: string) => void;
  onFileOperation?: (operation: string, files: FileItem[]) => void;
  initialPath?: string;
}

const EnhancedFileBrowser: React.FC<EnhancedFileBrowserProps> = ({
  files,
  onFileClick,
  onFolderSelect,
  onFileOperation,
  initialPath = '/'
}) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'tree'>('list');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'modified' | 'type'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: FileItem } | null>(null);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedFiles, setDraggedFiles] = useState<FileItem[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build file tree structure
  const fileTree = useMemo(() => {
    const buildTree = (items: FileItem[], path: string = ''): FileItem[] => {
      if (!items || !Array.isArray(items)) return [];
      
      return items
        .filter(item => item.path.startsWith(path) && item.path !== path)
        .map(item => {
          const relativePath = item.path.substring(path.length).replace(/^\//, '');
          const parts = relativePath.split('/');
          const isCurrentLevel = parts.length === 1;
          
          if (isCurrentLevel) {
            const children = buildTree(items, item.path);
            return { ...item, children };
          }
          
          return null;
        })
        .filter(Boolean) as FileItem[];
    };

    return buildTree(files, currentPath);
  }, [files, currentPath]);

  // Filter and sort files
  const processedFiles = useMemo(() => {
    let filtered = fileTree;

    // Apply search
    if (searchQuery) {
      filtered = filtered.filter(file =>
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'modified':
          comparison = a.modified.getTime() - b.modified.getTime();
          break;
        case 'type':
          comparison = a.type.localeCompare(b.type);
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [fileTree, searchQuery, sortBy, sortOrder]);

  // Navigation
  const navigateToFolder = useCallback((path: string) => {
    setCurrentPath(path);
    setSelectedFiles(new Set());
    onFolderSelect?.(path);
  }, [onFolderSelect]);

  const navigateUp = useCallback(() => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    navigateToFolder(parentPath);
  }, [currentPath, navigateToFolder]);

  const navigateToBreadcrumb = useCallback((index: number) => {
    const parts = currentPath.split('/').filter(Boolean);
    const newPath = '/' + parts.slice(0, index + 1).join('/');
    navigateToFolder(newPath);
  }, [currentPath, navigateToFolder]);

  // File operations
  const toggleFileSelection = useCallback((fileId: string, event?: React.MouseEvent) => {
    event?.stopPropagation();
    
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  }, []);

  const selectAllFiles = useCallback(() => {
    const allFileIds = processedFiles.filter(f => f.type === 'file').map(f => f.id);
    setSelectedFiles(new Set(allFileIds));
  }, [processedFiles]);

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set());
  }, []);

  const deleteSelectedFiles = useCallback(() => {
    if (selectedFiles.size > 0) {
      const filesToDelete = processedFiles.filter(f => selectedFiles.has(f.id));
      onFileOperation?.('delete', filesToDelete);
      setSelectedFiles(new Set());
    }
  }, [selectedFiles, processedFiles, onFileOperation]);

  const copySelectedFiles = useCallback(() => {
    if (selectedFiles.size > 0) {
      const filesToCopy = processedFiles.filter(f => selectedFiles.has(f.id));
      onFileOperation?.('copy', filesToCopy);
    }
  }, [selectedFiles, processedFiles, onFileOperation]);

  const moveSelectedFiles = useCallback(() => {
    if (selectedFiles.size > 0) {
      const filesToMove = processedFiles.filter(f => selectedFiles.has(f.id));
      onFileOperation?.('move', filesToMove);
    }
  }, [selectedFiles, processedFiles, onFileOperation]);

  // Folder expansion for tree view
  const toggleFolderExpansion = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  }, []);

  // Context menu
  const handleContextMenu = useCallback((event: React.MouseEvent, file: FileItem) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, file });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // Drag and drop
  const handleDragStart = useCallback((event: React.DragEvent, file: FileItem) => {
    setIsDragging(true);
    setDraggedFiles([file]);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', file.name);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((event: React.DragEvent, targetFile?: FileItem) => {
    event.preventDefault();
    setIsDragging(false);
    
    if (draggedFiles.length > 0 && targetFile?.type === 'directory') {
      // @ts-ignore - argument count mismatch
      onFileOperation?.('move', draggedFiles, targetFile.path);
    }
    
    setDraggedFiles([]);
  }, [draggedFiles, onFileOperation]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'a':
            event.preventDefault();
            selectAllFiles();
            break;
          case 'Escape':
            clearSelection();
            closeContextMenu();
            break;
          case 'Delete':
            if (selectedFiles.size > 0) {
              deleteSelectedFiles();
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedFiles, selectAllFiles, clearSelection, deleteSelectedFiles, closeContextMenu]);

  // Click outside to close context menu
  useEffect(() => {
    const handleClickOutside = () => {
      closeContextMenu();
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [closeContextMenu]);

  // Breadcrumb navigation
  const breadcrumbParts = currentPath.split('/').filter(Boolean);

  const getFileIconComponent = useCallback((file: FileItem) => {
    const iconProps = { size: 16, className: 'flex-shrink-0' };
    
    if (file.type === 'directory') {
      return expandedFolders.has(file.id) ? <FolderOpen {...iconProps} /> : <Folder {...iconProps} />;
    }
    
    // @ts-ignore - iconProps type mismatch
    return getFileIcon(file.extension, iconProps);
  }, [expandedFolders]);

  return (
    <div className="enhanced-file-browser" ref={containerRef}>
      {/* Header with Breadcrumb */}
      <div className="file-browser-header">
        <div className="breadcrumb-navigation">
          <button
            onClick={() => navigateToFolder('/')}
            className={`breadcrumb-item ${currentPath === '/' ? 'active' : ''}`}
          >
            <Home size={16} />
          </button>
          
          {breadcrumbParts.map((part, index) => (
            <React.Fragment key={index}>
              <ChevronRight size={16} className="breadcrumb-separator" />
              <button
                onClick={() => navigateToBreadcrumb(index)}
                className={`breadcrumb-item ${index === breadcrumbParts.length - 1 ? 'active' : ''}`}
              >
                {part}
              </button>
            </React.Fragment>
          ))}
        </div>

        <div className="header-actions">
          {currentPath !== '/' && (
            <button onClick={navigateUp} className="action-button" title="Go up">
              <ArrowLeft size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Controls Bar */}
      <div className="file-browser-controls">
        <div className="search-section">
          <div className="search-container">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search files and folders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="clear-search"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="view-controls">
          <div className="sort-section">
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split('-');
                setSortBy(newSortBy as any);
                setSortOrder(newSortOrder as any);
              }}
              className="sort-select"
            >
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="size-asc">Size Smallest</option>
              <option value="size-desc">Size Largest</option>
              <option value="modified-asc">Modified Oldest</option>
              <option value="modified-desc">Modified Newest</option>
              <option value="type-asc">Type A-Z</option>
              <option value="type-desc">Type Z-A</option>
            </select>
          </div>

          <div className="view-mode-section">
            <button
              onClick={() => setViewMode('list')}
              className={`view-mode-button ${viewMode === 'list' ? 'active' : ''}`}
              title="List view"
            >
              <List size={16} />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`view-mode-button ${viewMode === 'grid' ? 'active' : ''}`}
              title="Grid view"
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`view-mode-button ${viewMode === 'tree' ? 'active' : ''}`}
              title="Tree view"
            >
              <Folder size={16} />
            </button>
          </div>
        </div>

        <div className="selection-controls">
          <button
            onClick={selectAllFiles}
            className="select-all-button"
            title="Select all files"
          >
            <CheckSquare size={16} />
          </button>
          <button
            onClick={clearSelection}
            className="clear-selection-button"
            title="Clear selection"
          >
            <Square size={16} />
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedFiles.size > 0 && (
          <motion.div
            className="bulk-actions-bar"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className="bulk-actions-info">
              <span className="selection-count">
                {selectedFiles.size} item{selectedFiles.size !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="bulk-actions-buttons">
              <button onClick={copySelectedFiles} className="bulk-action-button">
                <Copy size={14} />
                Copy
              </button>
              <button onClick={moveSelectedFiles} className="bulk-action-button">
                <Move size={14} />
                Move
              </button>
              <button onClick={deleteSelectedFiles} className="bulk-action-button delete">
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* File List */}
      <div className="file-list-container">
        {processedFiles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Folder size={48} />
            </div>
            <h3>No files found</h3>
            <p>
              {searchQuery
                ? 'No files match your search criteria'
                : 'This folder is empty'}
            </p>
          </div>
        ) : (
          <div className={`file-list ${viewMode}`}>
            {processedFiles.map((file) => (
              <motion.div
                key={file.id}
                className={`file-item ${selectedFiles.has(file.id) ? 'selected' : ''} ${
                  isDragging && draggedFiles.includes(file) ? 'dragging' : ''
                }`}
                // @ts-ignore - layout type
                layout={viewMode === 'grid' ? true : false}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                draggable={file.type === 'file'}
                // @ts-ignore - event type mismatch
                onDragStart={(e) => handleDragStart(e, file)}
                onDragOver={file.type === 'directory' ? handleDragOver : undefined}
                onDrop={(e) => handleDrop(e, file)}
                onClick={() => {
                  if (file.type === 'directory') {
                    navigateToFolder(file.path);
                  } else {
                    onFileClick?.(file);
                  }
                }}
                onContextMenu={(e) => handleContextMenu(e, file)}
              >
                <div className="file-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(file.id)}
                    onChange={() => toggleFileSelection(file.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                <div className="file-icon">
                  {getFileIconComponent(file)}
                </div>

                <div className="file-info">
                  <div className="file-name">{file.name}</div>
                  <div className="file-meta">
                    <span className="file-size">{formatFileSize(file.size)}</span>
                    {file.extension && (
                      <span className="file-extension">.{file.extension}</span>
                    )}
                    <span className="file-category">{file.category}</span>
                  </div>
                </div>

                <div className="file-actions">
                  {file.type === 'file' && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Preview file
                        }}
                        className="file-action-button"
                        title="Preview"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Download file
                        }}
                        className="file-action-button"
                        title="Download"
                      >
                        <Download size={14} />
                      </button>
                    </>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // More options
                    }}
                    className="file-action-button"
                    title="More options"
                  >
                    <MoreVertical size={14} />
                  </button>
                </div>

                {viewMode === 'tree' && file.type === 'directory' && file.children && file.children.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFolderExpansion(file.id);
                    }}
                    className="expand-button"
                  >
                    <ChevronDown
                      size={16}
                      className={`expand-icon ${
                        expandedFolders.has(file.id) ? 'expanded' : ''
                      }`}
                    />
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            className="context-menu"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 1000
            }}
          >
            <div className="context-menu-content">
              {contextMenu.file.type === 'file' && (
                <>
                  <button
                    onClick={() => {
                      onFileClick?.(contextMenu.file);
                      closeContextMenu();
                    }}
                    className="context-menu-item"
                  >
                    <Eye size={14} />
                    Preview
                  </button>
                  <button
                    onClick={() => {
                      // Download file
                      closeContextMenu();
                    }}
                    className="context-menu-item"
                  >
                    <Download size={14} />
                    Download
                  </button>
                  <button
                    onClick={() => {
                      // Edit file
                      closeContextMenu();
                    }}
                    className="context-menu-item"
                  >
                    <Edit3 size={14} />
                    Edit
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  toggleFileSelection(contextMenu.file.id);
                  closeContextMenu();
                }}
                className="context-menu-item"
              >
                {selectedFiles.has(contextMenu.file.id) ? (
                  <>
                    <Square size={14} />
                    Deselect
                  </>
                ) : (
                  <>
                    <CheckSquare size={14} />
                    Select
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  // Copy
                  closeContextMenu();
                }}
                className="context-menu-item"
              >
                <Copy size={14} />
                Copy
              </button>
              <button
                onClick={() => {
                  // Move
                  closeContextMenu();
                }}
                className="context-menu-item"
              >
                <Move size={14} />
                Move
              </button>
              <button
                onClick={() => {
                  // Delete
                  closeContextMenu();
                }}
                className="context-menu-item delete"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EnhancedFileBrowser;
