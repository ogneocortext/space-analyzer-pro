import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Thermometer, Flame, Snowflake, Clock, Calendar, Filter, Download } from 'lucide-react';

interface FileNode {
  name: string;
  path: string;
  size: number;
  type: 'file' | 'directory';
  modified: Date;
  accessed?: Date;
  children?: FileNode[];
}

interface TemperatureData {
  path: string;
  name: string;
  size: number;
  temperature: 'hot' | 'warm' | 'cool' | 'cold';
  lastAccessed: Date;
  lastModified: Date;
  accessFrequency: number;
  daysSinceAccess: number;
  temperatureScore: number;
}

interface TemperatureHeatmapProps {
  files: FileNode[];
  onFileClick?: (file: TemperatureData) => void;
  className?: string;
  showControls?: boolean;
}

const TemperatureHeatmap: React.FC<TemperatureHeatmapProps> = ({
  files,
  onFileClick,
  className = '',
  showControls = true
}) => {
  const [selectedTemperature, setSelectedTemperature] = useState<'all' | 'hot' | 'warm' | 'cool' | 'cold'>('all');
  const [sortBy, setSortBy] = useState<'temperature' | 'size' | 'name' | 'accessed'>('temperature');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Calculate temperature for each file
  const calculateTemperature = useCallback((file: FileNode): TemperatureData => {
    const now = new Date();
    const lastAccessed = file.accessed || file.modified;
    const daysSinceAccess = Math.floor((now.getTime() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24));
    
    // Calculate temperature score (0-100, where 100 is hottest)
    let temperatureScore = 0;
    
    // Recent access (higher score for more recent)
    if (daysSinceAccess <= 1) temperatureScore += 40;
    else if (daysSinceAccess <= 7) temperatureScore += 30;
    else if (daysSinceAccess <= 30) temperatureScore += 20;
    else if (daysSinceAccess <= 90) temperatureScore += 10;
    
    // File size bonus (larger files get slightly higher score)
    if (file.size > 100 * 1024 * 1024) temperatureScore += 10; // > 100MB
    else if (file.size > 10 * 1024 * 1024) temperatureScore += 5; // > 10MB
    
    // File type bonus (certain file types are typically accessed more)
    const ext = file.name.split('.').pop()?.toLowerCase();
    const hotExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c'];
    const warmExtensions = ['doc', 'docx', 'pdf', 'txt', 'md'];
    
    if (hotExtensions.includes(ext || '')) temperatureScore += 10;
    else if (warmExtensions.includes(ext || '')) temperatureScore += 5;
    
    // Access frequency (simulated based on file patterns)
    let accessFrequency = 0;
    if (daysSinceAccess <= 1) accessFrequency = 100;
    else if (daysSinceAccess <= 7) accessFrequency = 50;
    else if (daysSinceAccess <= 30) accessFrequency = 20;
    else if (daysSinceAccess <= 90) accessFrequency = 10;
    else accessFrequency = 1;
    
    // Determine temperature category
    let temperature: 'hot' | 'warm' | 'cool' | 'cold';
    if (temperatureScore >= 70) temperature = 'hot';
    else if (temperatureScore >= 50) temperature = 'warm';
    else if (temperatureScore >= 30) temperature = 'cool';
    else temperature = 'cold';
    
    return {
      path: file.path,
      name: file.name,
      size: file.size,
      temperature,
      lastAccessed,
      lastModified: file.modified,
      accessFrequency,
      daysSinceAccess,
      temperatureScore
    };
  }, []);

  // Process all files and calculate temperatures
  const temperatureData = useMemo(() => {
    const processFiles = (files: FileNode[]): TemperatureData[] => {
      const result: TemperatureData[] = [];
      
      const traverse = (file: FileNode) => {
        if (file.type === 'file') {
          result.push(calculateTemperature(file));
        } else if (file.children) {
          file.children.forEach(traverse);
        }
      };
      
      files.forEach(traverse);
      return result;
    };
    
    return processFiles(files);
  }, [files, calculateTemperature]);

  // Filter and sort data
  const filteredAndSortedData = useMemo(() => {
    let filtered = temperatureData;
    
    // Filter by temperature
    if (selectedTemperature !== 'all') {
      filtered = filtered.filter(item => item.temperature === selectedTemperature);
    }
    
    // Sort data
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'temperature':
          return b.temperatureScore - a.temperatureScore;
        case 'size':
          return b.size - a.size;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'accessed':
          return b.lastAccessed.getTime() - a.lastAccessed.getTime();
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [temperatureData, selectedTemperature, sortBy]);

  // Temperature statistics
  const statistics = useMemo(() => {
    const stats = {
      hot: 0,
      warm: 0,
      cool: 0,
      cold: 0,
      totalFiles: temperatureData.length,
      totalSize: temperatureData.reduce((sum, item) => sum + item.size, 0),
      averageTemperature: 0
    };
    
    temperatureData.forEach(item => {
      stats[item.temperature]++;
      stats.averageTemperature += item.temperatureScore;
    });
    
    stats.averageTemperature = stats.totalFiles > 0 ? stats.averageTemperature / stats.totalFiles : 0;
    
    return stats;
  }, [temperatureData]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString();
  };

  const getTemperatureColor = (temperature: string): string => {
    switch (temperature) {
      case 'hot': return 'bg-red-500 border-red-600 text-red-100';
      case 'warm': return 'bg-orange-500 border-orange-600 text-orange-100';
      case 'cool': return 'bg-blue-500 border-blue-600 text-blue-100';
      case 'cold': return 'bg-cyan-500 border-cyan-600 text-cyan-100';
      default: return 'bg-gray-500 border-gray-600 text-gray-100';
    }
  };

  const getTemperatureGradient = (temperature: string): string => {
    switch (temperature) {
      case 'hot': return 'from-red-600 to-red-400';
      case 'warm': return 'from-orange-600 to-orange-400';
      case 'cool': return 'from-blue-600 to-blue-400';
      case 'cold': return 'from-cyan-600 to-cyan-400';
      default: return 'from-gray-600 to-gray-400';
    }
  };

  const getTemperatureIcon = (temperature: string) => {
    switch (temperature) {
      case 'hot': return <Flame className="w-4 h-4" />;
      case 'warm': return <Thermometer className="w-4 h-4" />;
      case 'cool': return <Clock className="w-4 h-4" />;
      case 'cold': return <Snowflake className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getTemperatureDescription = (temperature: string): string => {
    switch (temperature) {
      case 'hot': return 'Frequently accessed (last 24 hours)';
      case 'warm': return 'Recently accessed (last week)';
      case 'cool': return 'Moderately accessed (last month)';
      case 'cold': return 'Rarely accessed (over 3 months)';
      default: return 'Unknown access pattern';
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Thermometer className="w-6 h-6 text-orange-400" />
            <h2 className="text-xl font-bold text-white">File Temperature Heatmap</h2>
          </div>
          <div className="text-sm text-gray-400">
            {statistics.totalFiles} files • {formatBytes(statistics.totalSize)} total
          </div>
        </div>

        {/* Statistics Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {(['hot', 'warm', 'cool', 'cold'] as const).map((temp) => (
            <motion.div
              key={temp}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: ['hot', 'warm', 'cool', 'cold'].indexOf(temp) * 0.1 }}
              className={`p-3 rounded-lg border ${getTemperatureColor(temp)}`}
            >
              <div className="flex items-center justify-between mb-1">
                {getTemperatureIcon(temp)}
                <span className="font-bold">{statistics[temp]}</span>
              </div>
              <div className="text-xs opacity-80">
                {getTemperatureDescription(temp)}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Controls */}
        {showControls && (
          <div className="flex flex-wrap gap-4 mb-6">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={selectedTemperature}
                onChange={(e) => setSelectedTemperature(e.target.value as any)}
                className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="all">All Temperatures</option>
                <option value="hot">Hot Only</option>
                <option value="warm">Warm Only</option>
                <option value="cool">Cool Only</option>
                <option value="cold">Cold Only</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-gray-400 text-sm">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value="temperature">Temperature</option>
                <option value="size">Size</option>
                <option value="name">Name</option>
                <option value="accessed">Last Accessed</option>
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
                className="px-3 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm hover:bg-gray-700 transition-colors"
              >
                {viewMode === 'grid' ? 'List View' : 'Grid View'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Heatmap Display */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {filteredAndSortedData.map((item, index) => (
              <motion.div
                key={`${item.path}-${index}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02 }}
                whileHover={{ scale: 1.05 }}
                className={`relative p-3 rounded-lg border cursor-pointer transition-all ${getTemperatureColor(item.temperature)}`}
                onClick={() => onFileClick?.(item)}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${getTemperatureGradient(item.temperature)} opacity-20 rounded-lg`} />
                
                <div className="relative">
                  <div className="text-xs font-medium truncate mb-1">
                    {item.name}
                  </div>
                  <div className="text-xs opacity-80">
                    {formatBytes(item.size)}
                  </div>
                  <div className="text-xs opacity-60 mt-1">
                    {item.daysSinceAccess}d ago
                  </div>
                </div>

                {/* Temperature indicator */}
                <div className="absolute top-1 right-1">
                  <div className={`w-2 h-2 rounded-full bg-current opacity-60`} />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAndSortedData.map((item, index) => (
              <motion.div
                key={`${item.path}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${getTemperatureColor(item.temperature)}`}
                onClick={() => onFileClick?.(item)}
              >
                <div className="flex items-center space-x-3">
                  {getTemperatureIcon(item.temperature)}
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm opacity-80">
                      {item.path} • {formatDate(item.lastAccessed)}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="font-medium">{formatBytes(item.size)}</div>
                  <div className="text-sm opacity-60">
                    {item.daysSinceAccess} days ago
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {filteredAndSortedData.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Thermometer className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No files found for the selected criteria</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemperatureHeatmap;
