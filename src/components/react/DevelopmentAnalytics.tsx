import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useDevelopmentAnalytics } from '../hooks/useDevelopmentAnalytics';
import { Code2, TrendingUp, AlertTriangle, CheckCircle, Clock, Zap, Target, BarChart3 } from 'lucide-react';
import './DevelopmentAnalytics.css';

interface DevelopmentAnalyticsProps {
  projectPath: string;
}

const DevelopmentAnalytics: React.FC<DevelopmentAnalyticsProps> = ({ projectPath }) => {
  const [activeTab, setActiveTab] = useState<'duplication' | 'performance' | 'dependencies'>('duplication');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const { detectCodeDuplication, trackBuildPerformance, analyzeDependencies } = useDevelopmentAnalytics(projectPath);

  const [duplicationData, setDuplicationData] = useState<any>(null);
  const [performanceData, setPerformanceData] = useState<any>(null);
  const [dependencyData, setDependencyData] = useState<any>(null);

  useEffect(() => {
    const runAnalysis = async () => {
      setIsAnalyzing(true);
      try {
        // Run all analyses in parallel
        const [duplication, performance, dependencies] = await Promise.all([
          detectCodeDuplication([]),
          trackBuildPerformance(),
          analyzeDependencies()
        ]);

        setDuplicationData(duplication);
        setPerformanceData(performance);
        setDependencyData(dependencies);
      } catch (error) {
        console.error('Analysis failed:', error);
      } finally {
        setIsAnalyzing(false);
      }
    };

    runAnalysis();
  }, [detectCodeDuplication, trackBuildPerformance, analyzeDependencies]);

  const renderCodeDuplication = () => {
    if (!duplicationData) return null;

    const similarityData = duplicationData.similarFiles?.map((file: any, index: number) => ({
      name: `File ${index + 1}`,
      similarity: file.similarity * 100,
      lines: file.lines
    })) || [];

    const duplicationDistribution = [
      { name: '0-20%', value: duplicationData.duplicationRanges?.low || 0, color: '#10b981' },
      { name: '20-50%', value: duplicationData.duplicationRanges?.medium || 0, color: '#f59e0b' },
      { name: '50-80%', value: duplicationData.duplicationRanges?.high || 0, color: '#ef4444' },
      { name: '80-100%', value: duplicationData.duplicationRanges?.critical || 0, color: '#dc2626' }
    ];

    return (
      <div className="analytics-section">
        <div className="section-header">
          <h3><Code2 size={20} /> Code Duplication Analysis</h3>
          <div className="metrics-summary">
            <div className="metric">
              <span className="metric-value">{duplicationData.overallDuplication?.toFixed(1) || 0}%</span>
              <span className="metric-label">Overall Duplication</span>
            </div>
            <div className="metric">
              <span className="metric-value">{duplicationData.similarFiles?.length || 0}</span>
              <span className="metric-label">Similar Files</span>
            </div>
            <div className="metric">
              <span className="metric-value">{duplicationData.totalDuplicatedLines || 0}</span>
              <span className="metric-label">Duplicated Lines</span>
            </div>
          </div>
        </div>

        <div className="charts-grid">
          <div className="chart-container">
            <h4>Similarity Distribution</h4>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={duplicationDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {duplicationDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <h4>File Similarity Analysis</h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={similarityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="similarity" fill="#3b82f6" name="Similarity %" />
                <Bar dataKey="lines" fill="#10b981" name="Lines" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {duplicationData.recommendations?.length > 0 && (
          <div className="recommendations">
            <h4><Target size={16} /> Optimization Recommendations</h4>
            <ul>
              {duplicationData.recommendations.map((rec: string, index: number) => (
                <li key={index}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderBuildPerformance = () => {
    if (!performanceData) return null;

    const buildTimeData = performanceData.buildHistory?.map((build: any, index: number) => ({
      build: `Build ${index + 1}`,
      time: build.buildTime / 1000,
      bundleSize: build.bundleSize / (1024 * 1024),
      optimization: build.optimizationScore
    })) || [];

    const performanceMetrics = [
      { name: 'Build Time', value: performanceData.averageBuildTime / 1000, unit: 's', color: '#3b82f6' },
      { name: 'Bundle Size', value: performanceData.averageBundleSize / (1024 * 1024), unit: 'MB', color: '#10b981' },
      { name: 'Optimization', value: performanceData.optimizationScore, unit: '%', color: '#f59e0b' }
    ];

    return (
      <div className="analytics-section">
        <div className="section-header">
          <h3><Zap size={20} /> Build Performance Analysis</h3>
          <div className="metrics-summary">
            <div className="metric">
              <span className="metric-value">{(performanceData.averageBuildTime / 1000).toFixed(1)}s</span>
              <span className="metric-label">Avg Build Time</span>
            </div>
            <div className="metric">
              <span className="metric-value">{(performanceData.averageBundleSize / (1024 * 1024)).toFixed(1)}MB</span>
              <span className="metric-label">Avg Bundle Size</span>
            </div>
            <div className="metric">
              <span className="metric-value">{performanceData.optimizationScore}%</span>
              <span className="metric-label">Optimization Score</span>
            </div>
          </div>
        </div>

        <div className="charts-grid">
          <div className="chart-container">
            <h4>Build Performance Trends</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={buildTimeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="build" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="time" stroke="#3b82f6" name="Build Time (s)" />
                <Line type="monotone" dataKey="bundleSize" stroke="#10b981" name="Bundle Size (MB)" />
                <Line type="monotone" dataKey="optimization" stroke="#f59e0b" name="Optimization %" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <h4>Current Performance Metrics</h4>
            <div className="metrics-list">
              {performanceMetrics.map((metric, index) => (
                <div key={index} className="metric-item">
                  <div className="metric-info">
                    <span className="metric-name">{metric.name}</span>
                    <span className="metric-value">{metric.value.toFixed(1)}{metric.unit}</span>
                  </div>
                  <div className="metric-bar" style={{ width: `${metric.value}%`, backgroundColor: metric.color }} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {performanceData.recommendations?.length > 0 && (
          <div className="recommendations">
            <h4><TrendingUp size={16} /> Performance Improvements</h4>
            <ul>
              {performanceData.recommendations.map((rec: string, index: number) => (
                <li key={index}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  const renderDependencyAnalysis = () => {
    if (!dependencyData) return null;

    const dependencyTypes = [
      { name: 'Production', value: dependencyData.productionDependencies || 0, color: '#3b82f6' },
      { name: 'Development', value: dependencyData.devDependencies || 0, color: '#10b981' },
      { name: 'Unused', value: dependencyData.unusedDependencies?.length || 0, color: '#ef4444' },
      { name: 'Outdated', value: dependencyData.outdatedDependencies?.length || 0, color: '#f59e0b' }
    ];

    const securityIssues = dependencyData.securityIssues?.map((issue: any, index: number) => ({
      name: `Issue ${index + 1}`,
      severity: issue.severity,
      package: issue.package
    })) || [];

    return (
      <div className="analytics-section">
        <div className="section-header">
          <h3><BarChart3 size={20} /> Dependency Analysis</h3>
          <div className="metrics-summary">
            <div className="metric">
              <span className="metric-value">{dependencyData.totalDependencies || 0}</span>
              <span className="metric-label">Total Dependencies</span>
            </div>
            <div className="metric">
              <span className="metric-value">{dependencyData.unusedDependencies?.length || 0}</span>
              <span className="metric-label">Unused</span>
            </div>
            <div className="metric">
              <span className="metric-value">{dependencyData.outdatedDependencies?.length || 0}</span>
              <span className="metric-label">Outdated</span>
            </div>
          </div>
        </div>

        <div className="charts-grid">
          <div className="chart-container">
            <h4>Dependency Distribution</h4>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dependencyTypes}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dependencyTypes.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-container">
            <h4>Security Issues</h4>
            <div className="security-issues">
              {securityIssues.length > 0 ? (
                securityIssues.map((issue, index) => (
                  <div key={index} className={`security-issue ${issue.severity}`}>
                    <AlertTriangle size={14} />
                    <span>{issue.package}</span>
                    <span className="severity">{issue.severity}</span>
                  </div>
                ))
              ) : (
                <div className="no-issues">
                  <CheckCircle size={16} />
                  <span>No security issues found</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {dependencyData.recommendations?.length > 0 && (
          <div className="recommendations">
            <h4><AlertTriangle size={16} /> Dependency Optimization</h4>
            <ul>
              {dependencyData.recommendations.map((rec: string, index: number) => (
                <li key={index}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  if (isAnalyzing) {
    return (
      <div className="development-analytics loading">
        <div className="loading-spinner">
          <Clock size={24} className="animate-spin" />
          <p>Analyzing project structure...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="development-analytics">
      <div className="analytics-header">
        <h2>Development Analytics</h2>
        <p>Comprehensive analysis of your project's code quality and performance</p>
      </div>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'duplication' ? 'active' : ''}`}
          onClick={() => setActiveTab('duplication')}
        >
          <Code2 size={16} />
          Code Duplication
        </button>
        <button
          className={`tab ${activeTab === 'performance' ? 'active' : ''}`}
          onClick={() => setActiveTab('performance')}
        >
          <Zap size={16} />
          Build Performance
        </button>
        <button
          className={`tab ${activeTab === 'dependencies' ? 'active' : ''}`}
          onClick={() => setActiveTab('dependencies')}
        >
          <BarChart3 size={16} />
          Dependencies
        </button>
      </div>

      <div className="tab-content">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'duplication' && renderCodeDuplication()}
          {activeTab === 'performance' && renderBuildPerformance()}
          {activeTab === 'dependencies' && renderDependencyAnalysis()}
        </motion.div>
      </div>
    </div>
  );
};

export default DevelopmentAnalytics;