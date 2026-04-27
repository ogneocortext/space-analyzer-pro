import React, { useState, FC } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  XCircle, 
  GitBranch, 
  FileText, 
  Shield, 
  TrendingUp,
  ArrowRight,
  Zap,
  Lock,
  Unlock,
  Eye,
  EyeOff
} from 'lucide-react';
import './DependencyImpactAnalyzer.css';
// @ts-ignore - DependencyCheckerService module
import { PredictiveDependencyAnalysis, DependencyImpact } from '../services/DependencyCheckerService';

interface DependencyImpactAnalyzerProps {
  analysis: PredictiveDependencyAnalysis | null;
  onExecuteAction: (action: string, alternative?: string) => void;
  loading?: boolean;
}

export const DependencyImpactAnalyzer: FC<DependencyImpactAnalyzerProps> = ({ 
  analysis, 
  onExecuteAction, 
  loading = false 
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [selectedImpact, setSelectedImpact] = useState<DependencyImpact | null>(null);

  const getRiskColor = (risk: 'critical' | 'high' | 'medium' | 'low' | 'none') => {
    switch (risk) {
      case 'critical': return '#ef4444';
      case 'high': return '#f59e0b';
      case 'medium': return '#3b82f6';
      case 'low': return '#22c55e';
      case 'none': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getRiskIcon = (risk: 'critical' | 'high' | 'medium' | 'low' | 'none') => {
    switch (risk) {
      case 'critical': return <XCircle size={16} className="severity-icon severity-icon-error" />;
      case 'high': return <AlertTriangle size={16} className="severity-icon severity-icon-warning" />;
      case 'medium': return <Info size={16} className="severity-icon severity-icon-info" />;
      case 'low': return <CheckCircle size={16} className="severity-icon severity-icon-info" />;
      case 'none': return <CheckCircle size={16} className="severity-icon severity-icon-info" />;
    }
  };

  const getImpactIcon = (impact: 'critical' | 'high' | 'medium' | 'low' | 'none') => {
    switch (impact) {
      case 'critical': return <XCircle size={14} style={{ color: '#ef4444' }} />;
      case 'high': return <AlertTriangle size={14} style={{ color: '#f59e0b' }} />;
      case 'medium': return <Info size={14} style={{ color: '#3b82f6' }} />;
      case 'low': return <CheckCircle size={14} style={{ color: '#22c55e' }} />;
      case 'none': return <CheckCircle size={14} style={{ color: '#6b7280' }} />;
      default: return <Info size={14} style={{ color: '#6b7280' }} />;
    }
  };

  const getRiskBackground = (risk: 'critical' | 'high' | 'medium' | 'low' | 'none') => {
    switch (risk) {
      case 'critical': return 'rgba(239, 68, 68, 0.1)';
      case 'high': return 'rgba(245, 158, 11, 0.1)';
      case 'medium': return 'rgba(59, 130, 246, 0.1)';
      case 'low': return 'rgba(34, 197, 94, 0.1)';
      case 'none': return 'rgba(107, 114, 128, 0.1)';
      default: return 'rgba(107, 114, 128, 0.1)';
    }
  };

  if (!analysis) {
    return (
      <div className="dependency-impact-panel">
        <div className="dependency-impact-header">
          <div className="dependency-impact-title">
            <GitBranch size={48} className="dependency-impact-icon" />
            <h3 className="dependency-impact-title">Dependency Impact Analysis</h3>
          </div>
        </div>
      </div>
    );
  }

  const totalAffectedFiles = analysis.directImpacts.length + analysis.cascadingImpacts.length;
  const criticalImpacts = [...analysis.directImpacts, ...analysis.cascadingImpacts].filter(i => i.riskLevel === 'critical').length;
  const highImpacts = [...analysis.directImpacts, ...analysis.cascadingImpacts].filter(i => i.riskLevel === 'high').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Risk Overview */}
      <div className="glass-panel" style={{ 
        background: getRiskBackground(analysis.overallRisk),
        borderLeft: `4px solid ${getRiskColor(analysis.overallRisk)}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          {getRiskIcon(analysis.overallRisk)}
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
              {analysis.action.charAt(0).toUpperCase() + analysis.action.slice(1)} Impact Analysis
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              {analysis.targetFiles.length} target files • {totalAffectedFiles} total affected
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ 
              padding: '0.5rem 1rem', 
              borderRadius: '20px', 
              background: getRiskColor(analysis.overallRisk),
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="quick-stats">
          <div className="quick-stat-item">
            <div className="quick-stat-label">Critical Impacts</div>
            <div className="quick-stat-value">{criticalImpacts}</div>
          </div>
          <div className="quick-stat-item">
            <div className="quick-stat-label">High Impacts</div>
            <div className="quick-stat-value">{highImpacts}</div>
          </div>
          <div className="quick-stat-item">
            <div className="quick-stat-label">Direct Impacts</div>
            <div className="quick-stat-value">{analysis.directImpacts.length}</div>
          </div>
          <div className="quick-stat-item">
            <div className="quick-stat-label">Cascading Impacts</div>
            <div className="quick-stat-value">{analysis.cascadingImpacts.length}</div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <div className="glass-panel recommendations">
          <h4 className="recommendation-title">Recommendations</h4>
          <div className="recommendation-list">
            {analysis.recommendations.map((rec, index) => (
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

      {/* Alternative Actions */}
      {analysis.alternativeActions.length > 0 && (
        <div className="glass-panel alternative-actions">
          <h4 className="alternative-action-title">Safer Alternatives</h4>
          <div className="alternative-action-list">
            {analysis.alternativeActions.map((alt, index) => (
              <div key={index} className="alternative-action-item">
                <div className="alternative-action-header">
                  <div className="alternative-action-title">{alt.action.charAt(0).toUpperCase() + alt.action.slice(1)}</div>
                  <div className="alternative-action-risk-level">
                    <span className={`risk-level ${getRiskColor(alt.risk)}`}>{alt.risk.toUpperCase()}</span>
                  </div>
                </div>
                <div className="alternative-action-description">{alt.description}</div>
                <div className="alternative-action-benefits">
                  {alt.benefits.map((benefit, benefitIndex) => (
                    <span key={benefitIndex} className="benefit">{benefit}</span>
                  ))}
                </div>
                <button
                  onClick={() => onExecuteAction(alt.action)}
                  disabled={loading}
                  className={`execute-action-btn ${loading ? 'loading' : ''}`}
                >
                  <Zap size={14} />
                  {loading ? 'Processing...' : `Execute ${alt.action}`}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Impact Details */}
      <div className="glass-panel">
        <div className="impact-details-header">
          <h4 className="impact-details-title">Impact Details</h4>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className={`show-details-btn ${showDetails ? 'active' : ''}`}
          >
            {showDetails ? <EyeOff size={14} /> : <Eye size={14} />}
            {showDetails ? 'Hide' : 'Show'} Details
          </button>
        </div>

        {showDetails && (
          <div className="impact-details-content">
            {/* Direct Impacts */}
            {analysis.directImpacts.length > 0 && (
              <div>
                <h5 className="impact-type-title">Direct Impacts ({analysis.directImpacts.length})</h5>
                <div className="impact-list">
                  {analysis.directImpacts.map((impact, index) => (
                    <ImpactCard 
                      key={index} 
                      impact={impact} 
                      onSelect={setSelectedImpact}
                      selected={selectedImpact?.file === impact.file}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Cascading Impacts */}
            {analysis.cascadingImpacts.length > 0 && (
              <div>
                <h5 className="impact-type-title">Cascading Impacts ({analysis.cascadingImpacts.length})</h5>
                <div className="impact-list">
                  {analysis.cascadingImpacts.map((impact, index) => (
                    <ImpactCard 
                      key={index} 
                      impact={impact} 
                      onSelect={setSelectedImpact}
                      selected={selectedImpact?.file === impact.file}
                      isCascading={true}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Impact Detail */}
      {selectedImpact && (
        <div className="glass-panel selected-impact-detail">
          <div className="selected-impact-header">
            <FileText size={16} className="selected-impact-icon" />
            <h4 className="selected-impact-title">{selectedImpact.file.split(/[/\\]/).pop()}</h4>
            <div className="selected-impact-actions">
              {getImpactIcon(selectedImpact.impact)}
              <span className="selected-impact-risk-level">{selectedImpact.impact.toUpperCase()}</span>
            </div>
          </div>

          <div className="selected-impact-content">
            <div className="selected-impact-reason">
              <div className="selected-impact-reason-title">Reason</div>
              <div className="selected-impact-reason-text">{selectedImpact.reason}</div>
            </div>

            {selectedImpact.consequences.length > 0 && (
              <div className="selected-impact-consequences">
                <div className="selected-impact-consequences-title">Potential Consequences</div>
                <div className="selected-impact-consequences-list">
                  {selectedImpact.consequences.map((consequence, index) => (
                    <div key={index} className="consequence">
                      <AlertTriangle size={12} className="consequence-icon" />
                      {consequence}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedImpact.benefits.length > 0 && (
              <div className="selected-impact-benefits">
                <div className="selected-impact-benefits-title">Benefits</div>
                <div className="selected-impact-benefits-list">
                  {selectedImpact.benefits.map((benefit, index) => (
                    <div key={index} className="benefit">
                      <CheckCircle size={12} className="benefit-icon" />
                      {benefit}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Execute Action Button */}
      <div className="execute-action-container">
        <button
          onClick={() => onExecuteAction(analysis.action)}
          disabled={loading || analysis.overallRisk === 'critical'}
          className={`execute-action-btn ${loading || analysis.overallRisk === 'critical' ? 'disabled' : ''}`}
        >
          {loading ? (
            <>
              <div className="loading-spinner" />
              Processing...
            </>
          ) : (
            <>
              <Zap size={16} />
              Execute {analysis.action.charAt(0).toUpperCase() + analysis.action.slice(1)}
            </>
          )}
        </button>
        
        {analysis.overallRisk === 'critical' && (
          <div className="critical-risk-warning">
            <XCircle size={16} className="critical-risk-icon" />
            Critical risk detected - consider alternatives
          </div>
        )}
      </div>
    </div>
  );
};

// Impact Card Component
interface ImpactCardProps {
  impact: DependencyImpact;
  onSelect: (impact: DependencyImpact) => void;
  selected: boolean;
  isCascading?: boolean;
}

const ImpactCard: FC<ImpactCardProps> = ({ impact, onSelect, selected, isCascading = false }) => {
  return (
    <div
      onClick={() => onSelect(impact)}
      className={`impact-card ${selected ? 'selected' : ''}`}
    >
      <div className="impact-card-header">
        {isCascading && <ArrowRight size={14} className="impact-card-arrow" />}
        {/* @ts-ignore - impact.impact type */}
        {getImpactIcon(impact.impact)}
        <span className="impact-card-title">{impact.file.split(/[/\\]/).pop()}</span>
        {/* @ts-ignore - impact.riskLevel type */}
        <span className={`impact-card-risk-level ${getRiskColor(impact.riskLevel)}`}>
          {impact.riskLevel.toUpperCase()}
        </span>
      </div>
      
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
        {impact.reason}
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        <span>{impact.affectedFiles.length} affected files</span>
        {impact.consequences.length > 0 && <span>{impact.consequences.length} consequences</span>}
        {impact.benefits.length > 0 && <span>{impact.benefits.length} benefits</span>}
      </div>
    </div>
  );
};

export default DependencyImpactAnalyzer;
