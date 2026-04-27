import React from "react";
import { AnalysisResult } from "../services/AnalysisBridge";
import styles from "../styles/components/App.module.css";

interface VisualizationPageProps {
  analysisData: AnalysisResult;
  isLoading: boolean;
}

const VisualizationPage: React.FC<VisualizationPageProps> = ({ analysisData, isLoading }) => {
  if (isLoading || !analysisData) {
    return (
      <div className={styles.contentSection}>
        <h2>Data Visualization</h2>
        <p>Loading visualizations...</p>
      </div>
    );
  }

  // Generate chart data from analysis results
  const categoryData = Object.entries(analysisData.categories || {}).map(([name, data]) => ({
    name,
    value: data.size,
    count: data.count,
  }));

  const extensionData = Object.entries(analysisData.extensionStats || {}).map(([ext, data]) => ({
    name: ext || "No Extension",
    value: data.size,
    count: data.count,
  }));

  return (
    <div className={styles.contentSection}>
      <h2>Data Visualization</h2>
      <p>Interactive charts and graphs powered by AI analysis</p>

      <div className={styles.visualizationGrid}>
        {/* File Size Distribution (Pie Chart) */}
        <div className={styles.visualizationCard}>
          <h3>File Size Distribution</h3>
          <div className={styles.chartContainer}>
            <div className={styles.pieChart}>
              {categoryData.slice(0, 5).map((category, index) => (
                <div
                  key={index}
                  className={styles.pieSlice}
                  style={{
                    backgroundColor: `hsl(${index * 60}, 70%, 50%)`,
                    width: `${(category.value / analysisData.totalSize) * 100}%`,
                  }}
                >
                  <span className={styles.chartLabel}>
                    {category.name}: {Math.round((category.value / analysisData.totalSize) * 100)}%
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.chartLegend}>
              {categoryData.slice(0, 5).map((category, index) => (
                <div key={index} className={styles.legendItem}>
                  <span
                    className={styles.legendColor}
                    style={{ backgroundColor: `hsl(${index * 60}, 70%, 50%)` }}
                  ></span>
                  <span>
                    {category.name} ({category.count} files)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* File Count by Category (Bar Chart) */}
        <div className={styles.visualizationCard}>
          <h3>File Count by Category</h3>
          <div className={styles.barChart}>
            {categoryData.slice(0, 7).map((category, index) => (
              <div key={index} className={styles.barGroup}>
                <div
                  className={styles.bar}
                  style={{
                    height: `${(category.count / Math.max(...categoryData.map((c) => c.count))) * 100}%`,
                    backgroundColor: `hsl(${index * 50}, 70%, 50%)`,
                  }}
                ></div>
                <span className={styles.barLabel}>{category.name}</span>
                <span className={styles.barValue}>{category.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Extension Distribution */}
        <div className={styles.visualizationCard}>
          <h3>File Extensions</h3>
          <div className={styles.extensionChart}>
            {extensionData.slice(0, 10).map((ext, index) => (
              <div key={index} className={styles.extensionItem}>
                <span className={styles.extensionName}>{ext.name}</span>
                <div className={styles.extensionBar}>
                  <div
                    className={styles.extensionFill}
                    style={{
                      width: `${(ext.count / Math.max(...extensionData.map((e) => e.count))) * 100}%`,
                      backgroundColor: `hsl(${index * 36}, 70%, 50%)`,
                    }}
                  ></div>
                </div>
                <span className={styles.extensionCount}>{ext.count} files</span>
              </div>
            ))}
          </div>
        </div>

        {/* Storage Analysis */}
        <div className={styles.visualizationCard}>
          <h3>Storage Analysis</h3>
          <div className={styles.storageMetrics}>
            <div className={styles.metricCard}>
              <h4>Total Files</h4>
              <div className={styles.metricValue}>{analysisData.totalFiles.toLocaleString()}</div>
            </div>
            <div className={styles.metricCard}>
              <h4>Total Size</h4>
              <div className={styles.metricValue}>
                {Math.round(analysisData.totalSize / (1024 * 1024 * 1024))} GB
              </div>
            </div>
            <div className={styles.metricCard}>
              <h4>Average File Size</h4>
              <div className={styles.metricValue}>
                {Math.round(analysisData.totalSize / analysisData.totalFiles / 1024)} KB
              </div>
            </div>
            <div className={styles.metricCard}>
              <h4>Categories</h4>
              <div className={styles.metricValue}>
                {Object.keys(analysisData.categories || {}).length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Insights */}
      {analysisData.ai_insights && (
        <div className={styles.aiInsightsCard}>
          <h3>AI Analysis Insights</h3>
          <div className={styles.insightsGrid}>
            {analysisData.ai_insights.storage_warnings?.length > 0 && (
              <div className={styles.insightSection}>
                <h4>Storage Warnings</h4>
                <ul>
                  {analysisData.ai_insights.storage_warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}
            {analysisData.ai_insights.optimization_suggestions?.length > 0 && (
              <div className={styles.insightSection}>
                <h4>Optimization Suggestions</h4>
                <ul>
                  {analysisData.ai_insights.optimization_suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VisualizationPage;
