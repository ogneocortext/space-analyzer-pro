import React, { useEffect, useRef, useState, useMemo } from 'react';
import { File, Activity, Zap, Clock, Pause, Play } from 'lucide-react';

interface ScannedFile {
  name: string;
  path: string;
  size: number;
  category: string;
}

interface RealTimeFileScannerProps {
  scannedFiles: ScannedFile[];
  progress: {
    files: number;
    percentage: number;
    currentFile: string;
    completed: boolean;
  };
}

export const RealTimeFileScanner: React.FC<RealTimeFileScannerProps> = ({
  scannedFiles,
  progress
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [startTime] = useState(Date.now());

  // Auto-scroll to bottom when new files are added
  useEffect(() => {
    if (scrollRef.current && !isPaused) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [scannedFiles.length, isPaused]);

  // Calculate speed metrics
  const metrics = useMemo(() => {
    const elapsedSeconds = (Date.now() - startTime) / 1000;
    const filesPerSecond = elapsedSeconds > 0 ? progress.files / elapsedSeconds : 0;
    
    const totalSize = scannedFiles.reduce((acc, file) => acc + file.size, 0);
    const mbPerSecond = elapsedSeconds > 0 ? (totalSize / 1024 / 1024) / elapsedSeconds : 0;
    
    // Estimate remaining time - fix division by zero
    let etaSeconds = 0;
    if (progress.percentage > 0 && progress.percentage < 100 && filesPerSecond > 0) {
      const remainingPercentage = 100 - progress.percentage;
      const remainingFiles = (progress.files / progress.percentage) * remainingPercentage;
      etaSeconds = remainingFiles / filesPerSecond;
    }
    
    // Category distribution
    const categoryCount: Record<string, number> = {};
    scannedFiles.forEach(file => {
      const category = file.category || 'Other';
      categoryCount[category] = (categoryCount[category] || 0) + 1;
    });
    
    return {
      filesPerSecond,
      mbPerSecond,
      etaSeconds,
      categoryCount,
      totalSize
    };
  }, [progress.files, progress.percentage, scannedFiles, startTime]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0 || !bytes || isNaN(bytes)) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return 'Calculating...';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  // Truncate file name and handle git hashes
  const formatFileName = (name: string, path?: string) => {
    if (!name) return 'Unknown file';
    // If it's a hash (git or any 40-char hex), try to get a better name from the path
    if (/^[a-f0-9]{40}$/.test(name)) {
      if (path) {
        const pathParts = path.split(/[/\\]/);
        // Get the last meaningful part from path
        for (let i = pathParts.length - 1; i >= 0; i--) {
          const part = pathParts[i];
          if (part && part !== name && part.length > 0 && !/^[a-f0-9]{40}$/.test(part)) {
            return part;
          }
        }
      }
      // If no good path found, show abbreviated hash
      return `Hash: ${name.substring(0, 8)}...`;
    }
    // Truncate long names
    if (name.length > 50) {
      return name.substring(0, 47) + '...';
    }
    return name;
  };

  // Deduplicate scanned files by path
  const uniqueScannedFiles = useMemo(() => {
    const seen = new Set();
    return scannedFiles.filter(file => {
      const key = file.path;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [scannedFiles]);

  const topCategories = Object.entries(metrics.categoryCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900/50 px-4 py-3 border-b border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-sm font-medium text-white">Real-time File Scanner</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Speed metrics */}
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 text-yellow-400" />
                <span>{metrics.filesPerSecond.toFixed(0)} files/s</span>
              </div>
              <div className="flex items-center gap-1">
                <Activity className="w-3 h-3 text-emerald-400" />
                <span>{metrics.mbPerSecond.toFixed(1)} MB/s</span>
              </div>
              {metrics.etaSeconds > 0 && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-400" />
                  <span>ETA: {formatTime(metrics.etaSeconds)}</span>
                </div>
              )}
            </div>
            {/* Pause/Resume button */}
            <button
              onClick={() => setIsPaused(!isPaused)}
              className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
              title={isPaused ? 'Resume scrolling' : 'Pause scrolling'}
            >
              {isPaused ? <Play className="w-3 h-3 text-white" /> : <Pause className="w-3 h-3 text-white" />}
            </button>
          </div>
        </div>
        
        {/* Progress bar with stats */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">{progress.files.toLocaleString()} files scanned</span>
            <span className="text-cyan-400 font-medium">
              {progress.percentage > 0 ? `${progress.percentage.toFixed(1)}%` : 'Initializing...'}
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-linear-to-r from-cyan-500 to-blue-500 transition-all duration-300 relative"
              style={{ width: `${Math.max(1, progress.percentage)}%` }}
            >
              <div className="absolute inset-0 bg-white/10 animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Category distribution */}
      {topCategories.length > 0 && (
        <div className="px-4 py-2 bg-slate-900/30 border-b border-slate-700">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Top categories:</span>
            {topCategories.map(([category, count]) => (
              <span key={category} className="px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                {category}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Current file */}
      {progress.currentFile && !progress.completed && (
        <div className="px-4 py-2 bg-cyan-500/10 border-b border-cyan-500/20">
          <div className="flex items-center gap-2 text-xs text-cyan-300">
            <File className="w-3 h-3" />
            <span className="truncate">Scanning: {formatFileName(progress.currentFile)}</span>
          </div>
        </div>
      )}

      {/* Scanned files list */}
      <div
        ref={scrollRef}
        className="h-64 overflow-y-auto p-2 space-y-1"
        style={{ maxHeight: '256px' }}
      >
        {uniqueScannedFiles.length === 0 && progress.files === 0 ? (
          <div className="text-center text-slate-500 text-sm py-8">
            Waiting for scan to start...
          </div>
        ) : uniqueScannedFiles.length === 0 && progress.files > 0 ? (
          <div className="text-center text-slate-400 text-sm py-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Activity className="w-4 h-4 animate-spin" />
              <span>Scanning {progress.files.toLocaleString()} files...</span>
            </div>
            <div className="text-xs text-slate-500">
              {Math.round(progress.percentage)}% complete
            </div>
          </div>
        ) : (
          uniqueScannedFiles.map((file, index) => (
            <div
              key={`${file.path}-${index}`}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors"
            >
              <File className="w-3 h-3 text-slate-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white truncate">{formatFileName(file.name, file.path)}</div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="truncate">{file.category || 'Other'}</span>
                  <span>•</span>
                  <span>{formatFileSize(file.size)}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {progress.completed && (
        <div className="px-4 py-2 bg-emerald-500/10 border-t border-emerald-500/20">
          <div className="flex items-center justify-between text-xs text-emerald-300">
            <span>Scan complete!</span>
            <span>{progress.files.toLocaleString()} files processed • {formatFileSize(metrics.totalSize)} total</span>
          </div>
        </div>
      )}
    </div>
  );
};
