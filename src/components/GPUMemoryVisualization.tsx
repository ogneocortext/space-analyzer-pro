import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { useGPUMemoryVisualization } from '../hooks/useGPUMemoryVisualization';
import { Cpu, HardDrive, TrendingUp, TrendingDown, Zap, AlertTriangle, Clock, BarChart3, Activity } from 'lucide-react';
import './GPUMemoryVisualization.css';

interface ModelData {
  name: string;
  path: string;
  size: number;
  type: string;
  framework: string;
  accuracy: number;
  parameters: number;
  gpuMemory: number;
  inferenceTime: number;
  status: string;
  lastUsed: Date;
}

interface GPUMemoryVisualizationProps {
  models: ModelData[];
}

const GPUMemoryVisualization: React.FC<GPUMemoryVisualizationProps> = ({ models }) => {
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');
  const [selectedModel, setSelectedModel] = useState<ModelData | null>(null);
  
  const {
    gpuMemoryStats,
    memoryEfficiencyScore,
    optimizationSuggestions,
    getMemoryUsageForModel,
    getMemoryTrends,
    getModelPerformanceComparison
  } = useGPUMemoryVisualization(models);

  const [memoryTrends, setMemoryTrends] = useState<any[]>([]);
  const [performanceComparison, setPerformanceComparison] = useState<any[]>([]);

  useEffect(() => {
    const trends = getMemoryTrends(timeRange);
    const comparison = getModelPerformanceComparison();
    
    setMemoryTrends(trends);
    setPerformanceComparison(comparison);
  }, [timeRange, getMemoryTrends, getModelPerformanceComparison]);

  const memoryDistribution = [
    { name: 'PyTorch', value: models.filter(m => m.type === 'pytorch').reduce((sum, m) => sum + m.gpuMemory, 0), color: '#ff6b6b' },
    { name: 'TensorFlow', value: models.filter(m => m.type === 'tensorflow').reduce((sum, m) => sum + m.gpuMemory, 0), color: '#4ecdc4' },
    { name: 'ONNX', value: models.filter(m => m.type === 'onnx').reduce((sum, m) => sum + m.gpuMemory, 0), color: '#45b7d1' },
    { name: 'Custom', value: models.filter(m => m.type === 'custom').reduce((sum, m) => sum + m.gpuMemory, 0), color: '#96ceb4' }
  ];

  const formatBytes = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const renderMemoryOverview = () => (
    <div className="memory-overview">
      <div className="overview-cards">
        <div className="card">
          <div className="card-header">
            <HardDrive size={20} />
            <h3>Total Memory Usage</h3>
          </div>
          <div className="card-value">{formatBytes(gpuMemoryStats.totalUsed)}</div>
          <div className="card-change positive">
            <TrendingUp size={14} />
            <span>+12% from last hour</span>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <Activity size={20} />
            <h3>Available Memory</h3>
          </div>
          <div className="card-value">{formatBytes(gpuMemoryStats.available)}</div>
          <div className="card-change neutral">
            <span>Stable</span>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <Cpu size={20} />
            <h3>Efficiency Score</h3>
          </div>
          <div className="card-value">{memoryEfficiencyScore}%</div>
          <div className="card-change positive">
            <TrendingUp size={14} />
            <span>+5% optimization</span>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <Zap size={20} />
            <h3>Active Models</h3>
          </div>
          <div className="card-value">{models.filter(m => m.status === 'loaded').length}</div>
          <div className="card-change neutral">
            <span>{models.length} total models</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMemoryTrends = () => (
    <div className="memory-trends">
      <div className="section-header">
        <h3><Clock size={20} /> Memory Usage Trends</h3>
        <div className="time-range-selector">
          {(['1h', '24h', '7d'] as const).map(range => (
            <button
              key={range}
              className={`range-button ${timeRange === range ? 'active' : ''}`}
              onClick={() => setTimeRange(range)}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={memoryTrends}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="used" stackId="1" stroke="#8884d8" fill="#8884d8" name="Used Memory" />
            <Area type="monotone" dataKey="cached" stackId="1" stroke="#82ca9d" fill="#82ca9d" name="Cached Memory" />
            <Area type="monotone" dataKey="free" stackId="1" stroke="#ffc658" fill="#ffc658" name="Free Memory" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderModelPerformance = () => (
    <div className="model-performance">
      <div className="section-header">
        <h3><BarChart3 size={20} /> Model Performance vs Memory</h3>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={performanceComparison}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="gpuMemory" fill="#8884d8" name="GPU Memory (MB)" />
            <Bar yAxisId="right" dataKey="inferenceTime" fill="#82ca9d" name="Inference Time (ms)" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  const renderMemoryDistribution = () => (
    <div className="memory-distribution">
      <div className="section-header">
        <h3><PieChart /> Memory Distribution by Model Type</h3>
      </div>

      <div className="distribution-grid">
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={memoryDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value, percent }) => `${name}: ${formatBytes(value)} (${(percent * 100).toFixed(0)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {memoryDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="distribution-details">
          {memoryDistribution.map((type, index) => (
            <div key={index} className="type-detail">
              <div className="type-header">
                <div className="type-color" style={{ backgroundColor: type.color }} />
                <span className="type-name">{type.name}</span>
              </div>
              <div className="type-stats">
                <span className="memory-usage">{formatBytes(type.value)}</span>
                <span className="model-count">
                  {models.filter(m => m.type.toLowerCase() === type.name.toLowerCase()).length} models
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderOptimizationSuggestions = () => (
    <div className="optimization-suggestions">
      <div className="section-header">
        <h3><AlertTriangle size={20} /> Optimization Suggestions</h3>
      </div>

      <div className="suggestions-grid">
        {optimizationSuggestions.map((suggestion, index) => (
          <motion.div
            key={index}
            className="suggestion-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="suggestion-header">
              <div className="suggestion-icon">
                {suggestion.type === 'memory' && <HardDrive size={16} />}
                {suggestion.type === 'performance' && <Zap size={16} />}
                {suggestion.type === 'efficiency' && <TrendingUp size={16} />}
              </div>
              <span className="suggestion-title">{suggestion.title}</span>
            </div>
            <p className="suggestion-description">{suggestion.description}</p>
            <div className="suggestion-impact">
              <span className="impact-label">Potential Impact:</span>
              <span className="impact-value">{suggestion.impact}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderModelDetails = () => {
    if (!selectedModel) return null;

    return (
      <div className="model-details">
        <div className="details-header">
          <h3>Model Details: {selectedModel.name}</h3>
          <button onClick={() => setSelectedModel(null)} className="close-button">
            ×
          </button>
        </div>

        <div className="details-content">
          <div className="detail-section">
            <h4>Memory Usage</h4>
            <div className="memory-breakdown">
              <div className="memory-item">
                <span>GPU Memory:</span>
                <span>{formatBytes(selectedModel.gpuMemory * 1024 * 1024)}</span>
              </div>
              <div className="memory-item">
                <span>System Memory:</span>
                <span>{formatBytes(selectedModel.size)}</span>
              </div>
              <div className="memory-item">
                <span>Efficiency:</span>
                <span>{getMemoryUsageForModel(selectedModel).efficiency}%</span>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h4>Performance Metrics</h4>
            <div className="performance-metrics">
              <div className="metric">
                <span>Inference Time:</span>
                <span>{selectedModel.inferenceTime}ms</span>
              </div>
              <div className="metric">
                <span>Accuracy:</span>
                <span>{selectedModel.accuracy}%</span>
              </div>
              <div className="metric">
                <span>Parameters:</span>
                <span>{(selectedModel.parameters / 1e9).toFixed(2)}B</span>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h4>Model Information</h4>
            <div className="model-info">
              <div className="info-item">
                <span>Type:</span>
                <span>{selectedModel.type}</span>
              </div>
              <div className="info-item">
                <span>Framework:</span>
                <span>{selectedModel.framework}</span>
              </div>
              <div className="info-item">
                <span>Status:</span>
                <span className={`status ${selectedModel.status}`}>{selectedModel.status}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="gpu-memory-visualization">
      <div className="visualization-header">
        <h2>GPU Memory Visualization</h2>
        <p>Real-time monitoring and optimization insights for your AI models</p>
      </div>

      {renderMemoryOverview()}
      {renderMemoryTrends()}
      {renderModelPerformance()}
      {renderMemoryDistribution()}
      {renderOptimizationSuggestions()}
      {renderModelDetails()}
    </div>
  );
};

export default GPUMemoryVisualization;