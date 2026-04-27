import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, ArrowRightLeft, TrendingUp, TrendingDown, FilePlus, FileMinus, FolderPlus, FolderMinus, Calendar, HardDrive, FileText } from 'lucide-react';
import { useIndexedDB } from '../hooks/useIndexedDB';

interface ComparisonResult {
  timeDifference: number;
  sizeDifference: number;
  filesDifference: number;
  directoriesDifference: number;
  percentageChange: number;
  snapshot1: SnapshotInfo;
  snapshot2: SnapshotInfo;
  changes: FileChange[];
}

interface SnapshotInfo {
  name: string;
  timestamp: number;
  totalSize: number;
  totalFiles: number;
}

interface FileChange {
  type: 'added' | 'removed' | 'modified' | 'moved';
  path: string;
  size?: number;
  sizeDifference?: number;
  timestamp?: number;
  fileType?: string;
}

interface TimeTravelProps {
  onCompare?: (result: ComparisonResult) => void;
  className?: string;
}

const TimeTravel: React.FC<TimeTravelProps> = ({ onCompare, className = '' }) => {
  const { snapshots, compareSnapshots, isLoading, error } = useIndexedDB();
  const [selectedSnapshot1, setSelectedSnapshot1] = useState<string>('');
  const [selectedSnapshot2, setSelectedSnapshot2] = useState<string>('');
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  const handleCompare = async () => {
    if (!selectedSnapshot1 || !selectedSnapshot2 || selectedSnapshot1 === selectedSnapshot2) {
      return;
    }

    setIsComparing(true);
    setComparisonResult(null);

    try {
      const result = await compareSnapshots(selectedSnapshot1, selectedSnapshot2);
      
      if (result) {
        // Generate mock file changes for demonstration
        const mockChanges: FileChange[] = generateMockChanges(result);
        
        const enhancedResult: ComparisonResult = {
          ...result,
          changes: mockChanges
        };

        setComparisonResult(enhancedResult);
        onCompare?.(enhancedResult);
      }
    } catch (err) {
      console.error('Comparison failed:', err);
    } finally {
      setIsComparing(false);
    }
  };

  const generateMockChanges = (result: any): FileChange[] => {
    const changes: FileChange[] = [];
    const now = Date.now();

    // Generate some realistic changes based on the comparison
    if (result.filesDifference > 0) {
      // Added files
      for (let i = 0; i < Math.min(result.filesDifference, 5); i++) {
        changes.push({
          type: 'added',
          path: `/new/file_${i}.txt`,
          size: Math.floor(Math.random() * 1000000) + 1000,
          timestamp: now - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000),
          fileType: 'txt'
        });
      }
    } else if (result.filesDifference < 0) {
      // Removed files
      for (let i = 0; i < Math.min(Math.abs(result.filesDifference), 5); i++) {
        changes.push({
          type: 'removed',
          path: `/old/file_${i}.txt`,
          size: Math.floor(Math.random() * 1000000) + 1000,
          timestamp: now - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
          fileType: 'txt'
        });
      }
    }

    // Add some modified files
    for (let i = 0; i < 3; i++) {
      changes.push({
        type: 'modified',
        path: `/modified/file_${i}.js`,
        sizeDifference: Math.floor(Math.random() * 10000) - 5000,
        timestamp: now - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000),
        fileType: 'js'
      });
    }

    return changes;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
  };

  const getChangeIcon = (type: FileChange['type']) => {
    switch (type) {
      case 'added': return <FilePlus className="w-4 h-4 text-green-400" />;
      case 'removed': return <FileMinus className="w-4 h-4 text-red-400" />;
      case 'modified': return <FileText className="w-4 h-4 text-yellow-400" />;
      case 'moved': return <ArrowRightLeft className="w-4 h-4 text-blue-400" />;
      default: return <FileText className="w-4 h-4 text-gray-400" />;
    }
  };

  const getChangeColor = (type: FileChange['type']) => {
    switch (type) {
      case 'added': return 'text-green-400 bg-green-400/10 border-green-400/30';
      case 'removed': return 'text-red-400 bg-red-400/10 border-red-400/30';
      case 'modified': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
      case 'moved': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Clock className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-bold text-white">Time Travel Analysis</h2>
        </div>

        {/* Snapshot Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              First Snapshot (Earlier)
            </label>
            <select
              value={selectedSnapshot1}
              onChange={(e) => setSelectedSnapshot1(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Select snapshot...</option>
              {snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {snapshot.name} - {formatDate(snapshot.timestamp)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Second Snapshot (Later)
            </label>
            <select
              value={selectedSnapshot2}
              onChange={(e) => setSelectedSnapshot2(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Select snapshot...</option>
              {snapshots.map((snapshot) => (
                <option key={snapshot.id} value={snapshot.id}>
                  {snapshot.name} - {formatDate(snapshot.timestamp)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Compare Button */}
        <div className="flex justify-center">
          <button
            onClick={handleCompare}
            disabled={!selectedSnapshot1 || !selectedSnapshot2 || selectedSnapshot1 === selectedSnapshot2 || isComparing}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            <ArrowRightLeft className="w-4 h-4" />
            <span>{isComparing ? 'Comparing...' : 'Compare Snapshots'}</span>
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>

      {/* Comparison Results */}
      <AnimatePresence>
        {comparisonResult && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Time Difference</span>
                  <Calendar className="w-4 h-4 text-blue-400" />
                </div>
                <div className="text-white font-semibold">
                  {formatDuration(comparisonResult.timeDifference)}
                </div>
              </motion.div>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Size Change</span>
                  {comparisonResult.sizeDifference > 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div className={`font-semibold ${
                  comparisonResult.sizeDifference > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {comparisonResult.sizeDifference > 0 ? '+' : ''}{formatBytes(comparisonResult.sizeDifference)}
                </div>
                <div className="text-gray-400 text-xs">
                  {comparisonResult.percentageChange.toFixed(1)}% change
                </div>
              </motion.div>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Files Change</span>
                  <FileText className="w-4 h-4 text-blue-400" />
                </div>
                <div className={`font-semibold ${
                  comparisonResult.filesDifference > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {comparisonResult.filesDifference > 0 ? '+' : ''}{comparisonResult.filesDifference}
                </div>
              </motion.div>

              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="bg-gray-900 border border-gray-800 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Directories</span>
                  <HardDrive className="w-4 h-4 text-blue-400" />
                </div>
                <div className={`font-semibold ${
                  comparisonResult.directoriesDifference > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {comparisonResult.directoriesDifference > 0 ? '+' : ''}{comparisonResult.directoriesDifference}
                </div>
              </motion.div>
            </div>

            {/* File Changes */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">File Changes</h3>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {comparisonResult.changes.map((change, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`flex items-center justify-between p-3 rounded-lg border ${getChangeColor(change.type)}`}
                  >
                    <div className="flex items-center space-x-3">
                      {getChangeIcon(change.type)}
                      <div>
                        <div className="text-white font-medium">{change.path}</div>
                        <div className="text-gray-400 text-sm">
                          {change.fileType && `Type: ${change.fileType}`}
                          {change.timestamp && ` • Modified: ${formatDate(change.timestamp)}`}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      {change.size && (
                        <div className="text-white font-medium">{formatBytes(change.size)}</div>
                      )}
                      {change.sizeDifference && (
                        <div className={`text-sm ${
                          change.sizeDifference > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {change.sizeDifference > 0 ? '+' : ''}{formatBytes(change.sizeDifference)}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TimeTravel;
