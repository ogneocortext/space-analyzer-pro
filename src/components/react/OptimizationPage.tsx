import React from "react";
import { AnalysisResult } from "../services/AnalysisBridge";
import styles from "../styles/components/App.module.css";

interface OptimizationPageProps {
  analysisData: AnalysisResult;
  isLoading: boolean;
}

const OptimizationPage: React.FC<OptimizationPageProps> = ({ analysisData, isLoading }) => {
  if (isLoading || !analysisData) {
    return (
      <div className={styles.contentSection}>
        <h2>Storage Optimization</h2>
        <p>Loading optimization analysis...</p>
      </div>
    );
  }

  // Generate optimization recommendations
  const generateOptimizations = () => {
    const optimizations = [];
    const categories = analysisData.categories || {};

    // Large files optimization
    const largestCategory = Object.entries(categories).reduce((prev, curr) =>
      curr[1].size > prev[1].size ? curr : prev
    );

    optimizations.push({
      type: "category",
      title: `Optimize ${largestCategory[0]} Files`,
      description: `Your ${largestCategory[0]} category uses ${Math.round(largestCategory[1].size / (1024 * 1024 * 1024))} GB (${Math.round((largestCategory[1].size / analysisData.totalSize) * 100)}% of total storage).`,
      potentialSavings: Math.round((largestCategory[1].size * 0.3) / (1024 * 1024 * 1024)),
      priority: "high",
      actions: [
        "Compress large files using appropriate tools",
        "Archive old files to external storage",
        "Remove unnecessary duplicates",
        "Consider cloud storage for infrequently accessed files",
      ],
    });

    // Duplicate file optimization
    const potentialDuplicates = analysisData.ai_insights?.potential_duplicates || 0;
    if (typeof potentialDuplicates === "number" && potentialDuplicates > 0) {
      optimizations.push({
        type: "duplicates",
        title: "Remove Duplicate Files",
        description: `${potentialDuplicates} potential duplicate files detected.`,
        potentialSavings: Math.round((analysisData.totalSize * 0.05) / (1024 * 1024 * 1024)),
        priority: "medium",
        actions: [
          "Run duplicate file detection scan",
          "Review and remove duplicate files",
          "Set up automated duplicate monitoring",
          "Implement file naming conventions to prevent duplicates",
        ],
      });
    }

    // Extension-based optimization
    const extensionStats = analysisData.extensionStats || {};
    const largestExtension = Object.entries(extensionStats).reduce((prev, curr) =>
      curr[1].size > prev[1].size ? curr : prev
    );

    optimizations.push({
      type: "extension",
      title: `Optimize ${largestExtension[0]} Files`,
      description: `${largestExtension[0]} files account for ${Math.round(largestExtension[1].size / (1024 * 1024 * 1024))} GB.`,
      potentialSavings: Math.round((largestExtension[1].size * 0.2) / (1024 * 1024 * 1024)),
      priority: "medium",
      actions: [
        "Compress files of this type",
        "Archive old files",
        "Review file retention policies",
        "Consider alternative formats",
      ],
    });

    // General optimization
    optimizations.push({
      type: "general",
      title: "General Storage Optimization",
      description: "Improve overall storage efficiency and performance.",
      potentialSavings: Math.round((analysisData.totalSize * 0.1) / (1024 * 1024 * 1024)),
      priority: "low",
      actions: [
        "Defragment storage drives",
        "Clean up temporary files",
        "Remove unused applications",
        "Optimize system settings",
      ],
    });

    return optimizations;
  };

  const optimizations = generateOptimizations();
  const totalPotentialSavings = optimizations.reduce((sum, opt) => sum + opt.potentialSavings, 0);

  return (
    <div className={styles.contentSection}>
      <h2>Storage Optimization</h2>
      <p>AI-powered optimization suggestions based on your file analysis</p>

      <div className={styles.optimizationSection}>
        <div className={styles.optimizationSummary}>
          <h3>Optimization Summary</h3>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <h4>Total Potential Savings</h4>
              <div className={styles.summaryValue}>{totalPotentialSavings} GB</div>
              <div className={styles.summaryPercentage}>
                {Math.round(
                  ((totalPotentialSavings * 1024 * 1024 * 1024) / analysisData.totalSize) * 100
                )}
                % of total storage
              </div>
            </div>
            <div className={styles.summaryCard}>
              <h4>High Priority Actions</h4>
              <div className={styles.summaryValue}>
                {optimizations.filter((opt) => opt.priority === "high").length}
              </div>
            </div>
            <div className={styles.summaryCard}>
              <h4>Medium Priority Actions</h4>
              <div className={styles.summaryValue}>
                {optimizations.filter((opt) => opt.priority === "medium").length}
              </div>
            </div>
            <div className={styles.summaryCard}>
              <h4>Low Priority Actions</h4>
              <div className={styles.summaryValue}>
                {optimizations.filter((opt) => opt.priority === "low").length}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.optimizationList}>
          <h3>Optimization Suggestions</h3>
          {optimizations.map((optimization, index) => (
            <div
              key={index}
              className={`${styles.optimizationCard} ${styles[`priority-${optimization.priority}`]}`}
            >
              <div className={styles.optimizationHeader}>
                <h4>{optimization.title}</h4>
                <span className={styles.priorityBadge}>{optimization.priority}</span>
              </div>
              <p>{optimization.description}</p>
              <div className={styles.optimizationDetails}>
                <div className={styles.savingsInfo}>
                  <strong>Potential Savings:</strong> {optimization.potentialSavings} GB
                </div>
                <div className={styles.actionList}>
                  <strong>Recommended Actions:</strong>
                  <ul>
                    {optimization.actions.map((action, actionIndex) => (
                      <li key={actionIndex}>{action}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {analysisData.ai_insights?.optimization_suggestions?.length > 0 && (
          <div className={styles.aiOptimizations}>
            <h3>AI-Generated Suggestions</h3>
            <ul className={styles.suggestionsList}>
              {analysisData.ai_insights.optimization_suggestions.map((suggestion, index) => (
                <li key={index} className={styles.aiSuggestion}>
                  <span className={styles.suggestionIcon}>🤖</span>
                  {suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className={styles.optimizationTools}>
          <h3>Optimization Tools</h3>
          <div className={styles.toolsGrid}>
            <div className={styles.toolCard}>
              <h4>Automated Cleanup</h4>
              <p>Set up automated rules to clean up temporary files, duplicates, and old files.</p>
              <button className={styles.toolButton}>Configure Rules</button>
            </div>
            <div className={styles.toolCard}>
              <h4>File Compression</h4>
              <p>Compress large files to save space without losing quality.</p>
              <button className={styles.toolButton}>Start Compression</button>
            </div>
            <div className={styles.toolCard}>
              <h4>Archive Manager</h4>
              <p>Move old files to archive storage to free up primary storage space.</p>
              <button className={styles.toolButton}>Setup Archive</button>
            </div>
            <div className={styles.toolCard}>
              <h4>Storage Monitor</h4>
              <p>Monitor storage usage in real-time and get alerts when thresholds are reached.</p>
              <button className={styles.toolButton}>Enable Monitoring</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptimizationPage;
