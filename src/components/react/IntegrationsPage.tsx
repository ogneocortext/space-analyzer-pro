import React, { useState, useEffect } from "react";
import { AnalysisResult } from "../services/AnalysisBridge";
import styles from "../styles/components/App.module.css";

interface IntegrationsPageProps {
  analysisData: AnalysisResult;
  isLoading: boolean;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  category: "cloud" | "storage" | "monitoring" | "productivity";
  status: "connected" | "disconnected" | "not-configured";
  lastSync?: Date;
  features: string[];
}

const IntegrationsPage: React.FC<IntegrationsPageProps> = ({ analysisData, isLoading }) => {
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: "1",
      name: "Google Drive",
      description: "Sync files and access cloud storage",
      category: "cloud",
      status: "connected",
      lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000),
      features: ["Auto-sync", "Backup", "Sharing"],
    },
    {
      id: "2",
      name: "Dropbox",
      description: "Cloud storage integration with Space Analyzer",
      category: "cloud",
      status: "disconnected",
      features: ["File sync", "Version control"],
    },
    {
      id: "3",
      name: "OneDrive",
      description: "Microsoft cloud storage integration",
      category: "cloud",
      status: "not-configured",
      features: ["Office 365 integration", "Auto-backup"],
    },
    {
      id: "4",
      name: "GitHub",
      description: "Version control and code repository integration",
      category: "storage",
      status: "connected",
      lastSync: new Date(Date.now() - 1 * 60 * 60 * 1000),
      features: ["Git hooks", "Commit analysis", "Code insights"],
    },
    {
      id: "5",
      name: "Slack",
      description: "Team communication and notifications",
      category: "productivity",
      status: "connected",
      lastSync: new Date(Date.now() - 30 * 60 * 1000),
      features: ["Notifications", "File sharing", "Status updates"],
    },
    {
      id: "6",
      name: "Grafana",
      description: "Advanced monitoring and visualization",
      category: "monitoring",
      status: "not-configured",
      features: ["Dashboards", "Alerts", "Metrics"],
    },
    {
      id: "7",
      name: "Prometheus",
      description: "System monitoring and alerting toolkit",
      category: "monitoring",
      status: "disconnected",
      features: ["Metrics collection", "Alerting", "Querying"],
    },
    {
      id: "8",
      name: "Jira",
      description: "Project management and issue tracking",
      category: "productivity",
      status: "not-configured",
      features: ["Task management", "Issue tracking", "Reporting"],
    },
  ]);

  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);

  useEffect(() => {
    if (analysisData) {
      // Update integration status based on analysis data
      const updatedIntegrations = integrations.map((integration) => {
        if (integration.category === "storage" && analysisData.totalFiles > 5000) {
          return { ...integration, status: "connected" as const, lastSync: new Date() };
        }
        return integration;
      });
      setIntegrations(updatedIntegrations);
    }
  }, [analysisData]);

  const connectIntegration = (id: string) => {
    setIntegrations(
      integrations.map((integration) =>
        integration.id === id
          ? { ...integration, status: "connected" as const, lastSync: new Date() }
          : integration
      )
    );
  };

  const disconnectIntegration = (id: string) => {
    setIntegrations(
      integrations.map((integration) =>
        integration.id === id ? { ...integration, status: "disconnected" as const } : integration
      )
    );
  };

  const getIntegrationIcon = (category: string) => {
    switch (category) {
      case "cloud":
        return "☁️";
      case "storage":
        return "💾";
      case "monitoring":
        return "📊";
      case "productivity":
        return "💼";
      default:
        return "🔗";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "#10b981";
      case "disconnected":
        return "#ef4444";
      case "not-configured":
        return "#6b7280";
      default:
        return "#6b7280";
    }
  };

  if (isLoading || !analysisData) {
    return (
      <div className={styles.contentSection}>
        <h2>Integrations</h2>
        <p>Loading integration options...</p>
      </div>
    );
  }

  const connectedIntegrations = integrations.filter((i) => i.status === "connected").length;
  const totalIntegrations = integrations.length;

  return (
    <div className={styles.contentSection}>
      <h2>Integrations</h2>
      <p>Connect with external services and APIs</p>

      <div className={styles.integrationsSection}>
        <div className={styles.integrationsOverview}>
          <h3>Integration Status</h3>
          <div className={styles.overviewGrid}>
            <div className={styles.overviewCard}>
              <h4>Connected</h4>
              <div className={styles.overviewValue}>{connectedIntegrations}</div>
              <div className={styles.overviewPercentage}>
                {Math.round((connectedIntegrations / totalIntegrations) * 100)}% connected
              </div>
            </div>
            <div className={styles.overviewCard}>
              <h4>Total Available</h4>
              <div className={styles.overviewValue}>{totalIntegrations}</div>
              <div className={styles.overviewDescription}>Integration options</div>
            </div>
            <div className={styles.overviewCard}>
              <h4>Last Sync</h4>
              <div className={styles.overviewValue}>
                {integrations
                  .reduce(
                    (latest, integration) =>
                      integration.lastSync && (!latest || integration.lastSync > latest)
                        ? integration.lastSync
                        : latest,
                    null as Date | null
                  )
                  ?.toLocaleString() || "Never"}
              </div>
              <div className={styles.overviewDescription}>Most recent sync</div>
            </div>
          </div>
        </div>

        <div className={styles.integrationsList}>
          <h3>Available Integrations</h3>
          <div className={styles.integrationsGrid}>
            {integrations.map((integration) => (
              <div
                key={integration.id}
                className={`${styles.integrationCard} ${selectedIntegration?.id === integration.id ? styles.selected : ""}`}
                onClick={() => setSelectedIntegration(integration)}
              >
                <div className={styles.integrationHeader}>
                  <span className={styles.integrationIcon}>
                    {getIntegrationIcon(integration.category)}
                  </span>
                  <h4>{integration.name}</h4>
                  <span
                    className={styles.integrationStatus}
                    style={{ backgroundColor: getStatusColor(integration.status) }}
                  >
                    {integration.status}
                  </span>
                </div>
                <p>{integration.description}</p>
                <div className={styles.integrationFeatures}>
                  {integration.features.map((feature, index) => (
                    <span key={index} className={styles.featureTag}>
                      {feature}
                    </span>
                  ))}
                </div>
                {integration.lastSync && (
                  <div className={styles.integrationFooter}>
                    <span className={styles.lastSync}>
                      Last sync: {integration.lastSync.toLocaleString()}
                    </span>
                  </div>
                )}

                <div className={styles.integrationActions}>
                  {integration.status === "connected" ? (
                    <button
                      className={styles.disconnectButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        disconnectIntegration(integration.id);
                      }}
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      className={styles.connectButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        connectIntegration(integration.id);
                      }}
                    >
                      Connect
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedIntegration && (
          <div className={styles.integrationDetails}>
            <h3>{selectedIntegration.name} Details</h3>
            <div className={styles.detailsContent}>
              <div className={styles.detailSection}>
                <h4>Configuration</h4>
                <div className={styles.configItems}>
                  <div className={styles.configItem}>
                    <span className={styles.configLabel}>Status:</span>
                    <span
                      className={styles.configValue}
                      style={{ color: getStatusColor(selectedIntegration.status) }}
                    >
                      {selectedIntegration.status}
                    </span>
                  </div>
                  <div className={styles.configItem}>
                    <span className={styles.configLabel}>Category:</span>
                    <span className={styles.configValue}>{selectedIntegration.category}</span>
                  </div>
                  {selectedIntegration.lastSync && (
                    <div className={styles.configItem}>
                      <span className={styles.configLabel}>Last Sync:</span>
                      <span className={styles.configValue}>
                        {selectedIntegration.lastSync.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.detailSection}>
                <h4>Features</h4>
                <div className={styles.featuresList}>
                  {selectedIntegration.features.map((feature, index) => (
                    <div key={index} className={styles.featureItem}>
                      <span className={styles.featureIcon}>✅</span>
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.detailActions}>
                <button className={styles.detailButton}>Configure</button>
                <button className={styles.detailButton}>Test Connection</button>
                <button className={styles.detailButton}>View Logs</button>
              </div>
            </div>
          </div>
        )}

        <div className={styles.integrationRecommendations}>
          <h3>Recommended Integrations</h3>
          <div className={styles.recommendationsGrid}>
            <div className={styles.recommendationCard}>
              <h4>🚀 Cloud Storage</h4>
              <p>Connect to cloud storage for automatic backups and file synchronization.</p>
              <div className={styles.recommendationActions}>
                <button className={styles.recButton}>Setup Cloud Sync</button>
              </div>
            </div>
            <div className={styles.recommendationCard}>
              <h4>📊 Monitoring</h4>
              <p>Integrate with monitoring tools for real-time system insights.</p>
              <div className={styles.recommendationActions}>
                <button className={styles.recButton}>Setup Monitoring</button>
              </div>
            </div>
            <div className={styles.recommendationCard}>
              <h4>💼 Productivity</h4>
              <p>Connect productivity tools for seamless workflow integration.</p>
              <div className={styles.recommendationActions}>
                <button className={styles.recButton}>Setup Productivity</button>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.integrationStats}>
          <h3>Integration Statistics</h3>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <h4>Data Synced</h4>
              <div className={styles.statValue}>
                {Math.round(analysisData.totalSize / (1024 * 1024 * 1024))} GB
              </div>
              <div className={styles.statLabel}>Across connected services</div>
            </div>
            <div className={styles.statCard}>
              <h4>Active Connections</h4>
              <div className={styles.statValue}>{connectedIntegrations}</div>
              <div className={styles.statLabel}>Real-time sync</div>
            </div>
            <div className={styles.statCard}>
              <h4>API Calls</h4>
              <div className={styles.statValue}>1,234</div>
              <div className={styles.statLabel}>This month</div>
            </div>
            <div className={styles.statCard}>
              <h4>Success Rate</h4>
              <div className={styles.statValue}>98.5%</div>
              <div className={styles.statLabel}>Sync success rate</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;
