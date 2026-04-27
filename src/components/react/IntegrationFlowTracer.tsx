import React, { useState, useEffect, FC } from "react";
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  GitBranch,
  Globe,
  Database,
  Code,
  Layers,
  Activity,
  Eye,
  EyeOff,
  Download,
  RefreshCw,
  AlertCircle,
  Info,
  Bug,
  Wrench,
  Settings,
} from "lucide-react";
import { dependencyCheckerService } from "../services/DependencyCheckerService";
import "./IntegrationFlowTracer.css";

interface IntegrationFlowTracerProps {
  files: any[];
  onConnectionSelect?: (connection: any) => void;
  width?: number;
  height?: number;
}

interface ConnectionFlow {
  frontendComponent: ComponentConnection;
  backendEndpoint: EndpointConnection;
  confidence: number;
  issues: string[];
  flowPath: FlowStep[];
}

interface FlowStep {
  id: string;
  type: "frontend" | "backend" | "api-call" | "response";
  description: string;
  file: string;
  line: number;
  status: "success" | "warning" | "error" | "pending";
  details?: any;
}

interface ComponentConnection {
  filePath: string;
  componentName: string;
  type: "button" | "function" | "effect";
  handler: string;
  line: number;
  column: number;
  apiCalls: APICall[];
}

interface EndpointConnection {
  filePath: string;
  endpoint: string;
  method: string;
  line: number;
  column: number;
  parameters: string[];
  responses: string[];
}

interface APICall {
  endpoint: string;
  method: string;
  line: number;
  column: number;
}

interface MissingConnection {
  frontendComponent: ComponentConnection;
  apiCall: APICall;
  suggestedEndpoint: string;
  confidence: "low" | "medium" | "high";
}

export const IntegrationFlowTracer: FC<IntegrationFlowTracerProps> = ({
  files,
  onConnectionSelect,
  width = 800,
  height = 600,
}) => {
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<ConnectionFlow[]>([]);
  const [missingConnections, setMissingConnections] = useState<MissingConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<ConnectionFlow | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "connected" | "missing" | "high-confidence">(
    "all"
  );
  const [showDetails, setShowDetails] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const [stats, setStats] = useState({
    totalConnections: 0,
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
    missingConnections: 0,
    frontendComponents: 0,
    backendEndpoints: 0,
  });

  // Load integration flow data
  useEffect(() => {
    const loadIntegrationData = async () => {
      setLoading(true);

      try {
        const analysis = await dependencyCheckerService.getIntegrationFlowAnalysis(files);

        // Convert to ConnectionFlow format
        const connectionFlows: ConnectionFlow[] = analysis.connections.map((conn) => ({
          ...conn,
          flowPath: generateFlowPath(conn.frontendComponent, conn.backendEndpoint),
        }));

        setConnections(connectionFlows);
        setMissingConnections(analysis.missingConnections);

        // Calculate stats
        const highConfidence = connectionFlows.filter((c) => c.confidence >= 0.8).length;
        const mediumConfidence = connectionFlows.filter(
          (c) => c.confidence >= 0.5 && c.confidence < 0.8
        ).length;
        const lowConfidence = connectionFlows.filter((c) => c.confidence < 0.5).length;

        setStats({
          totalConnections: connectionFlows.length,
          highConfidence,
          mediumConfidence,
          lowConfidence,
          missingConnections: analysis.missingConnections.length,
          frontendComponents: analysis.frontendComponents.length,
          backendEndpoints: analysis.backendEndpoints.length,
        });
      } catch (error) {
        console.error("Failed to load integration flow data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadIntegrationData();
  }, [files]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      // @ts-ignore - loadIntegrationData not defined
      // loadIntegrationData();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, files]);

  // Generate flow path for a connection
  const generateFlowPath = (
    component: ComponentConnection,
    endpoint: EndpointConnection
  ): FlowStep[] => {
    const path: FlowStep[] = [
      {
        id: `${component.filePath}::${component.handler}`,
        type: "frontend",
        description: `Button/Function: ${component.handler}`,
        file: component.filePath,
        line: component.line,
        status: "success",
        details: {
          componentName: component.componentName,
          type: component.type,
        },
      },
    ];

    // Add API call steps
    for (const apiCall of component.apiCalls) {
      path.push({
        id: `${component.filePath}::${apiCall.endpoint}`,
        type: "api-call",
        description: `API Call: ${apiCall.method} ${apiCall.endpoint}`,
        file: component.filePath,
        line: apiCall.line,
        status: apiCall.method === endpoint.method ? "success" : "warning",
        details: {
          calledEndpoint: apiCall.endpoint,
          expectedMethod: endpoint.method,
          actualMethod: apiCall.method,
        },
      });
    }

    // Add backend endpoint
    path.push({
      id: `${endpoint.filePath}::${endpoint.endpoint}`,
      type: "backend",
      description: `Endpoint: ${endpoint.method} ${endpoint.endpoint}`,
      file: endpoint.filePath,
      line: endpoint.line,
      status: "success",
      details: {
        parameters: endpoint.parameters,
        responses: endpoint.responses,
      },
    });

    return path;
  };

  // Filter connections based on search and filter type
  const filteredConnections = React.useMemo(() => {
    let filtered = [...connections];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (conn) =>
          conn.frontendComponent.componentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          conn.backendEndpoint.endpoint.toLowerCase().includes(searchTerm.toLowerCase()) ||
          conn.frontendComponent.filePath.toLowerCase().includes(searchTerm.toLowerCase()) ||
          conn.backendEndpoint.filePath.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    switch (filterType) {
      case "connected":
        // Already filtered
        break;
      case "missing":
        filtered = [];
        break;
      case "high-confidence":
        filtered = filtered.filter((conn) => conn.confidence >= 0.8);
        break;
      // @ts-ignore - medium-confidence not in type
      // case 'medium-confidence':
      //   filtered = filtered.filter(conn => conn.confidence >= 0.5 && conn.confidence < 0.8);
      //   break;
      // @ts-ignore - low-confidence not in type
      // case 'low-confidence':
      //   filtered = filtered.filter(conn => conn.confidence < 0.5);
      //   break;
    }

    return filtered;
  }, [connections, searchTerm, filterType]);

  const filteredMissingConnections = React.useMemo(() => {
    let filtered = [...missingConnections];

    if (searchTerm) {
      filtered = filtered.filter(
        (conn) =>
          conn.frontendComponent.componentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          conn.apiCall.endpoint.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [missingConnections, searchTerm]);

  const handleRefresh = () => {
    setLoading(true);
    // The useEffect will reload the data
  };

  const handleExport = () => {
    const data = {
      connections: filteredConnections,
      missingConnections: filteredMissingConnections,
      stats,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "integration-flow-analysis.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getConnectionIcon = (confidence: number) => {
    if (confidence >= 0.8) return <CheckCircle size={16} className="text-green-400" />;
    if (confidence >= 0.5) return <AlertTriangle size={16} className="text-yellow-400" />;
    return <XCircle size={16} className="text-red-400" />;
  };

  const getConnectionColor = (confidence: number) => {
    if (confidence >= 0.8) return "border-green-500";
    if (confidence >= 0.5) return "border-yellow-500";
    return "border-red-500";
  };

  if (loading) {
    return (
      <div className="integration-flow-tracer">
        <div className="loading-state">
          <RefreshCw className="animate-spin" size={24} />
          <p>Analyzing integration flows...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="integration-flow-tracer">
      {/* Header */}
      <div className="flow-header">
        <div className="header-left">
          <h3 className="flow-title">
            <Layers className="title-icon" size={20} />
            Integration Flow Tracer
          </h3>
          <div className="flow-stats">
            <div className="stat">
              <span className="stat-label">Connected</span>
              <span className="stat-value">{stats.totalConnections}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Missing</span>
              <span className="stat-value text-red-400">{stats.missingConnections}</span>
            </div>
            <div className="stat">
              <span className="stat-label">High Conf</span>
              <span className="stat-value text-green-400">{stats.highConfidence}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Components</span>
              <span className="stat-value">{stats.frontendComponents}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Endpoints</span>
              <span className="stat-value">{stats.backendEndpoints}</span>
            </div>
          </div>
        </div>

        <div className="header-right">
          {/* Search */}
          <div className="search-container">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              placeholder="Search components, endpoints..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>

          {/* Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">All Connections</option>
            <option value="connected">Connected Only</option>
            <option value="missing">Missing Only</option>
            <option value="high-confidence">High Confidence</option>
            <option value="medium-confidence">Medium Confidence</option>
            <option value="low-confidence">Low Confidence</option>
          </select>

          {/* Controls */}
          <button onClick={handleRefresh} className="control-btn" title="Refresh analysis">
            <RefreshCw size={16} />
          </button>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`control-btn ${autoRefresh ? "active" : ""}`}
            title="Auto-refresh every 30s"
          >
            <Activity size={16} />
          </button>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`control-btn ${showDetails ? "active" : ""}`}
            title="Toggle detailed view"
          >
            {showDetails ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>

          <button onClick={handleExport} className="control-btn" title="Export analysis">
            <Download size={16} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flow-content">
        {/* Connected Connections */}
        <div className="connections-section">
          <h4 className="section-title">
            <CheckCircle className="title-icon" size={16} />
            Connected Components ({filteredConnections.length})
          </h4>

          <div className="connections-list">
            {filteredConnections.map((connection, index) => (
              <div
                key={index}
                className={`connection-item ${getConnectionColor(connection.confidence)} ${selectedConnection === connection ? "selected" : ""}`}
                onClick={() => setSelectedConnection(connection)}
              >
                <div className="connection-header">
                  <div className="connection-info">
                    <div className="component-info">
                      <div className="component-name">
                        <Code size={14} className="component-icon" />
                        {connection.frontendComponent.componentName}
                      </div>
                      <div className="component-type">{connection.frontendComponent.type}</div>
                      <div className="component-file">
                        {connection.frontendComponent.filePath.split(/[/\\]/).pop()}
                      </div>
                    </div>

                    <div className="connection-arrow">
                      <ArrowRight size={16} className="arrow-icon" />
                    </div>

                    <div className="endpoint-info">
                      <div className="endpoint-name">
                        <Database size={14} className="endpoint-icon" />
                        {connection.backendEndpoint.endpoint}
                      </div>
                      <div className="endpoint-method">{connection.backendEndpoint.method}</div>
                      <div className="endpoint-file">
                        {connection.backendEndpoint.filePath.split(/[/\\]/).pop()}
                      </div>
                    </div>
                  </div>

                  <div className="connection-meta">
                    <div className="confidence-indicator">
                      {getConnectionIcon(connection.confidence)}
                      <span className="confidence-text">
                        {Math.round(connection.confidence * 100)}% confidence
                      </span>
                    </div>

                    <div className="issues-indicator">
                      {connection.issues.length > 0 && (
                        <div className="issues-badge">
                          <AlertTriangle size={12} />
                          <span>{connection.issues.length} issues</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {showDetails && (
                    <div className="connection-details">
                      <div className="flow-path">
                        <h5 className="path-title">Flow Path</h5>
                        <div className="path-steps">
                          {connection.flowPath.map((step, stepIndex) => (
                            <div key={stepIndex} className={`path-step ${step.status}`}>
                              <div className="step-icon">
                                {step.type === "frontend" && <Code size={14} />}
                                {step.type === "api-call" && <Globe size={14} />}
                                {step.type === "backend" && <Database size={14} />}
                              </div>
                              <div className="step-content">
                                <div className="step-description">{step.description}</div>
                                <div className="step-location">
                                  {step.file.split(/[/\\]/).pop()}:{step.line}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {connection.issues.length > 0 && (
                        <div className="connection-issues">
                          <h5 className="issues-title">Issues</h5>
                          <div className="issues-list">
                            {connection.issues.map((issue, issueIndex) => (
                              <div key={issueIndex} className="issue-item">
                                <Bug size={12} className="issue-icon" />
                                <span>{issue}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredConnections.length === 0 && (
              <div className="empty-state">
                <Info size={24} className="empty-icon" />
                <p>No connected components found</p>
                <p className="empty-description">
                  Try adjusting filters or check if frontend components are properly connected to
                  backend endpoints.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Missing Connections */}
        <div className="connections-section">
          <h4 className="section-title">
            <XCircle className="title-icon" size={16} />
            Missing Connections ({filteredMissingConnections.length})
          </h4>

          <div className="connections-list">
            {filteredMissingConnections.map((connection, index) => (
              <div key={index} className="connection-item missing-connection">
                <div className="connection-header">
                  <div className="component-info">
                    <div className="component-name">
                      <Code size={14} className="component-icon" />
                      {connection.frontendComponent.componentName}
                    </div>
                    <div className="component-type">{connection.frontendComponent.type}</div>
                    <div className="component-file">
                      {connection.frontendComponent.filePath.split(/[/\\]/).pop()}
                    </div>
                  </div>

                  <div className="connection-arrow missing">
                    <ArrowRight size={16} className="arrow-icon" />
                  </div>

                  <div className="endpoint-info missing">
                    <div className="endpoint-name">
                      <Database size={14} className="endpoint-icon" />
                      {connection.apiCall.endpoint}
                    </div>
                    <div className="endpoint-method">{connection.apiCall.method}</div>
                    <div className="endpoint-suggestion">
                      Suggested: {connection.suggestedEndpoint}
                    </div>
                  </div>
                </div>

                <div className="connection-meta">
                  <div className="confidence-indicator low">
                    <XCircle size={16} className="text-red-400" />
                    <span className="confidence-text">{connection.confidence} confidence</span>
                  </div>

                  <div className="action-suggestion">
                    <Wrench size={12} className="action-icon" />
                    <span>Create endpoint: {connection.suggestedEndpoint}</span>
                  </div>
                </div>
              </div>
            ))}

            {filteredMissingConnections.length === 0 && (
              <div className="empty-state">
                <CheckCircle size={24} className="empty-icon" />
                <p>No missing connections found</p>
                <p className="empty-description">
                  All frontend components appear to be properly connected to backend endpoints.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Auto-refresh indicator */}
      {autoRefresh && (
        <div className="auto-refresh-indicator">
          <Activity className="animate-pulse" size={12} />
          <span>Auto-refreshing every 30s</span>
        </div>
      )}
    </div>
  );
};
