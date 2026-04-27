import React, { useState, type FC, type ReactNode } from 'react';
import {
  Code,
  AlertTriangle,
  CheckCircle,
  Info,
  XCircle,
  Package,
  Trash2,
  Bug,
  FileText,
  GitBranch,
  TrendingUp,
  Shield,
  Zap,
  Download,
  Eye,
  EyeOff
} from 'lucide-react';
import { ProjectHealthMetrics, DependencyHealthAnalysis, CodeIssue } from '../services/CodeAnalysisService';
import './CodeAnalysisDisplay.css';

interface CodeAnalysisDisplayProps {
  healthMetrics: ProjectHealthMetrics | null;
  dependencyAnalysis: DependencyHealthAnalysis | null;
  onFixIssue?: (issue: CodeIssue) => void;
  onInstallDependency?: (dependency: string, command: string) => void;
  loading?: boolean;
}

export const CodeAnalysisDisplay: FC<CodeAnalysisDisplayProps> = ({
  healthMetrics, 
  dependencyAnalysis, 
  onFixIssue, 
  onInstallDependency,
  loading = false 
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('overview');

  const getHealthColor = (score: number): string => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#f59e0b';
    if (score >= 40) return '#ef4444';
    return '#6b7280';
  };

  const getHealthIcon = (score: number) => {
    if (score >= 80) return <CheckCircle size={16} className="health-icon health-score-high" />;
    if (score >= 60) return <Info size={16} className="health-icon health-score-medium" />;
    if (score >= 40) return <AlertTriangle size={16} className="health-icon health-score-low" />;
    return <XCircle size={16} className="health-icon health-score-good" />;
  };

  const getSeverityColor = (severity: 'error' | 'warning' | 'info'): string => {
    switch (severity) {
      case 'error': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'info': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const getSeverityIcon = (severity: 'error' | 'warning' | 'info') => {
    switch (severity) {
      case 'error': return <XCircle size={14} className="severity-icon severity-icon-error" />;
      case 'warning': return <AlertTriangle size={14} className="severity-icon severity-icon-warning" />;
      case 'info': return <Info size={14} className="severity-icon severity-icon-info" />;
      default: return <Info size={14} style={{ color: '#6b7280' }} />;
    }
  };

  if (!healthMetrics && !dependencyAnalysis) {
    return (
      <div className="code-analysis-panel">
        <div className="code-analysis-header">
          <div className="code-analysis-title">
            <Code size={48} className="code-analysis-no-data-icon" />
            <h3 className="code-analysis-title">No Code Analysis Available</h3>
            <p className="code-analysis-no-data-text">Run an analysis on a development directory to see code health metrics</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Health Overview */}
      {healthMetrics && (
        <div className="health-metrics">
          <div className="health-metric-item">
            <div className="health-metric-label">Code Health Score</div>
            <div className="health-metric-value">
              <div className="health-score" style={{ color: getHealthColor(healthMetrics.healthScore) }}>
                {healthMetrics.healthScore}%
              </div>
              <div className="health-issues">
                {healthMetrics.filesWithIssues} of {healthMetrics.totalFiles} files have issues
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="quick-stats">
            <div className="quick-stat-item">
              <div className="quick-stat-label">Errors</div>
              <div className="quick-stat-value">{healthMetrics.issuesBySeverity.error || 0}</div>
            </div>
            <div className="quick-stat-item">
              <div className="quick-stat-label">Warnings</div>
              <div className="quick-stat-value">{healthMetrics.issuesBySeverity.warning || 0}</div>
            </div>
            <div className="quick-stat-item">
              <div className="quick-stat-label">Info</div>
              <div className="quick-stat-value">{healthMetrics.issuesBySeverity.info || 0}</div>
            </div>
            <div className="quick-stat-item">
              <div className="quick-stat-label">Total Issues</div>
              <div className="quick-stat-value">{healthMetrics.totalIssues}</div>
            </div>
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="category-tabs">
        {['overview', 'dependencies', 'unused', 'bugs'].map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`category-tab ${selectedCategory === category ? 'active' : ''}`}
          >
            {category === 'overview' && <TrendingUp size={14} />}
            {category === 'dependencies' && <Package size={14} />}
            {category === 'unused' && <Trash2 size={14} />}
            {category === 'bugs' && <Bug size={14} />}
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </button>
        ))}
      </div>

      {/* Content Based on Selected Category */}
      <div className="content-container">
        {selectedCategory === 'overview' && (
          <OverviewTab healthMetrics={healthMetrics} dependencyAnalysis={dependencyAnalysis} />
        )}
        
        {selectedCategory === 'dependencies' && (
          <DependenciesTab 
            dependencyAnalysis={dependencyAnalysis} 
            onInstallDependency={onInstallDependency}
          />
        )}
        
        {selectedCategory === 'unused' && (
          <UnusedCodeTab 
            dependencyAnalysis={dependencyAnalysis}
            onFixIssue={onFixIssue}
          />
        )}
        
        {selectedCategory === 'bugs' && (
          <BugsTab 
            dependencyAnalysis={dependencyAnalysis}
            onFixIssue={onFixIssue}
          />
        )}
      </div>

      {/* Recommendations */}
      {healthMetrics?.recommendations && healthMetrics.recommendations.length > 0 && (
        <div className="recommendations">
          <h4 className="recommendation-title">Recommendations</h4>
          <div className="recommendation-list">
            {healthMetrics.recommendations.map((rec, index) => (
              <div key={index} className="recommendation-item">
                <div className="recommendation-header">
                  <div className="recommendation-title">{rec}</div>
                </div>
                <div className="recommendation-description">{rec}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Overview Tab Component
const OverviewTab: FC<{ healthMetrics: ProjectHealthMetrics | null; dependencyAnalysis: DependencyHealthAnalysis | null }> = ({ healthMetrics, dependencyAnalysis }) => {
  if (!healthMetrics) return null;

  return (
    <div className="overview-tab">
      {/* Issue Distribution */}
      <div className="issue-distribution">
        <h4 className="issue-type">Issue Distribution</h4>
        <div className="issue-list">
          {Object.entries(healthMetrics.issuesByType).map(([type, count]) => (
            <div key={type} className="issue-item">
              <div className="issue-item-header">
                <div className="issue-item-title">{type.replace(/_/g, ' ')}</div>
                <div className="issue-item-count">{count}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Health Trend */}
      <div className="glass-panel">
        <h4 className="health-assessment">Health Assessment</h4>
        <div className="health-trend">
          <div className="health-score-container">
            {/* @ts-ignore - getHealthColor function */}
            <div className="health-score" style={{ color: getHealthColor(healthMetrics.healthScore) }}>
              {healthMetrics.healthScore}%
            </div>
            <div className="health-score-description">
              {healthMetrics.healthScore >= 80 ? 'Excellent' : 
               healthMetrics.healthScore >= 60 ? 'Good' : 
               healthMetrics.healthScore >= 40 ? 'Fair' : 'Poor'} Code Health
            </div>
          </div>
          <div className="health-description">
            {healthMetrics.healthScore >= 80 ? 'Your code is well-maintained with minimal issues' :
             healthMetrics.healthScore >= 60 ? 'Good code quality with some room for improvement' :
             healthMetrics.healthScore >= 40 ? 'Code needs attention and cleanup' :
             'Significant code quality issues require immediate attention'}
          </div>
        </div>
      </div>
    </div>
  );
};

// Dependencies Tab Component
const DependenciesTab: FC<{
  dependencyAnalysis: DependencyHealthAnalysis | null; 
  onInstallDependency?: (dependency: string, command: string) => void;
}> = ({ dependencyAnalysis, onInstallDependency }) => {
  if (!dependencyAnalysis) return null;

  const { missingDependencies, unusedImports } = dependencyAnalysis;

  return (
    <div className="dependencies-tab">
      {/* Missing Dependencies */}
      {missingDependencies.length > 0 && (
        <div className="missing-dependencies">
          <h4 className="missing-dependencies-title">Missing Dependencies ({missingDependencies.length})</h4>
          <div className="missing-dependencies-list">
            {missingDependencies.map((dep, index) => (
              <div key={index} className="missing-dependency">
                <div className="missing-dependency-header">
                  <div className="missing-dependency-title">{dep.dependency}</div>
                  <button
                    onClick={() => onInstallDependency?.(dep.dependency, dep.installCommand)}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '6px',
                      background: '#22c55e',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <Download size={14} />
                    Install
                  </button>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  <code>{dep.installCommand}</code>
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  {dep.files.map((file, fileIndex) => (
                    <div key={fileIndex} style={{ 
                      padding: '0.25rem 0.5rem', 
                      background: 'rgba(239, 68, 68, 0.1)', 
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      color: 'var(--text-primary)',
                      marginBottom: '0.25rem'
                    }}>
                      {file}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unused Imports */}
      {unusedImports.length > 0 && (
        <div className="glass-panel" style={{ background: 'rgba(245, 158, 11, 0.1)', borderLeft: '4px solid #f59e0b' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Trash2 size={16} />
            Unused Imports ({unusedImports.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {unusedImports.map((unused, index) => (
              <div key={index} style={{ 
                padding: '1rem', 
                background: 'rgba(245, 158, 11, 0.05)', 
                borderRadius: '8px'
              }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  {unused.file.split(/[/\\]/).pop()}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {unused.imports.map((imp, impIndex) => (
                    <span key={impIndex} style={{ 
                      padding: '0.25rem 0.5rem',
                      background: 'rgba(245, 158, 11, 0.2)',
                      borderRadius: '4px',
                      color: '#f59e0b',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace'
                    }}>
                      {imp}
                    </span>
                  ))}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                  Lines {unused.linesToRemove.join(', ')} can be removed
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {missingDependencies.length === 0 && unusedImports.length === 0 && (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <CheckCircle size={48} style={{ margin: '0 auto 1rem', color: '#22c55e' }} />
          <h3>All Dependencies Look Good!</h3>
          <p>No missing or unused dependencies detected</p>
        </div>
      )}
    </div>
  );
};

// Unused Code Tab Component
const UnusedCodeTab: FC<{ 
  dependencyAnalysis: DependencyHealthAnalysis | null;
  onFixIssue?: (issue: CodeIssue) => void;
}> = ({ dependencyAnalysis, onFixIssue }) => {
  if (!dependencyAnalysis) return null;

  const { unusedVariables, deadCode } = dependencyAnalysis;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Unused Variables */}
      {unusedVariables.length > 0 && (
        <div className="glass-panel" style={{ background: 'rgba(245, 158, 11, 0.1)', borderLeft: '4px solid #f59e0b' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Trash2 size={16} />
            Unused Variables ({unusedVariables.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {unusedVariables.map((unused, index) => (
              <div key={index} style={{ 
                padding: '1rem', 
                background: 'rgba(245, 158, 11, 0.05)', 
                borderRadius: '8px'
              }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  {unused.file.split(/[/\\]/).pop()}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {unused.variables.map((variable, varIndex) => (
                    <span key={varIndex} style={{ 
                      padding: '0.25rem 0.5rem',
                      background: 'rgba(245, 158, 11, 0.2)',
                      borderRadius: '4px',
                      color: '#f59e0b',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace'
                    }}>
                      {variable.name} ({variable.type})
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dead Code */}
      {deadCode.length > 0 && (
        <div className="glass-panel" style={{ background: 'rgba(107, 114, 128, 0.1)', borderLeft: '4px solid #6b7280' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={16} />
            Dead Code ({deadCode.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {deadCode.map((dead, index) => (
              <div key={index} style={{ 
                padding: '1rem', 
                background: 'rgba(107, 114, 128, 0.05)', 
                borderRadius: '8px'
              }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  {dead.file.split(/[/\\]/).pop()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {dead.functions.map((func, funcIndex) => (
                    <div key={funcIndex} style={{ 
                      padding: '0.5rem', 
                      background: 'rgba(107, 114, 128, 0.1)', 
                      borderRadius: '4px',
                      fontSize: '0.875rem'
                    }}>
                      <div style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        Function: {func.name} (line {func.line})
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        {func.reason}
                      </div>
                    </div>
                  ))}
                  {dead.classes.map((cls, clsIndex) => (
                    <div key={clsIndex} style={{ 
                      padding: '0.5rem', 
                      background: 'rgba(107, 114, 128, 0.1)', 
                      borderRadius: '4px',
                      fontSize: '0.875rem'
                    }}>
                      <div style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                        Class: {cls.name} (line {cls.line})
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        {cls.reason}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {unusedVariables.length === 0 && deadCode.length === 0 && (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <CheckCircle size={48} style={{ margin: '0 auto 1rem', color: '#22c55e' }} />
          <h3>No Unused Code Found!</h3>
          <p>Your code appears to be clean and efficient</p>
        </div>
      )}
    </div>
  );
};

// Bugs Tab Component
const BugsTab: FC<{ 
  dependencyAnalysis: DependencyHealthAnalysis | null;
  onFixIssue?: (issue: CodeIssue) => void;
}> = ({ dependencyAnalysis, onFixIssue }) => {
  if (!dependencyAnalysis) return null;

  const { potentialBugs, undefinedVariables } = dependencyAnalysis;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Potential Bugs */}
      {potentialBugs.length > 0 && (
        <div className="glass-panel" style={{ background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bug size={16} />
            Potential Bugs ({potentialBugs.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {potentialBugs.map((bugFile, index) => (
              <div key={index} style={{ 
                padding: '1rem', 
                background: 'rgba(239, 68, 68, 0.05)', 
                borderRadius: '8px'
              }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  {bugFile.file.split(/[/\\]/).pop()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {bugFile.issues.map((issue, issueIndex) => (
                    <div key={issueIndex} style={{ 
                      padding: '0.75rem', 
                      background: 'rgba(239, 68, 68, 0.1)', 
                      borderRadius: '6px',
                      borderLeft: '3px solid #ef4444'
                    }}>
                      <div style={{ color: 'var(--text-primary)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                        <strong>{issue.type}</strong> (line {issue.line})
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                        {issue.description}
                      </div>
                      <div style={{ color: '#22c55e', fontSize: '0.875rem' }}>
                        💡 {issue.suggestion}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Undefined Variables */}
      {undefinedVariables.length > 0 && (
        <div className="glass-panel" style={{ background: 'rgba(245, 158, 11, 0.1)', borderLeft: '4px solid #f59e0b' }}>
          <h4 style={{ margin: '0 0 1rem 0', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} />
            Undefined Variables ({undefinedVariables.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {undefinedVariables.map((undef, index) => (
              <div key={index} style={{ 
                padding: '1rem', 
                background: 'rgba(245, 158, 11, 0.05)', 
                borderRadius: '8px'
              }}>
                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                  {undef.file.split(/[/\\]/).pop()}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {undef.variables.map((variable, varIndex) => (
                    <span key={varIndex} style={{ 
                      padding: '0.25rem 0.5rem',
                      background: 'rgba(245, 158, 11, 0.2)',
                      borderRadius: '4px',
                      color: '#f59e0b',
                      fontSize: '0.75rem',
                      fontFamily: 'monospace'
                    }}>
                      {variable.name} (line {variable.line}, used {variable.usageCount}x)
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {potentialBugs.length === 0 && undefinedVariables.length === 0 && (
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <CheckCircle size={48} style={{ margin: '0 auto 1rem', color: '#22c55e' }} />
          <h3>No Bugs Detected!</h3>
          <p>Your code appears to be bug-free</p>
        </div>
      )}
    </div>
  );
};

export default CodeAnalysisDisplay;
