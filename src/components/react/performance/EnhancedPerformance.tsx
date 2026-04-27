import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  Cpu,
  HardDrive,
  Wifi,
  Monitor,
  Server,
  Database,
  Zap,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Settings,
  Download,
  Upload,
  Calendar,
  Clock,
  BarChart3,
  PieChart,
  LineChart,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  HelpCircle,
  X,
  Bell,
  Filter,
  Search,
  Info,
  Shield,
  Target,
  Gauge,
  Timer,
  Wind,
  Power,
  Thermometer,
  MemoryStick,
  Network,
  Trash2,
} from "lucide-react";
import styles from "./EnhancedPerformance.module.css";

interface PerformanceMetrics {
  cpu: {
    usage: number;
    cores: number;
    temperature?: number;
    processes: number;
  };
  memory: {
    total: number;
    used: number;
    available: number;
    usage: number;
    swap: {
      total: number;
      used: number;
    };
  };
  disk: {
    total: number;
    used: number;
    available: number;
    readSpeed: number;
    writeSpeed: number;
    iops: number;
  };
  network: {
    upload: number;
    download: number;
    latency: number;
    packets: {
      sent: number;
      received: number;
      errors: number;
    };
  };
  system: {
    uptime: number;
    loadAverage: number[];
    processes: number;
    threads: number;
  };
  timestamp: Date;
}

interface PerformanceAlert {
  id: string;
  type: "warning" | "critical" | "info" | "success";
  metric: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  acknowledged: boolean;
}

interface PerformanceHistory {
  timestamp: Date;
  metrics: PerformanceMetrics;
}

interface EnhancedPerformanceProps {
  className?: string;
}

const EnhancedPerformance: React.FC<EnhancedPerformanceProps> = ({ className = "" }) => {
  // State management
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [history, setHistory] = useState<PerformanceHistory[]>([]);
  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<"1h" | "6h" | "24h" | "7d" | "30d">(
    "1h"
  );
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [showAlerts, setShowAlerts] = useState(true);
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(
    new Set(["cpu", "memory", "disk", "network"])
  );
  const [viewMode, setViewMode] = useState<"overview" | "detailed" | "history" | "alerts">(
    "overview"
  );
  const [showDetails, setShowDetails] = useState(false);

  const refreshIntervalRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Generate mock performance data
  const generateMockMetrics = useCallback((): PerformanceMetrics => {
    const now = new Date();

    return {
      cpu: {
        usage: 45 + Math.random() * 30,
        cores: 8,
        temperature: 45 + Math.random() * 20,
        processes: Math.floor(100 + Math.random() * 200),
      },
      memory: {
        total: 16384,
        used: 8192 + Math.random() * 4096,
        available: 4096 - Math.random() * 2048,
        usage: 50 + Math.random() * 30,
        swap: {
          total: 4096,
          used: 1024 + Math.random() * 1024,
        },
      },
      disk: {
        total: 1000000,
        used: 450000 + Math.random() * 100000,
        available: 550000 - Math.random() * 50000,
        readSpeed: 100 + Math.random() * 50,
        writeSpeed: 80 + Math.random() * 40,
        iops: 150 + Math.random() * 100,
      },
      network: {
        upload: 10 + Math.random() * 20,
        download: 50 + Math.random() * 30,
        latency: 10 + Math.random() * 20,
        packets: {
          sent: 1000 + Math.random() * 500,
          received: 2000 + Math.random() * 1000,
          errors: Math.floor(Math.random() * 10),
        },
      },
      system: {
        uptime: Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
        loadAverage: [
          1.2 + Math.random() * 0.8,
          1.1 + Math.random() * 0.7,
          1.0 + Math.random() * 0.6,
        ],
        processes: Math.floor(150 + Math.random() * 100),
        threads: 16,
      },
      timestamp: now,
    };
  }, []);

  // Generate mock alerts
  const generateMockAlerts = useCallback(
    (currentMetrics: PerformanceMetrics): PerformanceAlert[] => {
      const alerts: PerformanceAlert[] = [];

      if (currentMetrics.cpu.usage > 80) {
        alerts.push({
          id: `cpu-${Date.now()}`,
          type: "critical",
          metric: "CPU",
          message: "CPU usage is critically high",
          value: currentMetrics.cpu.usage,
          threshold: 80,
          timestamp: new Date(),
          acknowledged: false,
        });
      } else if (currentMetrics.cpu.usage > 70) {
        alerts.push({
          id: `cpu-${Date.now()}`,
          type: "warning",
          metric: "CPU",
          message: "CPU usage is elevated",
          value: currentMetrics.cpu.usage,
          threshold: 70,
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      if (currentMetrics.memory.usage > 85) {
        alerts.push({
          id: `memory-${Date.now()}`,
          type: "critical",
          metric: "Memory",
          message: "Memory usage is critically high",
          value: currentMetrics.memory.usage,
          threshold: 85,
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      if (currentMetrics.disk.iops > 200) {
        alerts.push({
          id: `disk-${Date.now()}`,
          type: "warning",
          metric: "Disk I/O",
          message: "Disk I/O is elevated",
          value: currentMetrics.disk.iops,
          threshold: 200,
          timestamp: new Date(),
          acknowledged: false,
        });
      }

      return alerts;
    },
    []
  );

  // Fetch performance data
  const fetchPerformanceData = useCallback(async () => {
    setIsLoading(true);

    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));

      const newMetrics = generateMockMetrics();
      const newAlerts = generateMockAlerts(newMetrics);

      setMetrics(newMetrics);
      setAlerts((prev) => [...newAlerts, ...prev]);

      // Add to history
      setHistory((prev) => {
        const newHistory = [...prev, { timestamp: new Date(), metrics: newMetrics }];
        return newHistory.slice(-1000); // Keep last 1000 records
      });
    } catch (error) {
      console.error("Failed to fetch performance data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [generateMockMetrics, generateMockAlerts]);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        fetchPerformanceData();
      }, refreshInterval);
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
  }, [autoRefresh, refreshInterval, fetchPerformanceData]);

  // Initial data fetch
  useEffect(() => {
    fetchPerformanceData();
  }, [fetchPerformanceData]);

  // Calculate unacknowledged alerts
  const unacknowledgedAlerts = useMemo(() => {
    return alerts.filter((alert) => !alert.acknowledged);
  }, [alerts]);

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!metrics) return null;

    const alertsByType = alerts.reduce(
      (acc, alert) => {
        acc[alert.type] = (acc[alert.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      totalAlerts: alerts.length,
      criticalAlerts: alertsByType.critical || 0,
      warningAlerts: alertsByType.warning || 0,
      infoAlerts: alertsByType.info || 0,
      successAlerts: alertsByType.success || 0,
      unacknowledgedAlerts: unacknowledgedAlerts.length,
      avgCpuUsage: history.reduce((sum, h) => sum + h.metrics.cpu.usage, 0) / history.length || 0,
      avgMemoryUsage:
        history.reduce((sum, h) => sum + h.metrics.memory.usage, 0) / history.length || 0,
      avgDiskIO: history.reduce((sum, h) => sum + h.metrics.disk.iops, 0) / history.length || 0,
    };
  }, [metrics, alerts, history, unacknowledgedAlerts]);

  // Format bytes
  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }, []);

  // Format time
  const formatTime = useCallback((ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }, []);

  // Get status color
  const getStatusColor = useCallback(
    (value: number, thresholds: { warning: number; critical: number }): string => {
      if (value >= thresholds.critical) return styles.critical;
      if (value >= thresholds.warning) return styles.warning;
      return styles.normal;
    },
    []
  );

  // Get status icon
  const getStatusIcon = useCallback(
    (value: number, thresholds: { warning: number; critical: number }) => {
      if (value >= thresholds.critical) return AlertTriangle;
      if (value >= thresholds.warning) return TrendingUp;
      return CheckCircle;
    },
    []
  );

  // Acknowledge alert
  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) => (alert.id === alertId ? { ...alert, acknowledged: true } : alert))
    );
  }, []);

  // Clear all alerts
  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case "r":
            event.preventDefault();
            fetchPerformanceData();
            break;
          case "f":
            event.preventDefault();
            setIsFullscreen((prev) => !prev);
            break;
          case "a":
            event.preventDefault();
            setAutoRefresh((prev) => !prev);
            break;
          case "h":
            event.preventDefault();
            setShowHelp(true);
            break;
        }
      }

      switch (event.key) {
        case "Escape":
          setShowHelp(false);
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [fetchPerformanceData, setIsFullscreen, setAutoRefresh, setShowHelp]);

  return (
    <div
      className={`${styles.enhancedPerformance} ${isFullscreen ? styles.fullscreen : ""} ${className}`}
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerTitle}>
            <Activity className={styles.headerIcon} />
            <h1>Performance</h1>
            <div className={styles.headerSubtitle}>System performance metrics</div>
          </div>
        </div>

        <div className={styles.headerRight}>
          <div className={styles.headerControls}>
            <button
              onClick={() => setShowAlerts(!showAlerts)}
              className={`${styles.controlButton} ${showAlerts ? styles.active : ""}`}
              title="Toggle Alerts"
            >
              <Bell size={16} />
            </button>

            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`${styles.controlButton} ${autoRefresh ? styles.active : ""}`}
              title="Toggle Auto Refresh"
            >
              <RefreshCw className={autoRefresh ? styles.spinning : ""} size={16} />
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

          <div className={styles.refreshInfo}>
            <Clock size={14} />
            <span>
              Updated: {metrics ? formatTime(Date.now() - metrics.timestamp.getTime()) : "Never"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={styles.content}>
        {/* View Mode Selector */}
        <div className={styles.viewModeSelector}>
          <button
            onClick={() => setViewMode("overview")}
            className={`${styles.viewModeButton} ${viewMode === "overview" ? styles.active : ""}`}
          >
            <BarChart3 size={16} />
            Overview
          </button>
          <button
            onClick={() => setViewMode("detailed")}
            className={`${styles.viewModeButton} ${viewMode === "detailed" ? styles.active : ""}`}
          >
            <Monitor size={16} />
            Detailed
          </button>
          <button
            onClick={() => setViewMode("history")}
            className={`${styles.viewModeButton} ${viewMode === "history" ? styles.active : ""}`}
          >
            <LineChart size={16} />
            History
          </button>
          <button
            onClick={() => setViewMode("alerts")}
            className={`${styles.viewModeButton} ${viewMode === "alerts" ? styles.active : ""}`}
          >
            <AlertTriangle size={16} />
            Alerts
          </button>
        </div>

        {/* Alerts Banner */}
        <AnimatePresence>
          {showAlerts && unacknowledgedAlerts.length > 0 && (
            <motion.div
              className={styles.alertsBanner}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className={styles.alertsHeader}>
                <Bell className={styles.alertsIcon} />
                <h3>Performance Alerts</h3>
                <span className={styles.alertsCount}>{unacknowledgedAlerts.length}</span>
              </div>
              <div className={styles.alertsList}>
                {unacknowledgedAlerts.slice(0, 3).map((alert) => (
                  <div key={alert.id} className={`${styles.alertItem} ${styles[alert.type]}`}>
                    <div className={styles.alertIcon}>
                      {React.createElement(
                        getStatusIcon(alert.value, { warning: 70, critical: 80 }),
                        { size: 20 }
                      )}
                    </div>
                    <div className={styles.alertContent}>
                      <strong>{alert.metric}</strong>
                      <span>{alert.message}</span>
                      <button
                        onClick={() => acknowledgeAlert(alert.id)}
                        className={styles.acknowledgeButton}
                      >
                        Acknowledge
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Overview View */}
        {viewMode === "overview" && metrics && (
          <div className={styles.overviewView}>
            {/* Key Metrics */}
            <div className={styles.keyMetrics}>
              <div className={styles.metricCard}>
                <div className={styles.metricHeader}>
                  <div className={styles.metricIcon}>
                    <Cpu size={24} />
                  </div>
                  <div className={styles.metricInfo}>
                    <h3>CPU Usage</h3>
                    <span className={styles.metricValue}>{metrics.cpu.usage.toFixed(1)}%</span>
                  </div>
                </div>
                <div
                  className={`${styles.progressBar} ${getStatusColor(metrics.cpu.usage, { warning: 70, critical: 80 })}`}
                >
                  <div className={styles.progressFill} style={{ width: `${metrics.cpu.usage}%` }} />
                </div>
                <div className={styles.metricDetails}>
                  <div className={styles.detailItem}>
                    <span>Cores:</span>
                    <span>{metrics.cpu.cores}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span>Processes:</span>
                    <span>{metrics.cpu.processes}</span>
                  </div>
                  {metrics.cpu.temperature && (
                    <div className={styles.detailItem}>
                      <span>Temperature:</span>
                      <span>{metrics.cpu.temperature.toFixed(1)}°C</span>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricHeader}>
                  <div className={styles.metricIcon}>
                    <MemoryStick size={24} />
                  </div>
                  <div className={styles.metricInfo}>
                    <h3>Memory Usage</h3>
                    <span className={styles.metricValue}>{metrics.memory.usage.toFixed(1)}%</span>
                  </div>
                </div>
                <div
                  className={`${styles.progressBar} ${getStatusColor(metrics.memory.usage, { warning: 85, critical: 95 })}`}
                >
                  <div
                    className={styles.progressFill}
                    style={{ width: `${metrics.memory.usage}%` }}
                  />
                </div>
                <div className={styles.metricDetails}>
                  <div className={styles.detailItem}>
                    <span>Total:</span>
                    <span>{formatBytes(metrics.memory.total)}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span>Used:</span>
                    <span>{formatBytes(metrics.memory.used)}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span>Available:</span>
                    <span>{formatBytes(metrics.memory.available)}</span>
                  </div>
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricHeader}>
                  <div className={styles.metricIcon}>
                    <HardDrive size={24} />
                  </div>
                  <div className={styles.metricInfo}>
                    <h3>Disk I/O</h3>
                    <span className={styles.metricValue}>{metrics.disk.iops.toFixed(0)} IOPS</span>
                  </div>
                </div>
                <div
                  className={`${styles.progressBar} ${getStatusColor(metrics.disk.iops, { warning: 150, critical: 200 })}`}
                >
                  <div
                    className={styles.progressFill}
                    style={{ width: `${Math.min((metrics.disk.iops / 200) * 100, 100)}%` }}
                  />
                </div>
                <div className={styles.metricDetails}>
                  <div className={styles.detailItem}>
                    <span>Read:</span>
                    <span>{formatBytes(metrics.disk.readSpeed)}/s</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span>Write:</span>
                    <span>{formatBytes(metrics.disk.writeSpeed)}/s</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span>Total:</span>
                    <span>{formatBytes(metrics.disk.total)}</span>
                  </div>
                </div>
              </div>

              <div className={styles.metricCard}>
                <div className={styles.metricHeader}>
                  <div className={styles.metricIcon}>
                    <Wifi size={24} />
                  </div>
                  <div className={styles.metricInfo}>
                    <h3>Network</h3>
                    <span className={styles.metricValue}>
                      {metrics.network.latency.toFixed(0)}ms
                    </span>
                  </div>
                </div>
                <div className={styles.networkMetrics}>
                  <div className={styles.networkMetric}>
                    <div className={styles.networkIcon}>
                      <Upload size={16} />
                    </div>
                    <div className={styles.networkInfo}>
                      <span>Upload:</span>
                      <span>{metrics.network.upload.toFixed(1)} Mbps</span>
                    </div>
                  </div>
                  <div className={styles.networkMetric}>
                    <div className={styles.networkIcon}>
                      <Download size={16} />
                    </div>
                    <div className={styles.networkInfo}>
                      <span>Download:</span>
                      <span>{metrics.network.download.toFixed(1)} Mbps</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* System Information */}
            <div className={styles.systemInfo}>
              <h3>System Information</h3>
              <div className={styles.systemGrid}>
                <div className={styles.systemItem}>
                  <span className={styles.systemLabel}>Uptime:</span>
                  <span className={styles.systemValue}>{formatTime(metrics.system.uptime)}</span>
                </div>
                <div className={styles.systemItem}>
                  <span className={styles.systemLabel}>Load Average:</span>
                  <span className={styles.systemValue}>
                    {metrics.system.loadAverage.map((load, index) => load.toFixed(2)).join(", ")}
                  </span>
                </div>
                <div className={styles.systemItem}>
                  <span className={styles.systemLabel}>Processes:</span>
                  <span className={styles.systemValue}>{metrics.system.processes}</span>
                </div>
                <div className={styles.systemItem}>
                  <span className={styles.systemLabel}>Threads:</span>
                  <span className={styles.systemValue}>{metrics.system.threads}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detailed View */}
        {viewMode === "detailed" && metrics && (
          <div className={styles.detailedView}>
            <div className={styles.detailedGrid}>
              {/* CPU Details */}
              <div className={styles.detailSection}>
                <h3>CPU Details</h3>
                <div className={styles.detailCard}>
                  <div className={styles.detailHeader}>
                    <Cpu size={20} />
                    <span>CPU Performance</span>
                  </div>
                  <div className={styles.detailContent}>
                    <div className={styles.detailRow}>
                      <span>Usage:</span>
                      <span className={styles.detailValue}>{metrics.cpu.usage.toFixed(2)}%</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Cores:</span>
                      <span>{metrics.cpu.cores}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Processes:</span>
                      <span>{metrics.cpu.processes}</span>
                    </div>
                    {metrics.cpu.temperature && (
                      <div className={styles.detailRow}>
                        <span>Temperature:</span>
                        <span>{metrics.cpu.temperature.toFixed(1)}°C</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Memory Details */}
              <div className={styles.detailSection}>
                <h3>Memory Details</h3>
                <div className={styles.detailCard}>
                  <div className={styles.detailHeader}>
                    <MemoryStick size={20} />
                    <span>Memory Usage</span>
                  </div>
                  <div className={styles.detailContent}>
                    <div className={styles.detailRow}>
                      <span>Total:</span>
                      <span>{formatBytes(metrics.memory.total)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Used:</span>
                      <span>{formatBytes(metrics.memory.used)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Available:</span>
                      <span>{formatBytes(metrics.memory.available)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Usage:</span>
                      <span>{metrics.memory.usage.toFixed(2)}%</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Swap Total:</span>
                      <span>{formatBytes(metrics.memory.swap.total)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Swap Used:</span>
                      <span>{formatBytes(metrics.memory.swap.used)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Disk Details */}
              <div className={styles.detailSection}>
                <h3>Disk Details</h3>
                <div className={styles.detailCard}>
                  <div className={styles.detailHeader}>
                    <HardDrive size={20} />
                    <span>Disk Performance</span>
                  </div>
                  <div className={styles.detailContent}>
                    <div className={styles.detailRow}>
                      <span>Total:</span>
                      <span>{formatBytes(metrics.disk.total)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Used:</span>
                      <span>{formatBytes(metrics.disk.used)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Available:</span>
                      <span>{formatBytes(metrics.disk.available)}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Read Speed:</span>
                      <span>{formatBytes(metrics.disk.readSpeed)}/s</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Write Speed:</span>
                      <span>{formatBytes(metrics.disk.writeSpeed)}/s</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>IOPS:</span>
                      <span>{metrics.disk.iops.toFixed(0)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Network Details */}
              <div className={styles.detailSection}>
                <h3>Network Details</h3>
                <div className={styles.detailCard}>
                  <div className={styles.detailHeader}>
                    <Wifi size={20} />
                    <span>Network Performance</span>
                  </div>
                  <div className={styles.detailContent}>
                    <div className={styles.detailRow}>
                      <span>Upload Speed:</span>
                      <span>{metrics.network.upload.toFixed(1)} Mbps</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Download Speed:</span>
                      <span>{metrics.network.download.toFixed(1)} Mbps</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Latency:</span>
                      <span>{metrics.network.latency.toFixed(0)} ms</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Packets Sent:</span>
                      <span>{metrics.network.packets.sent.toLocaleString()}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Packets Received:</span>
                      <span>{metrics.network.packets.received.toLocaleString()}</span>
                    </div>
                    <div className={styles.detailRow}>
                      <span>Packet Errors:</span>
                      <span>{metrics.network.packets.errors}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* History View */}
        {viewMode === "history" && (
          <div className={styles.historyView}>
            <div className={styles.historyControls}>
              <div className={styles.timeRangeSelector}>
                <button
                  onClick={() => setSelectedTimeRange("1h")}
                  className={`${styles.timeRangeButton} ${selectedTimeRange === "1h" ? styles.active : ""}`}
                >
                  1 Hour
                </button>
                <button
                  onClick={() => setSelectedTimeRange("6h")}
                  className={`${styles.timeRangeButton} ${selectedTimeRange === "6h" ? styles.active : ""}`}
                >
                  6 Hours
                </button>
                <button
                  onClick={() => setSelectedTimeRange("24h")}
                  className={`${styles.timeRangeButton} ${selectedTimeRange === "24h" ? styles.active : ""}`}
                >
                  24 Hours
                </button>
                <button
                  onClick={() => setSelectedTimeRange("7d")}
                  className={`${styles.timeRangeButton} ${selectedTimeRange === "7d" ? styles.active : ""}`}
                >
                  7 Days
                </button>
                <button
                  onClick={() => setSelectedTimeRange("30d")}
                  className={`${styles.timeRangeButton} ${selectedTimeRange === "30d" ? styles.active : ""}`}
                >
                  30 Days
                </button>
              </div>

              <div className={styles.historyActions}>
                <button onClick={fetchPerformanceData} className={styles.refreshButton}>
                  <RefreshCw size={16} />
                  Refresh
                </button>
                <button onClick={() => setHistory([])} className={styles.clearButton}>
                  <Trash2 size={16} />
                  Clear
                </button>
              </div>
            </div>

            <div className={styles.historyChart}>
              <div className={styles.chartPlaceholder}>
                <LineChart size={48} className={styles.chartIcon} />
                <h4>Performance History Chart</h4>
                <p>Interactive chart showing performance trends over {selectedTimeRange}</p>
              </div>

              <div className={styles.historyStats}>
                {statistics && (
                  <div className={styles.statsGrid}>
                    <div className={styles.statItem}>
                      <span className={styles.statValue}>{statistics.avgCpuUsage.toFixed(1)}%</span>
                      <span className={styles.statLabel}>Avg CPU</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statValue}>
                        {statistics.avgMemoryUsage.toFixed(1)}%
                      </span>
                      <span className={styles.statLabel}>Avg Memory</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statValue}>{statistics.avgDiskIO.toFixed(0)}</span>
                      <span className={styles.statLabel}>Avg IOPS</span>
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statValue}>{statistics.totalAlerts}</span>
                      <span className={styles.statLabel}>Total Alerts</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Alerts View */}
        {viewMode === "alerts" && (
          <div className={styles.alertsView}>
            <div className={styles.alertsHeader}>
              <h3>Performance Alerts</h3>
              <div className={styles.alertsActions}>
                <button onClick={clearAlerts} className={styles.clearButton}>
                  <Trash2 size={16} />
                  Clear All
                </button>
              </div>
            </div>

            <div className={styles.alertsList}>
              {alerts.length === 0 ? (
                <div className={styles.noAlerts}>
                  <CheckCircle size={48} className={styles.noAlertsIcon} />
                  <h4>No Alerts</h4>
                  <p>All systems are performing normally</p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <motion.div
                    key={alert.id}
                    className={`${styles.alertCard} ${styles[alert.type]} ${alert.acknowledged ? styles.acknowledged : ""}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <div className={styles.alertHeader}>
                      <div className={styles.alertIcon}>
                        {React.createElement(
                          getStatusIcon(alert.value, { warning: 70, critical: 80 }),
                          { size: 20 }
                        )}
                      </div>
                      <div className={styles.alertInfo}>
                        <h4>{alert.metric}</h4>
                        <span>{alert.message}</span>
                        <span className={styles.alertValue}>{alert.value.toFixed(1)}%</span>
                      </div>
                      <div className={styles.alertActions}>
                        {!alert.acknowledged && (
                          <button
                            onClick={() => acknowledgeAlert(alert.id)}
                            className={styles.acknowledgeButton}
                          >
                            Acknowledge
                          </button>
                        )}
                        <button
                          onClick={() => setAlerts((prev) => prev.filter((a) => a.id !== alert.id))}
                          className={styles.dismissButton}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                    <div className={styles.alertFooter}>
                      <span className={styles.alertTime}>{alert.timestamp.toLocaleString()}</span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
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
            <motion.div
              className={styles.helpContent}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className={styles.helpHeader}>
                <h3>Performance Monitoring Help</h3>
                <button onClick={() => setShowHelp(false)} className={styles.closeButton}>
                  <X size={20} />
                </button>
              </div>

              <div className={styles.helpSections}>
                <div className={styles.helpSection}>
                  <h4>Keyboard Shortcuts</h4>
                  <ul>
                    <li>
                      <kbd>Ctrl+R</kbd> - Refresh data
                    </li>
                    <li>
                      <kbd>Ctrl+F</kbd> - Toggle fullscreen
                    </li>
                    <li>
                      <kbd>Ctrl+A</kbd> - Toggle auto-refresh
                    </li>
                    <li>
                      <kbd>Ctrl+H</kbd> - Show help
                    </li>
                    <li>
                      <kbd>Escape</kbd> - Close help
                    </li>
                  </ul>
                </div>

                <div className={styles.helpSection}>
                  <h4>View Modes</h4>
                  <ul>
                    <li>
                      <strong>Overview:</strong> Key metrics at a glance
                    </li>
                    <li>
                      <strong>Detailed:</strong> In-depth performance breakdown
                    </li>
                    <li>
                      <strong>History:</strong> Historical performance trends
                    </li>
                    <li>
                      <strong>Alerts:</strong> Performance alerts and notifications
                    </li>
                  </ul>
                </div>

                <div className={styles.helpSection}>
                  <h4>Metrics Explained</h4>
                  <ul>
                    <li>
                      <strong>CPU Usage:</strong> Percentage of processor utilization
                    </li>
                    <li>
                      <strong>Memory Usage:</strong> RAM utilization percentage
                    </li>
                    <li>
                      <strong>Disk I/O:</strong> Input/output operations per second
                    </li>
                    <li>
                      <strong>Network:</strong> Network latency and throughput
                    </li>
                    <li>
                      <strong>Load Average:</strong> System load over time periods
                    </li>
                  </ul>
                </div>

                <div className={styles.helpSection}>
                  <h4>Alert Levels</h4>
                  <ul>
                    <li>
                      <span className={styles.critical}>Critical:</span> Immediate attention
                      required
                    </li>
                    <li>
                      <span className={styles.warning}>Warning:</span> Elevated usage detected
                    </li>
                    <li>
                      <span className={styles.normal}>Normal:</span> Operating normally
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

export default EnhancedPerformance;
