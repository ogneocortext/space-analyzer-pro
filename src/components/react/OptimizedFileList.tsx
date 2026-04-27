import React, { useState, useMemo, useCallback, useRef, useEffect, FC } from "react";
// @ts-ignore
import { FixedSizeList as List } from "react-window";
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Download,
  Trash2,
  HardDrive,
  File,
} from "lucide-react";

interface File {
  name: string;
  size: number;
  path: string;
  extension: string;
  category: string;
  modified?: Date;
  isSelected: boolean;
}

interface OptimizedFileListProps {
  files: File[];
  onFileAction: (action: string, files: File[]) => void;
  onToggleSelection: (file: File) => void;
}

export const OptimizedFileList: FC<OptimizedFileListProps> = ({
  files,
  onFileAction,
  onToggleSelection,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "size" | "modified">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [showHidden, setShowHidden] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Memoized expensive calculations
  const fileStatistics = useMemo(() => {
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const totalFiles = files.length;
    const categories = [...new Set(files.map((f) => f.category))];
    const extensions = [...new Set(files.map((f) => f.extension || ""))];

    return {
      totalSize,
      totalFiles,
      categories,
      extensions,
      averageFileSize: totalSize / totalFiles,
      largestFile: files.reduce((largest, file) => (file.size > largest.size ? file : largest), {
        size: 0,
        name: "",
      }),
    };
  }, [files]);

  // Memoized filtering and sorting
  const filteredAndSortedFiles = useMemo(() => {
    const filtered = files.filter((file) => {
      // Search filter
      if (searchQuery && !file.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Category filter
      if (filterCategory && file.category !== filterCategory) {
        return false;
      }

      // Hidden files filter
      if (!showHidden && file.name.startsWith(".")) {
        return false;
      }

      return true;
    });

    // Sort files
    return filtered.sort((a, b) => {
      const comparison = sortBy === "name" ? a.name.localeCompare(b.name) : a.size - b.size;

      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [files, searchQuery, sortBy, sortOrder, filterCategory, showHidden]);

  // Virtual scrolling with react-window
  const rowRenderer = useCallback(
    (index: number, style: React.CSSProperties) => {
      const file = filteredAndSortedFiles[index];
      const isSelected = selectedFiles.has(file.path);

      return (
        <div
          className={`file-item ${isSelected ? "selected" : ""}`}
          style={style}
          onClick={() => onToggleSelection(file)}
        >
          <div className="file-checkbox">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                onToggleSelection(file);
              }}
              title={`Select ${file.name}`}
              aria-label={`Select ${file.name}`}
            />
          </div>
          <div className="file-icon">{getFileIcon(file.extension)}</div>
          <div className="file-info">
            <div className="file-name" title={file.path}>
              {file.name}
            </div>
            <div className="file-meta">
              <span className="file-size">{formatFileSize(file.size)}</span>
              <span className="file-category">{file.category}</span>
              <span className="file-modified">
                {file.modified ? file.modified.toLocaleDateString() : "Unknown"}
              </span>
            </div>
          </div>
          <div className="file-actions">
            <button
              onClick={() => onFileAction("download", [file])}
              className="action-btn download-btn"
              title="Download file"
            >
              <Download size={16} />
            </button>
            <button
              onClick={() => onFileAction("delete", [file])}
              className="action-btn delete-btn"
              title="Delete file"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      );
    },
    [filteredAndSortedFiles, selectedFiles, onToggleSelection]
  );

  // Group files by category
  const groupedFiles = useMemo(() => {
    const groups: { [key: string]: File[] } = {};

    filteredAndSortedFiles.forEach((file) => {
      const groupKey = filterCategory || file.category || "Uncategorized";
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(file);
    });

    return groups;
  }, [filteredAndSortedFiles, filterCategory]);

  // Toggle group expansion
  const toggleGroupExpansion = useCallback((groupKey: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  }, []);

  // Select/deselect all files
  const selectAllVisible = useCallback(() => {
    const allFilePaths = filteredAndSortedFiles.map((f) => f.path);
    setSelectedFiles(new Set(allFilePaths));
  }, [filteredAndSortedFiles]);

  const clearSelection = useCallback(() => {
    setSelectedFiles(new Set());
  }, []);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Get file icon based on extension
  const getFileIcon = (extension?: string) => {
    const iconMap: { [key: string]: React.ReactNode } = {
      js: <span className="icon-js">JS</span>,
      ts: <span className="icon-ts">TS</span>,
      jsx: <span className="icon-jsx">JSX</span>,
      css: <span className="icon-css">CSS</span>,
      html: <span className="icon-html">HTML</span>,
      json: <span className="icon-json">JSON</span>,
      md: <span className="icon-md">MD</span>,
      txt: <span className="icon-txt">TXT</span>,
      png: <span className="icon-image">IMG</span>,
      jpg: <span className="icon-image">IMG</span>,
      gif: <span className="icon-image">IMG</span>,
      pdf: <span className="icon-pdf">PDF</span>,
      zip: <span className="icon-archive">ZIP</span>,
      exe: <span className="icon-exe">EXE</span>,
    };

    return iconMap[extension?.toLowerCase()] || <File size={16} />;
  };

  return (
    <div className="optimized-file-list">
      {/* Header with statistics */}
      <div className="list-header">
        <div className="list-stats">
          <div className="stat-item">
            <span className="stat-value">{fileStatistics.totalFiles.toLocaleString()}</span>
            <span className="stat-label">Total Files</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{formatFileSize(fileStatistics.totalSize)}</span>
            <span className="stat-label">Total Size</span>
          </div>
          <div className="stat-item">
            <span className="stat-value">{fileStatistics.categories.length}</span>
            <span className="stat-label">Categories</span>
          </div>
        </div>

        {/* Search and filters */}
        <div className="list-controls">
          <div className="search-section">
            <div className="search-input">
              <Search size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files..."
                className="search-field"
              />
            </div>

            <div className="filter-controls">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="filter-select"
                title="Filter by category"
                aria-label="Filter by category"
              >
                <option value="">All Categories</option>
                {Array.from(fileStatistics.categories).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setShowHidden(!showHidden)}
                className={`hidden-toggle ${showHidden ? "active" : ""}`}
                title={showHidden ? "Hide hidden files" : "Show hidden files"}
              >
                {showHidden ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <div className="sort-controls">
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [sort, order] = e.target.value.split("-");
                  setSortBy(sort as any);
                  setSortOrder(order as any);
                }}
                className="sort-select"
                title="Sort files"
                aria-label="Sort files"
              >
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="size-asc">Size (Smallest)</option>
                <option value="size-desc">Size (Largest)</option>
                <option value="modified-desc">Recently Modified</option>
                <option value="modified-asc">Oldest First</option>
              </select>
            </div>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="view-controls">
          <button
            onClick={() => setViewMode("list")}
            className={`view-btn ${viewMode === "list" ? "active" : ""}`}
            title="List view"
          >
            <List size={16} />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`view-btn ${viewMode === "grid" ? "active" : ""}`}
            title="Grid view"
          >
            <div className="grid-icon">⊞</div>
          </button>
        </div>

        {/* Selection actions */}
        <div className="selection-actions">
          <button
            onClick={selectAllVisible}
            className="select-all-btn"
            disabled={selectedFiles.size === filteredAndSortedFiles.length}
          >
            Select All ({selectedFiles.size}/{filteredAndSortedFiles.length})
          </button>
          <button
            onClick={clearSelection}
            className="clear-selection-btn"
            disabled={selectedFiles.size === 0}
          >
            Clear Selection
          </button>
          {selectedFiles.size > 0 && (
            <div className="bulk-actions">
              <button
                // @ts-ignore - type mismatch
                onClick={() => onFileAction("download", Array.from(selectedFiles))}
                className="bulk-action-btn download-btn"
              >
                <Download size={16} />
                Download Selected ({selectedFiles.size})
              </button>
              <button
                // @ts-ignore - type mismatch
                onClick={() => onFileAction("delete", Array.from(selectedFiles))}
                className="bulk-action-btn delete-btn"
              >
                <Trash2 size={16} />
                Delete Selected ({selectedFiles.size})
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Virtualized file list */}
      <div className="file-list-container">
        {Object.entries(groupedFiles).map(([groupKey, groupFiles]) => {
          const isExpanded = expandedGroups.has(groupKey);
          const groupSize = groupFiles.reduce((sum, file) => sum + file.size, 0);

          return (
            <div key={groupKey} className="file-group">
              <div className="group-header" onClick={() => toggleGroupExpansion(groupKey)}>
                <ChevronDown size={16} className={`group-toggle ${isExpanded ? "expanded" : ""}`} />
                <span className="group-name">
                  {groupKey} ({groupFiles.length} files, {formatFileSize(groupSize)})
                </span>
              </div>

              {isExpanded && (
                <div className="group-content">
                  <List
                    height={400}
                    itemCount={groupFiles.length}
                    itemData={groupFiles}
                    itemSize={50}
                    width="100%"
                  >
                    {rowRenderer}
                  </List>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
