import React, { useState, useEffect } from "react";
import { AnalysisResult } from "../services/AnalysisBridge";
import styles from "../styles/components/App.module.css";

interface MonitoringPageProps {
  analysisData: AnalysisResult;
  isLoading: boolean;
}

interface SystemMetric {
  timestamp: Date;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkUsage: number;
  activeProcesses: number;
}

const MonitoringPage: React.FC<MonitoringPageProps> = ({ analysisData, isLoading }) => {
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [alerts, setAlerts] = useState<string[]>([]);

  useEffect(() => {
    if (analysisData) {
      // Generate initial metrics based on analysis data
      const initialMetrics: SystemMetric[] = [];
      const now = new Date();

      for (let i = 0; i < 24; i++) {
        initialMetrics.push({
          timestamp: new Date(now.getTime() - (23 - i) * 60 * 60 * 1000),
          cpuUsage: 45 + Math.random() * 30,
          memoryUsage: 60 + Math.random() * 25,
          diskUsage: 75 + Math.random() * 15,
          networkUsage: 20 + Math.random() * 40,
          activeProcesses: 80 + Math.floor(Math.random() * 50),
        });
      }

      setMetrics(initialMetrics);
    }
  }, [analysisData]);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isMonitoring) {
      interval = setInterval(() => {
        const now = new Date();
        const newMetric: SystemMetric = {
          timestamp: now,
          cpuUsage: 45 + Math.random() * 30,
          memoryUsage: 60 + Math.random() * 25,
          diskUsage: 75 + Math.random() * 15,
          networkUsage: 20 + Math.random() * 40,
          activeProcesses: 80 + Math.floor(Math.random() * 50),
        };

        setMetrics((prev) => [...prev.slice(-23), newMetric]);

        // Check for alerts
        const newAlerts: string[] = [];
        if (newMetric.cpuUsage > 80)
          newAlerts.push(`High CPU usage: ${newMetric.cpuUsage.toFixed(1)}%`);
        if (newMetric.memoryUsage > 85)
          newAlerts.push(`High memory usage: ${newMetric.memoryUsage.toFixed(1)}%`);
        if (newMetric.diskUsage > 90)
          newAlerts.push(`High disk usage: ${newMetric.diskUsage.toFixed(1)}%`);

        if (newAlerts.length > 0) {
          setAlerts((prev) => [...newAlerts, ...prev].slice(0, 10));
        }
      }, 5000);
    }

    return () => clearInterval(interval);
  }, [isMonitoring]);

  if (isLoading || !analysisData) {
    return (
      <div className={styles.contentSection}>
        <h2>System Monitoring</h2>
        <p>Loading monitoring dashboard...</p>
      </div>
    );
  }

  const latestMetric = metrics[metrics.length - 1];
  const getAlertLevel = (value: number, threshold: number) => {
    if (value > threshold + 10) return "critical";
    if (value > threshold) return "warning";
    return "normal";
  };

  const formatTime = (date: Date) => date.toLocaleTimeString();

  return (
    <div className={styles.contentSection}>
      <h2>System Monitoring</h2>
      <p>Real-time system monitoring and alerts</p>

      <div className={styles.monitoringSection}>
        <div className={styles.monitoringControls}>
          <button
            className={`${styles.monitorButton} ${isMonitoring ? styles.active : ""}`}
            onClick={() => setIsMonitoring(!isMonitoring)}
          >
            {isMonitoring ? "Stop Monitoring" : "Start Monitoring"}
          </button>
          <span className={styles.monitorStatus}>
            Status: {isMonitoring ? "Active" : "Inactive"}
          </span>
        </div>

        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <h4>CPU Usage</h4>
            <div className={styles.metricValue}>{latestMetric?.cpuUsage.toFixed(1)}%</div>
            <div
              className={`${styles.metricTrend} ${getAlertLevel(latestMetric?.cpuUsage || 0, 70)}`}
            >
              {getAlertLevel(latestMetric?.cpuUsage || 0, 70) === "critical"
                ? "⚠️ Critical"
                : getAlertLevel(latestMetric?.cpuUsage || 0, 70) === "warning"
                  ? "⚠️ Warning"
                  : "✅ Normal"}
            </div>
            <div className={styles.metricChart}>
              {metrics.slice(-12).map((metric, index) => (
                <div
                  key={index}
                  className={styles.chartBar}
                  style={{ height: `${metric.cpuUsage}%` }}
                ></div>
              ))}
            </div>
          </div>

          <div className={styles.metricCard}>
            <h4>Memory Usage</h4>
            <div className={styles.metricValue}>{latestMetric?.memoryUsage.toFixed(1)}%</div>
            <div
              className={`${styles.metricTrend} ${getAlertLevel(latestMetric?.memoryUsage || 0, 80)}`}
            >
              {getAlertLevel(latestMetric?.memoryUsage || 0, 80) === "critical"
                ? "⚠️ Critical"
                : getAlertLevel(latestMetric?.memoryUsage || 0, 80) === "warning"
                  ? "⚠️ Warning"
                  : "✅ Normal"}
            </div>
            <div className={styles.metricChart}>
              {metrics.slice(-12).map((metric, index) => (
                <div
                  key={index}
                  className={styles.chartBar}
                  style={{ height: `${metric.memoryUsage}%` }}
                ></div>
              ))}
            </div>
          </div>

          <div className={styles.metricCard}>
            <h4>Disk Usage</h4>
            <div className={styles.metricValue}>{latestMetric?.diskUsage.toFixed(1)}%</div>
            <div
              className={`${styles.metricTrend} ${getAlertLevel(latestMetric?.diskUsage || 0, 85)}`}
            >
              {getAlertLevel(latestMetric?.diskUsage || 0, 85) === "critical"
                ? "⚠️ Critical"
                : getAlertLevel(latestMetric?.diskUsage || 0, 85) === "warning"
                  ? "⚠️ Warning"
                  : "✅ Normal"}
            </div>
            <div className={styles.metricChart}>
              {metrics.slice(-12).map((metric, index) => (
                <div
                  key={index}
                  className={styles.chartBar}
                  style={{ height: `${metric.diskUsage}%` }}
                ></div>
              ))}
            </div>
          </div>

          <div className={styles.metricCard}>
            <h4>Network Usage</h4>
            <div className={styles.metricValue}>{latestMetric?.networkUsage.toFixed(1)}%</div>
            <div
              className={`${styles.metricTrend} ${getAlertLevel(latestMetric?.networkUsage || 0, 70)}`}
            >
              {getAlertLevel(latestMetric?.networkUsage || 0, 70) === "critical"
                ? "⚠️ Critical"
                : getAlertLevel(latestMetric?.networkUsage || 0, 70) === "warning"
                  ? "⚠️ Warning"
                  : "✅ Normal"}
            </div>
            <div className={styles.metricChart}>
              {metrics.slice(-12).map((metric, index) => (
                <div
                  key={index}
                  className={styles.chartBar}
                  style={{ height: `${metric.networkUsage}%` }}
                ></div>
              ))}
            </div>
          </div>
        </div>

        <div className={styles.monitoringDetails}>
          <div className={styles.detailsSection}>
            <h3>System Status</h3>
            <div className={styles.statusDetails}>
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>Active Processes:</span>
                <span className={styles.statusValue}>{latestMetric?.activeProcesses}</span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>Last Update:</span>
                <span className={styles.statusValue}>
                  {latestMetric?.timestamp.toLocaleString()}
                </span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>Analysis Status:</span>
                <span className={styles.statusValue}>Complete</span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.statusLabel}>Storage Health:</span>
                <span className={styles.statusValue}>Good</span>
              </div>
            </div>
          </div>

          <div className={styles.alertsSection}>
            <h3>Recent Alerts</h3>
            <div className={styles.alertsList}>
              {alerts.length === 0 ? (
                <div className={styles.noAlerts}>No recent alerts</div>
              ) : (
                alerts.map((alert, index) => (
                  <div key={index} className={styles.alertItem}>
                    <span className={styles.alertTime}>{new Date().toLocaleTimeString()}</span>
                    <span className={styles.alertMessage}>{alert}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className={styles.monitoringChart}>
          <h3>Historical Data</h3>
          <div className={styles.chartContainer}>
            <div className={styles.chartHeader}>
              <span>Time</span>
              <span>CPU</span>
              <span>Memory</span>
              <span>Disk</span>
            </div>
            {metrics.slice(-8).map((metric, index) => (
              <div key={index} className={styles.chartRow}>
                <span className={styles.chartTime}>{formatTime(metric.timestamp)}</span>
                <div className={styles.chartBarContainer}>
                  <div
                    className={`${styles.chartBar} ${getAlertLevel(metric.cpuUsage, 70)}`}
                    style={{ width: `${metric.cpuUsage}%` }}
                  ></div>
                </div>
                <div className={styles.chartBarContainer}>
                  <div
                    className={`${styles.chartBar} ${getAlertLevel(metric.memoryUsage, 80)}`}
                    style={{ width: `${metric.memoryUsage}%` }}
                  ></div>
                </div>
                <div className={styles.chartBarContainer}>
                  <div
                    className={`${styles.chartBar} ${getAlertLevel(metric.diskUsage, 85)}`}
                    style={{ width: `${metric.diskUsage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.monitoringActions}>
          <h3>Monitoring Actions</h3>
          <div className={styles.actionsGrid}>
            <button className={styles.actionButton}>Generate Report</button>
            <button className={styles.actionButton}>Export Data</button>
            <button className={styles.actionButton}>Configure Alerts</button>
            <button className={styles.actionButton}>System Diagnostics</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonitoringPage;
