import React, { useState, useCallback } from 'react';
import type { FC } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  AlertTriangle, GitBranch, AlertCircle, TrendingUp, Clock, Calendar,
  CheckCircle, X, ChevronDown, ChevronUp, Zap, Target, Archive, Trash2, FolderOpen,
  BrainCircuit, Download, Move, FileText, Image, Video, Music, Code, HardDrive, Shield
} from 'lucide-react';
import './ActionablePrediction.css';
import { PredictiveInsight } from './PredictionExplainer';
import { DependencyImpactAnalyzer } from './DependencyImpactAnalyzer';
import { dependencyCheckerService } from '../services/DependencyCheckerService';


interface ActionablePredictionProps {
  insights: PredictiveInsight[];
  onAction: (action: string, target: string, files?: any[]) => void;
  files: any[];
  categories: { [key: string]: any };
}

const ActionablePrediction: FC<ActionablePredictionProps> = ({
  insights, 
  onAction, 
  files, 
  categories 
}) => {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [actionProgress, setActionProgress] = useState<{ [key: string]: number }>({});
  const [dependencyAnalysis, setDependencyAnalysis] = useState<any>(null);
  const [analyzingDependencies, setAnalyzingDependencies] = useState(false);
  const [showDependencyAnalysis, setShowDependencyAnalysis] = useState(false);

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'documents': return <FileText size={16} />;
      case 'images': return <Image size={16} />;
      case 'videos': return <Video size={16} />;
      case 'audio': return <Music size={16} />;
      case 'code': return <Code size={16} />;
      case 'executables': return <HardDrive size={16} />;
      default: return <FileText size={16} />;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'cleanup': return <Trash2 size={16} />;
      case 'organize': return <FolderOpen size={16} />;
      case 'archive': return <Archive size={16} />;
      case 'move': return <Move size={16} />;
      case 'analyze': return <BrainCircuit size={16} />;
      default: return <Target size={16} />;
    }
  };

  const extractCategoryFromReasoning = (reasoning: any): string => {
    // Extract category from primary factor or contributing factors
    const primaryFactor = reasoning.primaryFactor.toLowerCase();
    const categories = ['documents', 'images', 'videos', 'audio', 'code', 'executables', 'system', 'temp', 'archives'];
    
    for (const category of categories) {
      if (primaryFactor.includes(category)) {
        return category;
      }
    }
    
    for (const factor of reasoning.contributingFactors) {
      const factorLower = factor.toLowerCase();
      for (const category of categories) {
        if (factorLower.includes(category)) {
          return category;
        }
      }
    }
    
    return 'unknown';
  };

  const getFilesByCategory = (category: string) => {
    return files.filter(file => 
      file.category?.toLowerCase() === category.toLowerCase() ||
      file.path?.toLowerCase().includes(category.toLowerCase())
    );
  };

  const getHighImpactFiles = (category: string, limit: number = 10) => {
    const categoryFiles = getFilesByCategory(category);
    return categoryFiles
      .sort((a, b) => (b.size || 0) - (a.size || 0))
      .slice(0, limit);
  };

  const executeAction = async (action: string, target: string, insight: PredictiveInsight) => {
    setSelectedAction(`${action}-${target}`);
    setActionProgress(prev => ({ ...prev, [`${action}-${target}`]: 0 }));

    try {
      // First analyze dependencies for high-risk actions
      if (['delete', 'move', 'archive'].includes(action)) {
        await analyzeDependencies(action, target, insight);
      }

      // If high-risk action, show dependency analysis first
      if (dependencyAnalysis && (dependencyAnalysis.overallRisk === 'critical' || dependencyAnalysis.overallRisk === 'high')) {
        setShowDependencyAnalysis(true);
        return; // Wait for user confirmation
      }

      // Execute the action
      switch (action) {
        case 'cleanup':
          await executeCleanup(target, insight);
          break;
        case 'organize':
          await executeOrganization(target, insight);
          break;
        case 'archive':
          await executeArchive(target, insight);
          break;
        case 'analyze':
          await executeAnalysis(target, insight);
          break;
        default:
          console.log(`Unknown action: ${action} on ${target}`);
      }
      
      onAction(action, target, getFilesByCategory(target));
    } catch (error) {
      console.error(`Failed to execute ${action} on ${target}:`, error);
    } finally {
      setSelectedAction(null);
      setActionProgress(prev => ({ ...prev, [`${action}-${target}`]: 100 }));
    }
  };

  const analyzeDependencies = async (action: string, target: string, insight: PredictiveInsight) => {
    setAnalyzingDependencies(true);
    
    try {
      // Build dependency graph if not already built
      await dependencyCheckerService.buildDependencyGraph(files);
      
      // Get target files for the action
      const targetFiles = getTargetFilesForAction(action, target, insight);
      
      // Analyze impact
      const analysis = await dependencyCheckerService.analyzeActionImpact(action, targetFiles);
      setDependencyAnalysis(analysis);
      
      console.log('Dependency analysis complete:', analysis);
    } catch (error) {
      console.error('Failed to analyze dependencies:', error);
    } finally {
      setAnalyzingDependencies(false);
    }
  };

  const getTargetFilesForAction = (action: string, target: string, insight: PredictiveInsight): string[] => {
    const categoryFiles = getFilesByCategory(target);
    
    switch (action) {
      case 'cleanup':
        return categoryFiles
          .filter(file => {
            // Include temp files, duplicates, old files
            return file.path?.includes('temp') || 
                   file.path?.includes('tmp') || 
                   file.size === 0 ||
                   (file.lastModified && Date.now() - file.lastModified > 365 * 24 * 60 * 60 * 1000);
          })
          .map(file => file.path);
      
      case 'archive':
        return categoryFiles
          .filter(file => file.size > 10 * 1024 * 1024) // Files > 10MB
          .sort((a, b) => (b.size || 0) - (a.size || 0))
          .slice(0, 20)
          .map(file => file.path);
      
      case 'organize':
        return categoryFiles.map(file => file.path);
      
      case 'delete':
        return categoryFiles
          .filter(file => file.path?.includes('temp') || file.path?.includes('tmp'))
          .map(file => file.path);
      
      default:
        return categoryFiles.map(file => file.path);
    }
  };

  const executeActionWithConfirmation = async (action: string, alternative?: string) => {
    const actualAction = alternative || action;
    
    // Execute the action
    switch (actualAction) {
      case 'cleanup':
        await executeCleanup(dependencyAnalysis?.targetFiles[0]?.split('/')[0] || '', {} as any);
        break;
      case 'organize':
        await executeOrganization(dependencyAnalysis?.targetFiles[0]?.split('/')[0] || '', {} as any);
        break;
      case 'archive':
        await executeArchive(dependencyAnalysis?.targetFiles[0]?.split('/')[0] || '', {} as any);
        break;
      case 'move':
        await executeMove(dependencyAnalysis?.targetFiles[0]?.split('/')[0] || '', {} as any);
        break;
      default:
        console.log(`Executing alternative action: ${actualAction}`);
    }
    
    // Hide dependency analysis after execution
    setShowDependencyAnalysis(false);
    setDependencyAnalysis(null);
  };

  const executeCleanup = async (target: string, insight: PredictiveInsight) => {
    const targetFiles = getFilesByCategory(target);
    
    // Simulate cleanup progress
    for (let i = 0; i <= 100; i += 10) {
      setActionProgress(prev => ({ ...prev, [`cleanup-${target}`]: i }));
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Cleaned up ${targetFiles.length} files from ${target} category`);
  };

  const executeOrganization = async (target: string, insight: PredictiveInsight) => {
    const targetFiles = getFilesByCategory(target);
    
    // Simulate organization progress
    for (let i = 0; i <= 100; i += 20) {
      setActionProgress(prev => ({ ...prev, [`organize-${target}`]: i }));
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    console.log(`Organized ${targetFiles.length} files in ${target} category`);
  };

  const executeArchive = async (target: string, insight: PredictiveInsight) => {
    const targetFiles = getHighImpactFiles(target);
    
    // Simulate archive progress
    for (let i = 0; i <= 100; i += 25) {
      setActionProgress(prev => ({ ...prev, [`archive-${target}`]: i }));
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    console.log(`Archived ${targetFiles.length} large files from ${target} category`);
  };

  const executeAnalysis = async (target: string, insight: PredictiveInsight) => {
    // Simulate deep analysis progress
    for (let i = 0; i <= 100; i += 10) {
      setActionProgress(prev => ({ ...prev, [`analyze-${target}`]: i }));
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`Analyzed ${target} category for detailed insights`);
  };

  const executeMove = async (target: string, insight: PredictiveInsight) => {
    const targetFiles = getFilesByCategory(target);
    
    // Simulate move progress
    for (let i = 0; i <= 100; i += 20) {
      setActionProgress(prev => ({ ...prev, [`move-${target}`]: i }));
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    console.log(`Moved ${targetFiles.length} files from ${target} category`);
  };

  const getRecommendedActions = (insight: PredictiveInsight, category: string) => {
    const actions: { type: string; label: string; description: string; priority: 'high' | 'medium' | 'low' }[] = [];
    
    switch (insight.type) {
      case 'growth':
        if (insight.reasoning.trendAnalysis.direction === 'increasing') {
          actions.push({
            type: 'cleanup',
            label: 'Smart Cleanup',
            description: `Remove unnecessary ${category} files to slow growth`,
            priority: 'high'
          });
          actions.push({
            type: 'archive',
            label: 'Archive Large Files',
            description: `Move large ${category} files to archive storage`,
            priority: 'medium'
          });
        }
        break;
        
      case 'cleanup':
        actions.push({
          type: 'cleanup',
          label: 'Quick Cleanup',
          description: `Remove temp and unnecessary ${category} files`,
          priority: 'high'
        });
        break;
        
      case 'organization':
        actions.push({
          type: 'organize',
          label: 'Auto-Organize',
          description: `Create subfolders and organize ${category} files`,
          priority: 'medium'
        });
        break;
        
      case 'security':
        actions.push({
          type: 'analyze',
          label: 'Security Scan',
          description: `Analyze ${category} files for security risks`,
          priority: 'high'
        });
        break;
    }
    
    return actions;
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low') => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#22c55e';
      default: return '#6b7280';
    }
  };

  if (!insights || insights.length === 0) {
    return (
      <div className="actionable-prediction-container">
        <BrainCircuit size={48} className="actionable-no-insights-icon" />
        <h3 className="actionable-no-insights-text">No Actionable Insights Available</h3>
        <p className="actionable-no-insights-text">Run more analyses to generate actionable predictions</p>
      </div>
    );
  }

  return (
    <div className="actionable-prediction-container">
      {/* Dependency Analysis Modal */}
      {showDependencyAnalysis && dependencyAnalysis && (
        <div className="actionable-modal-overlay">
          <div className="actionable-modal">
            <div className="actionable-modal-header">
              <h2 className="actionable-modal-title">Dependency Impact Analysis</h2>
              <button onClick={() => setShowDependencyAnalysis(false)} className="actionable-close-btn" aria-label="Close dependency analysis">
                <X size={20} />
              </button>
            </div>
            <DependencyImpactAnalyzer
              analysis={dependencyAnalysis}
              onExecuteAction={executeActionWithConfirmation}
              loading={analyzingDependencies}
            />
          </div>
        </div>
      )}

      {insights.map((insight, index) => {
        const category = extractCategoryFromReasoning(insight.reasoning);
        const categoryFiles = getFilesByCategory(category);
        const highImpactFiles = getHighImpactFiles(category);
        const recommendedActions = getRecommendedActions(insight, category);

        return (
          <div key={index} className="glass-panel actionable-category-panel">
            {/* Header */}
            <div className="actionable-category-header">
              <div className="actionable-category-icon">{getCategoryIcon(category)}</div>
              <h4 className="actionable-category-title">{category.charAt(0).toUpperCase() + category.slice(1)} Category</h4>
              <div className="actionable-category-stats">
                <div className="actionable-stat-item">
                  <span className="actionable-stat-label">Files</span>
                  <span className="actionable-stat-value">{categoryFiles.length}</span>
                </div>
                <div className="actionable-stat-item">
                  <span className="actionable-stat-label">Total Size</span>
                  <span className="actionable-stat-value">{(categoryFiles.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(1)}MB</span>
                </div>
                <div className="actionable-stat-item">
                  <span className="actionable-stat-label">Large Files</span>
                  <span className="actionable-stat-value">{highImpactFiles.length}</span>
                </div>
              </div>
            </div>

            {/* Primary Driver */}
            <div className="actionable-primary-driver">
              <h5 className="actionable-primary-driver-title">Primary Driver</h5>
              <div className="actionable-primary-driver-content">
                <AlertTriangle size={14} className="actionable-primary-driver-icon" />
                {insight.reasoning.primaryFactor}
              </div>
            </div>

            {/* Actionable Items */}
            <div className="actionable-actions">
              <h5 className="actionable-actions-title">Recommended Actions</h5>
              <div className="actionable-actions-list">
                {recommendedActions.map((action, actionIndex) => (
                  <div key={actionIndex} className="actionable-action-item">
                    <div className="actionable-action-icon">{getActionIcon(action.type)}</div>
                    <div className="actionable-action-content">
                      <h6 className="actionable-action-title">{action.label}</h6>
                      <p className="actionable-action-description">{action.description}</p>
                    </div>
                    <div className="actionable-action-priority">
                      <span className={`actionable-priority-${action.priority}`}>{action.priority}</span>
                      <button
                        onClick={() => executeAction(action.type, category, insight)}
                        disabled={selectedAction === `${action.type}-${category}` || analyzingDependencies}
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '6px',
                          background: selectedAction === `${action.type}-${category}` ? '#6b7280' : '#3b82f6',
                          color: 'white',
                          border: 'none',
                          cursor: selectedAction === `${action.type}-${category}` || analyzingDependencies ? 'not-allowed' : 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: 'bold',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          position: 'relative'
                        }}
                      >
                        {selectedAction === `${action.type}-${category}` ? (
                          <>
                            <div style={{ 
                              width: '12px', 
                              height: '12px', 
                              border: '2px solid white', 
                              borderTop: '2px solid transparent',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite'
                            }} />
                            {actionProgress[`${action.type}-${category}`] || 0}%
                          </>
                        ) : analyzingDependencies ? (
                          <>
                            <GitBranch size={14} />
                            Analyzing Dependencies...
                          </>
                        ) : (
                          <>
                            {getActionIcon(action.type)}
                            Execute
                            {['delete', 'move', 'archive'].includes(action.type) && (
                              <Shield size={12} style={{ marginLeft: '0.25rem' }} />
                            )}
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* High Impact Files Preview */}
            {highImpactFiles.length > 0 && (
              <div>
                <h5 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', fontSize: '0.875rem' }}>
                  High Impact Files (Top {highImpactFiles.length})
                </h5>
                <div style={{ 
                  display: 'grid', 
                  gap: '0.5rem',
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {highImpactFiles.slice(0, 5).map((file, fileIndex) => (
                    <div key={fileIndex} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      padding: '0.5rem',
                      background: 'rgba(107, 114, 128, 0.1)',
                      borderRadius: '4px',
                      fontSize: '0.75rem'
                    }}>
                      {getCategoryIcon(file.category || 'unknown')}
                      <span style={{ flex: 1, color: 'var(--text-primary)' }}>
                        {file.path?.split(/[/\\]/).pop() || file.name}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {(file.size / (1024 * 1024)).toFixed(1)}MB
                      </span>
                    </div>
                  ))}
                  {highImpactFiles.length > 5 && (
                    <div style={{ 
                      textAlign: 'center', 
                      color: 'var(--text-secondary)', 
                      fontSize: '0.75rem',
                      padding: '0.5rem'
                    }}>
                      ... and {highImpactFiles.length - 5} more files
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ActionablePrediction;
