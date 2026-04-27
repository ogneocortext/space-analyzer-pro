import React, { useState, useMemo, useCallback, FC } from "react";
import {
  Search,
  Filter,
  File,
  Folder,
  Trash2,
  Download,
  CheckCircle,
  AlertTriangle,
  Copy,
  Eye,
  EyeOff,
  HardDrive,
  Zap,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import "./DuplicatesTab.css";

interface DuplicateGroup {
  hash: string;
  size: number;
  files: Array<{
    name: string;
    path: string;
    size: number;
    modified?: Date;
  }>;
  totalWastedSpace: number;
  potentialSavings: string;
}

interface DuplicatesTabProps {
  files: Array<{
    name: string;
    size: number;
    path: string;
    extension: string;
    category: string;
    modified?: Date;
  }>;
  onFileAction?: (action: string, files: any[]) => void;
}

export const DuplicatesTab: FC<DuplicatesTabProps> = ({ files, onFileAction }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [minSize, setMinSize] = useState(0);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [isScanning, setIsScanning] = useState(false);
  const [sortBy, setSortBy] = useState<"size" | "count" | "name">("size");

  // Simple hash function for duplicate detection
  const generateFileHash = useCallback((file: any): string => {
    // In a real implementation, this would use actual file content hashing
    // For demo purposes, we'll use a combination of name, size, and extension
    const baseString = `${file.name}-${file.size}-${file.extension}`;
    let hash = 0;
    for (let i = 0; i < baseString.length; i++) {
      const char = baseString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }, []);

  // Find duplicates
  const duplicateGroups = useMemo(() => {
    if (!files || files.length === 0) return [];

    setIsScanning(true);
    const fileMap = new Map<string, any[]>();

    // Group files by hash
    files.forEach((file) => {
      const hash = generateFileHash(file);
      if (!fileMap.has(hash)) {
        fileMap.set(hash, []);
      }
      fileMap.get(hash)!.push(file);
    });

    // Filter for actual duplicates (groups with 2+ files)
    const duplicates: DuplicateGroup[] = [];

    fileMap.forEach((fileList, hash) => {
      if (fileList.length > 1) {
        const totalSize = fileList.reduce((sum, file) => sum + file.size, 0);
        const largestFile = Math.max(...fileList.map((f) => f.size));
        const wastedSpace = totalSize - largestFile; // Space wasted by duplicates

        duplicates.push({
          hash,
          files: fileList,
          size: totalSize,
          totalWastedSpace: wastedSpace,
          potentialSavings: formatFileSize(wastedSpace),
        });
      }
    });

    setIsScanning(false);
    return duplicates.sort((a, b) => {
      switch (sortBy) {
        case "size":
          return b.totalWastedSpace - a.totalWastedSpace;
        case "count":
          return b.files.length - a.files.length;
        case "name":
          return a.files[0].name.localeCompare(b.files[0].name);
        default:
          return 0;
      }
    });
  }, [files, generateFileHash, sortBy]);

  // Filter duplicates
  const filteredDuplicates = useMemo(() => {
    return duplicateGroups.filter((group) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = group.files.some(
          (file) =>
            file.name.toLowerCase().includes(query) || file.path.toLowerCase().includes(query)
        );
        if (!matchesSearch) return false;
      }

      // Size filter
      if (minSize > 0) {
        const hasLargeEnoughFile = group.files.some((file) => file.size >= minSize);
        if (!hasLargeEnoughFile) return false;
      }

      return true;
    });
  }, [duplicateGroups, searchQuery, minSize]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalDuplicates = filteredDuplicates.reduce(
      (sum, group) => sum + group.files.length - 1,
      0
    ); // Subtract 1 from each group (keep original)
    const totalWastedSpace = filteredDuplicates.reduce(
      (sum, group) => sum + group.totalWastedSpace,
      0
    );
    const totalGroups = filteredDuplicates.length;
    const largestWaste = Math.max(...filteredDuplicates.map((g) => g.totalWastedSpace), 0);

    return {
      totalDuplicates,
      totalWastedSpace,
      totalGroups,
      largestWaste,
      averageWastePerGroup: totalGroups > 0 ? totalWastedSpace / totalGroups : 0,
    };
  }, [filteredDuplicates]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Toggle group expansion
  const toggleGroupExpansion = (hash: string) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(hash)) {
        newSet.delete(hash);
      } else {
        newSet.add(hash);
      }
      return newSet;
    });
  };

  // Toggle group selection
  const toggleGroupSelection = (hash: string) => {
    setSelectedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(hash)) {
        newSet.delete(hash);
      } else {
        newSet.add(hash);
      }
      return newSet;
    });
  };

  // Select/deselect all groups
  const toggleAllGroups = () => {
    if (selectedGroups.size === filteredDuplicates.length) {
      setSelectedGroups(new Set());
    } else {
      setSelectedGroups(new Set(filteredDuplicates.map((g) => g.hash)));
    }
  };

  // Handle duplicate actions
  const handleDuplicateAction = (action: string, group: DuplicateGroup) => {
    const filesToKeep = [group.files[0]]; // Keep the first file (original/largest)
    const filesToDelete = group.files.slice(1); // Delete the rest

    switch (action) {
      case "delete":
        onFileAction?.("delete", filesToDelete);
        break;
      case "keep":
        onFileAction?.("keep", filesToKeep);
        break;
      case "move":
        onFileAction?.("move", filesToDelete);
        break;
    }
  };

  // Export duplicates report
  const exportDuplicatesReport = () => {
    const report = {
      generated: new Date().toISOString(),
      stats,
      duplicates: filteredDuplicates.map((group) => ({
        hash: group.hash,
        fileCount: group.files.length,
        wastedSpace: group.totalWastedSpace,
        files: group.files.map((f) => ({
          name: f.name,
          path: f.path,
          size: f.size,
          modified: f.modified,
        })),
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `duplicates-report-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!files || files.length === 0) {
    return (
      <div className="duplicates-tab">
        <div className="empty-state">
          <HardDrive size={64} className="empty-icon" />
          <h2>No Files to Analyze</h2>
          <p>Run an analysis first to find duplicate files</p>
        </div>
      </div>
    );
  }

  return (
    <div className="duplicates-tab">
      {/* Header */}
      <div className="duplicates-header">
        <div className="header-content">
          <h2>
            <Copy className="header-icon" />
            Duplicate File Finder
          </h2>
          <p>Identify and manage duplicate files to reclaim storage space</p>
        </div>

        {isScanning && (
          <div className="scanning-indicator">
            <RefreshCw className="spinner" />
            Scanning for duplicates...
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="duplicates-stats">
        <div className="stat-card">
          <div className="stat-value">{stats.totalDuplicates.toLocaleString()}</div>
          <div className="stat-label">Duplicate Files</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatFileSize(stats.totalWastedSpace)}</div>
          <div className="stat-label">Wasted Space</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalGroups}</div>
          <div className="stat-label">Duplicate Groups</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatFileSize(stats.largestWaste)}</div>
          <div className="stat-label">Largest Waste</div>
        </div>
      </div>

      {/* Filters */}
      <div className="duplicates-filters">
        <div className="filter-group">
          <label className="filter-label">Search Duplicates:</label>
          <div className="search-input">
            <Search size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by file name or path..."
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="clear-search">
                ×
              </button>
            )}
          </div>
        </div>

        <div className="filter-group">
          <label className="filter-label">Minimum Size:</label>
          <select
            value={minSize}
            onChange={(e) => setMinSize(Number(e.target.value))}
            className="size-filter"
          >
            <option value={0}>Any Size</option>
            <option value={1024}>&gt; 1KB</option>
            <option value={1024 * 1024}>&gt; 1MB</option>
            <option value={1024 * 1024 * 100}>&gt; 100MB</option>
            <option value={1024 * 1024 * 1024}>&gt; 1GB</option>
          </select>
        </div>

        <div className="filter-group">
          <label className="filter-label">Sort By:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="sort-filter"
          >
            <option value="size">Wasted Space</option>
            <option value="count">File Count</option>
            <option value="name">File Name</option>
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="duplicates-actions">
        <button onClick={toggleAllGroups} className="action-btn">
          {selectedGroups.size === filteredDuplicates.length ? "Deselect All" : "Select All"}
        </button>

        {selectedGroups.size > 0 && (
          <>
            <button
              onClick={() =>
                onFileAction?.(
                  "delete",
                  Array.from(selectedGroups).flatMap(
                    (hash) => filteredDuplicates.find((g) => g.hash === hash)?.files.slice(1) || []
                  )
                )
              }
              className="action-btn danger"
            >
              <Trash2 size={16} />
              Delete Selected Duplicates
            </button>

            <button onClick={exportDuplicatesReport} className="action-btn">
              <Download size={16} />
              Export Report
            </button>
          </>
        )}
      </div>

      {/* Duplicate Groups */}
      <div className="duplicates-list">
        {filteredDuplicates.length === 0 ? (
          <div className="no-duplicates">
            <CheckCircle size={48} className="no-duplicates-icon" />
            <h3>No Duplicates Found</h3>
            <p>No duplicate files match your current filters.</p>
          </div>
        ) : (
          filteredDuplicates.map((group) => {
            const isExpanded = expandedGroups.has(group.hash);
            const isSelected = selectedGroups.has(group.hash);
            const originalFile = group.files[0];
            const duplicateFiles = group.files.slice(1);

            return (
              <div key={group.hash} className={`duplicate-group ${isSelected ? "selected" : ""}`}>
                <div className="group-header" onClick={() => toggleGroupExpansion(group.hash)}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => {
                      e.stopPropagation();
                      toggleGroupSelection(group.hash);
                    }}
                    className="group-checkbox"
                  />
                  <div className="group-info">
                    <div className="group-main">
                      <File size={16} className="group-icon" />
                      <div className="group-details">
                        <div className="group-name">{originalFile.name}</div>
                        <div className="group-meta">
                          <span className="group-size">{formatFileSize(originalFile.size)}</span>
                          <span className="group-count">+{duplicateFiles.length} duplicates</span>
                        </div>
                      </div>
                    </div>
                    <div className="group-waste">
                      <AlertTriangle size={14} className="waste-icon" />
                      <span className="waste-amount">{formatFileSize(group.totalWastedSpace)}</span>
                      <span className="waste-label">wasted</span>
                    </div>
                  </div>
                  <div className="group-toggle">
                    {isExpanded ? <EyeOff size={16} /> : <Eye size={16} />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="group-content">
                    <div className="file-section">
                      <div className="file-header">
                        <h4>Original File (Keep)</h4>
                      </div>
                      <div className="file-item original">
                        <File size={14} />
                        <div className="file-info">
                          <div className="file-name">{originalFile.name}</div>
                          <div className="file-meta">
                            <span>{formatFileSize(originalFile.size)}</span>
                            <span>{originalFile.path}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {duplicateFiles.length > 0 && (
                      <div className="file-section">
                        <div className="file-header">
                          <h4>Duplicate Files (Can Delete)</h4>
                          <div className="duplicate-actions">
                            <button
                              onClick={() => handleDuplicateAction("delete", group)}
                              className="duplicate-action-btn danger"
                              title="Delete all duplicate files"
                            >
                              <Trash2 size={14} />
                              Delete All
                            </button>
                            <button
                              onClick={() => handleDuplicateAction("move", group)}
                              className="duplicate-action-btn"
                              title="Move duplicate files to another location"
                            >
                              <Folder size={14} />
                              Move All
                            </button>
                          </div>
                        </div>
                        {duplicateFiles.map((file, index) => (
                          <div key={index} className="file-item duplicate">
                            <File size={14} />
                            <div className="file-info">
                              <div className="file-name">{file.name}</div>
                              <div className="file-meta">
                                <span>{formatFileSize(file.size)}</span>
                                <span>{file.path}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DuplicatesTab;
