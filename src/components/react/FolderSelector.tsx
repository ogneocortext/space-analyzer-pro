import React, { useState, FC, useEffect } from "react";
import {
  FolderOpen,
  X,
  Check,
  AlertCircle,
  HardDrive,
  Folder,
  Search,
  Sparkles,
  Clock,
} from "lucide-react";

interface FolderSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
  onQuickAnalysis?: (path: string) => Promise<void>;
}

export const FolderSelector: FC<FolderSelectorProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialPath = "C:\\",
  onQuickAnalysis,
}) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [customPath, setCustomPath] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [quickAnalysisResults, setQuickAnalysisResults] = useState<any>(null);
  const [analyzingPath, setAnalyzingPath] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [recentPaths, setRecentPaths] = useState<string[]>([]);

  const commonPaths = [
    { name: "Documents", path: "C:\\Users\\Public\\Documents", icon: <Folder size={16} /> },
    { name: "Desktop", path: "C:\\Users\\Public\\Desktop", icon: <Folder size={16} /> },
    { name: "Downloads", path: "C:\\Users\\Public\\Downloads", icon: <Folder size={16} /> },
    { name: "Projects (D:)", path: "D:\\Projects", icon: <HardDrive size={16} /> },
    { name: "Projects (E:)", path: "E:\\Projects", icon: <HardDrive size={16} /> },
    { name: "Source Code", path: ".\\src", icon: <FolderOpen size={16} /> },
    { name: "Parent Directory", path: "..\\", icon: <FolderOpen size={16} /> },
    { name: "Root Parent", path: "..\\..\\", icon: <FolderOpen size={16} /> },
    { name: "CLI Directory", path: "..\\..\\cli", icon: <FolderOpen size={16} /> },
    { name: "Web Source", path: "..\\..\\src\\web", icon: <FolderOpen size={16} /> },
  ];

  const handleCustomPathChange = (value: string) => {
    setCustomPath(value);
    setError("");
  };

  const validatePath = (path: string): boolean => {
    if (!path || path.trim() === "") {
      setError("Please enter a valid path");
      return false;
    }

    // Remove quotes if present
    const cleanPath = path.replace(/^["']|["']$/g, "");

    // Basic Windows path validation - updated to handle spaces
    const validPatterns = [
      /^[A-Za-z]:\\.*$/, // C:\... (with spaces allowed)
      /^\.\\.*$/, // .\... (with spaces allowed)
      /^\.\\\..*$/, // ..\... (with spaces allowed)
      /^\.\\\..\\\..*$/, // ..\..\... (with spaces allowed)
      /^[A-Za-z]:\\.*\\.*$/, // C:\...\... (with spaces allowed)
    ];

    const isValid = validPatterns.some((pattern) => pattern.test(cleanPath));
    if (!isValid) {
      setError("Invalid path format. Use formats like: C:\\Folder or .\\src or ..\\parent");
      return false;
    }

    return true;
  };

  const handleSelect = async () => {
    const pathToUse = customPath || currentPath;

    if (!validatePath(pathToUse)) {
      return;
    }

    // Clean the path by removing quotes before using it
    const cleanPath = pathToUse.replace(/^["']|["']$/g, "");

    setLoading(true);
    setError("");

    try {
      // Simulate path validation (in real app, this would call backend to verify)
      await new Promise((resolve) => setTimeout(resolve, 500));

      onSelect(cleanPath);
      onClose();
    } catch (err) {
      setError("Failed to access directory. Please check the path and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPath = (path: string) => {
    setCustomPath(path);
    setCurrentPath(path);
    setError("");

    // Add to recent paths
    if (!recentPaths.includes(path)) {
      setRecentPaths((prev) => [path, ...prev.slice(0, 4)]);
    }
  };

  // Enhanced quick analysis function
  const handleQuickAnalysis = async (path: string) => {
    if (!onQuickAnalysis) return;

    setAnalyzingPath(path);
    setQuickAnalysisResults(null);

    try {
      await onQuickAnalysis(path);
      // Mock quick analysis results for now
      setQuickAnalysisResults({
        path,
        estimatedFiles: Math.floor(Math.random() * 10000) + 1000,
        estimatedSize: Math.floor(Math.random() * 1000000000) + 100000000,
        complexity: ["Low", "Medium", "High"][Math.floor(Math.random() * 3)],
        recommendations: [
          "This directory contains mixed file types",
          "Consider organizing by file category",
          "Large files detected that may need compression",
        ],
      });
    } catch (error) {
      console.error("Quick analysis failed:", error);
    } finally {
      setAnalyzingPath("");
    }
  };

  // Filter paths based on search
  const filteredPaths = recentPaths.filter((path) =>
    path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="folder-selector-title"
      aria-describedby="folder-selector-desc"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4" role="document">
        {/* Header */}
        <header className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <FolderOpen className="text-blue-500" size={24} aria-hidden="true" />
            <h2 id="folder-selector-title" className="text-xl font-semibold text-gray-800">
              Select Directory to Analyze
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </header>

        {/* Body */}
        <div className="p-6 space-y-6" id="folder-selector-desc">
          {/* Search and Recent Paths */}
          <section aria-labelledby="search-heading">
            <h3 id="search-heading" className="text-sm font-medium text-gray-700 mb-3">
              Search & Recent
            </h3>

            {/* Search Bar */}
            <div className="relative mb-3">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={16}
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search recent paths..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>

            {/* Recent Paths */}
            {filteredPaths.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock size={12} />
                  <span>Recently Used</span>
                </div>
                {filteredPaths.map((path, index) => (
                  <div
                    key={path}
                    className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg group"
                  >
                    <Folder size={14} className="text-gray-400" />
                    <div className="flex-1">
                      <div className="text-sm text-gray-800 truncate">{path}</div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleQuickPath(path)}
                        className="p-1 text-gray-400 hover:text-blue-500 rounded"
                        aria-label={`Select ${path}`}
                      >
                        <Check size={14} />
                      </button>
                      {onQuickAnalysis && (
                        <button
                          onClick={() => handleQuickAnalysis(path)}
                          className="p-1 text-gray-400 hover:text-purple-500 rounded"
                          aria-label={`Quick analyze ${path}`}
                          disabled={analyzingPath === path}
                        >
                          {analyzingPath === path ? (
                            <div className="w-3 h-3 border border-purple-500 border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Sparkles size={14} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Quick Access */}
          <section aria-labelledby="quick-access-heading">
            <h3 id="quick-access-heading" className="text-sm font-medium text-gray-700 mb-3">
              Quick Access
            </h3>
            <div className="grid grid-cols-2 gap-2" role="listbox" aria-label="Common directories">
              {commonPaths.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleQuickPath(item.path)}
                  className="flex items-center gap-2 p-3 text-left bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors group"
                >
                  <span className="text-gray-500 group-hover:text-blue-500">{item.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-800 group-hover:text-blue-700">
                      {item.name}
                    </div>
                    <div className="text-xs text-gray-500 group-hover:text-blue-600">
                      {item.path}
                    </div>
                  </div>
                  {onQuickAnalysis && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleQuickAnalysis(item.path);
                      }}
                      className="p-1 text-gray-400 hover:text-purple-500 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`Quick analyze ${item.name}`}
                      disabled={analyzingPath === item.path}
                    >
                      {analyzingPath === item.path ? (
                        <div className="w-3 h-3 border border-purple-500 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Sparkles size={14} />
                      )}
                    </button>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Quick Analysis Results */}
          {quickAnalysisResults && (
            <section aria-labelledby="analysis-results-heading" className="border-t pt-4">
              <h3
                id="analysis-results-heading"
                className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2"
              >
                <Sparkles className="text-purple-500" size={16} />
                Quick Analysis
              </h3>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Estimated Files:</span>
                    <div className="font-semibold text-purple-700">
                      {quickAnalysisResults.estimatedFiles.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Estimated Size:</span>
                    <div className="font-semibold text-purple-700">
                      {(quickAnalysisResults.estimatedSize / 1024 / 1024).toFixed(1)} MB
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Complexity:</span>
                    <div className="font-semibold text-purple-700">
                      {quickAnalysisResults.complexity}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Recommendations:</span>
                    <div className="font-semibold text-purple-700">
                      {quickAnalysisResults.recommendations.length}
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-xs text-gray-600 mb-1">Key Insights:</div>
                  <ul className="text-xs text-purple-700 space-y-1">
                    {quickAnalysisResults.recommendations
                      .slice(0, 2)
                      .map((rec: string, index: number) => (
                        <li key={index}>• {rec}</li>
                      ))}
                  </ul>
                </div>
              </div>
            </section>
          )}

          {/* Custom Path Input */}
          <section aria-labelledby="custom-path-heading">
            <h3 id="custom-path-heading" className="text-sm font-medium text-gray-700 mb-3">
              Custom Path
            </h3>
            <div className="space-y-3">
              <input
                type="text"
                value={customPath}
                onChange={(e) => handleCustomPathChange(e.target.value)}
                placeholder="Enter directory path (e.g., C:\\Users\\YourName\\Documents)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                aria-describedby="path-examples"
              />

              {/* Path Examples */}
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-sm text-blue-800 font-medium mb-2">Path Examples:</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <code className="bg-white px-2 py-1 rounded">C:\Users\Public\Documents</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-white px-2 py-1 rounded">D:\Projects</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-white px-2 py-1 rounded">.\src</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-white px-2 py-1 rounded">..\parent</code>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="text-red-500" size={16} />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {/* Current Selection */}
          {(customPath || currentPath) && (
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Selected Path:</div>
              <div className="font-mono text-sm text-gray-800 break-all">
                {customPath || currentPath}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSelect}
            disabled={loading || (!customPath && !currentPath)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Validating...
              </>
            ) : (
              <>
                <Check size={16} />
                Select Directory
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
