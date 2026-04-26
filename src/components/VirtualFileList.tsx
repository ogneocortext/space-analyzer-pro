import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
// @ts-ignore - react-virtualized
import { FixedSizeList as List } from 'react-virtualized';
// @ts-ignore - react-virtual
import { useVirtual } from 'react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Folder,
  File,
  Clock,
  CheckCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  Download,
  Trash2,
  ExternalLink,
  FileIcon,
  FolderIcon
} from 'lucide-react';
// @ts-ignore
import { useIntersectionObserver } from '../hooks/useIntersectionObserver';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { formatFileSize, formatDate } from '../utils/formatters';
import { FileData } from '../types/frontend';

interface VirtualFileListProps {
  files: FileData[];
  onFileSelect?: (file: FileData) => void;
  onFileAction?: (file: FileData, action: string) => void;
  selectedFiles?: Set<string>;
  sortBy?: 'name' | 'size' | 'date' | 'type';
  sortOrder?: 'asc' | 'desc';
  searchTerm?: string;
  showHidden?: boolean;
  itemHeight?: number;
  height?: number;
  enableSelection?: boolean;
  enableActions?: boolean;
  enableVirtualization?: boolean;
  className?: string;
}

interface FileItemProps {
  file: FileData;
  index: number;
  style: React.CSSProperties;
  isSelected: boolean;
  onSelect: (file: FileData) => void;
  onAction: (file: FileData, action: string) => void;
  enableSelection: boolean;
  enableActions: boolean;
}

const FileItem: React.FC<FileItemProps> = ({
  file,
  index,
  style,
  isSelected,
  onSelect,
  onAction,
  enableSelection,
  enableActions
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSelect = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(file);
  }, [file, onSelect]);

  const handleAction = useCallback((action: string) => {
    onAction(file, action);
  }, [file, onAction]);

  const getFileIcon = useCallback((file: FileData) => {
    if (file.type === 'directory') {
      return <Folder className="w-4 h-4 text-blue-400" />;
    }

    const extension = file.extension || '';
    const name = file.name.toLowerCase();

    // Document files
    if (['.pdf', '.doc', '.docx', '.txt', '.rtf'].includes(extension)) {
      return <FileText className="w-4 h-4 text-red-400" />;
    }

    // Image files
    if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg'].includes(extension)) {
      return <File className="w-4 h-4 text-green-400" />;
    }

    // Video files
    if (['.mp4', '.avi', '.mov', '.wmv', '.flv'].includes(extension)) {
      return <File className="w-4 h-4 text-purple-400" />;
    }

    // Audio files
    if (['.mp3', '.wav', '.flac', '.aac'].includes(extension)) {
      return <File className="w-4 h-4 text-pink-400" />;
    }

    // Code files
    if (['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c'].includes(extension)) {
      return <File className="w-4 h-4 text-yellow-400" />;
    }

    // Archive files
    if (['.zip', '.rar', '.7z', '.tar', '.gz'].includes(extension)) {
      return <File className="w-4 h-4 text-orange-400" />;
    }

    // Default file icon
    return <File className="w-4 h-4 text-gray-400" />;
  }, []);

  return (
    <motion.div
      style={style}
      className={`group file-item border-b border-gray-800 hover:bg-gray-800/50 transition-all duration-200 ${
        isSelected ? 'bg-blue-900/30 border-blue-600' : ''
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleSelect}
    >
      <div className="flex items-center gap-3 px-4 py-2">
        {/* Selection checkbox */}
        {enableSelection && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(file)}
            className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500 focus:ring-offset-gray-900"
          />
        )}

        {/* File icon */}
        <div className="flex-shrink-0">
          {getFileIcon(file)}
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">
              {file.name}
            </span>
            {file.isHidden && (
              <span className="px-1 py-0.5 text-xs bg-gray-600 text-gray-200 rounded">
                hidden
              </span>
            )}
            {file.isCorrupted && (
              <span className="px-1 py-0.5 text-xs bg-red-600 text-red-100 rounded">
                corrupted
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
            <span>{file.type}</span>
            <span>{formatFileSize(file.size)}</span>
            <span>{formatDate(file.modified)}</span>
            {file.category && (
              <span className="px-2 py-0.5 bg-gray-700 text-gray-300 rounded-full">
                {file.category}
              </span>
            )}
          </div>

          {/* Extended info (expandable) */}
          {isExpanded && (
            <div className="mt-2 text-xs text-gray-300 space-y-1">
              <div>Path: {file.path}</div>
              {file.created && (
                <div>Created: {formatDate(file.created)}</div>
              )}
              {file.accessed && (
                <div>Accessed: {formatDate(file.accessed)}</div>
              )}
              {file.checksum && (
                <div>Checksum: {file.checksum.slice(0, 16)}...</div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {enableActions && (
          <div className={`flex items-center gap-1 transition-all duration-200 ${
            isHovered || isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2'
          }`}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAction('preview');
              }}
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="Preview"
            >
              <Eye className="w-4 h-4" />
            </button>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAction('download');
              }}
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAction('open');
              }}
              className="p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
              title="Open"
            >
              <ExternalLink className="w-4 h-4" />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleAction('delete');
              }}
              className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Expand button */}
        {enableActions && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="ml-2 p-1 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            title={isExpanded ? "Hide details" : "Show details"}
          >
            {isExpanded ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
};

const VirtualFileList: React.FC<VirtualFileListProps> = ({
  files,
  onFileSelect,
  onFileAction,
  selectedFiles = new Set(),
  sortBy = 'name',
  sortOrder = 'asc',
  searchTerm = '',
  showHidden = true,
  itemHeight = 64,
  height = 600,
  enableSelection = true,
  enableActions = true,
  enableVirtualization = true,
  className = ''
}) => {
  const listRef = useRef<List>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollToTopVisible, setScrollToTopVisible] = useState(false);

  const performanceMonitor = usePerformanceMonitor();

  // Filter files
  const filteredFiles = useMemo(() => {
    let result = files;

    // Filter by search term
    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      result = result.filter(file =>
        file.name.toLowerCase().includes(lowerSearchTerm) ||
        file.path.toLowerCase().includes(lowerSearchTerm) ||
        (file.category && file.category.toLowerCase().includes(lowerSearchTerm))
      );
    }

    // Filter hidden files
    if (!showHidden) {
      result = result.filter(file => !file.isHidden);
    }

    return result;
  }, [files, searchTerm, showHidden]);

  // Sort files
  const sortedFiles = useMemo(() => {
    const sorted = [...filteredFiles].sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'size':
          aValue = a.size;
          bValue = b.size;
          break;
        case 'date':
          aValue = new Date(a.modified || 0).getTime();
          bValue = new Date(b.modified || 0).getTime();
          break;
        case 'type':
          aValue = a.type.toLowerCase();
          bValue = b.type.toLowerCase();
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredFiles, sortBy, sortOrder]);

  // Virtualization setup
  const rowVirtualizer = useVirtual({
    size: sortedFiles.length,
    parentRef: containerRef,
    estimateSize: useCallback(() => itemHeight, [itemHeight]),
    overscan: 10
  });

  // Intersection Observer for performance monitoring
  const { isVisible, observerRef } = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '100px'
  });

  // Handle scroll events
  const handleScroll = useCallback((event: any) => {
    const scrollTop = event.target.scrollTop;
    setIsScrolled(scrollTop > 0);
    
    // Show/hide scroll to top button
    setScrollToTopVisible(scrollTop > 300);
  }, []);

  // Scroll to top functionality
  const scrollToTop = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(0);
    }
  }, []);

  // Scroll to bottom functionality
  const scrollToBottom = useCallback(() => {
    if (listRef.current) {
      listRef.current.scrollToItem(sortedFiles.length - 1);
    }
  }, [sortedFiles.length]);

  // Performance monitoring
  useEffect(() => {
    if (isVisible) {
      performanceMonitor.recordMetric('file_list_render', {
        fileCount: sortedFiles.length,
        virtualizationEnabled: enableVirtualization,
        renderTime: performance.now()
      });
    }
  }, [isVisible, sortedFiles.length, enableVirtualization, performanceMonitor]);

  const handleFileSelect = useCallback((file: FileData) => {
    onFileSelect?.(file);
  }, [onFileSelect]);

  const handleFileAction = useCallback((file: FileData, action: string) => {
    onFileAction?.(file, action);
  }, [onFileAction]);

  // Render virtualized list
  const renderVirtualizedList = () => {
    if (!enableVirtualization) {
      return (
        <div className="space-y-1">
          {sortedFiles.map((file, index) => (
            <FileItem
              key={file.path}
              file={file}
              index={index}
              style={{ height: itemHeight }}
              isSelected={selectedFiles.has(file.path)}
              onSelect={handleFileSelect}
              onAction={handleFileAction}
              enableSelection={enableSelection}
              enableActions={enableActions}
            />
          ))}
        </div>
      );
    }

    return (
      <List
        ref={listRef}
        height={height}
        itemCount={sortedFiles.length}
        itemSize={itemHeight}
        itemData={sortedFiles}
        onScroll={handleScroll}
        className="virtual-list"
      >
        {({ index, style, data }) => (
          <FileItem
            file={data[index]}
            index={index}
            style={style}
            isSelected={selectedFiles.has(data[index].path)}
            onSelect={handleFileSelect}
            onAction={handleFileAction}
            enableSelection={enableSelection}
            enableActions={enableActions}
          />
        )}
      </List>
    );
  };

  return (
    <div className={`virtual-file-list relative ${className}`} ref={containerRef}>
      {/* Header with stats */}
      <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-300">
            <span className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400" />
              {sortedFiles.length} files
            </span>
            <span className="flex items-center gap-2">
              <Folder className="w-4 h-4 text-green-400" />
              {sortedFiles.filter(f => f.type === 'directory').length} directories
            </span>
            {!showHidden && (
              <span className="flex items-center gap-2">
                <EyeOff className="w-4 h-4 text-gray-400" />
                Hidden files hidden
              </span>
            )}
            {searchTerm && (
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                Filtered by "{searchTerm}"
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              Virtualization: {enableVirtualization ? 'ON' : 'OFF'}
            </span>
            {enableVirtualization && (
              <span className="text-xs text-gray-500">
                Rendered: {rowVirtualizer.virtualItems.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Virtualized content */}
      <div 
        ref={observerRef}
        className="virtual-list-container"
        style={{ height: `${height}px` }}
      >
        {renderVirtualizedList()}
      </div>

      {/* Scroll indicators */}
      <AnimatePresence>
        {scrollToTopVisible && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors z-50"
            title="Scroll to top"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {sortedFiles.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <FileText className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg font-medium">No files found</p>
          <p className="text-sm">Try adjusting your search or filter criteria</p>
        </div>
      )}
    </div>
  );
};

export default VirtualFileList;