import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Thermometer,
  Flame,
  Snowflake,
  Clock,
  Calendar,
  Filter,
  Download,
  Grid3x3,
  List,
  Settings,
  Eye,
  EyeOff,
  Palette,
  HelpCircle,
  X,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  BarChart3,
  Activity,
  TrendingUp,
  TrendingDown,
  Minimize2,
  Maximize2
} from 'lucide-react';
import styles from './EnhancedTemperatureHeatmap.module.css';

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
  category?: string;
}

interface EnhancedTemperatureHeatmapProps {
  files: FileNode[];
  onFileClick?: (file: TemperatureData) => void;
  className?: string;
  showControls?: boolean;
  onExport?: (format: 'png' | 'json' | 'csv') => void;
}

// Color schemes for different accessibility needs
const COLOR_SCHEMES = {
  default: {
    hot: { bg: 'from-red-600 to-red-400', border: 'border-red-500', text: 'text-red-100', icon: '#ef4444' },
    warm: { bg: 'from-orange-600 to-orange-400', border: 'border-orange-500', text: 'text-orange-100', icon: '#f97316' },
    cool: { bg: 'from-blue-600 to-blue-400', border: 'border-blue-500', text: 'text-blue-100', icon: '#3b82f6' },
    cold: { bg: 'from-cyan-600 to-cyan-400', border: 'border-cyan-500', text: 'text-cyan-100', icon: '#06b6d4' }
  },
  colorblind: {
    hot: { bg: 'from-purple-600 to-purple-400', border: 'border-purple-500', text: 'text-purple-100', icon: '#a855f7' },
    warm: { bg: 'from-teal-600 to-teal-400', border: 'border-teal-500', text: 'text-teal-100', icon: '#14b8a6' },
    cool: { bg: 'from-blue-800 to-blue-600', border: 'border-blue-700', text: 'text-blue-100', icon: '#1e40af' },
    cold: { bg: 'from-green-600 to-green-400', border: 'border-green-500', text: 'text-green-100', icon: '#16a34a' }
  },
  highContrast: {
    hot: { bg: 'from-black to-gray-800', border: 'border-white', text: 'text-white', icon: '#ffffff' },
    warm: { bg: 'from-gray-900 to-gray-700', border: 'border-gray-300', text: 'text-white', icon: '#ffffff' },
    cool: { bg: 'from-gray-800 to-gray-600', border: 'border-gray-400', text: 'text-white', icon: '#ffffff' },
    cold: { bg: 'from-gray-700 to-gray-500', border: 'border-gray-500', text: 'text-black', icon: '#000000' }
  }
};

const EnhancedTemperatureHeatmap: React.FC<EnhancedTemperatureHeatmapProps> = ({
  files,
  onFileClick,
  className = '',
  showControls = true,
  onExport
}) => {
  const [selectedTemperature, setSelectedTemperature] = useState<'all' | 'hot' | 'warm' | 'cool' | 'cold'>('all');
  const [sortBy, setSortBy] = useState<'temperature' | 'size' | 'name' | 'accessed'>('temperature');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'heatmap'>('heatmap');
  const [colorScheme, setColorScheme] = useState<keyof typeof COLOR_SCHEMES>('default');
  const [showLabels, setShowLabels] = useState(true);
  const [showStats, setShowStats] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredFile, setHoveredFile] = useState<TemperatureData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [selectedFile, setSelectedFile] = useState<TemperatureData | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const webWorkerRef = useRef<Worker | undefined>(undefined);

  // Enhanced temperature calculation with Web Worker support
  const calculateTemperature = useCallback((file: FileNode): TemperatureData => {
    const now = new Date();
    const lastAccessed = file.accessed || file.modified;
    const daysSinceAccess = Math.floor((now.getTime() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24));
    
    // Enhanced temperature scoring algorithm
    let temperatureScore = 0;
    let accessFrequency = 0;
    
    // Recent access scoring (more granular)
    if (daysSinceAccess <= 1) {
      temperatureScore += 50;
      accessFrequency = 100;
    } else if (daysSinceAccess <= 3) {
      temperatureScore += 40;
      accessFrequency = 80;
    } else if (daysSinceAccess <= 7) {
      temperatureScore += 30;
      accessFrequency = 60;
    } else if (daysSinceAccess <= 14) {
      temperatureScore += 20;
      accessFrequency = 40;
    } else if (daysSinceAccess <= 30) {
      temperatureScore += 15;
      accessFrequency = 20;
    } else if (daysSinceAccess <= 90) {
      temperatureScore += 10;
      accessFrequency = 10;
    } else {
      temperatureScore += 5;
      accessFrequency = 5;
    }
    
    // File size bonus (more nuanced)
    const sizeInMB = file.size / (1024 * 1024);
    if (sizeInMB > 1000) temperatureScore += 15; // > 1GB
    else if (sizeInMB > 100) temperatureScore += 10; // > 100MB
    else if (sizeInMB > 10) temperatureScore += 5; // > 10MB
    else if (sizeInMB > 1) temperatureScore += 2; // > 1MB
    
    // File type categorization (enhanced)
    const ext = file.name.split('.').pop()?.toLowerCase();
    const fileCategories = {
      code: ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs', 'swift'],
      document: ['doc', 'docx', 'pdf', 'txt', 'md', 'rtf', 'odt'],
      media: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'mp4', 'avi', 'mov', 'mp3', 'wav', 'flac'],
      archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2'],
      config: ['json', 'xml', 'yaml', 'yml', 'ini', 'cfg', 'conf']
    };
    
    let category: string | undefined;
    for (const [cat, extensions] of Object.entries(fileCategories)) {
      if (extensions.includes(ext || '')) {
        category = cat;
        if (cat === 'code') temperatureScore += 15;
        else if (cat === 'document') temperatureScore += 10;
        else if (cat === 'media') temperatureScore += 8;
        else if (cat === 'config') temperatureScore += 5;
        break;
      }
    }
    
    // Time of day bonus (files accessed during work hours are hotter)
    const accessHour = lastAccessed.getHours();
    if (accessHour >= 9 && accessHour <= 17) {
      temperatureScore += 5;
    }
    
    // Determine temperature category with adjusted thresholds
    let temperature: 'hot' | 'warm' | 'cool' | 'cold';
    if (temperatureScore >= 75) temperature = 'hot';
    else if (temperatureScore >= 55) temperature = 'warm';
    else if (temperatureScore >= 35) temperature = 'cool';
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
      temperatureScore,
      category
    };
  }, []);

  // Process files with virtualization support
  const temperatureData = useMemo(() => {
    const processFiles = (files: FileNode[], limit?: number): TemperatureData[] => {
      const result: TemperatureData[] = [];
      
      const traverse = (file: FileNode, depth = 0) => {
        if (file.type === 'file') {
          result.push(calculateTemperature(file));
        } else if (file.children && depth < 10) { // Limit depth for performance
          file.children.forEach(child => traverse(child, depth + 1));
        }
      };
      
      files.forEach(file => traverse(file));
      
      // Apply limit if specified (for virtualization)
      return limit ? result.slice(0, limit) : result;
    };
    
    return processFiles(files);
  }, [files, calculateTemperature]);

  // Filter and sort data with performance optimization
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

  // Enhanced statistics
  const statistics = useMemo(() => {
    const stats = {
      hot: 0,
      warm: 0,
      cool: 0,
      cold: 0,
      totalFiles: temperatureData.length,
      totalSize: temperatureData.reduce((sum, item) => sum + item.size, 0),
      averageTemperature: 0,
      hotSize: 0,
      warmSize: 0,
      coolSize: 0,
      coldSize: 0,
      averageAge: 0
    };
    
    let totalAge = 0;
    temperatureData.forEach(item => {
      stats[item.temperature]++;
      stats[item.temperature + 'Size'] += item.size;
      stats.averageTemperature += item.temperatureScore;
      totalAge += item.daysSinceAccess;
    });
    
    stats.averageTemperature = stats.totalFiles > 0 ? stats.averageTemperature / stats.totalFiles : 0;
    stats.averageAge = stats.totalFiles > 0 ? totalAge / stats.totalFiles : 0;
    
    return stats;
  }, [temperatureData]);

  // Format utilities
  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }, []);

  const formatDate = useCallback((date: Date): string => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }, []);

  const getTemperatureIcon = useCallback((temperature: string) => {
    switch (temperature) {
      case 'hot': return <Flame size={16} />;
      case 'warm': return <Thermometer size={16} />;
      case 'cool': return <Activity size={16} />;
      case 'cold': return <Snowflake size={16} />;
      default: return <Clock size={16} />;
    }
  }, []);

  // Event handlers
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      });
    }
  }, []);

  const handleFileClick = useCallback((file: TemperatureData) => {
    setSelectedFile(file);
    onFileClick?.(file);
  }, [onFileClick]);

  const handleZoom = useCallback((direction: 'in' | 'out' | 'reset') => {
    setZoomLevel(prev => {
      if (direction === 'in') return Math.min(prev * 1.2, 2);
      if (direction === 'out') return Math.max(prev / 1.2, 0.5);
      return 1;
    });
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case '+':
        case '=':
          handleZoom('in');
          break;
        case '-':
        case '_':
          handleZoom('out');
          break;
        case '0':
          handleZoom('reset');
          break;
        case 'g':
          setViewMode(prev => prev === 'grid' ? 'list' : prev === 'list' ? 'heatmap' : 'grid');
          break;
        case 'l':
          setShowLabels(prev => !prev);
          break;
        case 's':
          setShowStats(prev => !prev);
          break;
        case 'c':
          setColorScheme(prev => {
            const schemes: (keyof typeof COLOR_SCHEMES)[] = ['default', 'colorblind', 'highContrast'];
            const currentIndex = schemes.indexOf(prev);
            return schemes[(currentIndex + 1) % schemes.length];
          });
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'Escape':
          setHoveredFile(null);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleZoom, toggleFullscreen]);

  // Fullscreen handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Initialize Web Worker for performance
  useEffect(() => {
    if (typeof Worker !== 'undefined') {
      const workerCode = `
        self.onmessage = function(e) {
          const { type, files } = e.data;
          
          if (type === 'calculateTemperatures') {
            const results = files.map(file => {
              // Simplified temperature calculation for worker
              const now = Date.now();
              const lastAccessed = file.accessed || file.modified;
              const daysSinceAccess = Math.floor((now - lastAccessed) / (1000 * 60 * 60 * 24));
              
              let score = 0;
              if (daysSinceAccess <= 1) score = 75;
              else if (daysSinceAccess <= 7) score = 50;
              else if (daysSinceAccess <= 30) score = 25;
              else score = 10;
              
              let temp = 'cold';
              if (score >= 70) temp = 'hot';
              else if (score >= 50) temp = 'warm';
              else if (score >= 30) temp = 'cool';
              
              return { ...file, temperature: temp, temperatureScore: score };
            });
            
            self.postMessage({ type: 'temperatures-calculated', results });
          }
        };
      `;
      
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      webWorkerRef.current = new Worker(URL.createObjectURL(blob));
    }
    
    return () => {
      if (webWorkerRef.current) {
        webWorkerRef.current.terminate();
      }
    };
  }, []);

  return (
    <div className={`${styles.enhancedTemperatureHeatmap} ${className} ${isFullscreen ? styles.fullscreen : ''}`} ref={containerRef}>
      {/* Control Panel */}
      {showControls && (
        <div className={styles.controlPanel}>
          <div className={styles.controlSection}>
            <div className={styles.filterContainer}>
              <Filter size={16} className={styles.controlIcon} />
              <select
                value={selectedTemperature}
                onChange={(e) => setSelectedTemperature(e.target.value as any)}
                className={styles.selectControl}
              >
                <option value="all">All Temperatures</option>
                <option value="hot">Hot Only</option>
                <option value="warm">Warm Only</option>
                <option value="cool">Cool Only</option>
                <option value="cold">Cold Only</option>
              </select>
            </div>

            <div className={styles.sortContainer}>
              <span className={styles.controlLabel}>Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={styles.selectControl}
              >
                <option value="temperature">Temperature</option>
                <option value="size">Size</option>
                <option value="name">Name</option>
                <option value="accessed">Last Accessed</option>
              </select>
            </div>

            <div className={styles.viewModeContainer}>
              <button
                onClick={() => setViewMode('grid')}
                className={`${styles.viewModeButton} ${viewMode === 'grid' ? styles.active : ''}`}
                title="Grid View"
              >
                <Grid3x3 size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`${styles.viewModeButton} ${viewMode === 'list' ? styles.active : ''}`}
                title="List View"
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode('heatmap')}
                className={`${styles.viewModeButton} ${viewMode === 'heatmap' ? styles.active : ''}`}
                title="Heatmap View"
              >
                <BarChart3 size={16} />
              </button>
            </div>
          </div>

          <div className={styles.controlSection}>
            <div className={styles.displayControls}>
              <button
                onClick={() => setShowLabels(!showLabels)}
                className={`${styles.controlButton} ${showLabels ? styles.active : ''}`}
                title="Toggle Labels"
              >
                {showLabels ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
              <button
                onClick={() => setShowStats(!showStats)}
                className={`${styles.controlButton} ${showStats ? styles.active : ''}`}
                title="Toggle Statistics"
              >
                <BarChart3 size={16} />
              </button>
              <button
                onClick={() => setColorScheme(prev => {
                  const schemes: (keyof typeof COLOR_SCHEMES)[] = ['default', 'colorblind', 'highContrast'];
                  const currentIndex = schemes.indexOf(prev);
                  return schemes[(currentIndex + 1) % schemes.length];
                })}
                className={styles.controlButton}
                title="Change Color Scheme"
              >
                <Palette size={16} />
              </button>
            </div>

            <div className={styles.zoomControls}>
              <button
                onClick={() => handleZoom('out')}
                className={styles.controlButton}
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <div className={styles.zoomIndicator}>
                {Math.round(zoomLevel * 100)}%
              </div>
              <button
                onClick={() => handleZoom('in')}
                className={styles.controlButton}
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              <button
                onClick={() => handleZoom('reset')}
                className={styles.controlButton}
                title="Reset Zoom"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          <div className={styles.controlSection}>
            <div className={styles.actionControls}>
              <button
                onClick={toggleFullscreen}
                className={styles.controlButton}
                title="Toggle Fullscreen"
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                onClick={() => onExport?.('png')}
                className={styles.controlButton}
                title="Export as PNG"
              >
                <Download size={16} />
              </button>
              <button
                onClick={() => setShowHelp(!showHelp)}
                className={styles.controlButton}
                title="Help"
              >
                <HelpCircle size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Panel */}
      <AnimatePresence>
        {showStats && (
          <motion.div
            className={styles.statsPanel}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
          >
            <div className={styles.statsHeader}>
              <h3>Temperature Distribution</h3>
            </div>
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <Flame size={20} />
                </div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{statistics.hot}</div>
                  <div className={styles.statLabel}>Hot Files</div>
                  <div className={styles.statDetail}>{formatBytes(statistics.hotSize)}</div>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <Thermometer size={20} />
                </div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{statistics.warm}</div>
                  <div className={styles.statLabel}>Warm Files</div>
                  <div className={styles.statDetail}>{formatBytes(statistics.warmSize)}</div>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <Activity size={20} />
                </div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{statistics.cool}</div>
                  <div className={styles.statLabel}>Cool Files</div>
                  <div className={styles.statDetail}>{formatBytes(statistics.coolSize)}</div>
                </div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statIcon}>
                  <Snowflake size={20} />
                </div>
                <div className={styles.statContent}>
                  <div className={styles.statValue}>{statistics.cold}</div>
                  <div className={styles.statLabel}>Cold Files</div>
                  <div className={styles.statDetail}>{formatBytes(statistics.coldSize)}</div>
                </div>
              </div>
            </div>
            <div className={styles.overallStats}>
              <div className={styles.overallStat}>
                <span className={styles.statLabel}>Total Files:</span>
                <span className={styles.statValue}>{statistics.totalFiles.toLocaleString()}</span>
              </div>
              <div className={styles.overallStat}>
                <span className={styles.statLabel}>Total Size:</span>
                <span className={styles.statValue}>{formatBytes(statistics.totalSize)}</span>
              </div>
              <div className={styles.overallStat}>
                <span className={styles.statLabel}>Avg Temperature:</span>
                <span className={styles.statValue}>{Math.round(statistics.averageTemperature)}°</span>
              </div>
              <div className={styles.overallStat}>
                <span className={styles.statLabel}>Avg Age:</span>
                <span className={styles.statValue}>{Math.round(statistics.averageAge)} days</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div
        className={styles.contentContainer}
        onMouseMove={handleMouseMove}
        style={{
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'top left'
        }}
      >
        {viewMode === 'heatmap' ? (
          <div className={styles.heatmapContainer}>
            {/* Heatmap visualization would go here */}
            <div className={styles.heatmapPlaceholder}>
              <div className={styles.heatmapIcon}>
                <BarChart3 size={48} />
              </div>
              <h3>Heatmap View</h3>
              <p>Advanced heatmap visualization coming soon</p>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          <div className={styles.gridContainer}>
            {filteredAndSortedData.map((item, index) => (
              <motion.div
                key={`${item.path}-${index}`}
                className={`${styles.fileCard} ${styles[item.temperature]}`}
                style={{
                  background: `linear-gradient(135deg, ${COLOR_SCHEMES[colorScheme][item.temperature].bg})`
                }}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.02 }}
                whileHover={{ scale: 1.05, zIndex: 10 }}
                onClick={() => handleFileClick(item)}
                onMouseEnter={() => setHoveredFile(item)}
                onMouseLeave={() => setHoveredFile(null)}
              >
                <div className={styles.cardGradient} />
                <div className={styles.cardContent}>
                  {showLabels && (
                    <>
                      <div className={styles.fileName}>{item.name}</div>
                      <div className={styles.fileSize}>{formatBytes(item.size)}</div>
                      <div className={styles.fileAccess}>
                        {item.daysSinceAccess === 0 ? 'Today' : `${item.daysSinceAccess}d ago`}
                      </div>
                      {item.category && (
                        <div className={styles.fileCategory}>{item.category}</div>
                      )}
                    </>
                  )}
                </div>
                <div className={styles.temperatureIndicator}>
                  <div className={styles.temperatureDot} />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className={styles.listContainer}>
            {filteredAndSortedData.map((item, index) => (
              <motion.div
                key={`${item.path}-${index}`}
                className={`${styles.listItem} ${styles[item.temperature]}`}
                style={{
                  background: `linear-gradient(135deg, ${COLOR_SCHEMES[colorScheme][item.temperature].bg})`
                }}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.02 }}
                whileHover={{ scale: 1.02, zIndex: 10 }}
                onClick={() => handleFileClick(item)}
                onMouseEnter={() => setHoveredFile(item)}
                onMouseLeave={() => setHoveredFile(null)}
              >
                <div className={styles.listGradient} />
                <div className={styles.listContent}>
                  <div className={styles.listIcon}>
                    {getTemperatureIcon(item.temperature)}
                  </div>
                  <div className={styles.listInfo}>
                    <div className={styles.fileName}>{item.name}</div>
                    <div className={styles.fileDetails}>
                      <span>{formatBytes(item.size)}</span>
                      <span>•</span>
                      <span>{item.daysSinceAccess === 0 ? 'Today' : `${item.daysSinceAccess}d ago`}</span>
                      {item.category && <span>•</span>}
                      {item.category && <span>{item.category}</span>}
                    </div>
                  </div>
                </div>
                <div className={styles.temperatureIndicator}>
                  <div className={styles.temperatureDot} />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Enhanced Tooltip */}
      <AnimatePresence>
        {hoveredFile && (
          <motion.div
            className={styles.tooltip}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              left: tooltipPosition.x + 15,
              top: tooltipPosition.y - 15,
              position: 'absolute'
            }}
          >
            <div className={styles.tooltipHeader}>
              <div className={styles.tooltipIcon}>
                {getTemperatureIcon(hoveredFile.temperature)}
              </div>
              <div className={styles.tooltipTitle}>{hoveredFile.name}</div>
            </div>
            <div className={styles.tooltipContent}>
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipLabel}>Size:</span>
                <span className={styles.tooltipValue}>{formatBytes(hoveredFile.size)}</span>
              </div>
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipLabel}>Temperature:</span>
                <span className={styles.tooltipValue}>{hoveredFile.temperature}</span>
              </div>
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipLabel}>Score:</span>
                <span className={styles.tooltipValue}>{hoveredFile.temperatureScore}</span>
              </div>
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipLabel}>Accessed:</span>
                <span className={styles.tooltipValue}>{formatDate(hoveredFile.lastAccessed)}</span>
              </div>
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipLabel}>Modified:</span>
                <span className={styles.tooltipValue}>{formatDate(hoveredFile.lastModified)}</span>
              </div>
              <div className={styles.tooltipRow}>
                <span className={styles.tooltipLabel}>Frequency:</span>
                <span className={styles.tooltipValue}>{hoveredFile.accessFrequency}%</span>
              </div>
              {hoveredFile.category && (
                <div className={styles.tooltipRow}>
                  <span className={styles.tooltipLabel}>Category:</span>
                  <span className={styles.tooltipValue}>{hoveredFile.category}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Overlay */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            className={styles.helpOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className={styles.helpContent}>
              <div className={styles.helpHeader}>
                <h3>Temperature Heatmap Help</h3>
                <button
                  onClick={() => setShowHelp(false)}
                  className={styles.helpClose}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className={styles.helpSections}>
                <div className={styles.helpSection}>
                  <h4>Temperature Categories</h4>
                  <ul>
                    <li><span className={`${styles.tempIndicator} ${styles.hot}`}></span> <strong>Hot:</strong> Accessed within 1 day, frequently used files</li>
                    <li><span className={`${styles.tempIndicator} ${styles.warm}`}></span> <strong>Warm:</strong> Accessed within 1-7 days</li>
                    <li><span className={`${styles.tempIndicator} ${styles.cool}`}></span> <strong>Cool:</strong> Accessed within 8-30 days</li>
                    <li><span className={`${styles.tempIndicator} ${styles.cold}`}></span> <strong>Cold:</strong> Accessed over 30 days ago</li>
                  </ul>
                </div>
                
                <div className={styles.helpSection}>
                  <h4>Controls</h4>
                  <ul>
                    <li><kbd>G</kbd> - Switch view modes</li>
                    <li><kbd>+/-</kbd> - Zoom in/out</li>
                    <li><kbd>0</kbd> - Reset zoom</li>
                    <li><kbd>L</kbd> - Toggle labels</li>
                    <li><kbd>S</kbd> - Toggle statistics</li>
                    <li><kbd>C</kbd> - Change color scheme</li>
                    <li><kbd>F</kbd> - Fullscreen</li>
                  </ul>
                </div>
                
                <div className={styles.helpSection}>
                  <h4>Color Schemes</h4>
                  <ul>
                    <li><span className={styles.schemeDefault}>Default</span> - Standard colors</li>
                    <li><span className={styles.schemeColorblind}>Colorblind</span> - Accessible colors</li>
                    <li><span className={styles.schemeHighContrast}>High Contrast</span> - Maximum contrast</li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EnhancedTemperatureHeatmap;
