import React, { useEffect, useState, useMemo, FC, ComponentType } from "react";
import {
  Clock,
  FileSearch,
  HardDrive,
  Activity,
  CheckCircle,
  AlertCircle,
  Pause,
  Play,
  X,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

interface AnalysisProgressProps {
  isRunning: boolean;
  progress: number;
  status: string;
  currentFile?: string;
  totalFiles?: number;
  processedFiles?: number;
  estimatedTimeRemaining?: number;
  analysisId?: string;
  onCancel?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onSpeedChange?: (speed: "slow" | "normal" | "fast") => void;
  onDepthChange?: (depth: number) => void;
  currentSpeed?: "slow" | "normal" | "fast";
  currentDepth?: number;
  realtimeData?: any;
  className?: string;
}

interface ProgressStage {
  name: string;
  description: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  estimatedDuration: number; // in seconds
}

const ANALYSIS_STAGES: ProgressStage[] = [
  {
    name: "Initializing",
    description: "Setting up analysis environment",
    icon: Activity,
    estimatedDuration: 5,
  },
  {
    name: "Directory Scan",
    description: "Scanning directory structure",
    icon: FileSearch,
    estimatedDuration: 30,
  },
  {
    name: "File Analysis",
    description: "Analyzing individual files",
    icon: HardDrive,
    estimatedDuration: 120,
  },
  {
    name: "Dependency Analysis",
    description: "Building file relationships",
    icon: Activity,
    estimatedDuration: 45,
  },
  {
    name: "Finalizing",
    description: "Generating insights and reports",
    icon: CheckCircle,
    estimatedDuration: 15,
  },
];

const AnalysisProgress: FC<AnalysisProgressProps> = ({
  isRunning,
  progress,
  status,
  currentFile,
  totalFiles = 0,
  processedFiles = 0,
  estimatedTimeRemaining,
  analysisId,
  onCancel,
  onPause,
  onResume,
  onSpeedChange,
  onDepthChange,
  currentSpeed = "normal",
  currentDepth = 5,
  realtimeData,
  className = "",
}) => {
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Update elapsed time
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, startTime]);

  // Calculate current stage based on progress
  const currentStage = useMemo(() => {
    const stageIndex = Math.floor((progress / 100) * ANALYSIS_STAGES.length);
    return ANALYSIS_STAGES[Math.min(stageIndex, ANALYSIS_STAGES.length - 1)];
  }, [progress]);

  // Calculate estimated completion time
  const estimatedCompletion = useMemo(() => {
    if (!isRunning || progress <= 0) return null;

    const elapsed = elapsedTime / 1000; // in seconds
    const remainingProgress = (100 - progress) / 100;
    const estimatedTotal = elapsed / (progress / 100);

    return Math.max(0, estimatedTotal - elapsed);
  }, [isRunning, progress, elapsedTime]);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  };

  const formatElapsedTime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    return formatTime(seconds);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getProgressColor = () => {
    if (progress < 25) return "bg-blue-500";
    if (progress < 50) return "bg-yellow-500";
    if (progress < 75) return "bg-orange-500";
    return "bg-green-500";
  };

  const getStatusColor = () => {
    if (!isRunning) return "text-gray-400";
    if (progress < 25) return "text-blue-400";
    if (progress < 50) return "text-yellow-400";
    if (progress < 75) return "text-orange-400";
    return "text-green-400";
  };

  // Extract meaningful status from the status string
  const getMeaningfulStatus = () => {
    // If status contains emoji and meaningful text, use it directly
    if (
      status &&
      (status.includes("🔍") ||
        status.includes("🧠") ||
        status.includes("🤖") ||
        status.includes("💡") ||
        status.includes("📊") ||
        status.includes("✅"))
    ) {
      return status;
    }

    // If status is from real progress callback, use it
    if (
      status &&
      (status.includes("Scanning:") ||
        status.includes("Analyzing:") ||
        status.includes("Found") ||
        status.includes("Generating") ||
        status.includes("Finalizing"))
    ) {
      return status;
    }

    // Fallback to dynamic status based on progress
    if (progress >= 0 && progress < 25) return "🔍 Scanning directory structure...";
    if (progress >= 25 && progress < 75) return "🤖 Running AI categorization...";
    if (progress >= 75 && progress < 90) return "💡 Generating AI recommendations...";
    if (progress >= 90 && progress < 100) return "📊 Finalizing analysis results...";
    if (progress >= 100) return "✅ Analysis complete!";

    return currentStage.description;
  };

  // Don't render if not running and no progress
  if (!isRunning && progress === 0) {
    return null;
  }

  return (
    <div
      className={`bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-4 sm:p-6 shadow-2xl ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Activity className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Analysis in Progress</h3>
            <p className="text-sm text-slate-400">
              {analysisId ? `ID: ${analysisId.slice(-8)}` : "Processing directory"}
            </p>
          </div>
        </div>

        {/* Enhanced Control Buttons */}
        <div className="flex items-center space-x-2">
          {/* Speed Control */}
          {onSpeedChange && (
            <div className="flex items-center space-x-1 bg-slate-700 rounded-lg p-1">
              {(["slow", "normal", "fast"] as const).map((speed) => (
                <button
                  key={speed}
                  onClick={() => onSpeedChange(speed)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    currentSpeed === speed
                      ? "bg-blue-500 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-600"
                  }`}
                  aria-label={`Set speed to ${speed}`}
                >
                  {speed === "slow" ? "🐢" : speed === "normal" ? "🚶" : "🏃"}
                </button>
              ))}
            </div>
          )}

          {/* Depth Control */}
          {onDepthChange && (
            <div className="flex items-center space-x-1 bg-slate-700 rounded-lg p-1">
              <button
                onClick={() => onDepthChange(Math.max(1, currentDepth - 1))}
                className="px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
                aria-label="Decrease depth"
              >
                -
              </button>
              <span className="px-2 py-1 text-xs text-slate-300">{currentDepth}</span>
              <button
                onClick={() => onDepthChange(Math.min(10, currentDepth + 1))}
                className="px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-600 rounded transition-colors"
                aria-label="Increase depth"
              >
                +
              </button>
            </div>
          )}

          {onPause && onResume && (
            <button
              onClick={() => {
                if (isPaused) {
                  onResume();
                  setIsPaused(false);
                } else {
                  onPause();
                  setIsPaused(true);
                }
              }}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              aria-label={isPaused ? "Resume analysis" : "Pause analysis"}
            >
              {isPaused ? <Play size={16} /> : <Pause size={16} />}
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
              aria-label="Cancel analysis"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Status and Current Stage */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-medium ${getStatusColor()}`}>{getMeaningfulStatus()}</span>
          <span className="text-sm text-slate-400">{progress}% Complete</span>
        </div>

        {/* Current File Information */}
        {currentFile && currentFile !== "Starting analysis..." && (
          <div className="text-xs text-slate-500 mb-2 truncate">Currently: {currentFile}</div>
        )}

        {/* File Count Information */}
        {totalFiles > 0 && (
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Files: {processedFiles || 0} / {totalFiles}
            </span>
            <span>Elapsed: {formatElapsedTime(elapsedTime)}</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ease-out ${getProgressColor()}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Detailed Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-lg font-semibold text-white">{processedFiles.toLocaleString()}</div>
          <div className="text-xs text-slate-400">Files Processed</div>
        </div>

        {totalFiles > 0 && (
          <div className="text-center">
            <div className="text-lg font-semibold text-white">{totalFiles.toLocaleString()}</div>
            <div className="text-xs text-slate-400">Total Files</div>
          </div>
        )}

        <div className="text-center">
          <div className="text-lg font-semibold text-white">{formatElapsedTime(elapsedTime)}</div>
          <div className="text-xs text-slate-400">Elapsed Time</div>
        </div>

        {estimatedCompletion !== null && (
          <div className="text-center">
            <div className="text-lg font-semibold text-white">
              {formatTime(estimatedCompletion)}
            </div>
            <div className="text-xs text-slate-400">Estimated Remaining</div>
          </div>
        )}
      </div>

      {/* Current File */}
      {currentFile && (
        <div className="mb-4">
          <div className="flex items-center space-x-2">
            <FileSearch size={14} className="text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-300 truncate">{currentFile}</span>
          </div>
        </div>
      )}

      {/* Stage Progress */}
      <div className="border-t border-slate-700 pt-4">
        <h4 className="text-sm font-medium text-white mb-3">Analysis Stages</h4>
        <div className="space-y-2">
          {ANALYSIS_STAGES.map((stage, index) => {
            const stageProgress = Math.min(
              100,
              Math.max(0, ((progress / 100) * ANALYSIS_STAGES.length - index) * 100)
            );
            const isActive = index === Math.floor((progress / 100) * ANALYSIS_STAGES.length);
            const isCompleted = stageProgress >= 100;

            return (
              <div key={stage.name} className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {isCompleted ? (
                    <CheckCircle size={16} className="text-green-400" />
                  ) : isActive ? (
                    <stage.icon size={16} className="text-blue-400 animate-pulse" />
                  ) : (
                    <stage.icon size={16} className="text-slate-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-sm font-medium ${
                        isCompleted
                          ? "text-green-400"
                          : isActive
                            ? "text-blue-400"
                            : "text-slate-400"
                      }`}
                    >
                      {stage.name}
                    </span>
                    <span className="text-xs text-slate-500">{stage.estimatedDuration}s</span>
                  </div>
                  {isActive && (
                    <div className="w-full bg-slate-700 rounded-full h-1">
                      <div
                        className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, (stageProgress / 100) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Performance Metrics (Development Only) */}
      {process.env.NODE_ENV === "development" && (
        <div className="border-t border-slate-700 pt-4 mt-4">
          <h4 className="text-xs font-medium text-slate-400 mb-2">Debug Info</h4>
          <div className="text-xs text-slate-500 font-mono">
            Progress: {progress.toFixed(2)}% | Elapsed: {formatElapsedTime(elapsedTime)} | Stage:{" "}
            {currentStage?.name || "Unknown"}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisProgress;
