import React, { useState, useEffect } from 'react';
import { AnalysisResult } from '../services/AnalysisBridge';
import styles from '../styles/components/App.module.css';

interface DevelopmentPageProps {
  analysisData: AnalysisResult;
  isLoading: boolean;
}

interface DevTool {
  id: string;
  name: string;
  description: string;
  category: 'api' | 'cli' | 'integration' | 'monitoring';
  status: 'available' | 'beta' | 'planned';
  lastUpdated: Date;
}

const DevelopmentPage: React.FC<DevelopmentPageProps> = ({ analysisData, isLoading }) => {
  const [tools, setTools] = useState<DevTool[]>([
    {
      id: '1',
      name: 'REST API',
      description: 'Full REST API for programmatic access to Space Analyzer features',
      category: 'api',
      status: 'available',
      lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    },
    {
      id: '2',
      name: 'CLI Tool',
      description: 'Command-line interface for automated file analysis and reporting',
      category: 'cli',
      status: 'beta',
      lastUpdated: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    },
    {
      id: '3',
      name: 'Webhooks',
      description: 'Real-time notifications for file system events and analysis results',
      category: 'integration',
      status: 'planned',
      lastUpdated: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    },
    {
      id: '4',
      name: 'SDK',
      description: 'Software Development Kit for building custom integrations',
      category: 'integration',
      status: 'planned',
      lastUpdated: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    },
    {
      id: '5',
      name: 'Metrics API',
      description: 'Access to system metrics and performance data',
      category: 'monitoring',
      status: 'available',
      lastUpdated: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    }
  ]);

  const [selectedTool, setSelectedTool] = useState<DevTool | null>(null);
  const [apiDocs, setApiDocs] = useState<string>('');

  useEffect(() => {
    if (analysisData) {
      // Generate API documentation based on analysis data
      const docs = `
# Space Analyzer API Documentation

## Base URL
\`\`\`
http://localhost:8080/api
\`\`\`

## Authentication
API Key required in header:
\`\`\`
Authorization: Bearer YOUR_API_KEY
\`\`\`

## Endpoints

### Analyze Directory
\`\`\`
POST /analyze
Content-Type: application/json

{
  "directory": "/path/to/directory",
  "options": {
    "recursive": true,
    "includeHidden": false,
    "fileTypes": ["js", "ts", "json"]
  }
}
\`\`\`

### Get Analysis Results
\`\`\`
GET /results/{analysisId}
\`\`\`

### System Metrics
\`\`\`
GET /metrics
\`\`\`

### File Search
\`\`\`
GET /search?q=filename
\`\`\`

## Response Format
\`\`\`json
{
  "totalFiles": 1250,
  "totalSize": 50000000000,
  "categories": {
    "JavaScript": { "size": 1000000000, "count": 500 }
  },
  "ai_insights": {
    "storage_warnings": [],
    "optimization_suggestions": []
  }
}
\`\`\`
      `;
      setApiDocs(docs);
    }
  }, [analysisData]);

  if (isLoading || !analysisData) {
    return (
      <div className={styles.contentSection}>
        <h2>Development</h2>
        <p>Loading developer tools...</p>
      </div>
    );
  }

  const getToolIcon = (category: string) => {
    switch (category) {
      case 'api': return '🔌';
      case 'cli': return '💻';
      case 'integration': return '🔗';
      case 'monitoring': return '📊';
      default: return '🛠️';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return '#10b981';
      case 'beta': return '#f59e0b';
      case 'planned': return '#6b7280';
      default: return '#6b7280';
    }
  };

  return (
    <div className={styles.contentSection}>
      <h2>Development</h2>
      <p>Developer tools and APIs for extending Space Analyzer</p>
      
      <div className={styles.developmentSection}>
        <div className={styles.toolsOverview}>
          <h3>Available Tools</h3>
          <div className={styles.toolsGrid}>
            {tools.map((tool) => (
              <div 
                key={tool.id} 
                className={`${styles.toolCard} ${selectedTool?.id === tool.id ? styles.selected : ''}`}
                onClick={() => setSelectedTool(tool)}
              >
                <div className={styles.toolHeader}>
                  <span className={styles.toolIcon}>{getToolIcon(tool.category)}</span>
                  <h4>{tool.name}</h4>
                  <span 
                    className={styles.toolStatus}
                    style={{ backgroundColor: getStatusColor(tool.status) }}
                  >
                    {tool.status}
                  </span>
                </div>
                <p>{tool.description}</p>
                <div className={styles.toolFooter}>
                  <span className={styles.toolCategory}>{tool.category}</span>
                  <span className={styles.toolUpdated}>
                    Updated: {tool.lastUpdated.toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.developmentContent}>
          {selectedTool ? (
            <div className={styles.toolDetails}>
              <h3>{selectedTool.name}</h3>
              <p className={styles.toolDescription}>{selectedTool.description}</p>
              
              <div className={styles.toolActions}>
                <button className={styles.toolButton}>Documentation</button>
                <button className={styles.toolButton}>Download</button>
                <button className={styles.toolButton}>Examples</button>
              </div>

              <div className={styles.toolInfo}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Category:</span>
                  <span className={styles.infoValue}>{selectedTool.category}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Status:</span>
                  <span 
                    className={styles.infoValue}
                    style={{ color: getStatusColor(selectedTool.status) }}
                  >
                    {selectedTool.status}
                  </span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Last Updated:</span>
                  <span className={styles.infoValue}>{selectedTool.lastUpdated.toLocaleString()}</span>
                </div>
              </div>

              {selectedTool.category === 'api' && (
                <div className={styles.apiDocumentation}>
                  <h4>API Documentation</h4>
                  <div className={styles.codeBlock}>
                    <pre>{apiDocs}</pre>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.noSelection}>
              <h3>Select a Tool</h3>
              <p>Click on any tool card to view detailed information and documentation.</p>
            </div>
          )}
        </div>

        <div className={styles.developmentResources}>
          <h3>Developer Resources</h3>
          <div className={styles.resourcesList}>
            <div className={styles.resourceCard}>
              <h4>📚 API Documentation</h4>
              <p>Complete API reference with examples and authentication guides.</p>
              <button className={styles.resourceButton}>View Docs</button>
            </div>
            <div className={styles.resourceCard}>
              <h4>🔧 SDK Downloads</h4>
              <p>Download SDKs for popular programming languages.</p>
              <button className={styles.resourceButton}>Download</button>
            </div>
            <div className={styles.resourceCard}>
              <h4>💡 Code Examples</h4>
              <p>Sample code and integration examples.</p>
              <button className={styles.resourceButton}>View Examples</button>
            </div>
            <div className={styles.resourceCard}>
              <h4>🐛 Bug Reports</h4>
              <p>Report issues and track development progress.</p>
              <button className={styles.resourceButton}>Report Issue</button>
            </div>
          </div>
        </div>

        <div className={styles.developmentStats}>
          <h3>Development Statistics</h3>
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <h4>API Endpoints</h4>
              <div className={styles.statValue}>15+</div>
              <div className={styles.statLabel}>Available endpoints</div>
            </div>
            <div className={styles.statCard}>
              <h4>SDK Languages</h4>
              <div className={styles.statValue}>5</div>
              <div className={styles.statLabel}>Supported languages</div>
            </div>
            <div className={styles.statCard}>
              <h4>Active Integrations</h4>
              <div className={styles.statValue}>12</div>
              <div className={styles.statLabel}>Third-party tools</div>
            </div>
            <div className={styles.statCard}>
              <h4>Documentation</h4>
              <div className={styles.statValue}>100%</div>
              <div className={styles.statLabel}>API coverage</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevelopmentPage;