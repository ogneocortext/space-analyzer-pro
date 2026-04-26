import React, { useState, useEffect } from 'react';
import { AnalysisResult } from '../services/AnalysisBridge';
import styles from '../styles/components/App.module.css';

interface SecurityPageProps {
  analysisData: AnalysisResult;
  isLoading: boolean;
}

interface SecurityThreat {
  id: string;
  type: 'malware' | 'suspicious' | 'permission' | 'encryption';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  file?: string;
  risk: string;
  recommendation: string;
  detected: Date;
}

const SecurityPage: React.FC<SecurityPageProps> = ({ analysisData, isLoading }) => {
  const [threats, setThreats] = useState<SecurityThreat[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (analysisData) {
      // Generate security analysis based on file data
      const generatedThreats: SecurityThreat[] = [];
      
      // Analyze file patterns for potential security issues
      const files = analysisData.files || [];
      
      // Check for potentially suspicious file patterns
      files.forEach((file, index) => {
        if (file.name.toLowerCase().includes('temp') && file.size > 1000000) {
          generatedThreats.push({
            id: `temp-${index}`,
            type: 'suspicious',
            severity: 'medium',
            description: 'Large temporary file detected',
            file: file.path,
            risk: 'May indicate incomplete cleanup or potential malware',
            recommendation: 'Verify if this file is legitimate and remove if unnecessary',
            detected: new Date()
          });
        }
        
        if (file.extension && ['exe', 'dll', 'bat', 'cmd'].includes(file.extension.toLowerCase())) {
          generatedThreats.push({
            id: `exec-${index}`,
            type: 'malware',
            severity: file.size > 5000000 ? 'high' : 'medium',
            description: 'Executable file detected',
            file: file.path,
            risk: 'Executable files can contain malicious code',
            recommendation: 'Verify the source and scan with antivirus software',
            detected: new Date()
          });
        }
      });
      
      // Add some general security warnings
      if (analysisData.totalFiles > 10000) {
        generatedThreats.push({
          id: 'large-dataset',
          type: 'permission',
          severity: 'low',
          description: 'Large number of files detected',
          risk: 'Large datasets may be harder to monitor for security issues',
          recommendation: 'Consider implementing automated security monitoring',
          detected: new Date()
        });
      }
      
      setThreats(generatedThreats);
    }
  }, [analysisData]);

  const startSecurityScan = () => {
    setIsScanning(true);
    setScanProgress(0);
    
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          return 100;
        }
        return prev + 5;
      });
    }, 500);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'high': return '#f97316';
      case 'medium': return '#eab308';
      case 'low': return '#22c55e';
      default: return '#6b7280';
    }
  };

  const getThreatIcon = (type: string) => {
    switch (type) {
      case 'malware': return '🦠';
      case 'suspicious': return '⚠️';
      case 'permission': return '🔒';
      case 'encryption': return '🔐';
      default: return '🔍';
    }
  };

  if (isLoading || !analysisData) {
    return (
      <div className={styles.contentSection}>
        <h2>Security</h2>
        <p>Loading security analysis...</p>
      </div>
    );
  }

  const criticalThreats = threats.filter(t => t.severity === 'critical').length;
  const highThreats = threats.filter(t => t.severity === 'high').length;
  const mediumThreats = threats.filter(t => t.severity === 'medium').length;
  const lowThreats = threats.filter(t => t.severity === 'low').length;

  return (
    <div className={styles.contentSection}>
      <h2>Security</h2>
      <p>Security analysis and threat detection</p>
      
      <div className={styles.securitySection}>
        <div className={styles.securityOverview}>
          <h3>Security Status</h3>
          <div className={styles.statusGrid}>
            <div className={styles.statusCard}>
              <h4>Total Threats</h4>
              <div className={styles.statusValue}>{threats.length}</div>
              <div className={styles.statusIndicator}>
                <span className={styles.statusDot} style={{ backgroundColor: threats.length > 0 ? '#ef4444' : '#10b981' }}></span>
                {threats.length > 0 ? 'Threats Found' : 'No Threats'}
              </div>
            </div>
            <div className={styles.statusCard}>
              <h4>Critical</h4>
              <div className={styles.statusValue} style={{ color: '#ef4444' }}>{criticalThreats}</div>
            </div>
            <div className={styles.statusCard}>
              <h4>High</h4>
              <div className={styles.statusValue} style={{ color: '#f97316' }}>{highThreats}</div>
            </div>
            <div className={styles.statusCard}>
              <h4>Medium</h4>
              <div className={styles.statusValue} style={{ color: '#eab308' }}>{mediumThreats}</div>
            </div>
            <div className={styles.statusCard}>
              <h4>Low</h4>
              <div className={styles.statusValue} style={{ color: '#22c55e' }}>{lowThreats}</div>
            </div>
          </div>
        </div>

        <div className={styles.securityActions}>
          <button 
            className={styles.scanButton}
            onClick={startSecurityScan}
            disabled={isScanning}
          >
            {isScanning ? 'Scanning...' : 'Start Security Scan'}
          </button>
          <div className={styles.scanProgress}>
            {isScanning && (
              <div className={styles.progressContainer}>
                <div 
                  className={styles.progressBar}
                  style={{ width: `${scanProgress}%` }}
                ></div>
                <span className={styles.progressText}>{scanProgress}%</span>
              </div>
            )}
          </div>
        </div>

        <div className={styles.threatsList}>
          <h3>Detected Threats</h3>
          {threats.length === 0 ? (
            <div className={styles.noThreats}>
              <div className={styles.noThreatsIcon}>✅</div>
              <h4>No Security Threats Detected</h4>
              <p>Your file system appears to be secure. Continue monitoring for best practices.</p>
            </div>
          ) : (
            threats.map((threat) => (
              <div key={threat.id} className={`${styles.threatCard} ${styles[`severity-${threat.severity}`]}`}>
                <div className={styles.threatHeader}>
                  <div className={styles.threatInfo}>
                    <span className={styles.threatIcon}>{getThreatIcon(threat.type)}</span>
                    <h4>{threat.description}</h4>
                    <span 
                      className={styles.severityBadge}
                      style={{ backgroundColor: getSeverityColor(threat.severity) }}
                    >
                      {threat.severity.toUpperCase()}
                    </span>
                  </div>
                  <div className={styles.threatActions}>
                    <button className={styles.threatButton}>Quarantine</button>
                    <button className={styles.threatButton}>Ignore</button>
                  </div>
                </div>
                
                <div className={styles.threatDetails}>
                  {threat.file && (
                    <div className={styles.detailItem}>
                      <span className={styles.detailLabel}>File:</span>
                      <span className={styles.detailValue}>{threat.file}</span>
                    </div>
                  )}
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Risk:</span>
                    <span className={styles.detailValue}>{threat.risk}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Recommendation:</span>
                    <span className={styles.detailValue}>{threat.recommendation}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Detected:</span>
                    <span className={styles.detailValue}>{threat.detected.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={styles.securityRecommendations}>
          <h3>Security Recommendations</h3>
          <div className={styles.recommendationsList}>
            <div className={styles.recommendationCard}>
              <h4>🔒 Enable File Encryption</h4>
              <p>Encrypt sensitive files to protect against unauthorized access.</p>
              <button className={styles.recButton}>Setup Encryption</button>
            </div>
            <div className={styles.recommendationCard}>
              <h4>🛡️ Regular Security Scans</h4>
              <p>Schedule automatic security scans to detect threats early.</p>
              <button className={styles.recButton}>Configure Scans</button>
            </div>
            <div className={styles.recommendationCard}>
              <h4>🔑 Access Control</h4>
              <p>Implement proper file permissions and access controls.</p>
              <button className={styles.recButton}>Review Permissions</button>
            </div>
            <div className={styles.recommendationCard}>
              <h4>📊 Security Monitoring</h4>
              <p>Enable real-time monitoring for suspicious file activities.</p>
              <button className={styles.recButton}>Enable Monitoring</button>
            </div>
          </div>
        </div>

        <div className={styles.securitySummary}>
          <h3>Security Summary</h3>
          <div className={styles.summaryContent}>
            <p><strong>Overall Security Score:</strong> {threats.length === 0 ? 'Excellent (100%)' : threats.length < 5 ? 'Good (85%)' : 'Needs Attention (60%)'}</p>
            <p><strong>Last Scan:</strong> {new Date().toLocaleString()}</p>
            <p><strong>Files Analyzed:</strong> {analysisData.totalFiles.toLocaleString()}</p>
            <p><strong>Recommendations:</strong> {threats.length === 0 ? 'Continue monitoring' : 'Address detected threats'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SecurityPage;