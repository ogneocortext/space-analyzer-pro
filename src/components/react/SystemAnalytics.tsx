import React, { useState, useEffect, useCallback } from 'react';
import {
  Monitor,
  Cpu,
  HardDrive,
  MemoryStick,
  Network,
  Activity,
  Zap,
  Thermometer,
  RefreshCw,
  Server,
  Database,
  Clock,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

interface SystemMetrics {
  cpu: {
    usage: number;
    cores: number;
    temperature?: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
    readSpeed: number;
    writeSpeed: number;
  };
  network: {
    upload: number;
    download: number;
    latency: number;
  };
  server: {
    status: 'online' | 'offline' | 'degraded';
    uptime: number;
    requests: number;
    errors: number;
  };
}

export const SystemAnalytics: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    cpu: { usage: 0, cores: navigator.hardwareConcurrency || 4 },
    memory: { used: 0, total: 0, percentage: 0 },
    disk: { used: 0, total: 0, percentage: 0, readSpeed: 0, writeSpeed: 0 },
    network: { upload: 0, download: 0, latency: 0 },
    server: { status: 'online', uptime: 0, requests: 0, errors: 0 }
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  // Fetch memory info from browser
  const getMemoryInfo = useCallback(() => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.jsHeapSizeLimit,
        percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100
      };
    }
    return { used: 0, total: 0, percentage: 0 };
  }, []);

  // Fetch system metrics from backend
  const fetchSystemMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/system/metrics');
      if (response.ok) {
        const data = await response.json();
        return {
          cpu: data.cpu,
          memory: data.memory,
          disk: data.disk,
          system: data.system,
          process: data.process
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch system metrics:', error);
      return null;
    }
  }, []);

  // Fetch backend server status
  const fetchServerStatus = useCallback(async () => {
    try {
      const startTime = Date.now();
      const response = await fetch('/api/health');
      const latency = Date.now() - startTime;
      
      if (response.ok) {
        const data = await response.json();
        return {
          status: 'online' as const,
          uptime: data.uptime || 0,
          requests: data.requests || 0,
          errors: data.errors || 0,
          latency
        };
      }
      return { status: 'degraded' as const, uptime: 0, requests: 0, errors: 1, latency: 0 };
    } catch (error) {
      return { status: 'offline' as const, uptime: 0, requests: 0, errors: 1, latency: 0 };
    }
  }, []);

  // Update metrics
  const updateMetrics = useCallback(async () => {
    const systemMetrics = await fetchSystemMetrics();
    const server = await fetchServerStatus();

    if (systemMetrics) {
      setMetrics(prev => ({
        cpu: {
          usage: systemMetrics.cpu.usage,
          cores: systemMetrics.cpu.cores,
          temperature: undefined
        },
        memory: {
          used: systemMetrics.memory.used,
          total: systemMetrics.memory.total,
          percentage: systemMetrics.memory.percentage
        },
        disk: {
          used: systemMetrics.disk.used,
          total: systemMetrics.disk.total,
          percentage: systemMetrics.disk.percentage,
          readSpeed: 0, // Disk I/O requires continuous monitoring
          writeSpeed: 0
        },
        network: {
          upload: 0,
          download: 0,
          latency: server.latency
        },
        server
      }));
    }
    setLastUpdate(Date.now());
    setIsLoading(false);
  }, [fetchSystemMetrics, fetchServerStatus]);

  // Initial load and periodic updates
  useEffect(() => {
    updateMetrics();
    const interval = setInterval(updateMetrics, 5000);
    return () => clearInterval(interval);
  }, [updateMetrics]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'text-green-400';
      case 'offline': return 'text-red-400';
      case 'degraded': return 'text-yellow-400';
      default: return 'text-slate-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <CheckCircle size={16} className="text-green-400" />;
      case 'offline': return <AlertTriangle size={16} className="text-red-400" />;
      case 'degraded': return <AlertTriangle size={16} className="text-yellow-400" />;
      default: return <Activity size={16} className="text-slate-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-white">
        <RefreshCw className="animate-spin mr-2" />
        <span>Loading system metrics...</span>
      </div>
    );
  }

  return (
    <div className="p-8 text-white">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Monitor className="w-8 h-8 text-cyan-400" />
          System Analytics
        </h1>
        <p className="text-slate-400 text-lg">
          Real-time resource monitoring and system health
        </p>
        <div className="flex items-center gap-4 mt-4 text-sm text-slate-400">
          <span className="flex items-center gap-2">
            <Clock size={14} />
            Last updated: {new Date(lastUpdate).toLocaleTimeString()}
          </span>
          <button
            onClick={updateMetrics}
            className="flex items-center gap-2 hover:text-cyan-400 transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      {/* Server Status */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-400" />
            Backend Server Status
          </h2>
          <div className={`flex items-center gap-2 ${getStatusColor(metrics.server.status)}`}>
            {getStatusIcon(metrics.server.status)}
            <span className="capitalize">{metrics.server.status}</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-700/50 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">Uptime</div>
            <div className="text-2xl font-bold text-white">{formatUptime(metrics.server.uptime)}</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">Total Requests</div>
            <div className="text-2xl font-bold text-white">{metrics.server.requests.toLocaleString()}</div>
          </div>
          <div className="bg-slate-700/50 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">Errors</div>
            <div className="text-2xl font-bold text-red-400">{metrics.server.errors}</div>
          </div>
        </div>
      </div>

      {/* Resource Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* CPU */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Cpu className="w-6 h-6 text-cyan-400" />
            <h3 className="text-lg font-semibold">CPU</h3>
          </div>
          <div className="text-3xl font-bold text-cyan-400 mb-2">{metrics.cpu.usage.toFixed(1)}%</div>
          <div className="text-slate-400 text-sm mb-4">{metrics.cpu.cores} cores</div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-cyan-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${metrics.cpu.usage}%` }}
            />
          </div>
        </div>

        {/* Memory */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <MemoryStick className="w-6 h-6 text-purple-400" />
            <h3 className="text-lg font-semibold">Memory</h3>
          </div>
          <div className="text-3xl font-bold text-purple-400 mb-2">
            {metrics.memory.percentage.toFixed(1)}%
          </div>
          <div className="text-slate-400 text-sm mb-4">
            {formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div
              className="bg-purple-400 h-2 rounded-full transition-all duration-500"
              style={{ width: `${metrics.memory.percentage}%` }}
            />
          </div>
        </div>

        {/* Disk */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <HardDrive className="w-6 h-6 text-green-400" />
            <h3 className="text-lg font-semibold">Disk I/O</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Read</span>
              <span className="text-green-400">{metrics.disk.readSpeed} MB/s</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Write</span>
              <span className="text-blue-400">{metrics.disk.writeSpeed} MB/s</span>
            </div>
          </div>
        </div>

        {/* Network */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Network className="w-6 h-6 text-orange-400" />
            <h3 className="text-lg font-semibold">Network</h3>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Latency</span>
              <span className="text-orange-400">{metrics.network.latency}ms</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Status</span>
              <span className={metrics.network.latency < 100 ? 'text-green-400' : 'text-yellow-400'}>
                {metrics.network.latency < 100 ? 'Good' : 'Slow'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Trends */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-cyan-400" />
          Performance Summary
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center gap-3 p-4 bg-slate-700/50 rounded-lg">
            <Zap className="w-8 h-8 text-yellow-400" />
            <div>
              <div className="text-slate-400 text-sm">System Load</div>
              <div className="text-lg font-bold text-white">
                {((metrics.cpu.usage + metrics.memory.percentage) / 2).toFixed(1)}%
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-slate-700/50 rounded-lg">
            <Database className="w-8 h-8 text-blue-400" />
            <div>
              <div className="text-slate-400 text-sm">Memory Efficiency</div>
              <div className="text-lg font-bold text-white">
                {metrics.memory.percentage < 80 ? 'Good' : 'High'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-slate-700/50 rounded-lg">
            <TrendingUp className="w-8 h-8 text-green-400" />
            <div>
              <div className="text-slate-400 text-sm">Disk Performance</div>
              <div className="text-lg font-bold text-white">
                {metrics.disk.readSpeed + metrics.disk.writeSpeed} MB/s
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-slate-700/50 rounded-lg">
            <Thermometer className="w-8 h-8 text-red-400" />
            <div>
              <div className="text-slate-400 text-sm">System Health</div>
              <div className="text-lg font-bold text-white">
                {metrics.server.status === 'online' ? 'Healthy' : 'Warning'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
