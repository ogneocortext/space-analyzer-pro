import React, { useState, useEffect, useMemo, FC } from 'react';
import { 
  Monitor, 
  Cpu, 
  HardDrive, 
  Database, // Changed from Memory to Database
  Wifi, 
  Activity, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  TrendingDown, 
  Server, 
  Thermometer,
  Battery,
  Settings,
  RefreshCw
} from 'lucide-react';

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    temperature: number;
  };
  memory: {
    total: number;
    used: number;
    available: number;
    percentage: number;
  };
  storage: {
    total: number;
    used: number;
    available: number;
    percentage: number;
  };
  network: {
    status: 'connected' | 'disconnected' | 'poor';
    speed: number;
    latency: number;
  };
  performance: {
    score: number;
    uptime: number;
    processes: number;
  };
}

interface SystemTabProps {
  onSystemAction?: (action: string, data?: any) => void;
}

export const SystemTab: FC<SystemTabProps> = ({ onSystemAction }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<'overview' | 'cpu' | 'memory' | 'storage' | 'network' | 'performance'>('overview');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  // Mock system metrics (in real app, would fetch from system APIs)
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    cpu: {
      usage: 45,
      cores: 8,
      temperature: 65
    },
    memory: {
      total: 16384,
      used: 8192,
      available: 8192,
      percentage: 50
    },
    storage: {
      total: 1024 * 1024, // 1TB
      used: 512 * 1024, // 512GB
      available: 512 * 1024, // 512GB
      percentage: 50
    },
    network: {
      status: 'connected',
      speed: 1000, // Mbps
      latency: 12 // ms
    },
    performance: {
      score: 85,
      uptime: 72, // hours
      processes: 127
    }
  });

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // Simulate system metrics updates
      setSystemMetrics(prev => ({
        ...prev,
        cpu: {
          ...prev.cpu,
          usage: Math.max(0, Math.min(100, prev.cpu.usage + (Math.random() - 0.5) * 10))
        },
        memory: {
          ...prev.memory,
          used: Math.max(0, Math.min(prev.memory.total, prev.memory.used + (Math.random() - 0.5) * 100))
        },
        performance: {
          ...prev.performance,
          score: Math.max(0, Math.min(100, prev.performance.score + (Math.random() - 0.5) * 5))
        }
      }));
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  // Manual refresh
  const refreshMetrics = async () => {
    setIsRefreshing(true);
    try {
      // Simulate API call to get fresh system metrics
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setSystemMetrics(prev => ({
        ...prev,
        cpu: {
          ...prev.cpu,
          usage: Math.random() * 100,
          temperature: 60 + Math.random() * 20
        },
        memory: {
          ...prev.memory,
          used: Math.random() * prev.memory.total,
          percentage: Math.random() * 100
        }
      }));
    } catch (error) {
      console.error('Failed to refresh system metrics:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Format bytes to readable size
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const m = k * 1024;
    const g = m * 1024;
    if (bytes >= g) {
      return (bytes / g).toFixed(2) + ' GB';
    } else if (bytes >= m) {
      return (bytes / m).toFixed(2) + ' MB';
    } else {
      return (bytes / k).toFixed(2) + ' KB';
    }
  };

  // Get status class based on value
  const getStatusClass = (value: number, thresholds: { good: number; warning: number; critical: number }) => {
    if (value <= thresholds.good) return 'good';
    if (value <= thresholds.warning) return 'warning';
    return 'critical';
  };

  // Get status color based on value (for backward compatibility)
  const getStatusColor = (value: number, thresholds: { good: number; warning: number; critical: number }) => {
    if (value <= thresholds.good) return '#22c55e';
    if (value <= thresholds.warning) return '#f59e0b';
    return '#ef4444';
  };

  // CPU status
  const getCpuStatus = (usage: number) => {
    if (usage < 50) return { status: 'Good', color: '#22c55e', class: 'good', icon: CheckCircle };
    if (usage < 80) return { status: 'Moderate', color: '#f59e0b', class: 'warning', icon: Activity };
    return { status: 'High', color: '#ef4444', class: 'critical', icon: AlertTriangle };
  };

  // Memory status
  const getMemoryStatus = (percentage: number) => {
    if (percentage < 70) return { status: 'Good', color: '#22c55e', class: 'good', icon: CheckCircle };
    if (percentage < 85) return { status: 'Moderate', color: '#f59e0b', class: 'warning', icon: Activity };
    return { status: 'High', color: '#ef4444', class: 'critical', icon: AlertTriangle };
  };

  // Storage status
  const getStorageStatus = (percentage: number) => {
    if (percentage < 70) return { status: 'Good', color: '#22c55e', class: 'good', icon: CheckCircle };
    if (percentage < 85) return { status: 'Moderate', color: '#f59e0b', class: 'warning', icon: Activity };
    return { status: 'High', color: '#ef4444', class: 'critical', icon: AlertTriangle };
  };

  // Network status
  const getNetworkStatus = (status: string, speed: number) => {
    switch (status) {
      case 'connected':
        return { status: 'Connected', color: '#22c55e', class: 'good', icon: CheckCircle };
      case 'poor':
        return { status: 'Poor Connection', color: '#ef4444', class: 'critical', icon: AlertTriangle };
      default:
        return { status: 'Disconnected', color: '#6b7280', class: 'warning', icon: Wifi };
    }
  };

  const renderOverview = () => (
    <div className="system-overview">
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <Cpu className="metric-icon" />
            <span className="metric-title">CPU</span>
          </div>
          <div className="metric-value">
            <div className={`value-display cpu-${getCpuStatus(systemMetrics.cpu.usage).class}`}>
              {systemMetrics.cpu.usage.toFixed(1)}%
            </div>
            <div className="value-label">
              {getCpuStatus(systemMetrics.cpu.usage).status}
            </div>
          </div>
          <div className="metric-details">
            <div className="detail-item">
              <span className="detail-label">Cores:</span>
              <span className="detail-value">{systemMetrics.cpu.cores}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Temp:</span>
              <span className="detail-value">{systemMetrics.cpu.temperature.toFixed(0)}°C</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <Database className="metric-icon" />
            <span className="metric-title">Memory</span>
          </div>
          <div className="metric-value">
            <div className={`value-display memory-${getMemoryStatus(systemMetrics.memory.percentage).class}`}>
              {systemMetrics.memory.percentage.toFixed(1)}%
            </div>
            <div className="value-label">
              {getMemoryStatus(systemMetrics.memory.percentage).status}
            </div>
          </div>
          <div className="metric-details">
            <div className="detail-item">
              <span className="detail-label">Used:</span>
              <span className="detail-value">{formatBytes(systemMetrics.memory.used)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Total:</span>
              <span className="detail-value">{formatBytes(systemMetrics.memory.total)}</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <HardDrive className="metric-icon" />
            <span className="metric-title">Storage</span>
          </div>
          <div className="metric-value">
            <div className={`value-display storage-${getStorageStatus(systemMetrics.storage.percentage).class}`}>
              {systemMetrics.storage.percentage.toFixed(1)}%
            </div>
            <div className="value-label">
              {getStorageStatus(systemMetrics.storage.percentage).status}
            </div>
          </div>
          <div className="metric-details">
            <div className="detail-item">
              <span className="detail-label">Used:</span>
              <span className="detail-value">{formatBytes(systemMetrics.storage.used)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Free:</span>
              <span className="detail-value">{formatBytes(systemMetrics.storage.available)}</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <Wifi className="metric-icon" />
            <span className="metric-title">Network</span>
          </div>
          <div className="metric-value">
            <div className={`value-display network-${getNetworkStatus(systemMetrics.network.status, systemMetrics.network.speed).class}`}>
              {systemMetrics.network.status}
            </div>
            <div className="value-label">
              {systemMetrics.network.speed} Mbps
            </div>
          </div>
          <div className="metric-details">
            <div className="detail-item">
              <span className="detail-label">Latency:</span>
              <span className="detail-value">{systemMetrics.network.latency}ms</span>
            </div>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <Activity className="metric-icon" />
            <span className="metric-title">Performance</span>
          </div>
          <div className="metric-value">
            <div className={`value-display performance-${getStatusClass(systemMetrics.performance.score, { good: 80, warning: 60, critical: 40 })}`}>
              {systemMetrics.performance.score.toFixed(0)}
            </div>
            <div className="value-label">Score</div>
          </div>
          <div className="metric-details">
            <div className="detail-item">
              <span className="detail-label">Uptime:</span>
              <span className="detail-value">{systemMetrics.performance.uptime}h</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Processes:</span>
              <span className="detail-value">{systemMetrics.performance.processes}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderDetailed = () => {
    switch (selectedMetric) {
      case 'cpu':
        return (
          <div className="detailed-metric">
            <div className="detailed-header">
              <Cpu className="detailed-icon" />
              <h3>CPU Usage</h3>
            </div>
            <div className="cpu-chart">
              <div className="cpu-visualization">
                <div 
                  className={`cpu-bar usage`} 
                  style={{ '--cpu-usage': `${systemMetrics.cpu.usage}%` } as React.CSSProperties}
                ></div>
                <div 
                  className={`cpu-temperature ${systemMetrics.cpu.temperature > 70 ? 'high' : 'normal'}`} 
                  style={{ '--cpu-temp-position': `${Math.min(systemMetrics.cpu.temperature, 100)}%` } as React.CSSProperties}
                ></div>
              </div>
              <div className="cpu-legend">
                <div className="legend-item">
                  <div className={`legend-color cpu-usage`}></div>
                  <span>Usage</span>
                </div>
                <div className="legend-item">
                  <div className={`legend-color cpu-temp`}></div>
                  <span>Temperature</span>
                </div>
              </div>
            </div>
            <div className="detailed-stats">
              <div className="stat-row">
                <span className="stat-label">Current Usage:</span>
                <span className="stat-value">{systemMetrics.cpu.usage.toFixed(1)}%</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Temperature:</span>
                <span className="stat-value">{systemMetrics.cpu.temperature.toFixed(1)}°C</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Cores:</span>
                <span className="stat-value">{systemMetrics.cpu.cores}</span>
              </div>
            </div>
          </div>
        );

      case 'memory':
        return (
          <div className="detailed-metric">
            <div className="detailed-header">
              <Database className="detailed-icon" />
              <h3>Memory Usage</h3>
            </div>
            <div className="memory-chart">
              <div className="memory-visualization">
                <div 
                  className="memory-bar used" 
                  style={{ '--memory-used': `${systemMetrics.memory.percentage}%` } as React.CSSProperties}
                ></div>
                <div 
                  className="memory-bar available" 
                  style={{ '--memory-available': `${100 - systemMetrics.memory.percentage}%` } as React.CSSProperties}
                ></div>
              </div>
              <div className="memory-legend">
                <div className="legend-item">
                  <div className={`legend-color memory-used`}></div>
                  <span>Used ({formatBytes(systemMetrics.memory.used)})</span>
                </div>
                <div className="legend-item">
                  <div className={`legend-color memory-available`}></div>
                  <span>Available ({formatBytes(systemMetrics.memory.available)})</span>
                </div>
              </div>
            </div>
            <div className="detailed-stats">
              <div className="stat-row">
                <span className="stat-label">Total Memory:</span>
                <span className="stat-value">{formatBytes(systemMetrics.memory.total)}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Used Memory:</span>
                <span className="stat-value">{formatBytes(systemMetrics.memory.used)}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Available:</span>
                <span className="stat-value">{formatBytes(systemMetrics.memory.available)}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Usage Percentage:</span>
                <span className="stat-value">{systemMetrics.memory.percentage.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        );

      case 'storage':
        return (
          <div className="detailed-metric">
            <div className="detailed-header">
              <HardDrive className="detailed-icon" />
              <h3>Storage Usage</h3>
            </div>
            <div className="storage-chart">
              <div className="storage-visualization">
                <div 
                  className="storage-bar used" 
                  style={{ '--storage-used': `${systemMetrics.storage.percentage}%` } as React.CSSProperties}
                ></div>
                <div 
                  className="storage-bar available" 
                  style={{ '--storage-available': `${100 - systemMetrics.storage.percentage}%` } as React.CSSProperties}
                ></div>
              </div>
              <div className="storage-legend">
                <div className="legend-item">
                  <div className={`legend-color storage-used`}></div>
                  <span>Used ({formatBytes(systemMetrics.storage.used)})</span>
                </div>
                <div className="legend-item">
                  <div className={`legend-color storage-available`}></div>
                  <span>Available ({formatBytes(systemMetrics.storage.available)})</span>
                </div>
              </div>
            </div>
            <div className="detailed-stats">
              <div className="stat-row">
                <span className="stat-label">Total Storage:</span>
                <span className="stat-value">{formatBytes(systemMetrics.storage.total)}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Used Storage:</span>
                <span className="stat-value">{formatBytes(systemMetrics.storage.used)}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Available Storage:</span>
                <span className="stat-value">{formatBytes(systemMetrics.storage.available)}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Usage Percentage:</span>
                <span className="stat-value">{systemMetrics.storage.percentage.toFixed(1)}%</span>
              </div>
            </div>
          </div>
        );

      case 'network':
        return (
          <div className="detailed-metric">
            <div className="detailed-header">
              <Wifi className="detailed-icon" />
              <h3>Network Status</h3>
            </div>
            <div className="network-status">
              <div className={`status-indicator ${systemMetrics.network.status}`}>
                <div className="status-dot"></div>
                <span className="status-text">{systemMetrics.network.status}</span>
              </div>
            </div>
            <div className="detailed-stats">
              <div className="stat-row">
                <span className="stat-label">Connection Status:</span>
                <span className={`stat-value network-${getNetworkStatus(systemMetrics.network.status, systemMetrics.network.speed).class}`}>
                  {systemMetrics.network.status}
                </span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Download Speed:</span>
                <span className="stat-value">{systemMetrics.network.speed} Mbps</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Latency:</span>
                <span className="stat-value">{systemMetrics.network.latency}ms</span>
              </div>
            </div>
          </div>
        );

      case 'performance':
        return (
          <div className="detailed-metric">
            <div className="detailed-header">
              <Activity className="detailed-icon" />
              <h3>Performance Metrics</h3>
            </div>
            <div className="performance-chart">
              <div className="performance-score">
                <div className={`score-circle performance-${getStatusClass(systemMetrics.performance.score, { good: 80, warning: 60, critical: 40 })}`}>
                  <div className="score-value">{systemMetrics.performance.score.toFixed(0)}</div>
                </div>
                <div className="score-label">Performance Score</div>
              </div>
            </div>
            <div className="detailed-stats">
              <div className="stat-row">
                <span className="stat-label">System Uptime:</span>
                <span className="stat-value">{systemMetrics.performance.uptime} hours</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Active Processes:</span>
                <span className="stat-value">{systemMetrics.performance.processes}</span>
              </div>
              <div className="stat-row">
                <span className="stat-label">Performance Status:</span>
                <span className={`stat-value performance-${getStatusClass(systemMetrics.performance.score, { good: 80, warning: 60, critical: 40 })}`}>
                  {systemMetrics.performance.score >= 80 ? 'Excellent' : systemMetrics.performance.score >= 60 ? 'Good' : 'Needs Attention'}
                </span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="system-tab">
      {/* Header */}
      <div className="system-header">
        <div className="header-content">
          <h2>
            <Monitor className="header-icon" />
            System Monitoring
          </h2>
          <p>Real-time system performance and resource monitoring</p>
        </div>
        
        <div className="header-controls">
          <button
            onClick={refreshMetrics}
            disabled={isRefreshing}
            className="refresh-btn"
          >
            <RefreshCw className={`icon ${isRefreshing ? 'spinning' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          
          <div className="auto-refresh-control">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="checkbox-input"
              />
              Auto Refresh
            </label>
            
            {autoRefresh && (
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="interval-select"
                title="Select refresh interval"
              >
                <option value={1000}>1s</option>
                <option value={2000}>2s</option>
                <option value={5000}>5s</option>
                <option value={10000}>10s</option>
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Metric Navigation */}
      <div className="metric-navigation">
        {[
          { id: 'overview', label: 'Overview', icon: Monitor },
          { id: 'cpu', label: 'CPU', icon: Cpu },
          { id: 'memory', label: 'Memory', icon: Database },
          { id: 'storage', label: 'Storage', icon: HardDrive },
          { id: 'network', label: 'Network', icon: Wifi },
          { id: 'performance', label: 'Performance', icon: Activity }
        ].map((metric) => {
          const Icon = metric.icon;
          return (
            <button
              key={metric.id}
              onClick={() => setSelectedMetric(metric.id as any)}
              className={`metric-btn ${selectedMetric === metric.id ? 'active' : ''}`}
            >
              <Icon size={20} />
              <span>{metric.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="system-content">
        {selectedMetric === 'overview' && renderOverview()}
        {selectedMetric !== 'overview' && renderDetailed()}
      </div>

      {/* Footer */}
      <div className="system-footer">
        <div className="footer-info">
          <div className="info-item">
            <span className="info-label">Last Updated:</span>
            <span className="info-value">{new Date().toLocaleString()}</span>
          </div>
          <div className="info-item">
            <span className="info-label">Refresh Rate:</span>
            <span className="info-value">{autoRefresh ? `${refreshInterval/1000}s` : 'Manual'}</span>
          </div>
        </div>
        
        <div className="footer-actions">
          <button
            onClick={() => onSystemAction?.('optimize')}
            className="action-btn primary"
          >
            <Zap className="btn-icon" />
            Optimize System
          </button>
          <button
            onClick={() => onSystemAction?.('settings')}
            className="action-btn secondary"
          >
            <Settings className="btn-icon" />
            System Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemTab;
