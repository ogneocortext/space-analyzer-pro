import React, { useState, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainCircuit,
  BarChart3,
  FolderOpen,
  Folder,
  TrendingUp,
  TrendingDown,
  Search,
  Filter,
  Download,
  RefreshCw,
  ChevronRight,
  Clock,
  AlertTriangle,
  CheckCircle,
  X,
  FileText,
  HardDrive,
  Lightbulb,
  Activity
} from 'lucide-react';
import { StorageGauge } from '../StorageGauge';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';
import { AnalysisResult } from '../../services/AnalysisBridge';
import './EnhancedDashboard.css';

interface MetricCardProps {
  title: string;
  value: string;
  change: number;
  icon: React.ReactNode;
  trend: 'up' | 'down' | 'neutral';
  description?: string;
  isLoading?: boolean;
  onClick?: () => void;
}

const MetricCard = memo<MetricCardProps>(({
  title,
  value,
  change,
  icon,
  trend,
  description,
  isLoading = false,
  onClick
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.div
      className={`metric-card ${isHovered ? 'hovered' : ''}`}
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`${title}: ${value}${description ? `, ${description}` : ''}`}
    >
      <div className="metric-card-header">
        <div className="metric-icon">
          {icon}
        </div>
        <div className="metric-trend">
          {trend === 'up' && <TrendingUp className="trend-icon up" />}
          {trend === 'down' && <TrendingUp className="trend-icon down" />}
          {trend === 'neutral' && <div className="trend-neutral" />}
        </div>
      </div>
      
      <div className="metric-content">
        <div className="metric-value" aria-live="polite">
          {isLoading ? (
            <div className="metric-skeleton">
              <div className="skeleton-line"></div>
            </div>
          ) : (
            value
          )}
        </div>
        <div className="metric-title">{title}</div>
        {description && (
          <div className="metric-description">{description}</div>
        )}
        
        <div className={`metric-change ${trend}`}>
          <span className="change-value">
            {trend === 'up' && '+'}
            {change.toFixed(1)}%
          </span>
          <span className="change-label">vs last period</span>
        </div>
      </div>
      
      {onClick && (
        <div className="metric-action">
          <ChevronRight className="action-icon" />
        </div>
      )}
    </motion.div>
  );
});

interface InteractiveChartProps {
  title: string;
  subtitle?: string;
  data: any[];
  type: 'pie' | 'bar';
  onFilterChange?: (filters: any) => void;
  showFilters?: boolean;
  height?: number;
}

const InteractiveChart: React.FC<InteractiveChartProps> = ({
  title,
  subtitle,
  data,
  type,
  onFilterChange,
  showFilters = true,
  height = 300
}) => {
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

  const filteredData = useMemo(() => {
    if (selectedFilters.length === 0) return data;
    return data.filter(item => selectedFilters.includes(item.name));
  }, [data, selectedFilters]);

  const handleFilterToggle = useCallback((filterName: string) => {
    const newFilters = selectedFilters.includes(filterName)
      ? selectedFilters.filter(f => f !== filterName)
      : [...selectedFilters, filterName];
    
    setSelectedFilters(newFilters);
    onFilterChange?.(newFilters);
  }, [selectedFilters, onFilterChange]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'];

  return (
    <motion.div
      className="interactive-chart"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="chart-header">
        <div className="chart-title-section">
          <h3 className="chart-title">{title}</h3>
          {subtitle && <p className="chart-subtitle">{subtitle}</p>}
        </div>
        
        {showFilters && (
          <div className="chart-filters">
            <Filter className="filter-icon" />
            <div className="filter-pills">
              {data.map((item) => (
                <button
                  key={item.name}
                  className={`filter-pill ${selectedFilters.includes(item.name) ? 'active' : ''}`}
                  onClick={() => handleFilterToggle(item.name)}
                  aria-pressed={selectedFilters.includes(item.name) ? 'true' : 'false'}
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="chart-container" style={{ height: height }}>
        <ResponsiveContainer width="100%" height="100%">
          {type === 'pie' ? (
            <PieChart>
              <Pie
                data={filteredData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                animationBegin={0}
                animationDuration={800}
              >
                {filteredData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    style={{
                      filter: hoveredSegment === entry.name ? 'brightness(1.1)' : 'none',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={() => setHoveredSegment(entry.name)}
                    onMouseLeave={() => setHoveredSegment(null)}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: any, name: any) => [
                  `${((Number(value) / filteredData.reduce((sum, item) => sum + item.value, 0)) * 100).toFixed(1)}%`,
                  name
                ]}
                contentStyle={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-xl)',
                  color: 'var(--text-primary)'
                }}
              />
            </PieChart>
          ) : (
            <BarChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="name" stroke="var(--text-secondary)" />
              <YAxis stroke="var(--text-secondary)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-xl)',
                  color: 'var(--text-primary)'
                }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {filteredData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                    style={{ cursor: 'pointer' }}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {selectedFilters.length > 0 && (
        <div className="active-filters">
          <span className="filter-label">Active filters:</span>
          <div className="active-filter-pills">
            {selectedFilters.map((filter) => (
              <button
                key={filter}
                className="active-filter-pill"
                onClick={() => handleFilterToggle(filter)}
                aria-label={`Remove ${filter} filter`}
              >
                {filter}
                <X className="remove-icon" />
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

interface AIRecommendationProps {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: 'cleanup' | 'optimization' | 'security';
  onAction?: () => void;
  onDismiss?: () => void;
}

const AIRecommendation: React.FC<AIRecommendationProps> = ({
  id,
  title,
  description,
  impact,
  category,
  onAction,
  onDismiss
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const categoryIcons = {
    cleanup: <AlertTriangle className="category-icon cleanup" />,
    optimization: <TrendingUp className="category-icon optimization" />,
    security: <CheckCircle className="category-icon security" />
  };

  const impactColors = {
    high: 'high',
    medium: 'medium',
    low: 'low'
  };

  return (
    <motion.div
      className={`ai-recommendation ${impactColors[impact]}`}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      whileHover={{ scale: 1.02 }}
    >
      <div className="recommendation-header">
        <div className="recommendation-category">
          {categoryIcons[category]}
        </div>
        <div className="recommendation-content">
          <h4 className="recommendation-title">{title}</h4>
          <p className="recommendation-description">{description}</p>
        </div>
        <div className="recommendation-actions">
          <button
            className="expand-button"
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-label={`Expand ${title} details`}
          >
            <ChevronRight className={`expand-icon ${isExpanded ? 'expanded' : ''}`} />
          </button>
          {onDismiss && (
            <button
              className="dismiss-button"
              onClick={onDismiss}
              aria-label={`Dismiss ${title} recommendation`}
            >
              <X className="dismiss-icon" />
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="recommendation-details"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="recommendation-meta">
              <span className="impact-badge">{impact} impact</span>
              <span className="category-badge">{category}</span>
            </div>
            {onAction && (
              <button className="action-button" onClick={onAction}>
                <BrainCircuit className="action-icon" />
                Take Action
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

interface EnhancedDashboardProps {
  analysisData: any;
  onNavigate: (page: string) => void;
  userPreferences?: {
    compactMode?: boolean;
  };
}

const EnhancedDashboard: React.FC<EnhancedDashboardProps> = ({
  analysisData,
  onNavigate
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [compactMode, setCompactMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['metrics', 'charts', 'progress', 'insights', 'recommendations']));
  const [categoryFilter, setCategoryFilter] = useState('');

  const handleRefresh = useCallback(() => {
    setIsLoading(true);
    // Simulate refresh
    setTimeout(() => setIsLoading(false), 1000);
  }, []);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  }, []);

  // Memoize icon components to prevent re-renders
  const iconComponents = useMemo(() => ({
    fileText: <FileText />,
    hardDrive: <HardDrive />,
    lightbulb: <Lightbulb />,
    activity: <Activity />
  }), []);

  const processedData = useMemo(() => {
    if (!analysisData) return null;

    return {
      metrics: {
        totalFiles: {
          title: 'Total Files',
          value: analysisData.totalFiles?.toLocaleString() || '24,543',
          change: 12.5,
          trend: 'up' as const,
          description: 'Files scanned',
          icon: iconComponents.fileText
        },
        storageSize: {
          title: 'Storage Size',
          value: `${(analysisData.totalSize / (1024 ** 3)).toFixed(1)} GB`,
          change: -3.2,
          trend: 'down' as const,
          description: 'Total disk usage',
          icon: iconComponents.hardDrive
        },
        aiInsights: {
          title: 'AI Insights',
          value: analysisData.ai_insights?.optimization_suggestions?.length?.toString() || '47',
          change: 23.1,
          trend: 'up' as const,
          description: 'AI-generated insights',
          icon: iconComponents.lightbulb
        },
        optimization: {
          title: 'Optimization',
          value: '94%',
          change: 5.3,
          trend: 'up' as const,
          description: 'Storage optimization score',
          icon: iconComponents.activity
        }
      },
      storageData: Object.entries(analysisData.categories || {}).map(([name, data]: [string, any]) => ({
        name,
        value: data.size,
      })),
      recommendations: [
        {
          id: 'cleanup-duplicates',
          title: 'Clean up duplicates',
          description: `Found ${analysisData.ai_insights?.potential_duplicates || 0} duplicate files that can be safely removed.`,
          impact: 'high' as const,
          category: 'cleanup' as const
        },
        {
          id: 'optimize-media',
          title: 'Optimize media files',
          description: 'Compress large media files to save significant storage space.',
          impact: 'medium' as const,
          category: 'optimization' as const
        },
        {
          id: 'archive-old',
          title: 'Archive old files',
          description: 'Move files older than 1 year to archive storage.',
          impact: 'low' as const,
          category: 'archival' as const
        }
      ]
    };
  }, [analysisData, iconComponents]);

  const handleRecommendationAction = useCallback((id: string) => {
    console.log('Action triggered for recommendation:', id);
    // Handle recommendation action
  }, []);

  const handleRecommendationDismiss = useCallback((id: string) => {
    console.log('Dismissed recommendation:', id);
    // Handle recommendation dismissal
  }, []);

  // Helper function to get category colors
  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      'Documents': '#3b82f6',
      'Images': '#10b981',
      'Videos': '#f59e0b',
      'Audio': '#8b5cf6',
      'Archives': '#ef4444',
      'Code': '#06b6d4',
      'System': '#64748b',
      'Other': '#94a3b8'
    };
    return colors[category] || '#94a3b8';
  };

  // Helper function to get category icon class
  const getCategoryIconClass = (category: string): string => {
    const classes: Record<string, string> = {
      'Documents': 'documents',
      'Images': 'images',
      'Videos': 'videos',
      'Audio': 'audio',
      'Archives': 'archives',
      'Code': 'code',
      'System': 'system',
      'Other': 'other'
    };
    return classes[category] || 'other';
  };

  // Helper function to get category icon
  const getCategoryIcon = (category: string) => {
    const icons: Record<string, any> = {
      'Documents': <FileText size={20} />,
      'Images': <FolderOpen size={20} />,
      'Videos': <FolderOpen size={20} />,
      'Audio': <FolderOpen size={20} />,
      'Archives': <FolderOpen size={20} />,
      'Code': <FolderOpen size={20} />,
      'System': <FolderOpen size={20} />,
      'Other': <FolderOpen size={20} />
    };
    return icons[category] || <FolderOpen size={20} />;
  };

  // Helper function to format bytes
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Handle category click
  const handleCategoryClick = (categoryName: string) => {
    console.log('Category clicked:', categoryName);
    // Navigate to file browser filtered by category
    onNavigate('browser');
  };

  return (
    <div className="dashboard-container">
      {/* Header */}
      <motion.div
        className="dashboard-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="header-content">
          <div>
            <h1 className="text-display-large text-primary mb-2xl">Analysis Dashboard</h1>
            <p className="text-body text-secondary">AI-powered insights for your digital universe</p>
          </div>
        </div>
        
        <div className="header-actions">
          <div className="search-input">
            <Search className="search-icon text-tertiary" />
            <input
              type="text"
              placeholder="Search files and insights..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input bg-transparent border-none text-primary placeholder:text-tertiary"
            />
          </div>
          
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="input bg-elevated border-subtle text-primary"
            title="Select time range"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="btn btn-secondary btn-icon"
            title="Refresh dashboard"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </motion.div>

      {/* Metrics Grid - KPIs at top for visual hierarchy */}
      <motion.div
        className={`metrics-section ${compactMode ? 'compact' : ''}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="metrics-grid">
          {/* Storage Gauge - Primary KPI */}
          {processedData && (
            <motion.div 
              className="metric-card metric-card-primary"
              whileHover={{ scale: 1.02, y: -5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => toggleSection('storage')}
              style={{ cursor: 'pointer' }}
            >
              <StorageGauge
                used={analysisData?.totalSize || 0}
                total={(analysisData?.totalSize || 0) * 1.5}
                categories={Object.entries(analysisData?.categories || {}).map(([name, data]: [string, any]) => ({
                  name,
                  size: data.size || 0,
                  color: getCategoryColor(name)
                }))}
              />
            </motion.div>
          )}
          
          {/* Other KPIs */}
          {processedData && Object.entries(processedData.metrics).map(([key, metric], index) => (
            <motion.div
              key={key}
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              <MetricCard
                title={metric.title}
                value={metric.value}
                change={metric.change}
                trend={metric.trend}
                description={metric.description}
                icon={metric.icon}
                isLoading={false}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Analysis Progress */}
      {expandedSections.has('progress') && (
        <motion.div
          className="analysis-progress"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <div className="progress-header">
            <h3 className="text-display-small text-primary">Current Analysis</h3>
            <div className="progress-status">
              <div className="progress-status-dot active"></div>
              <span className="progress-status-text active">In Progress</span>
            </div>
          </div>
          
          <div className="progress-details">
            <span className="progress-file">Scanning: /project/src/components/</span>
            <span className="progress-percentage">67%</span>
          </div>
          
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: '67%' }}></div>
          </div>
        </motion.div>
      )}

      {/* File Categories */}
      <motion.div
        className="file-categories"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="categories-header">
          <h3 className="text-display-small text-primary">File Categories</h3>
          <div className="categories-actions">
            <input
              type="text"
              placeholder="Filter categories..."
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input bg-elevated border-subtle text-primary"
              style={{ minWidth: '200px' }}
            />
            <button
              onClick={() => onNavigate('browser')}
              className="btn btn-ghost"
            >
              View All
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        <div className="categories-grid">
          {Object.entries(analysisData?.categories || {})
            .filter(([categoryName]) => 
              categoryName.toLowerCase().includes(categoryFilter.toLowerCase())
            )
            .map(([categoryName, categoryData]: [string, any], index) => (
            <motion.div
              key={categoryName}
              className="category-card"
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleCategoryClick(categoryName)}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className={`category-icon ${getCategoryIconClass(categoryName)}`}>
                {getCategoryIcon(categoryName)}
              </div>
              <h4 className="category-title">{categoryName}</h4>
              <p className="category-count">{categoryData.count || 0} files</p>
              <p className="category-size">{formatBytes(categoryData.size || 0)}</p>
              <div className="category-progress">
                <div 
                  className="category-progress-bar" 
                  style={{ 
                    width: `${((categoryData.size || 0) / (analysisData?.totalSize || 1)) * 100}%`,
                    backgroundColor: getCategoryColor(categoryName)
                  }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* AI Insights */}
      <motion.div
        className="ai-insights"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="insights-header">
          <h3 className="text-display-small text-primary">AI Insights</h3>
          <button
            onClick={() => toggleSection('insights')}
            className="btn btn-ghost btn-icon"
          >
            {expandedSections.has('insights') ? <X size={20} /> : <ChevronRight size={20} />}
          </button>
        </div>
        
        {expandedSections.has('insights') && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="insights-content"
          >
            {analysisData?.ai_insights?.code_quality?.analysis && (
              <motion.div
                className="insight-card"
                whileHover={{ scale: 1.02, y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigate('neural')}
                style={{ cursor: 'pointer' }}
              >
                <div className="insight-icon">
                  <BrainCircuit size={24} />
                </div>
                <div className="insight-content">
                  <h4 className="insight-title">Code Quality Analysis</h4>
                  <p className="insight-description">
                    {analysisData.ai_insights.code_quality.analysis.substring(0, 150)}...
                  </p>
                </div>
                <ChevronRight className="insight-arrow" size={20} />
              </motion.div>
            )}
            
            {analysisData?.ai_insights?.performance?.recommendations && (
              <motion.div
                className="insight-card"
                whileHover={{ scale: 1.02, y: -3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onNavigate('neural')}
                style={{ cursor: 'pointer' }}
              >
                <div className="insight-icon">
                  <Activity size={24} />
                </div>
                <div className="insight-content">
                  <h4 className="insight-title">Performance Recommendations</h4>
                  <p className="insight-description">
                    {analysisData.ai_insights.performance.recommendations.substring(0, 150)}...
                  </p>
                </div>
                <ChevronRight className="insight-arrow" size={20} />
              </motion.div>
            )}
          </motion.div>
        )}
      </motion.div>

      {/* Recommendations */}
      {expandedSections.has('recommendations') && (
        <motion.div
          className="recommendations-section"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <div className="recommendations-header">
            <h3 className="text-display-small text-primary">Recommendations</h3>
            <button
              onClick={() => toggleSection('recommendations')}
              className="btn btn-ghost btn-icon"
            >
              {expandedSections.has('recommendations') ? <X size={20} /> : <ChevronRight size={20} />}
            </button>
          </div>
          
          <div className="recommendations-list">
            {analysisData?.ai_insights?.optimization_suggestions?.slice(0, 5).map((suggestion: string, index: number) => (
              <motion.div
                key={index}
                className="recommendation-item"
                whileHover={{ scale: 1.02, x: 5 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleRecommendationAction(suggestion)}
                style={{ cursor: 'pointer' }}
              >
                <Lightbulb className="recommendation-icon" size={20} />
                <span className="recommendation-text">{suggestion}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRecommendationDismiss(suggestion);
                  }}
                  className="btn btn-ghost btn-icon"
                >
                  <X size={16} />
                </button>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default EnhancedDashboard;
