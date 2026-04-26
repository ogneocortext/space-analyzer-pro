import React, { useState, useEffect } from 'react';
import {
  Eye, Palette, Layout, Type, Space,
  AlertTriangle, CheckCircle, Lightbulb, Download,
  Code, Brush, Zap, TrendingUp, Star
} from 'lucide-react';
import { visualAnalysisService, DesignAnalysis, VisualInsight } from '../services/VisualAnalysisService';

interface VisualDesignAnalysisProps {
  screenshotPath?: string;
  onImprovementsApply?: (improvements: any) => void;
}

export function VisualDesignAnalysis({ screenshotPath, onImprovementsApply }: VisualDesignAnalysisProps) {
  const [analysis, setAnalysis] = useState<DesignAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showCode, setShowCode] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'success' | 'error' | 'info'>('info');
  const [showNotification, setShowNotification] = useState(false);

  const categories = [
    { id: 'all', label: 'All Issues', icon: Eye, count: analysis?.improvements.length || 0 },
    { id: 'layout', label: 'Layout', icon: Layout, count: analysis?.improvements.filter(i => i.category === 'layout').length || 0 },
    { id: 'color', label: 'Color', icon: Palette, count: analysis?.improvements.filter(i => i.category === 'color').length || 0 },
    { id: 'typography', label: 'Typography', icon: Type, count: analysis?.improvements.filter(i => i.category === 'typography').length || 0 },
    { id: 'spacing', label: 'Spacing', icon: Space, count: analysis?.improvements.filter(i => i.category === 'spacing').length || 0 },
    { id: 'accessibility', label: 'Accessibility', icon: AlertTriangle, count: analysis?.improvements.filter(i => i.category === 'accessibility').length || 0 },
  ];

  useEffect(() => {
    if (screenshotPath) {
      performAnalysis();
    }
  }, [screenshotPath]);

  const performAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const result = await visualAnalysisService.analyzeDesign(screenshotPath || '');
      setAnalysis(result);
    } catch (error) {
      console.error('Visual analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400 bg-red-900/20 border-red-800';
      case 'medium': return 'text-yellow-400 bg-yellow-900/20 border-yellow-800';
      case 'low': return 'text-green-400 bg-green-900/20 border-green-800';
      default: return 'text-gray-400 bg-gray-900/20 border-gray-800';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-400';
    if (score >= 6) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getScoreIcon = (score: number) => {
    if (score >= 8) return CheckCircle;
    if (score >= 6) return AlertTriangle;
    return AlertTriangle;
  };

  const filteredImprovements = selectedCategory === 'all' 
    ? analysis?.improvements || []
    : analysis?.improvements.filter(imp => imp.category === selectedCategory) || [];

  const generateCodeImprovements = () => {
    if (!analysis) return '';
    
    const cssImprovements = visualAnalysisService.generateCSSImprovements(analysis);
    const componentImprovements = visualAnalysisService.generateComponentImprovements(analysis);
    
    return {
      css: cssImprovements.join('\n\n'),
      components: componentImprovements
    };
  };

  const exportAnalysis = () => {
    if (!analysis) return;
    
    const report = {
      timestamp: new Date().toISOString(),
      analysis,
      codeImprovements: generateCodeImprovements(),
      summary: {
        totalIssues: analysis.improvements.length,
        highPriorityIssues: analysis.improvements.filter(i => i.priority === 'high').length,
        accessibilityIssues: analysis.accessibility_issues.length,
        quickWins: analysis.quick_wins.length
      }
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `design-analysis-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isAnalyzing) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Eye className="w-16 h-16 mx-auto mb-4 text-blue-400 animate-pulse" />
          <h3 className="text-xl font-medium mb-2">Analyzing Design</h3>
          <p className="text-gray-400">LLaVA is examining your frontend for improvements...</p>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="text-center py-12">
        <Eye className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <h3 className="text-xl font-medium mb-2">No Design Analysis</h3>
        <p className="text-gray-400 mb-4">Take a screenshot to analyze your frontend design</p>
        <button
          onClick={performAnalysis}
          className="flex items-center space-x-2 mx-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Eye className="w-4 h-4" />
          <span>Analyze Current Design</span>
        </button>
      </div>
    );
  }

  const codeImprovements = generateCodeImprovements();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Eye className="w-6 h-6 text-blue-400" />
          <div>
            <h2 className="text-xl font-semibold">Visual Design Analysis</h2>
            <p className="text-sm text-gray-400">AI-powered UI/UX improvements using LLaVA</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowCode(!showCode)}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Code className="w-4 h-4" />
            <span>{showCode ? 'Hide Code' : 'Show Code'}</span>
          </button>
          
          <button
            onClick={exportAnalysis}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Overall Score */}
      <div className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 rounded-xl p-6 border border-blue-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium mb-2">Overall Design Score</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className={`text-3xl font-bold ${getScoreColor(analysis.overall_score)}`}>
                  {analysis.overall_score}/100
                </span>
                {React.createElement(getScoreIcon(analysis.overall_score), { 
                  className: `w-6 h-6 ${getScoreColor(analysis.overall_score)}` 
                })}
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className={`text-2xl font-bold ${getScoreColor(analysis.color_harmony * 10)}`}>
                {analysis.color_harmony}/10
              </div>
              <div className="text-sm text-gray-400">Color Harmony</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${getScoreColor(analysis.visual_hierarchy * 10)}`}>
                {analysis.visual_hierarchy}/10
              </div>
              <div className="text-sm text-gray-400">Visual Hierarchy</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${getScoreColor(analysis.responsiveness * 10)}`}>
                {analysis.responsiveness}/10
              </div>
              <div className="text-sm text-gray-400">Responsiveness</div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Total Issues</p>
              <p className="text-2xl font-bold">{analysis.improvements.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-400" />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">High Priority</p>
              <p className="text-2xl font-bold text-red-400">
                {analysis.improvements.filter(i => i.priority === 'high').length}
              </p>
            </div>
            <Zap className="w-8 h-8 text-red-400" />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Quick Wins</p>
              <p className="text-2xl font-bold text-green-400">{analysis.quick_wins.length}</p>
            </div>
            <Lightbulb className="w-8 h-8 text-green-400" />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-400">Accessibility</p>
              <p className="text-2xl font-bold text-orange-400">
                {analysis.accessibility_issues.length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-400" />
          </div>
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                selectedCategory === category.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm">{category.label}</span>
              <span className="text-xs bg-gray-700 px-2 py-1 rounded-full">
                {category.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Improvements List */}
      <div className="space-y-4">
        {filteredImprovements.map((improvement, index) => (
          <div
            key={index}
            className={`border rounded-lg p-4 ${getPriorityColor(improvement.priority)}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <span className="text-sm font-medium capitalize">{improvement.category}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    improvement.priority === 'high' ? 'bg-red-800 text-red-200' :
                    improvement.priority === 'medium' ? 'bg-yellow-800 text-yellow-200' :
                    'bg-green-800 text-green-200'
                  }`}>
                    {improvement.priority} priority
                  </span>
                </div>
                <h4 className="font-medium mb-2">{improvement.issue}</h4>
                <p className="text-sm text-gray-300 mb-2">{improvement.recommendation}</p>
                <p className="text-sm text-gray-400">
                  <strong>Implementation:</strong> {improvement.implementation}
                </p>
              </div>
            </div>
          </div>
        ))}

        {filteredImprovements.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <CheckCircle className="w-12 h-12 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Issues Found</h3>
            <p className="text-sm">Great design! No issues in this category.</p>
          </div>
        )}
      </div>

      {/* Strengths */}
      {analysis.strengths.length > 0 && (
        <div className="bg-green-900/20 border border-green-800 rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
            <Star className="w-5 h-5 text-green-400" />
            <span>Design Strengths</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {analysis.strengths.map((strength, index) => (
              <div key={index} className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-sm text-green-300">{strength}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Wins */}
      {analysis.quick_wins.length > 0 && (
        <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
            <Lightbulb className="w-5 h-5 text-blue-400" />
            <span>Quick Wins</span>
          </h3>
          <div className="space-y-2">
            {analysis.quick_wins.map((win, index) => (
              <div key={index} className="flex items-start space-x-2">
                <Zap className="w-4 h-4 text-blue-400 mt-0.5" />
                <span className="text-sm text-blue-300">{win}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Code Improvements */}
      {showCode && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4 flex items-center space-x-2">
            <Code className="w-5 h-5 text-purple-400" />
            <span>Generated Code Improvements</span>
          </h3>
          
          {/* CSS Improvements */}
          {typeof codeImprovements === 'object' && codeImprovements.css && (
            <div className="mb-6">
              <h4 className="text-md font-medium mb-2 text-purple-300">CSS Improvements</h4>
              <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm text-gray-300">
                <code>{codeImprovements.css}</code>
              </pre>
            </div>
          )}

          {/* Component Improvements */}
          {typeof codeImprovements === 'object' && codeImprovements.components && Object.keys(codeImprovements.components).length > 0 && (
            <div>
              <h4 className="text-md font-medium mb-2 text-purple-300">React Components</h4>
              {Object.entries(codeImprovements.components).map(([name, code]) => (
                <div key={name} className="mb-4">
                  <h5 className="text-sm font-medium mb-2 text-gray-400">{name}.tsx</h5>
                  <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm text-gray-300">
                    <code>{String(code)}</code>
                  </pre>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => {
              onImprovementsApply?.(codeImprovements);
              setNotificationMessage('Code improvements applied successfully');
              setNotificationType('success');
              setShowNotification(true);
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Brush className="w-4 h-4" />
            <span>Apply Improvements</span>
          </button>
        </div>
      )}
    </div>
  );
}
