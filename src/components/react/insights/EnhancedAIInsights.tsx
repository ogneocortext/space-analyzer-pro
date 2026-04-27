import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Filter,
  Search,
  RefreshCw,
  Download,
  Eye,
  EyeOff,
  Grid3x3,
  List,
  Settings,
  HelpCircle,
  X,
  Bell,
  Calendar,
  BarChart3,
  PieChart,
  Activity,
  Zap,
  Shield,
  FileText,
  Clock,
  Star,
  ChevronRight,
  ChevronDown,
  Info,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Archive,
} from "lucide-react";
// @ts-ignore
import { bridge } from "../services/AnalysisBridge";
import styles from "./EnhancedAIInsights.module.css";

interface EnhancedAIInsightsProps {
  analysisData?: any;
  onNavigate?: (view: string) => void;
}

interface Insight {
  id: string;
  type: "warning" | "suggestion" | "recommendation" | "trend";
  title: string;
  description: string;
  severity: "critical" | "high" | "medium" | "low";
  category: "storage" | "performance" | "security" | "organization";
  impact: "high" | "medium" | "low";
  actionable: boolean;
  files?: any[];
  metrics?: {
    size?: number;
    count?: number;
    percentage?: number;
  };
  timestamp: Date;
  feedback?: {
    useful: boolean;
    comment?: string;
  };
  status: "new" | "read" | "acknowledged" | "resolved";
  aiConfidence: number;
  relatedInsights?: string[];
}

interface InsightStats {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  resolved: number;
  pending: number;
  avgConfidence: number;
  categories: { [key: string]: number };
}

const EnhancedAIInsights: React.FC<EnhancedAIInsightsProps> = ({ analysisData, onNavigate }) => {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [filteredInsights, setFilteredInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showResolved, setShowResolved] = useState(false);
  const [expandedInsights, setExpandedInsights] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [sortBy, setSortBy] = useState<"severity" | "date" | "confidence" | "impact">("severity");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const refreshIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Generate mock insights based on analysis data
  const generateInsights = useCallback((data: any): Insight[] => {
    const insights: Insight[] = [];

    if (!data) return insights;

    // Storage warnings
    if (data.categories) {
      const totalSize = Object.values(data.categories).reduce(
        (sum: number, cat: any) => sum + (cat.size || 0),
        0
      );

      Object.entries(data.categories).forEach(([category, info]: [string, any], index) => {
        // @ts-ignore - totalSize type
        const percentage = ((info.size || 0) / totalSize) * 100;

        if (percentage > 30) {
          insights.push({
            id: `warning-${index}`,
            type: "warning",
            title: `Large ${category} directory detected`,
            description: `The ${category} category occupies ${percentage.toFixed(1)}% of your total storage (${(info.size / 1024 / 1024).toFixed(1)} MB). Consider archiving or removing unused files.`,
            severity: percentage > 50 ? "critical" : "high",
            category: "storage",
            impact: "high",
            actionable: true,
            metrics: { size: info.size, percentage },
            timestamp: new Date(Date.now() - Math.random() * 86400000),
            status: "new",
            aiConfidence: 0.85 + Math.random() * 0.15,
          });
        }
      });
    }

    // Performance suggestions
    if (data.files && data.files.length > 1000) {
      insights.push({
        id: "perf-1",
        type: "suggestion",
        title: "Large number of files detected",
        description: `Your system contains ${data.files.length.toLocaleString()} files. Consider organizing them into subdirectories for better performance.`,
        severity: "medium",
        category: "performance",
        impact: "medium",
        actionable: true,
        metrics: { count: data.files.length },
        timestamp: new Date(Date.now() - Math.random() * 86400000),
        status: "new",
        aiConfidence: 0.75 + Math.random() * 0.2,
      });
    }

    // Security recommendations
    insights.push({
      id: "security-1",
      type: "recommendation",
      title: "Regular backup recommended",
      description: "Ensure your important files are backed up regularly to prevent data loss.",
      severity: "medium",
      category: "security",
      impact: "high",
      actionable: true,
      timestamp: new Date(Date.now() - Math.random() * 86400000),
      status: "new",
      aiConfidence: 0.9,
    });

    // Organization tips
    insights.push({
      id: "org-1",
      type: "suggestion",
      title: "Consider file naming conventions",
      description:
        "Implement consistent file naming conventions to improve organization and searchability.",
      severity: "low",
      category: "organization",
      impact: "medium",
      actionable: true,
      timestamp: new Date(Date.now() - Math.random() * 86400000),
      status: "new",
      aiConfidence: 0.7 + Math.random() * 0.2,
    });

    // Add some trends
    insights.push({
      id: "trend-1",
      type: "trend",
      title: "Storage usage trending upward",
      description:
        "Your storage usage has increased by 15% over the past month. Monitor this trend to avoid running out of space.",
      severity: "medium",
      category: "storage",
      impact: "medium",
      actionable: false,
      metrics: { percentage: 15 },
      timestamp: new Date(Date.now() - Math.random() * 86400000),
      status: "new",
      aiConfidence: 0.8,
    });

    return insights;
  }, []);

  // Load insights
  const loadInsights = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate API call delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      const generatedInsights = generateInsights(analysisData);
      setInsights(generatedInsights);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load insights");
    } finally {
      setIsLoading(false);
    }
  }, [analysisData, generateInsights]);

  // Filter and sort insights
  useEffect(() => {
    let filtered = insights;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (insight) =>
          insight.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          insight.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply category filter
    if (selectedCategory !== "all") {
      filtered = filtered.filter((insight) => insight.category === selectedCategory);
    }

    // Apply severity filter
    if (selectedSeverity !== "all") {
      filtered = filtered.filter((insight) => insight.severity === selectedSeverity);
    }

    // Apply type filter
    if (selectedType !== "all") {
      filtered = filtered.filter((insight) => insight.type === selectedType);
    }

    // Apply resolved filter
    if (!showResolved) {
      filtered = filtered.filter((insight) => insight.status !== "resolved");
    }

    // Sort insights
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "severity":
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          comparison = severityOrder[b.severity] - severityOrder[a.severity];
          break;
        case "date":
          comparison = b.timestamp.getTime() - a.timestamp.getTime();
          break;
        case "confidence":
          comparison = b.aiConfidence - a.aiConfidence;
          break;
        case "impact":
          const impactOrder = { high: 3, medium: 2, low: 1 };
          comparison = impactOrder[b.impact] - impactOrder[a.impact];
          break;
      }

      return sortOrder === "asc" ? -comparison : comparison;
    });

    setFilteredInsights(filtered);
  }, [
    insights,
    searchQuery,
    selectedCategory,
    selectedSeverity,
    selectedType,
    showResolved,
    sortBy,
    sortOrder,
  ]);

  // Calculate statistics
  const stats = useMemo((): InsightStats => {
    const total = insights.length;
    const critical = insights.filter((i) => i.severity === "critical").length;
    const high = insights.filter((i) => i.severity === "high").length;
    const medium = insights.filter((i) => i.severity === "medium").length;
    const low = insights.filter((i) => i.severity === "low").length;
    const resolved = insights.filter((i) => i.status === "resolved").length;
    const pending = insights.filter((i) => i.status === "new" || i.status === "read").length;
    const avgConfidence = insights.reduce((sum, i) => sum + i.aiConfidence, 0) / total || 0;

    const categories = insights.reduce(
      (acc, insight) => {
        acc[insight.category] = (acc[insight.category] || 0) + 1;
        return acc;
      },
      {} as { [key: string]: number }
    );

    return {
      total,
      critical,
      high,
      medium,
      low,
      resolved,
      pending,
      avgConfidence,
      categories,
    };
  }, [insights]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        loadInsights();
      }, 30000); // Refresh every 30 seconds
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, loadInsights]);

  // Initial load
  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  // Event handlers
  const handleInsightAction = useCallback(
    (insightId: string, action: "acknowledge" | "resolve") => {
      setInsights((prev) =>
        prev.map((insight) => {
          if (insight.id === insightId) {
            return {
              ...insight,
              status: action === "acknowledge" ? "acknowledged" : "resolved",
            };
          }
          return insight;
        })
      );
    },
    []
  );

  const handleFeedback = useCallback((insightId: string, useful: boolean, comment?: string) => {
    setInsights((prev) =>
      prev.map((insight) => {
        if (insight.id === insightId) {
          return {
            ...insight,
            feedback: { useful, comment },
          };
        }
        return insight;
      })
    );
  }, []);

  const toggleInsightExpansion = useCallback((insightId: string) => {
    setExpandedInsights((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(insightId)) {
        newSet.delete(insightId);
      } else {
        newSet.add(insightId);
      }
      return newSet;
    });
  }, []);

  const getSeverityIcon = useCallback((severity: string) => {
    switch (severity) {
      case "critical":
        return AlertTriangle;
      case "high":
        return AlertTriangle;
      case "medium":
        return Info;
      case "low":
        return CheckCircle;
      default:
        return Info;
    }
  }, []);

  const getCategoryIcon = useCallback((category: string) => {
    switch (category) {
      case "storage":
        return Archive;
      case "performance":
        return Zap;
      case "security":
        return Shield;
      case "organization":
        return FileText;
      default:
        return Info;
    }
  }, []);

  const getTypeIcon = useCallback((type: string) => {
    switch (type) {
      case "warning":
        return AlertTriangle;
      case "suggestion":
        return CheckCircle;
      case "recommendation":
        return Star;
      case "trend":
        return TrendingUp;
      default:
        return Info;
    }
  }, []);

  const formatBytes = useCallback((bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case "r":
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            loadInsights();
          }
          break;
        case "g":
          setViewMode((prev) => (prev === "grid" ? "list" : "grid"));
          break;
        case "a":
          setAutoRefresh((prev) => !prev);
          break;
        case "/":
          event.preventDefault();
          // Focus search input
          break;
        case "Escape":
          setShowHelp(false);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [loadInsights]);

  return (
    <div className={styles.enhancedAIInsights}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerTitle}>
            <Brain className={styles.headerIcon} />
            <h1>AI Insights</h1>
            <div className={styles.headerSubtitle}>
              Intelligent recommendations for your storage
            </div>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.headerControls}>
            <div className={styles.searchContainer}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search insights..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            <button
              onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
              className={styles.controlButton}
              title={`Switch to ${viewMode === "grid" ? "list" : "grid"} view`}
            >
              {viewMode === "grid" ? <List size={16} /> : <Grid3x3 size={16} />}
            </button>

            <button
              onClick={() => setShowResolved(!showResolved)}
              className={`${styles.controlButton} ${showResolved ? styles.active : ""}`}
              title="Toggle resolved insights"
            >
              <Eye size={16} />
            </button>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`${styles.controlButton} ${autoRefresh ? styles.active : ""}`}
              title="Toggle auto-refresh"
            >
              <RefreshCw className={autoRefresh ? styles.spinning : ""} size={16} />
            </button>

            <button
              onClick={loadInsights}
              disabled={isLoading}
              className={styles.controlButton}
              title="Refresh insights"
            >
              <RefreshCw className={isLoading ? styles.spinning : ""} size={16} />
            </button>

            <button
              onClick={() => setShowHelp(!showHelp)}
              className={styles.controlButton}
              title="Help"
            >
              <HelpCircle size={16} />
            </button>
          </div>

          {lastUpdate && (
            <div className={styles.lastUpdate}>
              <Clock size={12} />
              <span>{lastUpdate.toLocaleTimeString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Statistics Bar */}
      <div className={styles.statsBar}>
        <div className={styles.statGroup}>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{stats.total}</div>
            <div className={styles.statLabel}>Total</div>
          </div>
          <div className={styles.statItem}>
            <div className={`${styles.statValue} ${styles.critical}`}>{stats.critical}</div>
            <div className={styles.statLabel}>Critical</div>
          </div>
          <div className={styles.statItem}>
            <div className={`${styles.statValue} ${styles.high}`}>{stats.high}</div>
            <div className={styles.statLabel}>High</div>
          </div>
          <div className={styles.statItem}>
            <div className={`${styles.statValue} ${styles.medium}`}>{stats.medium}</div>
            <div className={styles.statLabel}>Medium</div>
          </div>
          <div className={styles.statItem}>
            <div className={`${styles.statValue} ${styles.low}`}>{stats.low}</div>
            <div className={styles.statLabel}>Low</div>
          </div>
        </div>

        <div className={styles.statGroup}>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{stats.resolved}</div>
            <div className={styles.statLabel}>Resolved</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{stats.pending}</div>
            <div className={styles.statLabel}>Pending</div>
          </div>
          <div className={styles.statItem}>
            <div className={styles.statValue}>{(stats.avgConfidence * 100).toFixed(0)}%</div>
            <div className={styles.statLabel}>Avg Confidence</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Category:</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Categories</option>
            <option value="storage">Storage</option>
            <option value="performance">Performance</option>
            <option value="security">Security</option>
            <option value="organization">Organization</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Severity:</label>
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Type:</label>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Types</option>
            <option value="warning">Warnings</option>
            <option value="suggestion">Suggestions</option>
            <option value="recommendation">Recommendations</option>
            <option value="trend">Trends</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.filterLabel}>Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className={styles.filterSelect}
          >
            <option value="severity">Severity</option>
            <option value="date">Date</option>
            <option value="confidence">Confidence</option>
            <option value="impact">Impact</option>
          </select>
        </div>

        <button
          onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
          className={styles.sortOrderButton}
        >
          {sortOrder === "asc" ? "↑" : "↓"}
        </button>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {isLoading ? (
          <div className={styles.loadingState}>
            <RefreshCw className={styles.loadingSpinner} />
            <span>Loading AI insights...</span>
          </div>
        ) : error ? (
          <div className={styles.errorState}>
            <AlertTriangle className={styles.errorIcon} />
            <span>{error}</span>
          </div>
        ) : filteredInsights.length === 0 ? (
          <div className={styles.emptyState}>
            <CheckCircle className={styles.emptyIcon} />
            <h3>No insights found</h3>
            <p>Your system is running optimally!</p>
          </div>
        ) : (
          <div className={viewMode === "grid" ? styles.gridContainer : styles.listContainer}>
            {filteredInsights.map((insight) => {
              const SeverityIcon = getSeverityIcon(insight.severity);
              const CategoryIcon = getCategoryIcon(insight.category);
              const TypeIcon = getTypeIcon(insight.type);
              const isExpanded = expandedInsights.has(insight.id);

              return (
                <motion.div
                  key={insight.id}
                  className={`${styles.insightCard} ${styles[insight.severity]} ${styles[insight.status]}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.02 }}
                >
                  <div className={styles.cardHeader}>
                    <div className={styles.cardLeft}>
                      <div className={styles.cardIcons}>
                        <div className={`${styles.iconWrapper} ${styles[insight.severity]}`}>
                          <SeverityIcon size={20} />
                        </div>
                        <div className={`${styles.iconWrapper} ${styles[insight.category]}`}>
                          <CategoryIcon size={16} />
                        </div>
                        <div className={`${styles.iconWrapper} ${styles[insight.type]}`}>
                          <TypeIcon size={16} />
                        </div>
                      </div>
                      <div className={styles.cardTitle}>
                        <h3>{insight.title}</h3>
                        <div className={styles.cardMeta}>
                          <span className={`${styles.severity} ${styles[insight.severity]}`}>
                            {insight.severity}
                          </span>
                          <span className={`${styles.category} ${styles[insight.category]}`}>
                            {insight.category}
                          </span>
                          <span className={`${styles.type} ${styles[insight.type]}`}>
                            {insight.type}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className={styles.cardRight}>
                      <div className={styles.confidence}>
                        <span>{(insight.aiConfidence * 100).toFixed(0)}%</span>
                        <div className={styles.confidenceBar}>
                          <div
                            className={styles.confidenceFill}
                            style={{ width: `${insight.aiConfidence * 100}%` }}
                          />
                        </div>
                      </div>

                      <button
                        onClick={() => toggleInsightExpansion(insight.id)}
                        className={styles.expandButton}
                      >
                        <ChevronDown className={isExpanded ? styles.rotated : ""} size={16} />
                      </button>
                    </div>
                  </div>

                  <div className={styles.cardContent}>
                    <p className={styles.description}>{insight.description}</p>

                    {insight.metrics && (
                      <div className={styles.metrics}>
                        {insight.metrics.size && (
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>Size:</span>
                            <span className={styles.metricValue}>
                              {formatBytes(insight.metrics.size)}
                            </span>
                          </div>
                        )}
                        {insight.metrics.count && (
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>Count:</span>
                            <span className={styles.metricValue}>
                              {insight.metrics.count.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {insight.metrics.percentage && (
                          <div className={styles.metric}>
                            <span className={styles.metricLabel}>Percentage:</span>
                            <span className={styles.metricValue}>
                              {insight.metrics.percentage.toFixed(1)}%
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className={styles.cardFooter}>
                      <div className={styles.timestamp}>
                        <Clock size={12} />
                        <span>{insight.timestamp.toLocaleString()}</span>
                      </div>

                      <div className={styles.actions}>
                        {insight.actionable && insight.status !== "resolved" && (
                          <>
                            <button
                              onClick={() => handleInsightAction(insight.id, "acknowledge")}
                              className={styles.actionButton}
                            >
                              Acknowledge
                            </button>
                            <button
                              onClick={() => handleInsightAction(insight.id, "resolve")}
                              className={`${styles.actionButton} ${styles.primary}`}
                            >
                              Resolve
                            </button>
                          </>
                        )}

                        <div className={styles.feedback}>
                          <button
                            onClick={() => handleFeedback(insight.id, true)}
                            className={`${styles.feedbackButton} ${insight.feedback?.useful ? styles.positive : ""}`}
                          >
                            <ThumbsUp size={14} />
                          </button>
                          <button
                            onClick={() => handleFeedback(insight.id, false)}
                            className={`${styles.feedbackButton} ${insight.feedback?.useful === false ? styles.negative : ""}`}
                          >
                            <ThumbsDown size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className={styles.expandedContent}>
                      <div className={styles.expandedSection}>
                        <h4>Additional Details</h4>
                        <div className={styles.detailGrid}>
                          <div className={styles.detailItem}>
                            <span className={styles.detailLabel}>Impact:</span>
                            <span className={`${styles.detailValue} ${styles[insight.impact]}`}>
                              {insight.impact}
                            </span>
                          </div>
                          <div className={styles.detailItem}>
                            <span className={styles.detailLabel}>Actionable:</span>
                            <span className={styles.detailValue}>
                              {insight.actionable ? "Yes" : "No"}
                            </span>
                          </div>
                          <div className={styles.detailItem}>
                            <span className={styles.detailLabel}>Status:</span>
                            <span className={`${styles.detailValue} ${styles[insight.status]}`}>
                              {insight.status}
                            </span>
                          </div>
                          {insight.feedback && (
                            <div className={styles.detailItem}>
                              <span className={styles.detailLabel}>Feedback:</span>
                              <span className={styles.detailValue}>
                                {insight.feedback.useful ? "Useful" : "Not useful"}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {insight.feedback?.comment && (
                        <div className={styles.expandedSection}>
                          <h4>User Comment</h4>
                          <p className={styles.comment}>{insight.feedback.comment}</p>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

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
                <h3>AI Insights Help</h3>
                <button onClick={() => setShowHelp(false)} className={styles.helpClose}>
                  <X size={20} />
                </button>
              </div>

              <div className={styles.helpSections}>
                <div className={styles.helpSection}>
                  <h4>Insight Types</h4>
                  <ul>
                    <li>
                      <strong>Warnings:</strong> Critical issues that need immediate attention
                    </li>
                    <li>
                      <strong>Suggestions:</strong> Recommendations for improvement
                    </li>
                    <li>
                      <strong>Recommendations:</strong> Best practices and optimizations
                    </li>
                    <li>
                      <strong>Trends:</strong> Patterns and changes over time
                    </li>
                  </ul>
                </div>

                <div className={styles.helpSection}>
                  <h4>Severity Levels</h4>
                  <ul>
                    <li>
                      <span className={styles.severityCritical}>Critical</span> - Requires immediate
                      action
                    </li>
                    <li>
                      <span className={styles.severityHigh}>High</span> - Important to address
                    </li>
                    <li>
                      <span className={styles.severityMedium}>Medium</span> - Should be considered
                    </li>
                    <li>
                      <span className={styles.severityLow}>Low</span> - Optional improvements
                    </li>
                  </ul>
                </div>

                <div className={styles.helpSection}>
                  <h4>Keyboard Shortcuts</h4>
                  <ul>
                    <li>
                      <kbd>Ctrl+R</kbd> - Refresh insights
                    </li>
                    <li>
                      <kbd>G</kbd> - Toggle grid/list view
                    </li>
                    <li>
                      <kbd>A</kbd> - Toggle auto-refresh
                    </li>
                    <li>
                      <kbd>/</kbd> - Focus search
                    </li>
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

export default EnhancedAIInsights;
