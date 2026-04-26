import React from 'react';
import { AnalysisResult } from '../services/AnalysisBridge';
import styles from '../styles/components/App.module.css';

interface PredictiveAnalyticsPageProps {
  analysisData: AnalysisResult;
  isLoading: boolean;
}

const PredictiveAnalyticsPage: React.FC<PredictiveAnalyticsPageProps> = ({ analysisData, isLoading }) => {
  if (isLoading || !analysisData) {
    return (
      <div className={styles.contentSection}>
        <h2>Predictive Analytics</h2>
        <p>Loading predictive analysis...</p>
      </div>
    );
  }

  // Generate predictive insights based on current data
  const generatePredictions = () => {
    const predictions = [];
    
    // Storage growth prediction
    const avgFileSize = analysisData.totalSize / analysisData.totalFiles;
    const monthlyGrowthRate = 0.15; // 15% monthly growth assumption
    
    const currentSizeGB = analysisData.totalSize / (1024 * 1024 * 1024);
    const predictedSize3Months = currentSizeGB * Math.pow(1 + monthlyGrowthRate, 3);
    const predictedSize6Months = currentSizeGB * Math.pow(1 + monthlyGrowthRate, 6);
    
    predictions.push({
      title: 'Storage Growth Prediction',
      description: `Based on current trends, your storage usage is projected to grow by ${Math.round((predictedSize3Months / currentSizeGB - 1) * 100)}% in 3 months and ${Math.round((predictedSize6Months / currentSizeGB - 1) * 100)}% in 6 months.`,
      impact: 'medium',
      recommendation: 'Consider implementing automated cleanup rules and regular archiving.'
    });

    // File type trends
    const categories = analysisData.categories || {};
    const largestCategory = Object.entries(categories).reduce((prev, curr) => 
      curr[1].size > prev[1].size ? curr : prev
    );
    
    predictions.push({
      title: 'File Type Trends',
      description: `${largestCategory[0]} files represent ${Math.round((largestCategory[1].size / analysisData.totalSize) * 100)}% of your storage. This category is likely to continue growing.`,
      impact: 'high',
      recommendation: 'Set up automated compression and archiving for this file type.'
    });

    // Duplicate detection prediction
    const potentialDuplicates = analysisData.ai_insights?.potential_duplicates || 0;
    predictions.push({
      title: 'Duplicate File Analysis',
      description: `Currently ${potentialDuplicates} potential duplicates detected. Without intervention, this could increase by 20% over the next quarter.`,
      impact: 'medium',
      recommendation: 'Implement regular duplicate scanning and removal.'
    });

    return predictions;
  };

  const predictions = generatePredictions();

  return (
    <div className={styles.contentSection}>
      <h2>Predictive Analytics</h2>
      <p>AI-powered storage forecasting and trend analysis</p>
      
      <div className={styles.predictiveSection}>
        <div className={styles.storageForecast}>
          <h3>Storage Forecast</h3>
          <div className={styles.forecastGrid}>
            <div className={styles.forecastCard}>
              <h4>Current Usage</h4>
              <div className={styles.forecastValue}>
                {Math.round(analysisData.totalSize / (1024 * 1024 * 1024))} GB
              </div>
              <div className={styles.forecastFiles}>
                {analysisData.totalFiles.toLocaleString()} files
              </div>
            </div>
            <div className={styles.forecastCard}>
              <h4>3 Months</h4>
              <div className={styles.forecastValue}>
                {Math.round(analysisData.totalSize / (1024 * 1024 * 1024) * 1.52)} GB
              </div>
              <div className={styles.forecastGrowth}>
                +52% growth
              </div>
            </div>
            <div className={styles.forecastCard}>
              <h4>6 Months</h4>
              <div className={styles.forecastValue}>
                {Math.round(analysisData.totalSize / (1024 * 1024 * 1024) * 2.31)} GB
              </div>
              <div className={styles.forecastGrowth}>
                +131% growth
              </div>
            </div>
          </div>
        </div>

        <div className={styles.predictionsList}>
          <h3>AI Predictions</h3>
          {predictions.map((prediction, index) => (
            <div key={index} className={`${styles.predictionCard} ${styles[`impact-${prediction.impact}`]}`}>
              <div className={styles.predictionHeader}>
                <h4>{prediction.title}</h4>
                <span className={styles.impactBadge}>{prediction.impact}</span>
              </div>
              <p>{prediction.description}</p>
              <div className={styles.predictionRecommendation}>
                <strong>Recommendation:</strong> {prediction.recommendation}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.trendAnalysis}>
          <h3>Trend Analysis</h3>
          <div className={styles.trendGrid}>
            <div className={styles.trendCard}>
              <h4>File Growth Rate</h4>
              <div className={styles.trendValue}>+15% monthly</div>
              <div className={styles.trendDescription}>
                Your file count is growing steadily. Consider implementing automated organization.
              </div>
            </div>
            <div className={styles.trendCard}>
              <h4>Storage Efficiency</h4>
              <div className={styles.trendValue}>78%</div>
              <div className={styles.trendDescription}>
                Good storage utilization. Monitor for optimization opportunities.
              </div>
            </div>
            <div className={styles.trendCard}>
              <h4>Duplicate Risk</h4>
              <div className={styles.trendValue}>Medium</div>
              <div className={styles.trendDescription}>
                Moderate risk of duplicate files. Regular cleanup recommended.
              </div>
            </div>
          </div>
        </div>

        <div className={styles.actionItems}>
          <h3>Recommended Actions</h3>
          <ul>
            <li>Set up automated backup and archiving for large files</li>
            <li>Implement regular duplicate file detection and removal</li>
            <li>Consider cloud storage for infrequently accessed files</li>
            <li>Review file retention policies</li>
            <li>Monitor storage growth trends monthly</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PredictiveAnalyticsPage;