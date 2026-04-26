// Real-Time Complexity Monitoring Dashboard
// Tracks complexity hotspots and guides refactoring

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

interface ComplexityMetric {
  timestamp: number;
  file: string;
  complexity: number;
  lines: number;
  functions: number;
  classes: number;
  issues: number;
  risk: 'low' | 'medium' | 'high' | 'critical';
}

interface ComplexityHotspot {
  file: string;
  path: string;
  currentComplexity: number;
  previousComplexity: number;
  change: number;
  trend: 'improving' | 'stable' | 'degrading';
  risk: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  lastAnalyzed: number;
}

interface ComplexityThreshold {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export const RealTimeComplexityDashboard: React.FC<{
  data: ComplexityMetric[];
  thresholds?: Partial<ComplexityThreshold>;
  refreshInterval?: number;
  onFileSelect?: (file: string) => void;
}> = ({
  data,
  thresholds = {},
  refreshInterval = 30000,
  onFileSelect
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [selectedRisk, setSelectedRisk] = useState('all');
  const [isRealTime, setIsRealTime] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  const defaultThresholds: ComplexityThreshold = {
    low: 5,
    medium: 10,
    high: 15,
    critical: 25,
    ...thresholds
  };

  // Calculate complexity hotspots
  const complexityHotspots = useMemo(() => {
    const fileMap = new Map<string, ComplexityMetric[]>();
    
    // Group metrics by file
    data.forEach(metric => {
      if (!fileMap.has(metric.file)) {
        fileMap.set(metric.file, []);
      }
      fileMap.get(metric.file)!.push(metric);
    });

    const hotspots: ComplexityHotspot[] = [];
    
    fileMap.forEach((metrics, file) => {
      const sorted = metrics.sort((a, b) => a.timestamp - b.timestamp);
      const current = sorted[sorted.length - 1];
      const previous = sorted[sorted.length - 2] || current;
      
      const change = current.complexity - previous.complexity;
      let trend: 'improving' | 'stable' | 'degrading' = 'stable';
      
      if (change < -2) trend = 'improving';
      else if (change > 2) trend = 'degrading';
      
      let risk: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (current.complexity >= defaultThresholds.critical) risk = 'critical';
      else if (current.complexity >= defaultThresholds.high) risk = 'high';
      else if (current.complexity >= defaultThresholds.medium) risk = 'medium';
      
      const recommendations = generateRecommendations(current, change, risk);
      
      hotspots.push({
        file,
        path: file,
        currentComplexity: current.complexity,
        previousComplexity: previous.complexity,
        change,
        trend,
        risk,
        recommendations,
        lastAnalyzed: current.timestamp
      });
    });
    
    return hotspots.sort((a, b) => b.currentComplexity - a.currentComplexity);
  }, [data, defaultThresholds]);

  // Generate recommendations based on complexity
  const generateRecommendations = (metric: ComplexityMetric, change: number, risk: string): string[] => {
    const recommendations: string[] = [];
    
    if (risk === 'critical') {
      recommendations.push('Immediate refactoring required - complexity is critical');
      recommendations.push('Consider breaking down into smaller functions');
      recommendations.push('Reduce nesting levels and control flow complexity');
    } else if (risk === 'high') {
      recommendations.push('High complexity detected - plan refactoring');
      recommendations.push('Extract complex logic into separate functions');
      recommendations.push('Consider design patterns to simplify structure');
    } else if (risk === 'medium') {
      recommendations.push('Monitor complexity trends');
      recommendations.push('Consider minor refactoring opportunities');
    }
    
    if (change > 5) {
      recommendations.push('Complexity is increasing rapidly - investigate recent changes');
    } else if (change < -5) {
      recommendations.push('Great progress! Complexity is decreasing');
    }
    
    if (metric.functions > 20) {
      recommendations.push('Too many functions - consider splitting into modules');
    }
    
    if (metric.classes > 10) {
      recommendations.push('Large class detected - apply Single Responsibility Principle');
    }
    
    return recommendations;
  };

  // Filter hotspots based on selected criteria
  const filteredHotspots = useMemo(() => {
    let filtered = complexityHotspots;
    
    if (selectedRisk !== 'all') {
      filtered = filtered.filter(h => h.risk === selectedRisk);
    }
    
    // Filter by time range
    const cutoff = getTimeRangeCutoff(selectedTimeRange);
    filtered = filtered.filter(h => h.lastAnalyzed >= cutoff);
    
    return filtered;
  }, [complexityHotspots, selectedRisk, selectedTimeRange]);

  // Calculate time range cutoff
  const getTimeRangeCutoff = (range: string): number => {
    const now = Date.now();
    switch (range) {
      case '1h': return now - 60 * 60 * 1000;
      case '6h': return now - 6 * 60 * 60 * 1000;
      case '24h': return now - 24 * 60 * 60 * 1000;
      case '7d': return now - 7 * 24 * 60 * 60 * 1000;
      case '30d': return now - 30 * 24 * 60 * 60 * 1000;
      default: return now - 24 * 60 * 60 * 1000;
    }
  };

  // Calculate risk distribution
  const riskDistribution = useMemo(() => {
    const distribution = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    
    complexityHotspots.forEach(hotspot => {
      distribution[hotspot.risk]++;
    });
    
    return Object.entries(distribution).map(([risk, count]) => ({
      risk,
      count,
      percentage: (count / complexityHotspots.length) * 100
    }));
  }, [complexityHotspots]);

  // Calculate trend data
  const trendData = useMemo(() => {
    const timeMap = new Map<number, { total: number; count: number; files: string[] }>();
    
    data.forEach(metric => {
      const hour = Math.floor(metric.timestamp / (60 * 60 * 1000)) * (60 * 60 * 1000);
      
      if (!timeMap.has(hour)) {
        timeMap.set(hour, { total: 0, count: 0, files: [] });
      }
      
      const entry = timeMap.get(hour)!;
      entry.total += metric.complexity;
      entry.count++;
      if (!entry.files.includes(metric.file)) {
        entry.files.push(metric.file);
      }
    });
    
    return Array.from(timeMap.entries())
      .map(([timestamp, data]) => ({
        timestamp,
        avgComplexity: data.total / data.count,
        fileCount: data.files.length,
        totalComplexity: data.total
      }))
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-24); // Last 24 data points
  }, [data]);

  // Auto-refresh effect
  useEffect(() => {
    if (!isRealTime) return;
    
    const interval = setInterval(() => {
      setLastUpdate(Date.now());
      // In real implementation, this would fetch new data
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [isRealTime, refreshInterval]);

  const getRiskColor = (risk: string): string => {
    switch (risk) {
      case 'critical': return '#F44336';
      case 'high': return '#FF9800';
      case 'medium': return '#FFC107';
      case 'low': return '#4CAF50';
      default: return '#9E9E9E';
    }
  };

  const getTrendIcon = (trend: string): string => {
    switch (trend) {
      case 'improving': return '📉';
      case 'degrading': return '📈';
      case 'stable': return '➡️';
      default: return '➡️';
    }
  };

  return (
    <div className="real-time-complexity-dashboard">
      <div className="dashboard-header">
        <h2>🔍 Real-Time Complexity Monitoring</h2>
        <div className="header-controls">
          <div className="time-range-selector">
            <label>Time Range:</label>
            <select value={selectedTimeRange} onChange={(e) => setSelectedTimeRange(e.target.value)}>
              <option value="1h">Last Hour</option>
              <option value="6h">Last 6 Hours</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          
          <div className="risk-filter">
            <label>Risk Level:</label>
            <select value={selectedRisk} onChange={(e) => setSelectedRisk(e.target.value)}>
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          
          <div className="real-time-toggle">
            <label>
              <input
                type="checkbox"
                checked={isRealTime}
                onChange={(e) => setIsRealTime(e.target.checked)}
              />
              Real-Time Updates
            </label>
          </div>
          
          <div className="last-update">
            Last Update: {new Date(lastUpdate).toLocaleTimeString()}
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Overview Cards */}
        <div className="overview-section">
          <div className="metric-card">
            <h3>Total Files</h3>
            <div className="metric-value">{complexityHotspots.length}</div>
            <div className="metric-change">+2.3%</div>
          </div>
          
          <div className="metric-card">
            <h3>Avg Complexity</h3>
            <div className="metric-value">
              {(complexityHotspots.reduce((sum, h) => sum + h.currentComplexity, 0) / complexityHotspots.length).toFixed(1)}
            </div>
            <div className="metric-change negative">-1.2%</div>
          </div>
          
          <div className="metric-card">
            <h3>Critical Files</h3>
            <div className="metric-value critical">
              {complexityHotspots.filter(h => h.risk === 'critical').length}
            </div>
            <div className="metric-change positive">-5.1%</div>
          </div>
          
          <div className="metric-card">
            <h3>High Risk Files</h3>
            <div className="metric-value high">
              {complexityHotspots.filter(h => h.risk === 'high').length}
            </div>
            <div className="metric-change negative">+2.8%</div>
          </div>
        </div>

        {/* Risk Distribution */}
        <div className="chart-section">
          <h3>Risk Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={riskDistribution}
                dataKey="count"
                nameKey="risk"
                cx="50%"
                cy="50%"
                outerRadius={80}
                // @ts-ignore - risk, percentage properties
                label={({ risk, percentage }: any) => `${risk}: ${percentage.toFixed(1)}%`}
              >
                {riskDistribution.map((entry, index) => (
                  <Cell key={index} fill={getRiskColor(entry.risk)} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Complexity Trend */}
        <div className="chart-section">
          <h3>Complexity Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="timestamp" 
                tickFormatter={(value) => new Date(value).toLocaleTimeString()}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleString()}
                formatter={(value, name) => [
                  typeof value === 'number' ? value.toFixed(1) : value,
                  name === 'avgComplexity' ? 'Avg Complexity' : 'File Count'
                ]}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="avgComplexity" 
                stroke="#4A90E2" 
                strokeWidth={2}
                name="Average Complexity"
              />
              <Line 
                type="monotone" 
                dataKey="fileCount" 
                stroke="#7ED321" 
                strokeWidth={2}
                name="File Count"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Complexity Hotspots */}
        <div className="hotspots-section">
          <h3>Complexity Hotspots</h3>
          <div className="hotspots-list">
            {filteredHotspots.slice(0, 10).map((hotspot, index) => (
              <div 
                key={hotspot.file} 
                className={`hotspot-item ${hotspot.risk}`}
                onClick={() => onFileSelect?.(hotspot.file)}
              >
                <div className="hotspot-header">
                  <div className="hotspot-file">{hotspot.file}</div>
                  <div className="hotspot-metrics">
                    <span className="complexity">{hotspot.currentComplexity}</span>
                    <span className="trend">{getTrendIcon(hotspot.trend)}</span>
                    <span className="change">
                      {hotspot.change > 0 ? '+' : ''}{hotspot.change}
                    </span>
                  </div>
                </div>
                
                <div className="hotspot-details">
                  <div className="risk-indicator" style={{ backgroundColor: getRiskColor(hotspot.risk) }}></div>
                  <span className="risk-label">{hotspot.risk.toUpperCase()}</span>
                  <span className="last-analyzed">
                    {new Date(hotspot.lastAnalyzed).toLocaleTimeString()}
                  </span>
                </div>
                
                {hotspot.recommendations.length > 0 && (
                  <div className="recommendations">
                    <div className="recommendations-header">Recommendations:</div>
                    {hotspot.recommendations.slice(0, 2).map((rec, i) => (
                      <div key={i} className="recommendation">• {rec}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {filteredHotspots.length > 10 && (
            <div className="show-more">
              Showing 10 of {filteredHotspots.length} hotspots
            </div>
          )}
        </div>

        {/* Threshold Configuration */}
        <div className="threshold-section">
          <h3>Complexity Thresholds</h3>
          <div className="threshold-config">
            <div className="threshold-item">
              <label>Low:</label>
              <input
                type="number"
                value={defaultThresholds.low}
                onChange={(e) => {/* Update threshold */}}
              />
            </div>
            <div className="threshold-item">
              <label>Medium:</label>
              <input
                type="number"
                value={defaultThresholds.medium}
                onChange={(e) => {/* Update threshold */}}
              />
            </div>
            <div className="threshold-item">
              <label>High:</label>
              <input
                type="number"
                value={defaultThresholds.high}
                onChange={(e) => {/* Update threshold */}}
              />
            </div>
            <div className="threshold-item">
              <label>Critical:</label>
              <input
                type="number"
                value={defaultThresholds.critical}
                onChange={(e) => {/* Update threshold */}}
              />
            </div>
          </div>
        </div>
      </div>

      {/* @ts-ignore - jsx prop */}
      <style jsx>{`
        .real-time-complexity-dashboard {
          padding: 20px;
          background: #f5f5f5;
          min-height: 100vh;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          padding: 20px;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .dashboard-header h2 {
          margin: 0;
          color: #333;
        }

        .header-controls {
          display: flex;
          gap: 20px;
          align-items: center;
        }

        .header-controls label {
          margin-right: 8px;
          font-weight: 500;
        }

        .header-controls select {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
        }

        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
        }

        .overview-section {
          grid-column: span 4;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }

        .metric-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          text-align: center;
        }

        .metric-card h3 {
          margin: 0 0 10px 0;
          color: #666;
          font-size: 14px;
        }

        .metric-value {
          font-size: 32px;
          font-weight: bold;
          color: #333;
          margin-bottom: 5px;
        }

        .metric-value.critical {
          color: #F44336;
        }

        .metric-value.high {
          color: #FF9800;
        }

        .metric-change {
          font-size: 12px;
          color: #666;
        }

        .metric-change.positive {
          color: #4CAF50;
        }

        .metric-change.negative {
          color: #F44336;
        }

        .chart-section, .hotspots-section, .threshold-section {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .chart-section h3, .hotspots-section h3, .threshold-section h3 {
          margin: 0 0 20px 0;
          color: #333;
        }

        .hotspots-list {
          max-height: 500px;
          overflow-y: auto;
        }

        .hotspot-item {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 10px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .hotspot-item:hover {
          box-shadow: 0 4px 8px rgba(0,0,0,0.1);
          transform: translateY(-2px);
        }

        .hotspot-item.critical {
          border-left: 4px solid #F44336;
        }

        .hotspot-item.high {
          border-left: 4px solid #FF9800;
        }

        .hotspot-item.medium {
          border-left: 4px solid #FFC107;
        }

        .hotspot-item.low {
          border-left: 4px solid #4CAF50;
        }

        .hotspot-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .hotspot-file {
          font-weight: 500;
          color: #333;
        }

        .hotspot-metrics {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .complexity {
          font-size: 18px;
          font-weight: bold;
          color: #333;
        }

        .trend {
          font-size: 16px;
        }

        .change {
          font-size: 12px;
          color: #666;
        }

        .hotspot-details {
          display: flex;
          gap: 10px;
          align-items: center;
          margin-bottom: 10px;
        }

        .risk-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
        }

        .risk-label {
          font-size: 12px;
          font-weight: bold;
          text-transform: uppercase;
        }

        .last-analyzed {
          font-size: 12px;
          color: #666;
          margin-left: auto;
        }

        .recommendations {
          background: #f8f9fa;
          padding: 10px;
          border-radius: 4px;
          font-size: 12px;
        }

        .recommendations-header {
          font-weight: bold;
          margin-bottom: 5px;
        }

        .recommendation {
          color: #666;
          margin-bottom: 2px;
        }

        .show-more {
          text-align: center;
          padding: 10px;
          color: #666;
          font-style: italic;
        }

        .threshold-config {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 15px;
        }

        .threshold-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .threshold-item label {
          min-width: 60px;
          font-weight: 500;
        }

        .threshold-item input {
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          width: 80px;
        }

        .last-update {
          font-size: 12px;
          color: #666;
        }
      `}</style>
    </div>
  );
};

export default RealTimeComplexityDashboard;