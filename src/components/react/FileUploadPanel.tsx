import React, { useState, useRef, type FC } from "react";
import {
  FolderOpen,
  Upload,
  Search,
  FileText,
  AlertTriangle,
  CheckCircle,
  X,
  ChevronRight,
  HardDrive,
  Clock,
  BarChart3,
} from "lucide-react";
import { bridge } from "../services/AnalysisBridge";

interface FileUploadPanelProps {
  onDirectorySelected: (path: string) => void;
  onAnalysisStart: (path: string) => void;
  isAnalyzing?: boolean;
  analysisProgress?: number;
  currentFile?: string;
}

const FileUploadPanel: FC<FileUploadPanelProps> = ({
  onDirectorySelected,
  onAnalysisStart,
  isAnalyzing = false,
  analysisProgress = 0,
  currentFile = "",
}) => {
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [directoryInfo, setDirectoryInfo] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);

  // Handle directory selection
  const handleDirectorySelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Get the directory path from the first file
    const firstFile = files[0];
    const path = firstFile.webkitRelativePath?.split("/")[0] || firstFile.name;

    setSelectedPath(path);
    setError(null);
    setIsValidating(true);

    try {
      // Validate directory exists and is accessible
      const healthCheck = await bridge.healthCheck();
      if (healthCheck.status === "healthy") {
        setDirectoryInfo({
          name: path,
          fileCount: files.length,
          estimatedSize: Array.from(files).reduce((sum, file) => sum + file.size, 0),
          isValid: true,
        });
        onDirectorySelected(path);
      } else {
        setError("Backend is not responding correctly");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to validate directory");
    } finally {
      setIsValidating(false);
    }
  };

  // Handle manual path input
  const handlePathInput = async () => {
    if (!selectedPath.trim()) {
      setError("Please enter a directory path");
      return;
    }

    setError(null);
    setIsValidating(true);

    try {
      // Validate path format
      const path = selectedPath.trim();

      // Basic path validation
      if (!path.match(/^[a-zA-Z]:[\/\\]/) && !path.startsWith("/")) {
        setError("Please enter a valid absolute path");
        return;
      }

      // Check backend health
      const healthCheck = await bridge.healthCheck();
      if (healthCheck.status === "healthy") {
        setDirectoryInfo({
          name: path,
          isValid: true,
        });
        onDirectorySelected(path);
      } else {
        setError("Backend is not responding correctly");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to validate directory");
    } finally {
      setIsValidating(false);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (!items) return;

    // Look for directory items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          const path = entry.fullPath.replace(/^\//, "");
          setSelectedPath(path);
          onDirectorySelected(path);
          break;
        }
      }
    }
  };

  // Start analysis
  const handleStartAnalysis = () => {
    if (selectedPath && directoryInfo?.isValid) {
      onAnalysisStart(selectedPath);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 sm:p-5 lg:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <h3 className="text-lg sm:text-xl font-semibold text-white leading-tight flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-blue-400" />
          Directory Selection
        </h3>
        {directoryInfo?.isValid && (
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-green-400 text-sm">Valid</span>
          </div>
        )}
      </div>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 sm:p-8 text-center transition-colors ${
          isDragging
            ? "border-blue-400 bg-blue-400/10"
            : isAnalyzing
              ? "border-slate-600 bg-slate-700/50"
              : "border-slate-600 hover:border-slate-500 hover:bg-slate-700/30"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isAnalyzing ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400"></div>
            </div>
            <div className="space-y-2">
              <h4 className="text-white font-medium">Analyzing Directory...</h4>
              <p className="text-slate-400 text-sm">
                Check the progress panel above for detailed status
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <Upload className="w-12 h-12 text-slate-400" />
            </div>
            <div className="space-y-2">
              <h4 className="text-white font-medium">
                {isDragging ? "Drop directory here" : "Select Directory to Analyze"}
              </h4>
              <p className="text-slate-400 text-sm">
                Drag and drop a directory, or use the buttons below
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <input
                ref={directoryInputRef}
                type="file"
                // @ts-ignore - webkitdirectory
                webkitdirectory=""
                // @ts-ignore - directory
                directory=""
                multiple
                onChange={handleDirectorySelect}
                className="hidden"
              />
              <button
                onClick={() => directoryInputRef.current?.click()}
                disabled={isValidating}
                className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <FolderOpen size={16} />
                Browse Directory
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleDirectorySelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isValidating}
                className="bg-slate-600 hover:bg-slate-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <FileText size={16} />
                Select Files
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Manual Path Input */}
      {!isAnalyzing && (
        <div className="mt-4 sm:mt-6 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={selectedPath}
              onChange={(e) => setSelectedPath(e.target.value)}
              placeholder="Enter directory path (e.g., C:\Users\YourName\Documents)"
              className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-400"
              disabled={isValidating}
            />
            <button
              onClick={handlePathInput}
              disabled={isValidating || !selectedPath.trim()}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              {isValidating ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Search size={16} />
              )}
              Validate
            </button>
          </div>
        </div>
      )}

      {/* Directory Info */}
      {directoryInfo && !isAnalyzing && (
        <div className="mt-4 sm:mt-6 bg-slate-700/50 border border-slate-600 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-white font-medium flex items-center gap-2">
              <HardDrive size={16} />
              Directory Information
            </h4>
            <button
              onClick={() => {
                setSelectedPath("");
                setDirectoryInfo(null);
                setError(null);
              }}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">Path:</span>
              <span className="text-white text-sm font-mono truncate ml-2">
                {directoryInfo.name}
              </span>
            </div>
            {directoryInfo.fileCount && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Files:</span>
                <span className="text-white text-sm">
                  {directoryInfo.fileCount.toLocaleString()}
                </span>
              </div>
            )}
            {directoryInfo.estimatedSize && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-sm">Estimated Size:</span>
                <span className="text-white text-sm">
                  {formatFileSize(directoryInfo.estimatedSize)}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleStartAnalysis}
            className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <BarChart3 size={16} />
            Start Analysis
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-4 sm:mt-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-red-400 text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Quick Access */}
      {!isAnalyzing && (
        <div className="mt-4 sm:mt-6">
          <h4 className="text-white font-medium mb-3 flex items-center gap-2">
            <Clock size={16} />
            Recent Directories
          </h4>
          <div className="space-y-2">
            <button
              onClick={() => {
                setSelectedPath(
                  "D:\\Backup of Important Data for Windows 11 Upgrade\\Native Media AI Studio"
                );
                setDirectoryInfo({
                  name: "D:\\Backup of Important Data for Windows 11 Upgrade\\Native Media AI Studio",
                  isValid: true,
                });
              }}
              className="w-full text-left bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-sm"
            >
              Native Media AI Studio
            </button>
            <button
              onClick={() => {
                setSelectedPath(
                  "C:\\Users\\" +
                    (typeof window !== "undefined" && window.navigator.userAgent.includes("Windows")
                      ? "Public"
                      : "home")
                );
                setDirectoryInfo({
                  name: "C:\\Users\\Public",
                  isValid: true,
                });
              }}
              className="w-full text-left bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors text-sm"
            >
              Public Documents
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploadPanel;
