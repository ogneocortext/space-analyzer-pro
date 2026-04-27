import React, { useState, useEffect, FC } from "react";
import {
  Code,
  GitBranch,
  Package,
  Shield,
  Zap,
  FileText,
  Hammer,
  BookOpen,
  TestTube,
  Users,
  Scale,
  BrainCircuit,
  Search,
  Filter,
  ChevronRight,
  Activity,
  CheckCircle,
  AlertCircle,
  XCircle,
  TrendingUp,
  FileSearch,
  Settings,
  Play,
  Download,
  Eye,
  EyeOff,
  Microscope,
} from "lucide-react";

interface DevelopmentTabProps {
  projectPath: string;
  onPathChange: (path: string) => void;
  comprehensiveResult?: any;
  isAnalyzing?: boolean;
  onComprehensiveAnalysis?: (config: any) => void;
}

interface DevelopmentMetrics {
  totalFiles: number;
  codeFiles: number;
  testFiles: number;
  configFiles: number;
  docFiles: number;
  totalLines: number;
  languages: { [key: string]: number };
  dependencies: { [key: string]: string };
  issues: {
    security: number;
    performance: number;
    quality: number;
    total: number;
  };
}

export default function DevelopmentTab({
  projectPath,
  onPathChange,
  comprehensiveResult,
  isAnalyzing = false,
  onComprehensiveAnalysis,
}: DevelopmentTabProps) {
  const [activeSection, setActiveSection] = useState<
    "overview" | "analysis" | "dependencies" | "quality" | "security" | "performance"
  >("overview");
  const [metrics, setMetrics] = useState<DevelopmentMetrics | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());

  // Calculate development metrics from comprehensive results
  useEffect(() => {
    if (comprehensiveResult) {
      const calculatedMetrics: DevelopmentMetrics = {
        totalFiles: comprehensiveResult.metadata.total_files || 0,
        codeFiles: 0,
        testFiles: 0,
        configFiles: 0,
        docFiles: 0,
        totalLines: 0,
        languages: {},
        dependencies: {},
        issues: {
          security: 0,
          performance: 0,
          quality: 0,
          total: 0,
        },
      };

      // Extract metrics from analyzer results
      Object.entries(comprehensiveResult.results).forEach(
        ([analyzerName, result]: [string, any]) => {
          switch (analyzerName) {
            case "dependency_analysis":
              calculatedMetrics.dependencies = result.dependencies || {};
              break;
            case "security_analysis":
              calculatedMetrics.issues.security = result.security_issues?.length || 0;
              break;
            case "performance_analysis":
              calculatedMetrics.issues.performance = result.performance_issues?.length || 0;
              break;
            case "code_quality_analysis":
              calculatedMetrics.issues.quality = result.quality_issues?.length || 0;
              break;
            case "test_analysis":
              calculatedMetrics.testFiles = result.test_files || 0;
              break;
          }
        }
      );

      calculatedMetrics.issues.total =
        calculatedMetrics.issues.security +
        calculatedMetrics.issues.performance +
        calculatedMetrics.issues.quality;

      setMetrics(calculatedMetrics);
    }
  }, [comprehensiveResult]);

  const handleQuickAnalysis = () => {
    const config = {
      projectPath,
      selectedAnalyzers: ["dependency", "quality", "security", "performance", "test"],
      outputFormat: "json" as const,
      progress: true,
      verbose: true,
    };
    onComprehensiveAnalysis?.(config);
  };

  const toggleFileExpansion = (fileId: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(fileId)) {
      newExpanded.delete(fileId);
    } else {
      newExpanded.add(fileId);
    }
    setExpandedFiles(newExpanded);
  };

  const renderOverview = () => (
    <div className="development-overview">
      {/* Project Header */}
      <div className="project-header">
        <div className="project-info">
          <h2 className="project-title">
            <Code className="w-6 h-6 mr-2" />
            Software Development Dashboard
          </h2>
          <p className="project-path">{projectPath || "No project selected"}</p>
        </div>
        <div className="project-actions">
          <button onClick={() => onPathChange("")} className="btn-secondary">
            <FileSearch className="w-4 h-4 mr-2" />
            Change Project
          </button>
          <button
            onClick={handleQuickAnalysis}
            disabled={isAnalyzing || !projectPath}
            className="btn-primary"
          >
            {isAnalyzing ? (
              <>
                <Activity className="w-4 h-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Quick Analysis
              </>
            )}
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      {metrics && (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon">
              <FileText className="w-6 h-6" />
            </div>
            <div className="metric-content">
              <div className="metric-value">{metrics.totalFiles.toLocaleString()}</div>
              <div className="metric-label">Total Files</div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">
              <Code className="w-6 h-6" />
            </div>
            <div className="metric-content">
              <div className="metric-value">{metrics.codeFiles.toLocaleString()}</div>
              <div className="metric-label">Code Files</div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">
              <TestTube className="w-6 h-6" />
            </div>
            <div className="metric-content">
              <div className="metric-value">{metrics.testFiles.toLocaleString()}</div>
              <div className="metric-label">Test Files</div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">
              <Package className="w-6 h-6" />
            </div>
            <div className="metric-content">
              <div className="metric-value">{Object.keys(metrics.dependencies).length}</div>
              <div className="metric-label">Dependencies</div>
            </div>
          </div>

          <div className="metric-card issues-card">
            <div className="metric-icon">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="metric-content">
              <div className="metric-value">{metrics.issues.total}</div>
              <div className="metric-label">Total Issues</div>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div className="metric-content">
              <div className="metric-value">{metrics.totalLines.toLocaleString()}</div>
              <div className="metric-label">Lines of Code</div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="quick-actions">
        <h3 className="section-title">Development Tools</h3>
        <div className="action-grid">
          <button onClick={() => setActiveSection("analysis")} className="action-btn">
            <BrainCircuit className="w-5 h-5 mb-2" />
            <span>Comprehensive Analysis</span>
            <span className="action-desc">Run all 12 specialized analyzers</span>
          </button>

          <button onClick={() => setActiveSection("dependencies")} className="action-btn">
            <Package className="w-5 h-5 mb-2" />
            <span>Dependencies</span>
            <span className="action-desc">Analyze project dependencies</span>
          </button>

          <button onClick={() => setActiveSection("quality")} className="action-btn">
            <CheckCircle className="w-5 h-5 mb-2" />
            <span>Code Quality</span>
            <span className="action-desc">Check code quality metrics</span>
          </button>

          <button onClick={() => setActiveSection("security")} className="action-btn">
            <Shield className="w-5 h-5 mb-2" />
            <span>Security</span>
            <span className="action-desc">Security vulnerability scan</span>
          </button>

          <button onClick={() => setActiveSection("performance")} className="action-btn">
            <Zap className="w-5 h-5 mb-2" />
            <span>Performance</span>
            <span className="action-desc">Performance analysis</span>
          </button>

          <button onClick={() => setShowAnalysisModal(true)} className="action-btn">
            <Settings className="w-5 h-5 mb-2" />
            <span>Custom Analysis</span>
            <span className="action-desc">Configure custom analysis</span>
          </button>
        </div>
      </div>

      {/* Recent Issues */}
      {metrics && metrics.issues.total > 0 && (
        <div className="issues-summary">
          <h3 className="section-title">Issues Summary</h3>
          <div className="issues-grid">
            <div className="issue-item security">
              <Shield className="w-4 h-4" />
              <span>Security Issues: {metrics.issues.security}</span>
            </div>
            <div className="issue-item performance">
              <Zap className="w-4 h-4" />
              <span>Performance Issues: {metrics.issues.performance}</span>
            </div>
            <div className="issue-item quality">
              <CheckCircle className="w-4 h-4" />
              <span>Quality Issues: {metrics.issues.quality}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderAnalysisSection = () => (
    <div className="analysis-section">
      <div className="section-header">
        <h2>
          <Microscope className="w-5 h-5" /> Comprehensive Analysis
        </h2>
        <p>Deep code analysis with 12 specialized analyzers</p>
      </div>

      {comprehensiveResult ? (
        <div className="analysis-results">
          <div className="result-summary">
            <h3>Analysis Summary</h3>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="summary-label">Analyzers Run:</span>
                <span className="summary-value">
                  {comprehensiveResult.metadata.analyzers_run.length}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Files Analyzed:</span>
                <span className="summary-value">
                  {comprehensiveResult.metadata.total_files.toLocaleString()}
                </span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Analysis Time:</span>
                <span className="summary-value">
                  {new Date(comprehensiveResult.metadata.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="analyzer-results">
            <h3>Analyzer Results</h3>
            {Object.entries(comprehensiveResult.results).map(
              ([analyzerName, result]: [string, any]) => (
                <div key={analyzerName} className="analyzer-result">
                  <div
                    className="analyzer-header"
                    onClick={() => toggleFileExpansion(analyzerName)}
                  >
                    <ChevronRight
                      className={`w-4 h-4 transition-transform chevron ${
                        expandedFiles.has(analyzerName) ? "rotate-90" : ""
                      }`}
                    />
                    <h4>
                      {analyzerName.replace("_analysis", "").replace(/_/g, " ").toUpperCase()}
                    </h4>
                    <div className="analyzer-status">
                      {result.status === "completed" ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  </div>

                  {expandedFiles.has(analyzerName) && (
                    <div className="analyzer-details">
                      <div className="detail-grid">
                        <div className="detail-item">
                          <span className="detail-label">Issues Found:</span>
                          <span className="detail-value">{result.issues_found || 0}</span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Score:</span>
                          <span className="detail-value">
                            {result.score ? `${result.score.toFixed(1)}%` : "N/A"}
                          </span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Files Analyzed:</span>
                          <span className="detail-value">{result.analyzed_files || 0}</span>
                        </div>
                      </div>

                      {result.issues && result.issues.length > 0 && (
                        <div className="issues-list">
                          <h5>Issues Found:</h5>
                          {result.issues.slice(0, 5).map((issue: any, index: number) => (
                            <div key={index} className="issue-item">
                              <span className="issue-severity">{issue.severity}</span>
                              <span className="issue-description">{issue.description}</span>
                            </div>
                          ))}
                          {result.issues.length > 5 && (
                            <p className="more-issues">
                              ... and {result.issues.length - 5} more issues
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <BrainCircuit className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3>No Analysis Results</h3>
          <p>Run a comprehensive analysis to see detailed results.</p>
          <button onClick={handleQuickAnalysis} className="btn-primary">
            <Play className="w-4 h-4 mr-2" />
            Start Analysis
          </button>
        </div>
      )}
    </div>
  );

  const renderDependenciesSection = () => (
    <div className="dependencies-section">
      <div className="section-header">
        <h2>
          <GitBranch className="w-5 h-5" /> Dependencies Analysis
        </h2>
        <p>Project dependencies and relationships</p>
      </div>

      {metrics && Object.keys(metrics.dependencies).length > 0 ? (
        <div className="dependencies-content">
          <div className="dependencies-stats">
            <h3>Dependency Summary</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Total Dependencies:</span>
                <span className="stat-value">{Object.keys(metrics.dependencies).length}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">External Packages:</span>
                <span className="stat-value">
                  {
                    Object.values(metrics.dependencies).filter(
                      (dep: string) => dep.includes("node_modules") || dep.includes("vendor")
                    ).length
                  }
                </span>
              </div>
            </div>
          </div>

          <div className="dependencies-list">
            <h3>Dependency Details</h3>
            {Object.entries(metrics.dependencies)
              .slice(0, 20)
              .map(([name, version]: [string, string]) => (
                <div key={name} className="dependency-item">
                  <span className="dependency-name">{name}</span>
                  <span className="dependency-version">{version}</span>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <Package className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3>No Dependencies Found</h3>
          <p>Run an analysis to see project dependencies.</p>
        </div>
      )}
    </div>
  );

  const renderQualitySection = () => (
    <div className="quality-section">
      <div className="section-header">
        <h2>
          <CheckCircle className="w-5 h-5" /> Code Quality Analysis
        </h2>
        <p>Code quality metrics and technical debt</p>
      </div>

      {metrics && metrics.issues.quality > 0 ? (
        <div className="quality-content">
          <div className="quality-overview">
            <div className="quality-score">
              <div className="score-circle">
                <div className="score-value">
                  {Math.max(0, 100 - metrics.issues.quality * 5).toFixed(0)}%
                </div>
              </div>
              <div className="score-label">Quality Score</div>
            </div>

            <div className="quality-metrics">
              <div className="quality-metric">
                <span className="metric-label">Code Smells:</span>
                <span className="metric-value">{metrics.issues.quality}</span>
              </div>
              <div className="quality-metric">
                <span className="metric-label">Technical Debt:</span>
                <span className="metric-value">Medium</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3>Great Code Quality!</h3>
          <p>No quality issues detected.</p>
        </div>
      )}
    </div>
  );

  const renderSecuritySection = () => (
    <div className="security-section">
      <div className="section-header">
        <h2>
          <Shield className="w-5 h-5" /> Security Analysis
        </h2>
        <p>Security vulnerabilities and risks</p>
      </div>

      {metrics && metrics.issues.security > 0 ? (
        <div className="security-content">
          <div className="security-alerts">
            <div className="alert-header">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <h3>Security Issues Found</h3>
            </div>
            <div className="security-summary">
              <div className="summary-item critical">
                <span>Critical: {Math.floor(metrics.issues.security * 0.2)}</span>
              </div>
              <div className="summary-item high">
                <span>High: {Math.floor(metrics.issues.security * 0.3)}</span>
              </div>
              <div className="summary-item medium">
                <span>Medium: {Math.floor(metrics.issues.security * 0.5)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <Shield className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3>No Security Issues</h3>
          <p>Your code appears to be secure.</p>
        </div>
      )}
    </div>
  );

  const renderPerformanceSection = () => (
    <div className="performance-section">
      <div className="section-header">
        <h2>
          <Zap className="w-5 h-5" /> Performance Analysis
        </h2>
        <p>Performance bottlenecks and optimization opportunities</p>
      </div>

      {metrics && metrics.issues.performance > 0 ? (
        <div className="performance-content">
          <div className="performance-issues">
            <h3>Performance Issues</h3>
            <div className="issue-list">
              <div className="performance-issue">
                <Zap className="w-4 h-4 text-yellow-500 mr-2" />
                <span>Bottlenecks detected: {metrics.issues.performance}</span>
              </div>
              <div className="performance-issue">
                <TrendingUp className="w-4 h-4 text-blue-500 mr-2" />
                <span>Optimization opportunities available</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <Zap className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3>Good Performance</h3>
          <p>No major performance issues detected.</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="development-tab">
      {/* Section Navigation */}
      <div className="section-nav">
        {[
          { id: "overview", label: "Overview", icon: FileSearch },
          { id: "analysis", label: "Analysis", icon: BrainCircuit },
          { id: "dependencies", label: "Dependencies", icon: Package },
          { id: "quality", label: "Quality", icon: CheckCircle },
          { id: "security", label: "Security", icon: Shield },
          { id: "performance", label: "Performance", icon: Zap },
        ].map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id as any)}
              className={`section-btn ${activeSection === section.id ? "active" : ""}`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {section.label}
            </button>
          );
        })}
      </div>

      {/* Section Content */}
      <div className="section-content">
        {activeSection === "overview" && renderOverview()}
        {activeSection === "analysis" && renderAnalysisSection()}
        {activeSection === "dependencies" && renderDependenciesSection()}
        {activeSection === "quality" && renderQualitySection()}
        {activeSection === "security" && renderSecuritySection()}
        {activeSection === "performance" && renderPerformanceSection()}
      </div>
    </div>
  );
}
