import React, { FC, useState, memo } from "react";
import { motion } from "framer-motion";
import {
  BrainCircuit,
  Folder,
  Play,
  AlertTriangle,
  FolderOpen,
  BarChart3,
  Download,
  Trash2,
  Copy,
  Check,
} from "lucide-react";
import { RealTimeFileScanner } from "../RealTimeFileScanner";
import { StorageGauge } from "../StorageGauge";
import { Enhanced3DVisualization } from "../Enhanced3DVisualization";

interface LandingPageProps {
  path: string;
  onPathChange: (path: string) => void;
  onAnalyze: (useAI: boolean) => void;
  isBackendOnline: boolean;
  isAnalysisRunning: boolean;
  progress: number;
  status: string;
  error?: string;
  useAI: boolean;
  onToggleAI: () => void;
  recentPaths: string[];
  showPathPicker: boolean;
  onTogglePathPicker: () => void;
  onSelectRecentPath: (path: string) => void;
  analysisData?: any;
  scannedFiles: any[];
  progressData: {
    files: number;
    percentage: number;
    currentFile: string;
    completed: boolean;
  };
  onNavigateToDashboard: () => void;
  onNavigateToBrowser: () => void;
  onExportReport: () => void;
  onCleanupSuggestions: () => void;
  getCategoryColor: (category: string) => string;
}

export const LandingPage: FC<LandingPageProps> = memo(
  ({
    path,
    onPathChange,
    onAnalyze,
    isBackendOnline,
    isAnalysisRunning,
    progress,
    status,
    error,
    useAI,
    onToggleAI,
    recentPaths,
    showPathPicker,
    onTogglePathPicker,
    onSelectRecentPath,
    analysisData,
    scannedFiles,
    progressData,
    onNavigateToDashboard,
    onNavigateToBrowser,
    onExportReport,
    onCleanupSuggestions,
    getCategoryColor,
  }) => {
    const [copied, setCopied] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);

    const truncatePath = (path: string, maxLength: number = 40) => {
      if (path.length <= maxLength) return path;
      const parts = path.split(/[\\/]/);
      if (parts.length <= 2) return path;
      return `${parts[0]}\\...\\${parts[parts.length - 1]}`;
    };

    const handleCopyPath = async () => {
      try {
        await navigator.clipboard.writeText(path);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy path:", err);
      }
    };
    return (
      <div
        data-testid="landing-page"
        className="flex flex-col min-h-screen bg-slate-900 text-white relative overflow-hidden"
      >
        {/* Animated Background - simplified for better performance */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 md:p-12 relative z-10">
          <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Left Side - Hero Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
              className="space-y-8 lg:space-y-12 text-center lg:text-left"
            >
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                className="flex justify-center lg:justify-start"
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#00B4D8] to-purple-500 blur-2xl opacity-20 rounded-full"></div>
                  <div
                    data-testid="app-logo"
                    className="relative bg-slate-800/50 p-4 lg:p-6 rounded-full border border-white/20 shadow-lg"
                  >
                    <BrainCircuit
                      size={80}
                      className="text-transparent bg-gradient-to-r from-[#00B4D8] to-purple-500 bg-clip-text w-12 h-12 lg:w-20 lg:h-20"
                    />
                  </div>
                </div>
              </motion.div>

              <motion.h1
                data-testid="app-title"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                className="text-4xl lg:text-5xl text-transparent bg-gradient-to-r from-[#00B4D8] to-purple-500 bg-clip-text leading-tight"
              >
                Space Analyzer Pro
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                className="text-sm lg:text-base text-slate-300 leading-relaxed font-normal"
              >
                AI-Powered Intelligence for Your Digital Universe
              </motion.p>

              {/* Feature Highlights */}
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
                className="grid grid-cols-2 gap-3 lg:gap-4"
              >
                {[
                  { icon: "🧠", text: "Neural Analysis", desc: "AI-powered file relationships" },
                  { icon: "⚡", text: "Lightning Fast", desc: "Instant scanning results" },
                  { icon: "🤖", text: "AI Insights", desc: "Smart recommendations" },
                  { icon: "📊", text: "Smart Reports", desc: "Detailed analytics" },
                ].map((feature, index) => (
                  <motion.div
                    key={feature.text}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.03 }}
                    transition={{
                      delay: 0.6 + index * 0.05,
                      duration: 0.3,
                      ease: [0.25, 0.1, 0.25, 1],
                    }}
                    className="bg-slate-800/50 backdrop-blur border-2 border-white/20 rounded-xl p-4 cursor-pointer hover:border-[#00B4D8] transition-colors duration-200"
                  >
                    <div className="flex flex-col items-center text-center">
                      <span className="text-2xl lg:text-3xl mb-2">{feature.icon}</span>
                      <span className="text-sm font-medium text-white mb-1">{feature.text}</span>
                      <span className="text-xs text-slate-300">{feature.desc}</span>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right Side - Input Card */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
              className="w-full max-w-md mx-auto"
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                const droppedFile = e.dataTransfer.files[0];
                if (droppedFile) {
                  // In browser, we can only get the file name, not full path
                  // In Electron, we might get the full path
                  const droppedPath = (droppedFile as any).path || droppedFile.name;
                  onPathChange(droppedPath);
                }
              }}
            >
              <div
                className={`bg-slate-800/50 p-4 lg:p-6 space-y-3 lg:space-y-4 backdrop-blur-lg border border-white/20 rounded-xl ${isDragOver ? "border-2 border-dashed border-[#00B4D8] bg-[#00B4D8]/10" : ""}`}
              >
                <div data-testid="directory-input-section">
                  <label
                    htmlFor="directory-path"
                    className="block text-sm font-medium text-slate-300 mb-2"
                  >
                    Target Directory
                  </label>
                  <div className="relative">
                    <Folder
                      className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400"
                      size={20}
                    />
                    <input
                      data-testid="directory-path-input"
                      id="directory-path"
                      name="directory-path"
                      type="text"
                      value={path}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        onPathChange(e.target.value)
                      }
                      className="w-full pl-12 pr-20 font-mono text-sm bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[#00B4D8] focus:ring-1 focus:ring-[#00B4D8]"
                      placeholder="Enter directory path..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && isBackendOnline && !isAnalysisRunning) {
                          onAnalyze(useAI);
                        }
                      }}
                    />
                    <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
                      <button
                        onClick={handleCopyPath}
                        className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                        title="Copy path"
                      >
                        {copied ? (
                          <Check size={16} className="text-[#00B4D8]" />
                        ) : (
                          <Copy size={16} className="text-slate-300" />
                        )}
                      </button>
                      {recentPaths.length > 0 && (
                        <button
                          onClick={onTogglePathPicker}
                          className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
                          title="Recent paths"
                        >
                          <FolderOpen size={16} className="text-slate-300" />
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Recent paths dropdown */}
                  {showPathPicker && recentPaths.length > 0 && (
                    <div className="mt-2 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                      {recentPaths.map((path, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            onSelectRecentPath(path);
                            onTogglePathPicker();
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 transition-colors first:border-b border-slate-700"
                        >
                          {path}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Backend status indicator */}
                <div
                  data-testid="backend-status"
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${isBackendOnline ? "bg-[#00B4D8] animate-pulse" : "bg-red-400"}`}
                    />
                    <span className={isBackendOnline ? "text-[#00B4D8]" : "text-red-400"}>
                      {isBackendOnline ? "Backend Online" : "Backend Offline"}
                    </span>
                  </div>
                  {!isBackendOnline && (
                    <span className="text-slate-500">
                      Start the backend server to enable analysis
                    </span>
                  )}
                </div>

                {/* AI toggle */}
                <div data-testid="ai-toggle" className="flex items-center justify-between">
                  <label className="text-sm text-slate-300">Enable AI Analysis</label>
                  <button
                    data-testid="ai-toggle-button"
                    onClick={onToggleAI}
                    className={`relative w-12 h-6 rounded-full transition-colors ${useAI ? "bg-[#00B4D8]" : "bg-slate-600"}`}
                  >
                    <div
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${useAI ? "translate-x-6" : "translate-x-0"}`}
                    />
                  </button>
                </div>

                {/* AI Model Selection */}
                {useAI && (
                  <div data-testid="ai-panel" className="space-y-2">
                    <label className="text-sm text-slate-300">AI Model</label>
                    <select
                      data-testid="ai-model-select"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg text-white text-sm p-2 focus:outline-none focus:border-[#00B4D8]"
                      defaultValue="qwen2.5:7b"
                    >
                      <option value="qwen2.5:7b">Qwen 2.5 (7B)</option>
                      <option value="qwen2.5:14b">Qwen 2.5 (14B)</option>
                      <option value="phi4-mini:latest">Phi 4 Mini</option>
                      <option value="gemma3:4b">Gemma 3 (4B)</option>
                      <option value="deepseek-coder:6.7b-instruct">DeepSeek Coder</option>
                    </select>
                    <div data-testid="ai-status" className="text-xs text-slate-400">
                      {isBackendOnline ? "AI Service: Available" : "AI Service: Offline"}
                    </div>
                  </div>
                )}

                {error && (
                  <div className="bg-orange-500/10 border border-orange-500 text-orange-400 px-4 py-3 rounded-xl flex items-center gap-2">
                    <AlertTriangle size={18} />
                    {error}
                  </div>
                )}

                {isAnalysisRunning ? (
                  <div data-testid="progress-section" className="space-y-3">
                    <div className="flex justify-between text-sm text-slate-300">
                      <span>{status}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div
                        data-testid="progress-bar"
                        className="bg-[#00B4D8] h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                        title={`Analysis progress: ${Math.round(progress)}%`}
                      />
                    </div>
                    {/* Real-time file scanner */}
                    <RealTimeFileScanner scannedFiles={scannedFiles} progress={progressData} />
                  </div>
                ) : (
                  <button
                    data-testid="start-analysis-button"
                    onClick={() => onAnalyze(useAI)}
                    disabled={!isBackendOnline || isAnalysisRunning}
                    className="bg-[#00B4D8] hover:bg-[#0095b8] text-white font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full"
                  >
                    <Play size={20} />
                    {isAnalysisRunning
                      ? "Analyzing..."
                      : useAI
                        ? "Start AI Analysis"
                        : "Start Standard Analysis"}
                  </button>
                )}

                {analysisData && (
                  <motion.div
                    data-testid="scan-results"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="pt-4 border-t border-slate-700 space-y-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm text-slate-300">Analysis Complete</span>
                      <span className="text-xs text-emerald-400">✓</span>
                    </div>

                    {/* Storage Gauge */}
                    <StorageGauge
                      used={analysisData.totalSize || 0}
                      total={analysisData.totalSize * 1.5 || 1}
                      categories={Object.entries(analysisData.categories || {}).map(
                        ([name, data]: [string, any]) => ({
                          name,
                          size: data.size || 0,
                          color: getCategoryColor(name),
                        })
                      )}
                    />

                    <div data-testid="statistics" className="grid grid-cols-2 gap-3">
                      <div
                        data-testid="file-count"
                        className="bg-slate-800/50 rounded-lg p-3 text-center"
                      >
                        <div className="text-2xl font-bold text-white mb-1">
                          {analysisData.files?.length || 0}
                        </div>
                        <div className="text-xs text-slate-300">Files</div>
                      </div>
                      <div
                        data-testid="total-size"
                        className="bg-slate-800/50 rounded-lg p-3 text-center"
                      >
                        <div className="text-2xl font-bold text-white mb-1">
                          {analysisData.totalSize
                            ? `${(analysisData.totalSize / 1024 / 1024).toFixed(1)}`
                            : "0"}
                        </div>
                        <div className="text-xs text-slate-300">MB</div>
                      </div>
                    </div>

                    {/* 3D Visualization Preview */}
                    <div
                      data-testid="visualization"
                      className="mt-4 bg-slate-800/50 rounded-lg p-4"
                    >
                      <h4 className="text-sm font-medium text-white mb-2">3D Visualization</h4>
                      <div className="h-32 bg-slate-900 rounded-lg flex items-center justify-center text-slate-400 text-xs">
                        {analysisData?.files?.length > 0
                          ? `Ready to visualize ${analysisData.files.length} files`
                          : "Run analysis to enable 3D visualization"}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="space-y-2 mt-4">
                      <h4 className="text-sm font-medium text-white mb-2">Quick Actions</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={onNavigateToBrowser}
                          disabled={!analysisData}
                          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1"
                          title={analysisData ? "Browse Files" : "Run analysis first"}
                        >
                          <FolderOpen size={16} className="mr-1" />
                          Browse Files
                        </button>
                        <button
                          onClick={onNavigateToDashboard}
                          disabled={!analysisData}
                          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1"
                          title={analysisData ? "View Dashboard" : "Run analysis first"}
                        >
                          <BarChart3 size={16} className="mr-1" />
                          View Dashboard
                        </button>
                        <button
                          onClick={onExportReport}
                          disabled={!analysisData}
                          className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1"
                          title={analysisData ? "Export Report" : "Run analysis first"}
                        >
                          <Download size={16} className="mr-1" />
                          Export Report
                        </button>
                        <button
                          onClick={onCleanupSuggestions}
                          disabled={!analysisData}
                          className="bg-[#00B4D8] hover:bg-[#0095b8] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1"
                          title={analysisData ? "Cleanup" : "Run analysis first"}
                        >
                          <Trash2 size={16} className="mr-1" />
                          Cleanup
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }
);
