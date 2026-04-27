import React, { useState, useMemo, type FC, type ReactNode } from 'react';
import {
  Download, FileText, Database, Image, Code, FileJson,
  Calendar, Filter, Settings, Play, Save, Eye, Share2,
  BarChart3, PieChart, TrendingUp, Clock, HardDrive,
  Brain, Zap, Target, AlertTriangle, CheckCircle, Trash2
} from 'lucide-react';
import './ExportPanelEnhanced.css';

interface ExportPanelProps {
  analysisData: any;
  files: Array<any>;
  categories?: { [key: string]: { count: number; size: number } };
}

interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  format: 'json' | 'csv' | 'pdf' | 'xml' | 'xlsx';
  icon: ReactNode;
  sections: string[];
  aiOptimized: boolean;
}

interface ScheduledExport {
  id: string;
  name: string;
  template: string;
  schedule: string;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
}

export const ExportPanel: FC<ExportPanelProps> = ({
  analysisData,
  files,
  categories
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('comprehensive');
  const [selectedSections, setSelectedSections] = useState<Set<string>>(new Set(['all']));
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'pdf' | 'xml' | 'xlsx'>('json');
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [scheduledExports, setScheduledExports] = useState<ScheduledExport[]>([]);

  // AI-powered export templates
  const exportTemplates: ExportTemplate[] = useMemo(() => [
    {
      id: 'comprehensive',
      name: 'Comprehensive Analysis',
      description: 'Complete analysis with AI insights and recommendations',
      format: 'json',
      icon: <Database size={20} />,
      sections: ['overview', 'categories', 'files', 'ai-insights', 'recommendations', 'timeline'],
      aiOptimized: true
    },
    {
      id: 'executive-summary',
      name: 'Executive Summary',
      description: 'High-level overview for stakeholders',
      format: 'pdf',
      icon: <FileText size={20} />,
      sections: ['overview', 'key-metrics', 'ai-insights', 'recommendations'],
      aiOptimized: true
    },
    {
      id: 'technical-report',
      name: 'Technical Report',
      description: 'Detailed technical analysis for developers',
      format: 'xlsx',
      icon: <Code size={20} />,
      sections: ['files', 'categories', 'extensions', 'dependencies', 'performance'],
      aiOptimized: false
    },
    {
      id: 'security-audit',
      name: 'Security Audit',
      description: 'Security-focused analysis with risk assessment',
      format: 'json',
      icon: <AlertTriangle size={20} />,
      sections: ['security-analysis', 'file-permissions', 'sensitive-data', 'recommendations'],
      aiOptimized: true
    }
  ], []);

  // AI-generated export insights
  const aiInsights = useMemo(() => {
    if (!analysisData) return [];
    
    const insights = [];
    const totalSize = analysisData.totalSize || 0;
    const fileCount = analysisData.totalFiles || 0;
    
    if (totalSize > 1024 * 1024 * 1024 * 10) {
      insights.push({
        type: 'warning',
        icon: <AlertTriangle size={16} />,
        title: 'Large Dataset Detected',
        description: 'Consider splitting exports into smaller chunks'
      });
    }
    
    if (fileCount > 10000) {
      insights.push({
        type: 'info',
        icon: <Brain size={16} />,
        title: 'AI Optimization Recommended',
        description: 'Enable AI filtering to focus on relevant files'
      });
    }
    
    return insights;
  }, [analysisData]);

  // Generate export data
  const generateExportData = () => {
    const template = exportTemplates.find(t => t.id === selectedTemplate);
    if (!template) return null;

    const data: any = {
      metadata: {
        generatedAt: new Date().toISOString(),
        template: template.name,
        version: '3.0',
        aiOptimized: template.aiOptimized
      }
    };

    if (selectedSections.has('all') || selectedSections.has('overview')) {
      data.overview = {
        totalFiles: analysisData?.totalFiles || 0,
        totalSize: analysisData?.totalSize || 0,
        categories: categories || {},
        analysisTime: analysisData?.analysisTime || 0
      };
    }

    if (selectedSections.has('all') || selectedSections.has('files')) {
      data.files = files.map(file => ({
        name: file.name,
        size: file.size,
        path: file.path,
        extension: file.extension,
        category: file.category,
        riskScore: calculateRiskScore(file),
        aiTags: generateAITags(file)
      }));
    }

    return data;
  };

  // AI-powered risk scoring
  const calculateRiskScore = (file: any): number => {
    let score = 0;
    
    if (file.size > 1024 * 1024 * 100) score += 30;
    else if (file.size > 1024 * 1024 * 10) score += 15;
    
    const riskyExtensions = ['exe', 'dll', 'bat', 'sh', 'ps1'];
    if (riskyExtensions.includes(file.extension)) score += 25;
    
    if (file.category === 'System') score += 20;
    else if (file.category === 'Executables') score += 15;
    
    return Math.min(score, 100);
  };

  // Generate AI tags for files
  const generateAITags = (file: any): string[] => {
    const tags = [];
    
    if (file.size > 1024 * 1024 * 100) tags.push('large-file');
    else if (file.size < 1024) tags.push('tiny-file');
    
    const extensionTags: { [key: string]: string } = {
      'js': 'javascript', 'ts': 'typescript', 'py': 'python',
      'md': 'documentation', 'json': 'data', 'xml': 'config'
    };
    
    if (extensionTags[file.extension]) tags.push(extensionTags[file.extension]);
    
    return tags;
  };

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    
    try {
      const data = generateExportData();
      if (!data) return;

      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `space-analyzer-export-${Date.now()}.${exportFormat}`;
      a.click();
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="export-panel">
      <div className="export-header">
        <div className="header-title">
          <h2>AI-Powered Export Center</h2>
          <p>Generate intelligent reports with ML-enhanced insights</p>
        </div>
        
        <div className="header-actions">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`preview-btn ${showPreview ? 'active' : ''}`}
          >
            <Eye size={16} />
            Preview
          </button>
        </div>
      </div>

      {/* AI Insights */}
      {aiInsights.length > 0 && (
        <div className="ai-insights-banner">
          <div className="insights-header">
            <Brain className="pulse" size={20} />
            <h3>AI Export Recommendations</h3>
          </div>
          <div className="insights-list">
            {aiInsights.map((insight, index) => (
              <div key={index} className={`insight-item ${insight.type}`}>
                {insight.icon}
                <div className="insight-content">
                  <strong>{insight.title}</strong>
                  <p>{insight.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="export-content">
        {/* Template Selection */}
        <div className="template-section">
          <h3>Export Templates</h3>
          <div className="template-grid">
            {exportTemplates.map(template => (
              <div
                key={template.id}
                className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                onClick={() => setSelectedTemplate(template.id)}
              >
                <div className="template-icon">
                  {template.icon}
                  {template.aiOptimized && (
                    <div className="ai-badge">
                      <Zap size={12} />
                      AI
                    </div>
                  )}
                </div>
                <h4>{template.name}</h4>
                <p>{template.description}</p>
                <div className="template-format">
                  <FileText size={14} />
                  {template.format.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Export Configuration */}
        <div className="config-section">
          <h3>Export Configuration</h3>
          
          <div className="config-grid">
            {/* Format Selection */}
            <div className="config-group">
              <label>Export Format</label>
              <div className="format-options">
                {['json', 'csv', 'pdf', 'xml', 'xlsx'].map(format => (
                  <button
                    key={format}
                    onClick={() => setExportFormat(format as any)}
                    className={`format-btn ${exportFormat === format ? 'active' : ''}`}
                  >
                    {format === 'json' && <FileJson size={16} />}
                    {format === 'csv' && <Database size={16} />}
                    {format === 'pdf' && <FileText size={16} />}
                    {format === 'xml' && <Code size={16} />}
                    {format === 'xlsx' && <BarChart3 size={16} />}
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Section Selection */}
            <div className="config-group">
              <label>Data Sections</label>
              <div className="section-options">
                <label className="section-option">
                  <input
                    type="checkbox"
                    checked={selectedSections.has('all')}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedSections(new Set(['all']));
                      } else {
                        setSelectedSections(new Set());
                      }
                    }}
                  />
                  <span>All Sections</span>
                </label>
                
                {['overview', 'files', 'categories', 'ai-insights', 'recommendations'].map(section => (
                  <label key={section} className="section-option">
                    <input
                      type="checkbox"
                      checked={selectedSections.has(section)}
                      onChange={(e) => {
                        const newSections = new Set(selectedSections);
                        if (e.target.checked) {
                          newSections.add(section);
                          newSections.delete('all');
                        } else {
                          newSections.delete(section);
                        }
                        setSelectedSections(newSections);
                      }}
                    />
                    <span>{section.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Export Actions */}
        <div className="export-actions">
          <button
            onClick={handleExport}
            disabled={isExporting || selectedSections.size === 0}
            className="export-btn primary"
          >
            {isExporting ? (
              <>
                <div className="spinner" />
                Generating Export...
              </>
            ) : (
              <>
                <Download size={16} />
                Export {exportFormat.toUpperCase()}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportPanel;
