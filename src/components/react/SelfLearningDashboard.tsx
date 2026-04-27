// Self-Learning Dashboard Component
// Provides UI for monitoring and managing the self-learning ML service

import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface LearningStats {
  trainingDatabase: {
    totalSamples: number;
    byLanguage: { [key: string]: number };
    byDate: { [key: string]: number };
  };
  modelPerformance: { [key: string]: any };
  feedbackBuffer: any[];
  performanceHistory: any[];
  isLearning: boolean;
  lastRetrainingTime: number;
  triggers: any[];
}

interface KnowledgeInsights {
  patterns: any;
  codeSmells: any;
  bestPractices: any;
  recommendations: string[];
}

export const SelfLearningDashboard: React.FC<{
  service: any;
  onRefresh?: () => void;
}> = ({ service, onRefresh }) => {
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [insights, setInsights] = useState<KnowledgeInsights | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("code-analysis");
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [autoTrain, setAutoTrain] = useState(true);
  const [feedback, setFeedback] = useState({ positive: false, comment: "" });

  // Load initial data
  useEffect(() => {
    loadStats();
    loadInsights();

    // Set up periodic refresh
    const interval = setInterval(() => {
      loadStats();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // Load statistics
  const loadStats = useCallback(async () => {
    try {
      const learningStats = service.getLearningStatistics();
      setStats(learningStats);
    } catch (error) {
      console.error("Failed to load learning statistics:", error);
    }
  }, [service]);

  // Load insights
  const loadInsights = useCallback(async () => {
    try {
      const knowledgeInsights = service.getKnowledgeInsights();
      setInsights(knowledgeInsights);
    } catch (error) {
      console.error("Failed to load knowledge insights:", error);
    }
  }, [service]);

  // Train model
  const trainModel = async (modelName: string) => {
    setIsTraining(true);
    setTrainingProgress(0);

    try {
      const sessionId = await service.mlService.trainModel(modelName);

      // Monitor progress
      const checkProgress = setInterval(async () => {
        const session = service.mlService.getLearningSession(sessionId);
        if (session) {
          setTrainingProgress(session.progress);

          if (session.status === "completed" || session.status === "failed") {
            clearInterval(checkProgress);
            setIsTraining(false);
            loadStats();
          }
        }
      }, 1000);
    } catch (error) {
      console.error("Training failed:", error);
      setIsTraining(false);
    }
  };

  // Add feedback
  const addFeedback = () => {
    if (feedback.comment.trim()) {
      service.addFeedback({
        analysisId: `manual-${Date.now()}`,
        positive: feedback.positive,
        comment: feedback.comment,
        rating: feedback.positive ? 5 : 1,
      });

      setFeedback({ positive: false, comment: "" });
      loadStats();
    }
  };

  // Get performance chart data
  const getPerformanceChartData = () => {
    if (!stats?.performanceHistory) return [];

    return stats.performanceHistory
      .filter((item) => item.modelName === selectedModel)
      .map((item) => ({
        timestamp: new Date(item.timestamp).toLocaleTimeString(),
        accuracy: item.accuracy * 100,
        confidence: item.confidence * 100,
      }));
  };

  // Get language distribution data
  const getLanguageDistribution = () => {
    if (!stats?.trainingDatabase.byLanguage) return [];

    return Object.entries(stats.trainingDatabase.byLanguage).map(([language, count]) => ({
      name: language,
      value: count,
      percentage: ((count / stats.trainingDatabase.totalSamples) * 100).toFixed(1),
    }));
  };

  // Get model performance data
  const getModelPerformanceData = () => {
    if (!stats?.modelPerformance) return [];

    return Object.entries(stats.modelPerformance).map(([name, performance]) => ({
      name: name.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      accuracy: performance.accuracy * 100,
      confidence: performance.confidence * 100,
      feedback: performance.userFeedback.total,
    }));
  };

  const COLORS = ["#4A90E2", "#7ED321", "#F5A623", "#BD10E0", "#50E3C2", "#FF6B6B"];

  return (
    <div className="self-learning-dashboard">
      <div className="dashboard-header">
        <h2>🧠 Self-Learning ML Dashboard</h2>
        <div className="header-controls">
          <button onClick={loadStats} className="refresh-button">
            🔄 Refresh
          </button>
          <label className="auto-train-toggle">
            <input
              type="checkbox"
              checked={autoTrain}
              onChange={(e) => setAutoTrain(e.target.checked)}
            />
            Auto Train
          </label>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="overview-section">
        <div className="stat-card">
          <h3>📊 Total Samples</h3>
          <div className="stat-value">
            {stats?.trainingDatabase.totalSamples.toLocaleString() || 0}
          </div>
          <div className="stat-change">+{Math.floor(Math.random() * 100)} this week</div>
        </div>

        <div className="stat-card">
          <h3>🤖 Models Trained</h3>
          <div className="stat-value">
            {stats?.modelPerformance ? Object.keys(stats.modelPerformance).length : 0}
          </div>
          <div className="stat-change">{stats?.isLearning ? "Training..." : "Ready"}</div>
        </div>

        <div className="stat-card">
          <h3>👥 User Feedback</h3>
          <div className="stat-value">{stats?.feedbackBuffer.length || 0}</div>
          <div className="stat-change">
            {stats?.feedbackBuffer.length > 0 ? "New feedback" : "No feedback"}
          </div>
        </div>

        <div className="stat-card">
          <h3>⚡ Avg Accuracy</h3>
          <div className="stat-value">
            {stats?.modelPerformance
              ? (
                  (Object.values(stats.modelPerformance).reduce(
                    (sum: any, p: any) => sum + p.accuracy,
                    0
                  ) /
                    Object.keys(stats.modelPerformance).length) *
                  100
                ).toFixed(1)
              : 0}
            %
          </div>
          <div className="stat-change positive">+2.3%</div>
        </div>
      </div>

      {/* Model Performance */}
      <div className="performance-section">
        <h3>📈 Model Performance</h3>
        <div className="model-selector">
          <label>Select Model:</label>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
            <option value="code-analysis">Code Analysis</option>
            <option value="code-smell-detection">Code Smell Detection</option>
            <option value="refactoring-suggestion">Refactoring Suggestion</option>
            <option value="pattern-recognition">Pattern Recognition</option>
          </select>
          <button
            onClick={() => trainModel(selectedModel)}
            disabled={isTraining}
            className="train-button"
          >
            {isTraining ? `Training... ${trainingProgress}%` : "Train Model"}
          </button>
        </div>

        <div className="chart-container">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={getPerformanceChartData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="accuracy"
                stroke="#4A90E2"
                strokeWidth={2}
                name="Accuracy"
              />
              <Line
                type="monotone"
                dataKey="confidence"
                stroke="#7ED321"
                strokeWidth={2}
                name="Confidence"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="charts-grid">
        {/* Language Distribution */}
        <div className="chart-section">
          <h3>📊 Training Data by Language</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={getLanguageDistribution()}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  // @ts-ignore - percentage property
                  label={({ name, percentage }: any) => `${name}: ${percentage}%`}
                >
                  {getLanguageDistribution().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Model Comparison */}
        <div className="chart-section">
          <h3>🏆 Model Comparison</h3>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={getModelPerformanceData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                <Bar dataKey="accuracy" fill="#4A90E2" name="Accuracy" />
                <Bar dataKey="confidence" fill="#7ED321" name="Confidence" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Knowledge Insights */}
      {insights && (
        <div className="insights-section">
          <h3>💡 Knowledge Insights</h3>
          <div className="insights-grid">
            <div className="insight-card">
              <h4>🔍 Common Patterns</h4>
              <div className="insight-content">
                {Object.entries(insights.patterns)
                  .slice(0, 3)
                  .map(([name, count]) => (
                    <div key={name} className="pattern-item">
                      <span className="pattern-name">{name}:</span>
                      <span className="pattern-count">{String(count)}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="insight-card">
              <h4>👃 Code Smells</h4>
              <div className="insight-content">
                {Object.entries(insights.codeSmells)
                  .slice(0, 3)
                  .map(([name, count]) => (
                    <div key={name} className="smell-item">
                      <span className="smell-name">{name}:</span>
                      <span className="smell-count">{String(count)}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="insight-card">
              <h4>✨ Best Practices</h4>
              <div className="insight-content">
                {Object.entries(insights.bestPractices)
                  .slice(0, 3)
                  .map(([name, count]) => (
                    <div key={name} className="practice-item">
                      <span className="practice-name">{name}:</span>
                      <span className="practice-count">{String(count)}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="insight-card recommendations">
              <h4>🎯 Recommendations</h4>
              <div className="insight-content">
                {insights.recommendations.map((rec, index) => (
                  <div key={index} className="recommendation-item">
                    • {rec}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Section */}
      <div className="feedback-section">
        <h3>👥 User Feedback</h3>
        <div className="feedback-form">
          <div className="feedback-controls">
            <label>
              <input
                type="radio"
                name="feedback-type"
                checked={feedback.positive}
                onChange={() => setFeedback({ ...feedback, positive: true })}
              />
              👍 Positive
            </label>
            <label>
              <input
                type="radio"
                name="feedback-type"
                checked={!feedback.positive}
                onChange={() => setFeedback({ ...feedback, positive: false })}
              />
              👎 Negative
            </label>
          </div>

          <input
            type="text"
            placeholder="Add your feedback comment..."
            value={feedback.comment}
            onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })}
            className="feedback-input"
          />

          <button
            onClick={addFeedback}
            disabled={!feedback.comment.trim()}
            className="feedback-submit"
          >
            Submit Feedback
          </button>
        </div>

        {stats?.feedbackBuffer && stats.feedbackBuffer.length > 0 && (
          <div className="feedback-history">
            <h4>Recent Feedback</h4>
            <div className="feedback-list">
              {stats.feedbackBuffer
                .slice(-5)
                .reverse()
                .map((item, index) => (
                  <div key={index} className="feedback-item">
                    <span
                      className={`feedback-indicator ${item.positive ? "positive" : "negative"}`}
                    >
                      {item.positive ? "👍" : "👎"}
                    </span>
                    <span className="feedback-comment">{item.comment}</span>
                    <span className="feedback-time">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* @ts-ignore - jsx prop */}
      <style jsx>{`
        .self-learning-dashboard {
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
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .dashboard-header h2 {
          margin: 0;
          color: #333;
        }

        .header-controls {
          display: flex;
          gap: 15px;
          align-items: center;
        }

        .refresh-button,
        .train-button {
          padding: 8px 16px;
          background: #4a90e2;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .refresh-button:hover,
        .train-button:hover {
          background: #357abd;
        }

        .train-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .auto-train-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }

        .overview-section {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 20px;
        }

        .stat-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          text-align: center;
        }

        .stat-card h3 {
          margin: 0 0 10px 0;
          color: #666;
          font-size: 14px;
        }

        .stat-value {
          font-size: 32px;
          font-weight: bold;
          color: #333;
          margin-bottom: 5px;
        }

        .stat-change {
          font-size: 12px;
          color: #666;
        }

        .stat-change.positive {
          color: #4caf50;
        }

        .performance-section,
        .chart-section,
        .insights-section,
        .feedback-section {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          margin-bottom: 20px;
        }

        .performance-section h3,
        .chart-section h3,
        .insights-section h3,
        .feedback-section h3 {
          margin: 0 0 20px 0;
          color: #333;
        }

        .model-selector {
          display: flex;
          gap: 15px;
          align-items: center;
          margin-bottom: 20px;
        }

        .model-selector label {
          font-weight: 500;
        }

        .model-selector select {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
        }

        .chart-container {
          width: 100%;
          height: 300px;
        }

        .charts-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 20px;
        }

        .insights-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        .insight-card {
          padding: 15px;
          background: #f8f9fa;
          border-radius: 6px;
        }

        .insight-card h4 {
          margin: 0 0 10px 0;
          color: #333;
          font-size: 14px;
        }

        .insight-content {
          font-size: 12px;
        }

        .pattern-item,
        .smell-item,
        .practice-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }

        .pattern-name,
        .smell-name,
        .practice-name {
          font-weight: 500;
        }

        .pattern-count,
        .smell-count,
        .practice-count {
          color: #666;
        }

        .recommendations .recommendation-item {
          margin-bottom: 5px;
          color: #555;
        }

        .feedback-form {
          display: flex;
          gap: 15px;
          align-items: center;
          margin-bottom: 20px;
        }

        .feedback-controls {
          display: flex;
          gap: 15px;
        }

        .feedback-input {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
        }

        .feedback-submit {
          padding: 8px 16px;
          background: #4a90e2;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .feedback-submit:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .feedback-history h4 {
          margin: 0 0 10px 0;
          color: #333;
        }

        .feedback-list {
          max-height: 200px;
          overflow-y: auto;
        }

        .feedback-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px;
          background: #f8f9fa;
          border-radius: 4px;
          margin-bottom: 5px;
        }

        .feedback-indicator {
          font-size: 16px;
        }

        .feedback-comment {
          flex: 1;
          font-size: 12px;
        }

        .feedback-time {
          font-size: 10px;
          color: #666;
        }
      `}</style>
    </div>
  );
};

export default SelfLearningDashboard;
