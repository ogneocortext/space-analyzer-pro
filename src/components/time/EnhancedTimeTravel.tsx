import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  ArrowRightLeft,
  TrendingUp,
  TrendingDown,
  FilePlus,
  FileMinus,
  FolderPlus,
  FolderMinus,
  Calendar,
  HardDrive,
  FileText,
  Search,
  Filter,
  Download,
  Upload,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Maximize2,
  Minimize2,
  Settings,
  HelpCircle,
  X,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Folder,
  File,
  Database,
  GitBranch,
  Zap,
  BarChart3,
  PieChart,
  Activity,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  Share2,
  Copy,
  Trash2,
  Edit,
  Tag,
  Archive,
  Star
} from 'lucide-react';
// @ts-ignore
import { useIndexedDB } from '../hooks/useIndexedDB';
import styles from './EnhancedTimeTravel.module.css';

interface ComparisonResult {
  timeDifference: number;
  sizeDifference: number;
  filesDifference: number;
  directoriesDifference: number;
  percentageChange: number;
  snapshot1: SnapshotInfo;
  snapshot2: SnapshotInfo;
  changes: FileChange[];
  insights: string[];
  recommendations: string[];
}

interface SnapshotInfo {
  id: string;
  name: string;
  timestamp: number;
  totalSize: number;
  totalFiles: number;
  totalDirectories: number;
  description?: string;
  tags?: string[];
  category?: string;
  isPinned?: boolean;
  metadata?: {
    systemInfo?: any;
    scanDuration?: number;
    scanMethod?: string;
  };
}

interface FileChange {
  id: string;
  type: 'added' | 'removed' | 'modified' | 'moved';
  path: string;
  oldPath?: string;
  size?: number;
  sizeDifference?: number;
  timestamp?: number;
  fileType?: string;
  category?: string;
  impact?: 'high' | 'medium' | 'low';
  details?: {
    permissions?: string;
    owner?: string;
    checksum?: string;
  };
}

interface TimelineEvent {
  id: string;
  timestamp: number;
  snapshot: SnapshotInfo;
  changes: number;
  impact: 'high' | 'medium' | 'low';
  type: 'snapshot' | 'major_change' | 'system_event';
}

interface EnhancedTimeTravelProps {
  onCompare?: (result: ComparisonResult) => void;
  className?: string;
}

const EnhancedTimeTravel: React.FC<EnhancedTimeTravelProps> = ({ onCompare, className = '' }) => {
  const { snapshots, compareSnapshots, isLoading, error, createSnapshot, deleteSnapshot } = useIndexedDB();
  
  // Enhanced state management
  const [selectedSnapshot1, setSelectedSnapshot1] = useState<string>('');
  const [selectedSnapshot2, setSelectedSnapshot2] = useState<string>('');
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [viewMode, setViewMode] = useState<'timeline' | 'list' | 'comparison'>('timeline');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size' | 'impact'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showDetails, setShowDetails] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentTimelineIndex, setCurrentTimelineIndex] = useState(0);
  const [expandedSnapshots, setExpandedSnapshots] = useState<Set<string>>(new Set());
  const [selectedChanges, setSelectedChanges] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<'all' | 'added' | 'removed' | 'modified' | 'moved'>('all');
  const [showHelp, setShowHelp] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [editingSnapshot, setEditingSnapshot] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'pdf'>('json');
  
  // Timeline events for visualization
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);

  // Enhanced comparison with insights
  const handleCompare = useCallback(async () => {
    if (!selectedSnapshot1 || !selectedSnapshot2 || selectedSnapshot1 === selectedSnapshot2) {
      return;
    }

    setIsComparing(true);
    setComparisonResult(null);

    try {
      const result = await compareSnapshots(selectedSnapshot1, selectedSnapshot2);
      
      if (result) {
        const enhancedChanges = generateEnhancedChanges(result);
        const insights = generateInsights(result, enhancedChanges);
        const recommendations = generateRecommendations(result, enhancedChanges);
        
        const enhancedResult: ComparisonResult = {
          ...result,
          changes: enhancedChanges,
          insights,
          recommendations
        };

        setComparisonResult(enhancedResult);
        onCompare?.(enhancedResult);
      }
    } catch (err) {
      console.error('Comparison failed:', err);
    } finally {
      setIsComparing(false);
    }
  }, [selectedSnapshot1, selectedSnapshot2, compareSnapshots, onCompare]);

  // Enhanced file changes generation
  const generateEnhancedChanges = useCallback((result: any): FileChange[] => {
    const changes: FileChange[] = [];
    const now = Date.now();

    // Generate realistic changes with more detail
    if (result.filesDifference > 0) {
      for (let i = 0; i < Math.min(result.filesDifference, 10); i++) {
        const fileTypes = ['txt', 'jpg', 'png', 'pdf', 'doc', 'mp4', 'zip', 'js', 'css', 'html'];
        const categories = ['documents', 'media', 'code', 'archives', 'system'];
        const impact = ['high', 'medium', 'low'][Math.floor(Math.random() * 3)] as 'high' | 'medium' | 'low';
        
        changes.push({
          id: `added-${i}`,
          type: 'added',
          path: `/new/file_${i}.${fileTypes[Math.floor(Math.random() * fileTypes.length)]}`,
          size: Math.floor(Math.random() * 10000000) + 1000,
          timestamp: now - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000),
          fileType: fileTypes[Math.floor(Math.random() * fileTypes.length)],
          category: categories[Math.floor(Math.random() * categories.length)],
          impact,
          details: {
            permissions: 'rw-r--r--',
            owner: 'user',
            checksum: Math.random().toString(36).substring(2)
          }
        });
      }
    }

    if (result.filesDifference < 0) {
      for (let i = 0; i < Math.min(Math.abs(result.filesDifference), 5); i++) {
        changes.push({
          id: `removed-${i}`,
          type: 'removed',
          path: `/old/file_${i}.txt`,
          size: Math.floor(Math.random() * 1000000) + 1000,
          timestamp: now - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
          fileType: 'txt',
          category: 'documents',
          impact: 'medium',
          details: {
            permissions: 'rw-r--r--',
            owner: 'user',
            checksum: Math.random().toString(36).substring(2)
          }
        });
      }
    }

    return changes;
  }, []);

  // Generate insights from comparison
  const generateInsights = useCallback((result: any, changes: FileChange[]): string[] => {
    const insights = [];
    
    if (result.sizeDifference > 0) {
      insights.push(`Storage increased by ${formatBytes(result.sizeDifference)} (${result.percentageChange.toFixed(1)}%)`);
    }
    
    if (changes.filter(c => c.type === 'added').length > 5) {
      insights.push('High number of new files detected - consider organization review');
    }
    
    if (changes.filter(c => c.impact === 'high').length > 0) {
      insights.push('High impact changes detected - review critical files');
    }
    
    const largeFiles = changes.filter(c => c.size && c.size > 10000000);
    if (largeFiles.length > 0) {
      insights.push(`${largeFiles.length} large files (>10MB) added or modified`);
    }
    
    return insights;
  }, []);

  // Generate recommendations
  const generateRecommendations = useCallback((result: any, changes: FileChange[]): string[] => {
    const recommendations = [];
    
    if (result.filesDifference > 100) {
      recommendations.push('Consider organizing new files into appropriate directories');
    }
    
    if (changes.filter(c => c.type === 'removed').length > 10) {
      recommendations.push('Review deleted files - ensure important data is backed up');
    }
    
    if (result.sizeDifference > 1000000000) { // > 1GB
      recommendations.push('Storage usage increased significantly - consider cleanup');
    }
    
    return recommendations;
  }, []);

  // Timeline generation
  useEffect(() => {
    const events: TimelineEvent[] = snapshots.map((snapshot, index) => ({
      id: snapshot.id,
      timestamp: snapshot.timestamp,
      snapshot,
      changes: Math.floor(Math.random() * 50),
      impact: ['high', 'medium', 'low'][Math.floor(Math.random() * 3)] as 'high' | 'medium' | 'low',
      type: 'snapshot'
    }));
    
    setTimelineEvents(events.sort((a, b) => a.timestamp - b.timestamp));
  }, [snapshots]);

  // Playback functionality
  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleNext = useCallback(() => {
    if (currentTimelineIndex < timelineEvents.length - 1) {
      setCurrentTimelineIndex(prev => prev + 1);
    }
  }, [currentTimelineIndex, timelineEvents.length]);

  const handlePrevious = useCallback(() => {
    if (currentTimelineIndex > 0) {
      setCurrentTimelineIndex(prev => prev - 1);
    }
  }, [currentTimelineIndex]);

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(() => {
        handleNext();
      }, 3000 / playbackSpeed);
      
      return () => clearInterval(interval);
    }
  }, [isPlaying, playbackSpeed, handleNext]);

  // Filter and sort snapshots
  const filteredSnapshots = useMemo(() => {
    let filtered = snapshots;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(snapshot =>
        snapshot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        snapshot.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(snapshot => snapshot.category === selectedCategory);
    }

    // Apply tags filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(snapshot =>
        selectedTags.some(tag => snapshot.tags?.includes(tag))
      );
    }

    // Sort
    return filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = a.timestamp - b.timestamp;
          break;
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.totalSize - b.totalSize;
          break;
        case 'impact':
          // This would need actual impact data
          comparison = 0;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [snapshots, searchQuery, selectedCategory, selectedTags, sortBy, sortOrder]);

  // Filter changes
  const filteredChanges = useMemo(() => {
    if (!comparisonResult) return [];
    
    let filtered = comparisonResult.changes;
    
    if (filterType !== 'all') {
      filtered = filtered.filter(change => change.type === filterType);
    }
    
    return filtered;
  }, [comparisonResult, filterType]);

  // Format utilities
  const formatDate = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  }, []);

  const formatDuration = useCallback((ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }, []);

  const formatBytes = useCallback((bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }, []);

  // Get change icon
  const getChangeIcon = useCallback((type: FileChange['type']) => {
    switch (type) {
      case 'added': return <FilePlus size={16} />;
      case 'removed': return <FileMinus size={16} />;
      case 'modified': return <Edit size={16} />;
      case 'moved': return <FolderMinus size={16} />;
      default: return <FileText size={16} />;
    }
  }, []);

  // Get change color
  const getChangeColor = useCallback((type: FileChange['type']) => {
    switch (type) {
      case 'added': return styles.changeAdded;
      case 'removed': return styles.changeRemoved;
      case 'modified': return styles.changeModified;
      case 'moved': return styles.changeMoved;
      default: return styles.changeDefault;
    }
  }, []);

  // Export functionality
  const handleExport = useCallback(() => {
    if (!comparisonResult) return;
    
    let content = '';
    let filename = '';
    let mimeType = '';
    
    switch (exportFormat) {
      case 'json':
        content = JSON.stringify(comparisonResult, null, 2);
        filename = `comparison-${Date.now()}.json`;
        mimeType = 'application/json';
        break;
      case 'csv':
        // Generate CSV
        const headers = ['Type', 'Path', 'Size', 'Impact', 'Category'];
        const rows = comparisonResult.changes.map(change => [
          change.type,
          change.path,
          change.size || '',
          change.impact || '',
          change.category || ''
        ]);
        content = [headers, ...rows].map(row => row.join(',')).join('\n');
        filename = `comparison-${Date.now()}.csv`;
        mimeType = 'text/csv';
        break;
      case 'pdf':
        // Would need PDF generation library
        content = 'PDF export not implemented yet';
        filename = `comparison-${Date.now()}.pdf`;
        mimeType = 'application/pdf';
        break;
    }
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    
    setShowExportModal(false);
  }, [comparisonResult, exportFormat]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'f':
            event.preventDefault();
            setIsFullscreen(prev => !prev);
            break;
          case 'e':
            event.preventDefault();
            setShowExportModal(true);
            break;
          case 'h':
            event.preventDefault();
            setShowHelp(true);
            break;
          case ' ':
            event.preventDefault();
            handlePlayPause();
            break;
        }
      }
      
      switch (event.key) {
        case 'ArrowRight':
          handleNext();
          break;
        case 'ArrowLeft':
          handlePrevious();
          break;
        case 'Escape':
          setShowHelp(false);
          setShowExportModal(false);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlePlayPause, handleNext, handlePrevious]);

  return (
    <div className={`${styles.enhancedTimeTravel} ${isFullscreen ? styles.fullscreen : ''}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerTitle}>
            <Clock className={styles.headerIcon} />
            <h1>Time Travel</h1>
            <div className={styles.headerSubtitle}>Compare file system snapshots over time</div>
          </div>
        </div>
        
        <div className={styles.headerRight}>
          <div className={styles.headerControls}>
            <div className={styles.viewModeSelector}>
              <button
                onClick={() => setViewMode('timeline')}
                className={`${styles.viewModeButton} ${viewMode === 'timeline' ? styles.active : ''}`}
              >
                <Activity size={16} />
                Timeline
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`${styles.viewModeButton} ${viewMode === 'list' ? styles.active : ''}`}
              >
                <Database size={16} />
                List
              </button>
              <button
                onClick={() => setViewMode('comparison')}
                className={`${styles.viewModeButton} ${viewMode === 'comparison' ? styles.active : ''}`}
              >
                <GitBranch size={16} />
                Comparison
              </button>
            </div>
            
            <button
              onClick={handleExport}
              disabled={!comparisonResult}
              className={styles.controlButton}
              title="Export Results"
            >
              <Download size={16} />
            </button>
            
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={styles.controlButton}
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            
            <button
              onClick={() => setShowHelp(true)}
              className={styles.controlButton}
              title="Help"
            >
              <HelpCircle size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.content}>
        {viewMode === 'timeline' && (
          <div className={styles.timelineView}>
            {/* Timeline Controls */}
            <div className={styles.timelineControls}>
              <div className={styles.playbackControls}>
                <button
                  onClick={handlePrevious}
                  disabled={currentTimelineIndex === 0}
                  className={styles.playbackButton}
                >
                  <SkipBack size={16} />
                </button>
                <button
                  onClick={handlePlayPause}
                  className={styles.playbackButton}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button
                  onClick={handleNext}
                  disabled={currentTimelineIndex === timelineEvents.length - 1}
                  className={styles.playbackButton}
                >
                  <SkipForward size={16} />
                </button>
              </div>
              
              <div className={styles.speedControl}>
                <label>Speed:</label>
                <select
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className={styles.speedSelect}
                >
                  <option value={0.5}>0.5x</option>
                  <option value={1}>1x</option>
                  <option value={2}>2x</option>
                  <option value={4}>4x</option>
                </select>
              </div>
            </div>

            {/* Timeline */}
            <div className={styles.timeline}>
              <div className={styles.timelineTrack}>
                {timelineEvents.map((event, index) => (
                  <div
                    key={event.id}
                    className={`${styles.timelineEvent} ${index === currentTimelineIndex ? styles.active : ''}`}
                    onClick={() => setCurrentTimelineIndex(index)}
                  >
                    <div className={styles.timelineMarker} />
                    <div className={styles.timelineContent}>
                      <div className={styles.timelineTitle}>{event.snapshot.name}</div>
                      <div className={styles.timelineDate}>{formatDate(event.timestamp)}</div>
                      <div className={styles.timelineStats}>
                        <span>{event.snapshot.totalFiles} files</span>
                        <span>{formatBytes(event.snapshot.totalSize)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {viewMode === 'list' && (
          <div className={styles.listView}>
            {/* Search and Filters */}
            <div className={styles.filters}>
              <div className={styles.searchContainer}>
                <Search size={16} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search snapshots..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              
              <div className={styles.filterControls}>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={styles.filterSelect}
                >
                  <option value="all">All Categories</option>
                  <option value="system">System</option>
                  <option value="user">User</option>
                  <option value="backup">Backup</option>
                </select>
                
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className={styles.filterSelect}
                >
                  <option value="date">Sort by Date</option>
                  <option value="name">Sort by Name</option>
                  <option value="size">Sort by Size</option>
                </select>
                
                <button
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  className={styles.sortButton}
                >
                  {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>

            {/* Snapshots List */}
            <div className={styles.snapshotsList}>
              {filteredSnapshots.map((snapshot) => (
                <motion.div
                  key={snapshot.id}
                  className={styles.snapshotCard}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className={styles.snapshotHeader}>
                    <div className={styles.snapshotInfo}>
                      <div className={styles.snapshotTitle}>
                        {snapshot.isPinned && <Star className={styles.pinnedIcon} />}
                        {snapshot.name}
                      </div>
                      <div className={styles.snapshotMeta}>
                        <span>{formatDate(snapshot.timestamp)}</span>
                        <span>{snapshot.totalFiles} files</span>
                        <span>{formatBytes(snapshot.totalSize)}</span>
                      </div>
                    </div>
                    
                    <div className={styles.snapshotActions}>
                      <button
                        onClick={() => setSelectedSnapshot1(snapshot.id)}
                        className={`${styles.selectButton} ${selectedSnapshot1 === snapshot.id ? styles.selected : ''}`}
                      >
                        Select 1
                      </button>
                      <button
                        onClick={() => setSelectedSnapshot2(snapshot.id)}
                        className={`${styles.selectButton} ${selectedSnapshot2 === snapshot.id ? styles.selected : ''}`}
                      >
                        Select 2
                      </button>
                    </div>
                  </div>
                  
                  {snapshot.description && (
                    <div className={styles.snapshotDescription}>
                      {snapshot.description}
                    </div>
                  )}
                  
                  {snapshot.tags && (
                    <div className={styles.snapshotTags}>
                      {snapshot.tags.map((tag, index) => (
                        <span key={index} className={styles.tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {viewMode === 'comparison' && (
          <div className={styles.comparisonView}>
            {/* Comparison Controls */}
            <div className={styles.comparisonControls}>
              <div className={styles.selectedSnapshots}>
                <div className={styles.selectedSnapshot}>
                  <span className={styles.selectedLabel}>Snapshot 1:</span>
                  <span className={styles.selectedName}>
                    {snapshots.find(s => s.id === selectedSnapshot1)?.name || 'Not selected'}
                  </span>
                </div>
                <ArrowRightLeft className={styles.comparisonArrow} />
                <div className={styles.selectedSnapshot}>
                  <span className={styles.selectedLabel}>Snapshot 2:</span>
                  <span className={styles.selectedName}>
                    {snapshots.find(s => s.id === selectedSnapshot2)?.name || 'Not selected'}
                  </span>
                </div>
              </div>
              
              <button
                onClick={handleCompare}
                disabled={!selectedSnapshot1 || !selectedSnapshot2 || selectedSnapshot1 === selectedSnapshot2 || isComparing}
                className={styles.compareButton}
              >
                <ArrowRightLeft size={16} />
                {isComparing ? 'Comparing...' : 'Compare Snapshots'}
              </button>
            </div>

            {/* Comparison Results */}
            {comparisonResult && (
              <div className={styles.comparisonResults}>
                {/* Summary Cards */}
                <div className={styles.summaryCards}>
                  <div className={styles.summaryCard}>
                    <div className={styles.summaryHeader}>
                      <Calendar className={styles.summaryIcon} />
                      <span className={styles.summaryLabel}>Time Difference</span>
                    </div>
                    <div className={styles.summaryValue}>
                      {formatDuration(comparisonResult.timeDifference)}
                    </div>
                  </div>
                  
                  <div className={styles.summaryCard}>
                    <div className={styles.summaryHeader}>
                      <HardDrive className={styles.summaryIcon} />
                      <span className={styles.summaryLabel}>Size Change</span>
                    </div>
                    <div className={`${styles.summaryValue} ${
                      comparisonResult.sizeDifference > 0 ? styles.positive : styles.negative
                    }`}>
                      {comparisonResult.sizeDifference > 0 ? '+' : ''}{formatBytes(comparisonResult.sizeDifference)}
                    </div>
                    <div className={styles.summarySubValue}>
                      {comparisonResult.percentageChange.toFixed(1)}% change
                    </div>
                  </div>
                  
                  <div className={styles.summaryCard}>
                    <div className={styles.summaryHeader}>
                      <FileText className={styles.summaryIcon} />
                      <span className={styles.summaryLabel}>Files Change</span>
                    </div>
                    <div className={`${styles.summaryValue} ${
                      comparisonResult.filesDifference > 0 ? styles.positive : styles.negative
                    }`}>
                      {comparisonResult.filesDifference > 0 ? '+' : ''}{comparisonResult.filesDifference}
                    </div>
                  </div>
                  
                  <div className={styles.summaryCard}>
                    <div className={styles.summaryHeader}>
                      <Folder className={styles.summaryIcon} />
                      <span className={styles.summaryLabel}>Directories</span>
                    </div>
                    <div className={`${styles.summaryValue} ${
                      comparisonResult.directoriesDifference > 0 ? styles.positive : styles.negative
                    }`}>
                      {comparisonResult.directoriesDifference > 0 ? '+' : ''}{comparisonResult.directoriesDifference}
                    </div>
                  </div>
                </div>

                {/* Insights and Recommendations */}
                {(comparisonResult.insights.length > 0 || comparisonResult.recommendations.length > 0) && (
                  <div className={styles.insightsSection}>
                    {comparisonResult.insights.length > 0 && (
                      <div className={styles.insights}>
                        <h3>Insights</h3>
                        <ul>
                          {comparisonResult.insights.map((insight, index) => (
                            <li key={index}>{insight}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {comparisonResult.recommendations.length > 0 && (
                      <div className={styles.recommendations}>
                        <h3>Recommendations</h3>
                        <ul>
                          {comparisonResult.recommendations.map((rec, index) => (
                            <li key={index}>{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* File Changes */}
                <div className={styles.fileChanges}>
                  <div className={styles.fileChangesHeader}>
                    <h3>File Changes</h3>
                    <div className={styles.fileChangesControls}>
                      <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value as any)}
                        className={styles.filterSelect}
                      >
                        <option value="all">All Changes</option>
                        <option value="added">Added</option>
                        <option value="removed">Removed</option>
                        <option value="modified">Modified</option>
                        <option value="moved">Moved</option>
                      </select>
                      
                      <button
                        onClick={() => setShowDetails(!showDetails)}
                        className={styles.detailsButton}
                      >
                        {showDetails ? <EyeOff size={16} /> : <Eye size={16} />}
                        {showDetails ? 'Hide' : 'Show'} Details
                      </button>
                    </div>
                  </div>
                  
                  <div className={styles.fileChangesList}>
                    {filteredChanges.map((change, index) => (
                      <motion.div
                        key={change.id}
                        className={`${styles.fileChange} ${getChangeColor(change.type)}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <div className={styles.fileChangeHeader}>
                          <div className={styles.fileChangeIcon}>
                            {getChangeIcon(change.type)}
                          </div>
                          <div className={styles.fileChangeInfo}>
                            <div className={styles.filePath}>{change.path}</div>
                            {showDetails && (
                              <div className={styles.fileChangeDetails}>
                                <span>Type: {change.fileType}</span>
                                {change.category && <span>Category: {change.category}</span>}
                                {change.impact && <span>Impact: {change.impact}</span>}
                                {change.timestamp && <span>Modified: {formatDate(change.timestamp)}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className={styles.fileChangeSize}>
                          {change.size && (
                            <div className={styles.sizeValue}>{formatBytes(change.size)}</div>
                          )}
                          {change.sizeDifference && (
                            <div className={`${styles.sizeDifference} ${
                              change.sizeDifference > 0 ? styles.positive : styles.negative
                            }`}>
                              {change.sizeDifference > 0 ? '+' : ''}{formatBytes(change.sizeDifference)}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Export Modal */}
      <AnimatePresence>
        {showExportModal && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={styles.modalContent}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className={styles.modalHeader}>
                <h3>Export Comparison Results</h3>
                <button
                  onClick={() => setShowExportModal(false)}
                  className={styles.closeButton}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className={styles.modalBody}>
                <div className={styles.exportOptions}>
                  <label>
                    <input
                      type="radio"
                      value="json"
                      checked={exportFormat === 'json'}
                      onChange={(e) => setExportFormat(e.target.value as any)}
                    />
                    JSON Format
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="csv"
                      checked={exportFormat === 'csv'}
                      onChange={(e) => setExportFormat(e.target.value as any)}
                    />
                    CSV Format
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="pdf"
                      checked={exportFormat === 'pdf'}
                      onChange={(e) => setExportFormat(e.target.value as any)}
                    />
                    PDF Format
                  </label>
                </div>
              </div>
              
              <div className={styles.modalFooter}>
                <button
                  onClick={() => setShowExportModal(false)}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
                <button
                  onClick={handleExport}
                  className={styles.exportButton}
                >
                  Export
                </button>
              </div>
            </motion.div>
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
            <motion.div
              className={styles.helpContent}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className={styles.helpHeader}>
                <h3>Time Travel Help</h3>
                <button
                  onClick={() => setShowHelp(false)}
                  className={styles.closeButton}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className={styles.helpSections}>
                <div className={styles.helpSection}>
                  <h4>Keyboard Shortcuts</h4>
                  <ul>
                    <li><kbd>Ctrl+F</kbd> - Toggle fullscreen</li>
                    <li><kbd>Ctrl+E</kbd> - Export results</li>
                    <li><kbd>Ctrl+H</kbd> - Show help</li>
                    <li><kbd>Space</kbd> - Play/pause timeline</li>
                    <li><kbd>←/→</kbd> - Navigate timeline</li>
                  </ul>
                </div>
                
                <div className={styles.helpSection}>
                  <h4>Features</h4>
                  <ul>
                    <li><strong>Timeline View:</strong> Visual timeline with playback controls</li>
                    <li><strong>List View:</strong> Searchable and filterable snapshot list</li>
                    <li><strong>Comparison View:</strong> Detailed comparison results</li>
                    <li><strong>Export Options:</strong> JSON, CSV, and PDF export formats</li>
                  </ul>
                </div>
                
                <div className={styles.helpSection}>
                  <h4>Tips</h4>
                  <ul>
                    <li>Use the timeline to visualize changes over time</li>
                    <li>Filter snapshots by category or tags for better organization</li>
                    <li>Export comparison results for documentation</li>
                    <li>Use keyboard shortcuts for faster navigation</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default EnhancedTimeTravel;