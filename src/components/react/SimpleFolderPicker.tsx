import React, { useState, FC } from "react";
import { FolderOpen, X, Check, AlertCircle, HardDrive, Folder, Search } from "lucide-react";

interface SimpleFolderPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

export const SimpleFolderPicker: FC<SimpleFolderPickerProps> = ({
  isOpen,
  onClose,
  onSelect,
  initialPath = "C:\\",
}) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [customPath, setCustomPath] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    {
      name: "User Documents",
      path: "C:\\Users\\%USERNAME%\\Documents",
      icon: <Folder size={16} />,
    },
    { name: "Program Files", path: "C:\\Program Files", icon: <Folder size={16} /> },
    { name: "Windows", path: "C:\\Windows", icon: <Folder size={16} /> },
  ];

  const handleQuickPathSelect = (path: string) => {
    setCurrentPath(path);
    setCustomPath(path);
    setError("");
  };

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
      await new Promise((resolve) => setTimeout(resolve, 300));

      onSelect(cleanPath);
      onClose();
    } catch (err) {
      setError("Failed to access directory. Please check the path and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenExplorer = async () => {
    try {
      // Call backend to open File Explorer at the current path
      const response = await fetch("/api/files/open-explorer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: currentPath }),
      });

      if (response.ok) {
        // Show success message
        console.log("File Explorer opened at:", currentPath);
      }
    } catch (error) {
      console.error("Failed to open File Explorer:", error);
    }
  };

  const handleNativeFilePicker = async () => {
    try {
      // Use the native file system API if available
      if ("showDirectoryPicker" in window) {
        // Modern browsers with File System Access API
        const directoryHandle = await (window as any).showDirectoryPicker();
        const path = directoryHandle.name;
        setCurrentPath(path);
        setCustomPath(path);
        setError("");
        console.log("Selected directory:", path);
      } else if ("showOpenFilePicker" in window) {
        // Fallback to file picker
        const [fileHandle] = await (window as any).showOpenFilePicker({
          type: "openDirectory",
          multiple: false,
        });
        const path = fileHandle.name;
        setCurrentPath(path);
        setCustomPath(path);
        setError("");
        console.log("Selected directory:", path);
      } else {
        // Fallback for older browsers - use input[type=file] with webkitdirectory
        const input = document.createElement("input");
        input.type = "file";
        input.webkitdirectory = true;
        // @ts-ignore - directory property
        input.directory = true;
        // @ts-ignore - mozdirectory property
        input.mozdirectory = true;
        input.addEventListener("change", (e: any) => {
          const file = e.target.files[0];
          if (file) {
            const path = file.webkitRelativePath || file.name;
            setCurrentPath(path);
            setCustomPath(path);
            setError("");
            console.log("Selected directory:", path);
          }
        });
        input.click();
      }
    } catch (error) {
      console.error("Failed to open native file picker:", error);
      setError("Failed to open file picker. Please enter the path manually.");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        backdropFilter: "blur(4px)",
      }}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gradient-to-r from-blue-500 to-purple-600 text-white">
          <div className="flex items-center gap-3">
            <FolderOpen size={24} />
            <h2 className="text-xl font-semibold">Select Directory for Analysis</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Quick Access */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Search size={16} />
              Quick Access - Click to Select
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {commonPaths.map((item) => (
                <button
                  key={item.path}
                  onClick={() => handleQuickPathSelect(item.path)}
                  className="flex items-center gap-2 p-3 text-left bg-gray-50 hover:bg-blue-50 hover:border-blue-300 border border-gray-200 rounded-lg transition-all group"
                >
                  <span className="text-gray-500 group-hover:text-blue-500">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-800 group-hover:text-blue-700 truncate">
                      {item.name}
                    </div>
                    <div className="text-xs text-gray-500 group-hover:text-blue-600 truncate font-mono">
                      {item.path}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Path Input */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Custom Path Entry</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={customPath}
                onChange={(e) => handleCustomPathChange(e.target.value)}
                placeholder="Enter directory path (e.g., C:\\Users\\YourName\\Documents)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono"
              />

              {/* Path Examples */}
              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="text-sm text-blue-800 font-medium mb-2">Path Examples:</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <code className="bg-white px-2 py-1 rounded border border-blue-200">
                      C:\Users\Public\Documents
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-white px-2 py-1 rounded border border-blue-200">
                      D:\Projects
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-white px-2 py-1 rounded border border-blue-200">.\src</code>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="bg-white px-2 py-1 rounded border border-blue-200">
                      ..\parent
                    </code>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Native File System Integration */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Native File System</h3>
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <FolderOpen className="text-blue-600 mt-0.5" size={16} />
                <div className="text-sm text-blue-800">
                  <div className="font-medium mb-1">Windows 11 File Manager</div>
                  <div className="mb-3">
                    Click the button below to open Windows 11's native file manager. Select a
                    directory, and the path will be automatically filled in for you.
                  </div>
                  <button
                    onClick={handleNativeFilePicker}
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
                  >
                    🖥️ Open Windows File Manager
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* File Explorer Integration */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Windows File Explorer</h3>
            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-yellow-600 mt-0.5" size={16} />
                <div className="text-sm text-yellow-800">
                  <div className="font-medium mb-1">File Explorer Integration</div>
                  <div className="mb-3">
                    Click the button below to open Windows File Explorer. Navigate to your desired
                    folder, then manually copy the path from the address bar and paste it in the
                    Custom Path field above.
                  </div>
                  <button
                    onClick={handleOpenExplorer}
                    className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors text-sm"
                  >
                    📂 Open File Explorer
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="text-red-500" size={16} />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {/* Current Selection */}
          {(customPath || currentPath) && (
            <div className="bg-green-50 p-3 rounded-lg border border-green-200">
              <div className="text-sm text-green-800 font-medium mb-1">Selected Path:</div>
              <div className="font-mono text-sm text-green-900 break-all bg-white p-2 rounded border border-green-300">
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
                Selecting...
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
