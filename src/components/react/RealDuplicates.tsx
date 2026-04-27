import React, { useState, useMemo, useCallback } from "react";
import {
  Copy,
  Search,
  Filter,
  Trash2,
  Download,
  Eye,
  EyeOff,
  AlertTriangle,
  CheckCircle,
  HardDrive,
  FileText,
  Folder,
  X,
} from "lucide-react";
import { AnalysisResult } from "../services/AnalysisBridge";

interface DuplicateGroup {
  id: string;
  hash: string;
  files: Array<{
    path: string;
    name: string;
    size: number;
    modified: Date;
  }>;
  totalSize: number;
  totalWasted: number;
}

export const RealDuplicates: React.FC<{
  files: Array<{ name: string; size: number; path: string; category: string }>;
}> = ({ files }) => {
  if (!files || files.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen text-white">
        <div className="text-center">
          <Copy size={48} className="mx-auto mb-4 text-slate-400" />
          <h2 className="text-2xl font-bold mb-4">No Files to Analyze</h2>
          <p className="text-slate-400">Run an analysis first to find duplicate files</p>
        </div>
      </div>
    );
  }
  const [searchQuery, setSearchQuery] = useState("");
  const [minSize, setMinSize] = useState(0);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(true);

  // Find duplicates by analyzing file names and sizes
  const duplicateGroups = useMemo(() => {
    if (!files || files.length === 0) {
      return [];
    }

    const groups: Map<string, DuplicateGroup> = new Map();
    const nameMap: Map<string, Array<{ path: string; name: string; size: number }>> = new Map();

    // Group files by name (potential duplicates)
    files.forEach((file) => {
      const fileName = file.name.toLowerCase();
      if (!nameMap.has(fileName)) {
        nameMap.set(fileName, []);
      }
      nameMap.get(fileName)!.push({
        path: file.path,
        name: file.name,
        size: file.size,
      });
    });

    // Find actual duplicates (same name and size)
    let groupId = 0;
    nameMap.forEach((fileList, fileName) => {
      if (fileList.length > 1) {
        // Group by size
        const sizeMap: Map<number, typeof fileList> = new Map();
        fileList.forEach((file) => {
          if (!sizeMap.has(file.size)) {
            sizeMap.set(file.size, []);
          }
          sizeMap.get(file.size)!.push(file);
        });

        sizeMap.forEach((sameSizeFiles, size) => {
          if (sameSizeFiles.length > 1 && size >= minSize) {
            const totalSize = size * sameSizeFiles.length;
            const totalWasted = size * (sameSizeFiles.length - 1);

            groups.set(`group-${groupId}`, {
              id: `group-${groupId}`,
              hash: `${fileName}-${size}`,
              files: sameSizeFiles.map((f) => ({
                path: f.path,
                name: f.name,
                size: f.size,
                modified: new Date(),
              })),
              totalSize,
              totalWasted,
            });
            groupId++;
          }
        });
      }
    });

    return Array.from(groups.values()).sort((a, b) => b.totalWasted - a.totalWasted);
  }, [files, minSize]);

  // Filter duplicates by search query
  const filteredGroups = useMemo(() => {
    if (!searchQuery) return duplicateGroups;
    return duplicateGroups.filter((group) =>
      group.files.some(
        (file) =>
          file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          file.path.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [duplicateGroups, searchQuery]);

  // Calculate statistics
  const stats = useMemo(() => {
    const totalDuplicates = filteredGroups.length;
    const totalFiles = filteredGroups.reduce((sum, group) => sum + group.files.length, 0);
    const totalWasted = filteredGroups.reduce((sum, group) => sum + group.totalWasted, 0);
    const totalSize = filteredGroups.reduce((sum, group) => sum + group.totalSize, 0);

    return { totalDuplicates, totalFiles, totalWasted, totalSize };
  }, [filteredGroups]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const handleDelete = useCallback((groupId: string, fileIndex: number) => {
    // In a real implementation, this would call an API to delete the file
    console.log(`Delete file ${fileIndex} from group ${groupId}`);
  }, []);

  const handleDeleteAll = useCallback((groupId: string) => {
    // In a real implementation, this would call an API to delete all but one file
    console.log(`Delete all duplicates from group ${groupId}`);
  }, []);

  if (!files || files.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen text-white">
        <div className="text-center">
          <Copy size={48} className="mx-auto mb-4 text-slate-400" />
          <h2 className="text-2xl font-bold mb-4">No Files to Analyze</h2>
          <p className="text-slate-400">Run an analysis first to find duplicate files</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 text-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Copy className="w-8 h-8 text-cyan-400" />
          Duplicate Files
        </h1>
        <p className="text-slate-400 text-lg">
          Find and remove duplicate files to free up storage space
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Copy className="w-6 h-6 text-cyan-400" />
            <h3 className="text-lg font-semibold">Duplicate Groups</h3>
          </div>
          <div className="text-3xl font-bold text-cyan-400 mb-2">{stats.totalDuplicates}</div>
          <div className="text-slate-400 text-sm">Groups found</div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="w-6 h-6 text-purple-400" />
            <h3 className="text-lg font-semibold">Total Files</h3>
          </div>
          <div className="text-3xl font-bold text-purple-400 mb-2">{stats.totalFiles}</div>
          <div className="text-slate-400 text-sm">Duplicate files</div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <HardDrive className="w-6 h-6 text-orange-400" />
            <h3 className="text-lg font-semibold">Space Wasted</h3>
          </div>
          <div className="text-3xl font-bold text-orange-400 mb-2">
            {formatBytes(stats.totalWasted)}
          </div>
          <div className="text-slate-400 text-sm">Recoverable space</div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-400" />
            <h3 className="text-lg font-semibold">Total Size</h3>
          </div>
          <div className="text-3xl font-bold text-red-400 mb-2">{formatBytes(stats.totalSize)}</div>
          <div className="text-slate-400 text-sm">All duplicates</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              type="text"
              placeholder="Search duplicate files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <input
              type="number"
              placeholder="Min size (bytes)"
              value={minSize}
              onChange={(e) => setMinSize(Number(e.target.value))}
              className="w-40 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
            />
          </div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg transition-colors"
          >
            {showDetails ? <EyeOff size={16} /> : <Eye size={16} />}
            {showDetails ? "Hide Details" : "Show Details"}
          </button>
        </div>
      </div>

      {/* Duplicate Groups */}
      <div className="space-y-4">
        {filteredGroups.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-12 text-center">
            <CheckCircle size={48} className="mx-auto mb-4 text-green-400" />
            <h3 className="text-xl font-semibold text-white mb-2">No Duplicates Found</h3>
            <p className="text-slate-400">
              {searchQuery || minSize > 0 ? "Try adjusting your filters" : "Your files are clean!"}
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div
              key={group.id}
              className="bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden"
            >
              <div
                className="p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
                onClick={() => setSelectedGroup(selectedGroup === group.id ? null : group.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Copy className="w-5 h-5 text-cyan-400" />
                    <div>
                      <div className="text-white font-medium">{group.files[0].name}</div>
                      <div className="text-slate-400 text-sm">
                        {group.files.length} copies • {formatBytes(group.totalSize)} total •{" "}
                        {formatBytes(group.totalWasted)} wasted
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-sm">
                      {formatBytes(group.totalWasted)} wasted
                    </span>
                    {selectedGroup === group.id ? (
                      <X size={20} className="text-slate-400" />
                    ) : (
                      <Eye size={20} className="text-slate-400" />
                    )}
                  </div>
                </div>
              </div>

              {selectedGroup === group.id && showDetails && (
                <div className="border-t border-slate-700 p-4 bg-slate-900/50">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-white font-medium">File Locations</h4>
                    <button
                      onClick={() => handleDeleteAll(group.id)}
                      className="flex items-center gap-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 px-3 py-1 rounded-lg text-sm transition-colors"
                    >
                      <Trash2 size={14} />
                      Delete All but One
                    </button>
                  </div>
                  <div className="space-y-2">
                    {group.files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <Folder size={16} className="text-slate-400" />
                          <div className="flex-1">
                            <div className="text-white text-sm">{file.path}</div>
                            <div className="text-slate-400 text-xs">{formatBytes(file.size)}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(group.id, index)}
                          className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                          title="Delete file"
                        >
                          <Trash2 size={16} className="text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
