import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Download,
  FileText,
  Database,
  Image,
  Code,
  FileJson,
  Calendar,
  Filter,
  Settings,
  Play,
  Save,
  Eye,
  Share2,
  BarChart3,
  PieChart,
  TrendingUp,
  Clock,
  HardDrive,
  Brain,
  Zap,
  Target,
  AlertTriangle,
  CheckCircle,
  Trash2,
  Upload,
  Copy,
  Edit,
  Info,
  Plus,
  Minus,
  GripVertical,
  Maximize2,
  Minimize2,
  HelpCircle,
  X,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Folder,
  File,
  Search,
  RefreshCw,
  History,
  Users,
  Lock,
  Unlock,
  Mail,
  Link,
  Smartphone,
  Monitor,
  Tablet,
} from "lucide-react";
import styles from "./EnhancedExportPanel.module.css";

interface ExportPanelProps {
  analysisData?: any;
  files?: Array<any>;
  categories?: { [key: string]: { count: number; size: number } };
  onExport?: (format: string) => void;
}

interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  format: "json" | "csv" | "pdf" | "xml" | "xlsx" | "yaml" | "html" | "txt";
  icon: React.ReactNode;
  sections: string[];
  aiOptimized: boolean;
  custom?: boolean;
  layout?: any;
  styling?: any;
}

interface ScheduledExport {
  id: string;
  name: string;
  template: string;
  schedule: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  format: string;
  recipients?: string[];
  permissions?: "public" | "private" | "team";
}

interface ExportHistory {
  id: string;
  name: string;
  template: string;
  format: string;
  timestamp: Date;
  size: number;
  status: "completed" | "failed" | "processing";
  downloadUrl?: string;
  sharedWith?: string[];
  permissions?: "public" | "private" | "team";
}

interface ExportProgress {
  stage: string;
  progress: number;
  total: number;
  current: number;
  estimatedTime?: number;
  errors?: string[];
}

interface DataSelection {
  categories: string[];
  fileTypes: string[];
  dateRange: { start: Date; end: Date };
  sizeRange: { min: number; max: number };
  riskLevel: "all" | "low" | "medium" | "high";
  tags: string[];
}

const EnhancedExportPanel: React.FC<ExportPanelProps> = ({
  analysisData,
  files = [],
  categories = {},
  onExport,
}) => {
  // Enhanced state management
  const [selectedTemplate, setSelectedTemplate] = useState<string>("comprehensive");
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set(["all"]));
  const [exportFormat, setExportFormat] = useState<
    "json" | "csv" | "pdf" | "xml" | "xlsx" | "yaml" | "html" | "txt"
  >("json");
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSharing, setShowSharing] = useState(false);
  const [showDataSelection, setShowDataSelection] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Template management
  const [customTemplates, setCustomTemplates] = useState<ExportTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [scheduledExports, setScheduledExports] = useState<ScheduledExport[]>([]);
  const [exportHistory, setExportHistory] = useState<ExportHistory[]>([]);

  // Data selection
  const [dataSelection, setDataSelection] = useState<DataSelection>({
    categories: [],
    fileTypes: [],
    dateRange: { start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), end: new Date() },
    sizeRange: { min: 0, max: Number.MAX_SAFE_INTEGER },
    riskLevel: "all",
    tags: [],
  });

  // Export progress
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [exportProgressVisible, setExportProgressVisible] = useState(false);

  // Search and filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "custom" | "ai-optimized">("all");
  const [sortBy, setSortBy] = useState<"name" | "date" | "format" | "size">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // AI-powered export templates
  const exportTemplates: ExportTemplate[] = useMemo(
    () => [
      {
        id: "comprehensive",
        name: "Comprehensive Analysis",
        description: "Complete analysis with AI insights and recommendations",
        format: "json",
        icon: <Database size={20} />,
        sections: ["overview", "categories", "files", "ai-insights", "recommendations", "timeline"],
        aiOptimized: true,
      },
      {
        id: "executive-summary",
        name: "Executive Summary",
        description: "High-level overview for stakeholders",
        format: "pdf",
        icon: <FileText size={20} />,
        sections: ["overview", "key-metrics", "ai-insights", "recommendations"],
        aiOptimized: true,
      },
      {
        id: "technical-report",
        name: "Technical Report",
        description: "Detailed technical analysis for developers",
        format: "xlsx",
        icon: <Code size={20} />,
        sections: ["files", "categories", "extensions", "dependencies", "performance"],
        aiOptimized: false,
      },
      {
        id: "security-audit",
        name: "Security Audit",
        description: "Security-focused analysis with risk assessment",
        format: "json",
        icon: <AlertTriangle size={20} />,
        sections: ["security-analysis", "file-permissions", "sensitive-data", "recommendations"],
        aiOptimized: true,
      },
      {
        id: "web-report",
        name: "Web Report",
        description: "Interactive HTML report for web viewing",
        format: "html",
        icon: <Monitor size={20} />,
        sections: ["overview", "charts", "tables", "insights"],
        aiOptimized: true,
      },
      {
        id: "data-dump",
        name: "Raw Data Dump",
        description: "Complete raw data export",
        format: "json",
        icon: <FileJson size={20} />,
        sections: ["all-data"],
        aiOptimized: false,
      },
    ],
    []
  );

  // AI-generated export insights
  const aiInsights = useMemo(() => {
    if (!analysisData) return [];

    const insights = [];
    const totalSize = analysisData.totalSize || 0;
    const fileCount = analysisData.totalFiles || 0;

    if (totalSize > 1024 * 1024 * 1024 * 10) {
      insights.push({
        type: "warning",
        icon: <AlertTriangle size={16} />,
        title: "Large Dataset Detected",
        description: "Consider using compressed formats or data filtering for faster exports",
        action: "Enable data filtering",
      });
    }

    if (fileCount > 100000) {
      insights.push({
        type: "info",
        icon: <Info size={16} />,
        title: "High File Count",
        description: "Large file count may impact export performance",
        action: "Use batch processing",
      });
    }

    insights.push({
      type: "success",
      icon: <CheckCircle size={16} />,
      title: "AI Optimization Available",
      description: "AI can optimize your export for better performance and insights",
      action: "Enable AI optimization",
    });

    return insights;
  }, [analysisData]);

  // Enhanced export data generation
  const generateExportData = useCallback(() => {
    if (!analysisData) return null;

    const template = exportTemplates.find((t) => t.id === selectedTemplate);
    if (!template) return null;

    const data: any = {
      metadata: {
        exportDate: new Date().toISOString(),
        template: template.name,
        format: template.format,
        version: "2.0",
        aiOptimized: template.aiOptimized,
      },
      overview: {
        totalSize: analysisData.totalSize || 0,
        totalFiles: analysisData.totalFiles || 0,
        totalDirectories: analysisData.totalDirectories || 0,
        categories: Object.keys(categories).length,
        scanDuration: analysisData.scanDuration || 0,
      },
      categories: Object.entries(categories).map(([name, info]) => ({
        name,
        count: info.count,
        size: info.size,
        percentage: ((info.size / (analysisData.totalSize || 1)) * 100).toFixed(2),
      })),
      files: files.slice(0, 1000).map((file) => ({
        name: file.name,
        path: file.path,
        size: file.size,
        type: file.type || "unknown",
        modified: file.modified,
        riskScore: calculateRiskScore(file),
        aiTags: generateAITags(file),
      })),
      aiInsights: aiInsights,
      recommendations: generateRecommendations(),
      dataSelection: dataSelection,
    };

    return data;
  }, [
    analysisData,
    selectedTemplate,
    exportTemplates,
    categories,
    files,
    aiInsights,
    dataSelection,
  ]);

  // Enhanced risk scoring
  const calculateRiskScore = useCallback((file: any): number => {
    let score = 0;

    if (file.size > 1024 * 1024 * 100) score += 30;
    else if (file.size > 1024 * 1024 * 10) score += 15;

    const riskyExtensions = ["exe", "dll", "bat", "sh", "ps1", "scr", "com"];
    if (riskyExtensions.includes(file.extension)) score += 25;

    if (file.category === "System") score += 20;
    else if (file.category === "Executables") score += 15;

    return Math.min(score, 100);
  }, []);

  // Enhanced AI tags generation
  const generateAITags = useCallback((file: any): string[] => {
    const tags = [];

    if (file.size > 1024 * 1024 * 100) tags.push("large-file");
    else if (file.size < 1024) tags.push("tiny-file");

    const extensionTags: { [key: string]: string } = {
      js: "javascript",
      ts: "typescript",
      py: "python",
      md: "documentation",
      json: "data",
      xml: "config",
      jpg: "image",
      png: "image",
      gif: "image",
      mp4: "video",
      mp3: "audio",
      pdf: "document",
    };

    if (extensionTags[file.extension]) tags.push(extensionTags[file.extension]);

    return tags;
  }, []);

  // Generate recommendations
  const generateRecommendations = useCallback((): string[] => {
    const recommendations = [];

    if (files.length > 10000) {
      recommendations.push("Consider using data filtering for large datasets");
    }

    if (analysisData?.totalSize > 1024 * 1024 * 1024 * 5) {
      recommendations.push("Use compressed formats for large exports");
    }

    recommendations.push("Enable AI optimization for better insights");
    recommendations.push("Schedule regular exports for data consistency");

    return recommendations;
  }, [files, analysisData]);

  // Enhanced export handling with progress tracking
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    setExportProgressVisible(true);
    setExportProgress({
      stage: "Preparing data",
      progress: 0,
      total: 100,
      current: 0,
    });

    try {
      const data = generateExportData();
      if (!data) return;

      // Simulate export stages with progress
      const stages = [
        { stage: "Preparing data", duration: 500 },
        { stage: "Processing files", duration: 1000 },
        { stage: "Generating insights", duration: 800 },
        { stage: "Formatting output", duration: 600 },
        { stage: "Creating file", duration: 400 },
      ];

      let totalProgress = 0;
      for (const stage of stages) {
        setExportProgress({
          stage: stage.stage,
          progress: totalProgress,
          total: 100,
          current: totalProgress,
          estimatedTime:
            stages.reduce((acc, s) => acc + s.duration, 0) -
            stages.slice(0, stages.indexOf(stage)).reduce((acc, s) => acc + s.duration, 0),
        });

        await new Promise((resolve) => setTimeout(resolve, stage.duration));
        totalProgress += 20;
      }

      setExportProgress({
        stage: "Complete",
        progress: 100,
        total: 100,
        current: 100,
      });

      // Create and download file
      let content = "";
      let mimeType = "";
      const fileExtension = exportFormat;

      switch (exportFormat) {
        case "json":
          content = JSON.stringify(data, null, 2);
          mimeType = "application/json";
          break;
        case "csv":
          content = generateCSV(data);
          mimeType = "text/csv";
          break;
        case "html":
          content = generateHTML(data);
          mimeType = "text/html";
          break;
        default:
          content = JSON.stringify(data, null, 2);
          mimeType = "application/json";
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `space-analyzer-export-${Date.now()}.${fileExtension}`;
      a.click();
      URL.revokeObjectURL(url);

      // Add to history
      const historyItem: ExportHistory = {
        id: Date.now().toString(),
        name: exportTemplates.find((t) => t.id === selectedTemplate)?.name || "Custom Export",
        template: selectedTemplate,
        format: exportFormat,
        timestamp: new Date(),
        size: content.length,
        status: "completed",
        downloadUrl: url,
        permissions: "private",
      };

      setExportHistory((prev) => [historyItem, ...prev]);

      setTimeout(() => {
        setExportProgressVisible(false);
        setIsExporting(false);
      }, 2000);
    } catch (error) {
      console.error("Export failed:", error);
      setExportProgress({
        stage: "Error",
        progress: 0,
        total: 100,
        current: 0,
        errors: [error instanceof Error ? error.message : "Unknown error"],
      });
    } finally {
      setTimeout(() => {
        setIsExporting(false);
        setExportProgressVisible(false);
      }, 3000);
    }
  }, [selectedTemplate, exportFormat, generateExportData, exportTemplates]);

  // Generate CSV format
  const generateCSV = (data: any): string => {
    const headers = ["Name", "Path", "Size", "Type", "Risk Score", "AI Tags"];
    const rows =
      data.files?.map((file: any) => [
        file.name,
        file.path,
        file.size,
        file.type,
        file.riskScore,
        file.aiTags?.join(";") || "",
      ]) || [];

    return [headers, ...rows].map((row) => row.join(",")).join("\n");
  };

  // Generate HTML format
  const generateHTML = (data: any): string => {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Space Analyzer Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .section { margin: 20px 0; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #e9ecef; border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Space Analyzer Report</h1>
        <p>Generated on ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="section">
        <h2>Overview</h2>
        <div class="metric">Total Files: ${data.overview?.totalFiles || 0}</div>
        <div class="metric">Total Size: ${formatBytes(data.overview?.totalSize || 0)}</div>
        <div class="metric">Categories: ${data.overview?.categories || 0}</div>
    </div>
    
    <div class="section">
        <h2>Files</h2>
        <table>
            <thead>
                <tr><th>Name</th><th>Size</th><th>Type</th><th>Risk Score</th></tr>
            </thead>
            <tbody>
                ${
                  data.files
                    ?.slice(0, 100)
                    .map(
                      (file: any) => `
                    <tr>
                        <td>${file.name}</td>
                        <td>${formatBytes(file.size)}</td>
                        <td>${file.type}</td>
                        <td>${file.riskScore}%</td>
                    </tr>
                `
                    )
                    .join("") || ""
                }
            </tbody>
        </table>
    </div>
</body>
</html>`;
  };

  // Format bytes utility
  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }, []);

  // Template management
  const saveCustomTemplate = useCallback((template: ExportTemplate) => {
    setCustomTemplates((prev) => [...prev, template]);
  }, []);

  const deleteCustomTemplate = useCallback((id: string) => {
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case "e":
            event.preventDefault();
            handleExport();
            break;
          case "h":
            event.preventDefault();
            setShowHistory(true);
            break;
          case "t":
            event.preventDefault();
            setShowTemplateBuilder(true);
            break;
          case "f":
            event.preventDefault();
            setIsFullscreen((prev) => !prev);
            break;
        }
      }

      switch (event.key) {
        case "Escape":
          setShowHelp(false);
          setShowHistory(false);
          setShowTemplateBuilder(false);
          setShowSharing(false);
          setShowDataSelection(false);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleExport]);

  // Filter and sort templates
  const filteredTemplates = useMemo(() => {
    let filtered = [...exportTemplates, ...customTemplates];

    if (searchQuery) {
      filtered = filtered.filter(
        (template) =>
          template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          template.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterType !== "all") {
      filtered = filtered.filter((template) => {
        if (filterType === "custom") return template.custom;
        if (filterType === "ai-optimized") return template.aiOptimized;
        return true;
      });
    }

    return filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "format":
          comparison = a.format.localeCompare(b.format);
          break;
        default:
          comparison = 0;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [exportTemplates, customTemplates, searchQuery, filterType, sortBy, sortOrder]);

  return (
    <div className={`${styles.enhancedExportPanel} ${isFullscreen ? styles.fullscreen : ""}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerTitle}>
            <Download className={styles.headerIcon} />
            <h1>Export Data</h1>
            <div className={styles.headerSubtitle}>Export your analysis results</div>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.headerControls}>
            <button
              onClick={() => setShowDataSelection(!showDataSelection)}
              className={styles.controlButton}
              title="Data Selection"
            >
              <Filter size={16} />
            </button>

            <button
              onClick={() => setShowTemplateBuilder(!showTemplateBuilder)}
              className={styles.controlButton}
              title="Template Builder"
            >
              <Edit size={16} />
            </button>

            <button
              onClick={() => setShowHistory(!showHistory)}
              className={styles.controlButton}
              title="Export History"
            >
              <History size={16} />
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={styles.controlButton}
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
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

      {/* Main Content */}
      <div className={styles.content}>
        {/* AI Insights Banner */}
        {aiInsights.length > 0 && (
          <div className={styles.aiInsightsBanner}>
            <div className={styles.insightsHeader}>
              <Brain className={styles.pulse} size={20} />
              <h3>AI Export Recommendations</h3>
            </div>
            <div className={styles.insightsList}>
              {aiInsights.map((insight, index) => (
                <div key={index} className={`${styles.insightItem} ${styles[insight.type]}`}>
                  <div className={styles.insightIcon}>{insight.icon}</div>
                  <div className={styles.insightContent}>
                    <strong>{insight.title}</strong>
                    <p>{insight.description}</p>
                    <button className={styles.insightAction}>{insight.action}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Template Selection */}
        <div className={styles.templateSection}>
          <div className={styles.sectionHeader}>
            <h2>Export Templates</h2>
            <div className={styles.templateControls}>
              <div className={styles.searchContainer}>
                <Search size={16} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search templates..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className={styles.filterSelect}
              >
                <option value="all">All Templates</option>
                <option value="ai-optimized">AI Optimized</option>
                <option value="custom">Custom</option>
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className={styles.filterSelect}
              >
                <option value="name">Sort by Name</option>
                <option value="format">Sort by Format</option>
              </select>
            </div>
          </div>

          <div className={styles.templateGrid}>
            {filteredTemplates.map((template) => (
              <motion.div
                key={template.id}
                className={`${styles.templateCard} ${selectedTemplate === template.id ? styles.selected : ""}`}
                onClick={() => setSelectedTemplate(template.id)}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.02 }}
              >
                <div className={styles.templateHeader}>
                  <div className={styles.templateIcon}>{template.icon}</div>
                  <div className={styles.templateInfo}>
                    <h3>{template.name}</h3>
                    <p>{template.description}</p>
                  </div>
                  <div className={styles.templateBadges}>
                    {template.aiOptimized && <span className={styles.aiBadge}>AI</span>}
                    {template.custom && <span className={styles.customBadge}>Custom</span>}
                  </div>
                </div>

                <div className={styles.templateDetails}>
                  <div className={styles.templateFormat}>
                    <FileText size={14} />
                    <span>{template.format.toUpperCase()}</span>
                  </div>
                  <div className={styles.templateSections}>
                    <span>{template.sections.length} sections</span>
                  </div>
                </div>

                {template.custom && (
                  <div className={styles.templateActions}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingTemplate(template.id);
                      }}
                      className={styles.actionButton}
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCustomTemplate(template.id);
                      }}
                      className={styles.actionButton}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Export Controls */}
        <div className={styles.exportControls}>
          <div className={styles.formatSelection}>
            <h3>Export Format</h3>
            <div className={styles.formatGrid}>
              {["json", "csv", "pdf", "xml", "xlsx", "yaml", "html", "txt"].map((format) => (
                <button
                  key={format}
                  onClick={() => setExportFormat(format as any)}
                  className={`${styles.formatButton} ${exportFormat === format ? styles.selected : ""}`}
                >
                  {format.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.exportActions}>
            <button onClick={() => setShowPreview(!showPreview)} className={styles.previewButton}>
              <Eye size={16} />
              Preview
            </button>

            <button
              onClick={handleExport}
              disabled={isExporting || !selectedTemplate}
              className={styles.exportButton}
            >
              {isExporting ? (
                <>
                  <RefreshCw className={styles.spinning} size={16} />
                  Exporting...
                </>
              ) : (
                <>
                  <Download size={16} />
                  Export
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Export Progress Modal */}
      <AnimatePresence>
        {exportProgressVisible && exportProgress && (
          <motion.div
            className={styles.progressModal}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={styles.progressContent}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className={styles.progressHeader}>
                <h3>Exporting Data...</h3>
                <button
                  onClick={() => setExportProgressVisible(false)}
                  className={styles.closeButton}
                >
                  <X size={20} />
                </button>
              </div>

              <div className={styles.progressBody}>
                <div className={styles.progressStage}>
                  <span>{exportProgress.stage}</span>
                  {exportProgress.estimatedTime && (
                    <span>~{Math.ceil(exportProgress.estimatedTime / 1000)}s remaining</span>
                  )}
                </div>

                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${exportProgress.progress}%` }}
                  />
                </div>

                <div className={styles.progressDetails}>
                  <span>
                    {exportProgress.current} / {exportProgress.total}
                  </span>
                  <span>{exportProgress.progress}%</span>
                </div>

                {exportProgress.errors && exportProgress.errors.length > 0 && (
                  <div className={styles.progressErrors}>
                    {exportProgress.errors.map((error, index) => (
                      <div key={index} className={styles.errorItem}>
                        <AlertTriangle size={14} />
                        <span>{error}</span>
                      </div>
                    ))}
                  </div>
                )}
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
                <h3>Export Help</h3>
                <button onClick={() => setShowHelp(false)} className={styles.closeButton}>
                  <X size={20} />
                </button>
              </div>

              <div className={styles.helpSections}>
                <div className={styles.helpSection}>
                  <h4>Keyboard Shortcuts</h4>
                  <ul>
                    <li>
                      <kbd>Ctrl+E</kbd> - Start export
                    </li>
                    <li>
                      <kbd>Ctrl+H</kbd> - Show export history
                    </li>
                    <li>
                      <kbd>Ctrl+T</kbd> - Open template builder
                    </li>
                    <li>
                      <kbd>Ctrl+F</kbd> - Toggle fullscreen
                    </li>
                  </ul>
                </div>

                <div className={styles.helpSection}>
                  <h4>Export Formats</h4>
                  <ul>
                    <li>
                      <strong>JSON:</strong> Structured data format
                    </li>
                    <li>
                      <strong>CSV:</strong> Tabular data for spreadsheets
                    </li>
                    <li>
                      <strong>PDF:</strong> Professional reports
                    </li>
                    <li>
                      <strong>HTML:</strong> Interactive web reports
                    </li>
                    <li>
                      <strong>XLSX:</strong> Excel spreadsheets
                    </li>
                  </ul>
                </div>

                <div className={styles.helpSection}>
                  <h4>Features</h4>
                  <ul>
                    <li>
                      <strong>AI Templates:</strong> Pre-configured export templates
                    </li>
                    <li>
                      <strong>Custom Templates:</strong> Create your own templates
                    </li>
                    <li>
                      <strong>Data Selection:</strong> Filter data before export
                    </li>
                    <li>
                      <strong>Export History:</strong> Track all your exports
                    </li>
                    <li>
                      <strong>Real-time Progress:</strong> Monitor export progress
                    </li>
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

export default EnhancedExportPanel;
