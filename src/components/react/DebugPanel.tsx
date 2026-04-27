import React, { useState, useEffect, type FC } from "react";
import { Bug, Play, Pause, RotateCcw, Trash2, Download, Eye } from "lucide-react";
import { performanceMonitor } from "../services/PerformanceMonitor";

interface DebugPanelProps {
  visible?: boolean;
}

const DebugPanel: FC<DebugPanelProps> = ({ visible = false }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [metrics, setMetrics] = useState<Record<string, number>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);

  useEffect(() => {
    if (isMonitoring) {
      const interval = setInterval(() => {
        setMetrics(performanceMonitor.getAllMetrics());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isMonitoring]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 100));
  };

  const handleClearLogs = () => {
    setLogs([]);
    addLog("Logs cleared");
  };

  const handleClearMetrics = () => {
    performanceMonitor.clearMetrics();
    setMetrics({});
    addLog("Performance metrics cleared");
  };

  const handleExportLogs = () => {
    const logData = {
      timestamp: new Date().toISOString(),
      metrics: performanceMonitor.getAllMetrics(),
      logs: logs,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    const blob = new Blob([JSON.stringify(logData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `space-analyzer-debug-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    addLog("Debug data exported");
  };

  const handleViewLocalStorage = () => {
    try {
      const performanceMetrics = localStorage.getItem("performance-metrics");
      if (performanceMetrics) {
        const data = JSON.parse(performanceMetrics);
        addLog(`Found ${data.length} stored performance metrics`);
        console.table(data);
      } else {
        addLog("No stored performance metrics found");
      }
    } catch (error) {
      addLog(`Error reading localStorage: ${error}`);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-t-lg transition-colors"
      >
        <Bug size={16} />
        <span className="text-sm font-medium">Debug Panel</span>
        <span className={`transform transition-transform ${isExpanded ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {/* Panel Content */}
      {isExpanded && (
        <div className="p-4 w-96 max-h-96 overflow-y-auto">
          {/* Controls */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setIsMonitoring(!isMonitoring)}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                isMonitoring ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
              } text-white transition-colors`}
            >
              {isMonitoring ? <Pause size={12} /> : <Play size={12} />}
              {isMonitoring ? "Pause" : "Monitor"}
            </button>

            <button
              onClick={handleViewLocalStorage}
              className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-xs transition-colors"
            >
              <Eye size={12} />
              Storage
            </button>

            <button
              onClick={handleClearMetrics}
              className="flex items-center gap-1 px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded text-xs transition-colors"
            >
              <RotateCcw size={12} />
              Clear Metrics
            </button>

            <button
              onClick={handleClearLogs}
              className="flex items-center gap-1 px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-xs transition-colors"
            >
              <Trash2 size={12} />
              Clear Logs
            </button>

            <button
              onClick={handleExportLogs}
              className="flex items-center gap-1 px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs transition-colors"
            >
              <Download size={12} />
              Export
            </button>
          </div>

          {/* Performance Metrics */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Performance Metrics</h4>
            <div className="bg-gray-800 rounded p-2 text-xs">
              {Object.keys(metrics).length > 0 ? (
                Object.entries(metrics).map(([key, value]) => (
                  <div key={key} className="flex justify-between py-1">
                    <span className="text-gray-400">{key}:</span>
                    <span className="text-green-400 font-mono">{value.toFixed(2)}ms</span>
                  </div>
                ))
              ) : (
                <div className="text-gray-500">No metrics available. Start monitoring.</div>
              )}
            </div>
          </div>

          {/* Debug Logs */}
          <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-2">Debug Logs</h4>
            <div className="bg-gray-800 rounded p-2 text-xs font-mono max-h-48 overflow-y-auto">
              {logs.length > 0 ? (
                logs.map((log, index) => (
                  <div key={index} className="text-gray-300 py-1 border-b border-gray-700">
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-gray-500">No logs yet.</div>
              )}
            </div>
          </div>

          {/* System Info */}
          <div className="mt-4 pt-4 border-t border-gray-700">
            <h4 className="text-sm font-semibold text-gray-300 mb-2">System Info</h4>
            <div className="bg-gray-800 rounded p-2 text-xs text-gray-400">
              <div>URL: {window.location.href}</div>
              <div>User Agent: {navigator.userAgent.split(" ").slice(-2).join(" ")}</div>
              <div>
                Viewport: {window.innerWidth}x{window.innerHeight}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugPanel;

// Development-only hook to show debug panel
export const useDebugPanel = () => {
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    // Show debug panel in development or with debug flag
    const isDevelopment = process.env.NODE_ENV === "development";
    const debugFlag = localStorage.getItem("debug-mode") === "true";

    setShowDebug(isDevelopment || debugFlag);

    // Add keyboard shortcut to toggle debug panel (Ctrl+Shift+D)
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        localStorage.setItem("debug-mode", (!debugFlag).toString());
        setShowDebug(!debugFlag);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  return showDebug;
};
