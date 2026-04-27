import React, { useState } from "react";
import { AnalysisResult } from "../services/AnalysisBridge";
import styles from "../styles/components/App.module.css";

interface AutomationPageProps {
  analysisData: AnalysisResult;
  isLoading: boolean;
}

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  trigger: string;
  action: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

const AutomationPage: React.FC<AutomationPageProps> = ({ analysisData, isLoading }) => {
  const [rules, setRules] = useState<AutomationRule[]>([
    {
      id: "1",
      name: "Auto Cleanup Temporary Files",
      description: "Remove temporary files older than 7 days",
      trigger: "Daily at 2:00 AM",
      action: "Delete files matching *.tmp, *.temp, *.cache",
      enabled: true,
      lastRun: new Date(Date.now() - 24 * 60 * 60 * 1000),
      nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    {
      id: "2",
      name: "Duplicate File Detection",
      description: "Scan for and flag duplicate files",
      trigger: "Weekly on Sundays",
      action: "Generate duplicate file report",
      enabled: true,
      lastRun: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      nextRun: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
    {
      id: "3",
      name: "Archive Old Files",
      description: "Move files older than 1 year to archive",
      trigger: "Monthly on 1st",
      action: "Archive files to external storage",
      enabled: false,
      lastRun: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      nextRun: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    },
    {
      id: "4",
      name: "Storage Usage Alert",
      description: "Alert when storage usage exceeds 80%",
      trigger: "Real-time monitoring",
      action: "Send notification and email",
      enabled: true,
      lastRun: new Date(Date.now() - 1 * 60 * 60 * 1000),
      nextRun: new Date(Date.now() + 1 * 60 * 60 * 1000),
    },
  ]);

  const [isCreatingRule, setIsCreatingRule] = useState(false);

  if (isLoading || !analysisData) {
    return (
      <div className={styles.contentSection}>
        <h2>Automation</h2>
        <p>Loading automation rules...</p>
      </div>
    );
  }

  const toggleRule = (id: string) => {
    setRules(rules.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule)));
  };

  const deleteRule = (id: string) => {
    setRules(rules.filter((rule) => rule.id !== id));
  };

  const getStorageUsage = () => {
    const totalSizeGB = analysisData.totalSize / (1024 * 1024 * 1024);
    const usagePercentage = (totalSizeGB / 1000) * 100; // Assuming 1TB total capacity
    return usagePercentage;
  };

  const storageUsage = getStorageUsage();

  return (
    <div className={styles.contentSection}>
      <h2>Automation</h2>
      <p>Automated cleanup and maintenance tasks</p>

      <div className={styles.automationSection}>
        <div className={styles.automationOverview}>
          <h3>System Status</h3>
          <div className={styles.statusGrid}>
            <div className={styles.statusCard}>
              <h4>Active Rules</h4>
              <div className={styles.statusValue}>
                {rules.filter((rule) => rule.enabled).length} / {rules.length}
              </div>
              <div className={styles.statusIndicator}>
                <span
                  className={styles.statusDot}
                  style={{
                    backgroundColor:
                      rules.filter((rule) => rule.enabled).length > 0 ? "#10b981" : "#ef4444",
                  }}
                ></span>
                {rules.filter((rule) => rule.enabled).length > 0 ? "Active" : "Inactive"}
              </div>
            </div>
            <div className={styles.statusCard}>
              <h4>Storage Usage</h4>
              <div className={styles.statusValue}>{storageUsage.toFixed(1)}%</div>
              <div className={styles.statusIndicator}>
                <span
                  className={styles.statusDot}
                  style={{ backgroundColor: storageUsage > 80 ? "#ef4444" : "#10b981" }}
                ></span>
                {storageUsage > 80 ? "High" : "Normal"}
              </div>
            </div>
            <div className={styles.statusCard}>
              <h4>Last Run</h4>
              <div className={styles.statusValue}>
                {rules
                  .reduce(
                    (latest, rule) =>
                      rule.lastRun && (!latest || rule.lastRun > latest) ? rule.lastRun : latest,
                    null as Date | null
                  )
                  ?.toLocaleString() || "Never"}
              </div>
              <div className={styles.statusIndicator}>
                <span className={styles.statusDot} style={{ backgroundColor: "#10b981" }}></span>
                System Active
              </div>
            </div>
            <div className={styles.statusCard}>
              <h4>Next Scheduled</h4>
              <div className={styles.statusValue}>
                {rules
                  .reduce(
                    (earliest, rule) =>
                      rule.nextRun && (!earliest || rule.nextRun < earliest)
                        ? rule.nextRun
                        : earliest,
                    null as Date | null
                  )
                  ?.toLocaleString() || "No scheduled tasks"}
              </div>
              <div className={styles.statusIndicator}>
                <span className={styles.statusDot} style={{ backgroundColor: "#3b82f6" }}></span>
                Scheduled
              </div>
            </div>
          </div>
        </div>

        <div className={styles.rulesList}>
          <div className={styles.rulesHeader}>
            <h3>Active Automations</h3>
            <button className={styles.addRuleButton} onClick={() => setIsCreatingRule(true)}>
              + Add Rule
            </button>
          </div>

          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`${styles.ruleCard} ${rule.enabled ? styles.enabled : styles.disabled}`}
            >
              <div className={styles.ruleHeader}>
                <div className={styles.ruleInfo}>
                  <h4>{rule.name}</h4>
                  <p>{rule.description}</p>
                </div>
                <div className={styles.ruleControls}>
                  <label className={styles.switch}>
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => toggleRule(rule.id)}
                    />
                    <span className={styles.slider}></span>
                  </label>
                  <button
                    className={styles.deleteButton}
                    onClick={() => deleteRule(rule.id)}
                    title="Delete rule"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className={styles.ruleDetails}>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Trigger:</span>
                  <span className={styles.detailValue}>{rule.trigger}</span>
                </div>
                <div className={styles.detailItem}>
                  <span className={styles.detailLabel}>Action:</span>
                  <span className={styles.detailValue}>{rule.action}</span>
                </div>
                {rule.lastRun && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Last Run:</span>
                    <span className={styles.detailValue}>{rule.lastRun.toLocaleString()}</span>
                  </div>
                )}
                {rule.nextRun && (
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Next Run:</span>
                    <span className={styles.detailValue}>{rule.nextRun.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isCreatingRule && (
            <div className={styles.createRuleForm}>
              <h4>Create New Automation Rule</h4>
              <div className={styles.formGrid}>
                <input type="text" placeholder="Rule name" className={styles.formInput} />
                <input type="text" placeholder="Description" className={styles.formInput} />
                <select className={styles.formSelect}>
                  <option>Daily</option>
                  <option>Weekly</option>
                  <option>Monthly</option>
                  <option>Real-time</option>
                </select>
                <select className={styles.formSelect}>
                  <option>Delete files</option>
                  <option>Archive files</option>
                  <option>Generate report</option>
                  <option>Send notification</option>
                </select>
              </div>
              <div className={styles.formActions}>
                <button className={styles.formButton}>Create Rule</button>
                <button className={styles.cancelButton} onClick={() => setIsCreatingRule(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.automationInsights}>
          <h3>AI-Powered Automation Suggestions</h3>
          <div className={styles.insightsList}>
            <div className={styles.insightCard}>
              <h4>Smart Cleanup</h4>
              <p>
                Based on your file patterns, we recommend setting up automated cleanup for temporary
                files every 3 days.
              </p>
              <button className={styles.insightButton}>Setup Now</button>
            </div>
            <div className={styles.insightCard}>
              <h4>Duplicate Prevention</h4>
              <p>Implement automated duplicate detection to prevent storage waste.</p>
              <button className={styles.insightButton}>Configure</button>
            </div>
            <div className={styles.insightCard}>
              <h4>Archive Strategy</h4>
              <p>Set up automatic archiving for files older than 6 months to optimize storage.</p>
              <button className={styles.insightButton}>Setup</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutomationPage;
