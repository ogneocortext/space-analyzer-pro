import React, { useState, useEffect } from 'react';
import { 
  Lightbulb, Zap, Target, TrendingUp, AlertTriangle,
  CheckCircle, Clock, ArrowRight, Play, Pause,
  BarChart3, FileText, Trash2, Archive, FolderOpen
} from 'lucide-react';
import { ollamaService } from '../services/OllamaService';

interface SmartRecommendationsProps {
  analysisData: any;
  onActionExecute?: (action: RecommendationAction) => void;
}

interface RecommendationAction {
  id: string;
  type: 'delete' | 'archive' | 'compress' | 'organize' | 'analyze';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'easy' | 'medium' | 'hard';
  savings: string;
  files?: any[];
  automated: boolean;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: number;
}

interface RecommendationCategory {
  id: string;
  name: string;
  icon: any;
  color: string;
  description: string;
}

export function SmartRecommendations({ analysisData, onActionExecute }: SmartRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<RecommendationAction[]>([]);
  const [categories] = useState<RecommendationCategory[]>([
    {
      id: 'quick-wins',
      name: 'Quick Wins',
      icon: Zap,
      color: 'text-green-400',
      description: 'Easy actions with immediate impact'
    },
    {
      id: 'space-recovery',
      name: 'Space Recovery',
      icon: Trash2,
      color: 'text-red-400',
      description: 'Actions to recover significant storage'
    },
    {
      id: 'organization',
      name: 'Organization',
      icon: FolderOpen,
      color: 'text-blue-400',
      description: 'Improve file structure and accessibility'
    },
    {
      id: 'optimization',
      name: 'Optimization',
      icon: TrendingUp,
      color: 'text-purple-400',
      description: 'Long-term improvements and maintenance'
    }
  ]);
  
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  useEffect(() => {
    if (analysisData) {
      generateSmartRecommendations();
    }
  }, [analysisData]);

  const generateSmartRecommendations = async () => {
    setIsGenerating(true);
    
    try {
      // Get AI recommendations
      const aiRecommendations = await ollamaService.generateRecommendations(analysisData);
      
      // Generate actionable recommendations based on analysis data
      const actionableRecs = generateActionableRecommendations(aiRecommendations);
      setRecommendations(actionableRecs);
    } catch (error) {
      console.error('Failed to generate recommendations:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateActionableRecommendations = (aiRecs: string[]): RecommendationAction[] => {
    const recommendations: RecommendationAction[] = [];
    
    // Analyze the data to create specific actionable recommendations
    if (analysisData?.largestFiles?.length > 0) {
      const largeFiles = analysisData.largestFiles.slice(0, 5);
      const totalSize = largeFiles.reduce((sum: number, file: any) => sum + file.size, 0);
      
      recommendations.push({
        id: 'remove-large-files',
        type: 'delete',
        title: 'Remove Large Unused Files',
        description: `Delete ${largeFiles.length} large files that haven't been accessed recently`,
        impact: 'high',
        effort: 'easy',
        savings: formatFileSize(totalSize),
        files: largeFiles,
        automated: false,
        status: 'pending'
      });
    }

    if (analysisData?.duplicates?.length > 0) {
      const duplicateSize = analysisData.duplicates.reduce((sum: number, dup: any) => sum + dup.size, 0);
      
      recommendations.push({
        id: 'remove-duplicates',
        type: 'delete',
        title: 'Remove Duplicate Files',
        description: `Clean up ${analysisData.duplicates.length} duplicate files`,
        impact: 'medium',
        effort: 'easy',
        savings: formatFileSize(duplicateSize),
        files: analysisData.duplicates,
        automated: true,
        status: 'pending'
      });
    }

    if (analysisData?.oldFiles?.length > 0) {
      const oldFiles = analysisData.oldFiles.slice(0, 10);
      const oldSize = oldFiles.reduce((sum: number, file: any) => sum + file.size, 0);
      
      recommendations.push({
        id: 'archive-old-files',
        type: 'archive',
        title: 'Archive Old Files',
        description: `Archive ${oldFiles.length} files older than 1 year`,
        impact: 'medium',
        effort: 'medium',
        savings: formatFileSize(oldSize),
        files: oldFiles,
        automated: true,
        status: 'pending'
      });
    }

    // Add AI-generated recommendations as actionable items
    aiRecs.forEach((rec, index) => {
      if (rec.toLowerCase().includes('compress') || rec.toLowerCase().includes('optimize')) {
        recommendations.push({
          id: `ai-compress-${index}`,
          type: 'compress',
          title: 'Compress Files',
          description: rec.replace(/^\d+\.\s*/, ''),
          impact: 'medium',
          effort: 'easy',
          savings: 'Estimating...',
          automated: true,
          status: 'pending'
        });
      }
    });

    return recommendations;
  };

  const executeAction = async (action: RecommendationAction) => {
    setExecutingAction(action.id);
    
    // Update action status to running
    setRecommendations(prev => 
      prev.map(rec => 
        rec.id === action.id 
          ? { ...rec, status: 'running', progress: 0 }
          : rec
      )
    );

    try {
      // Simulate progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setRecommendations(prev => 
          prev.map(rec => 
            rec.id === action.id 
              ? { ...rec, progress: i }
              : rec
          )
        );
      }

      // Mark as completed
      setRecommendations(prev => 
        prev.map(rec => 
          rec.id === action.id 
            ? { ...rec, status: 'completed', progress: 100 }
            : rec
        )
      );

      onActionExecute?.(action);
    } catch (error) {
      setRecommendations(prev => 
        prev.map(rec => 
          rec.id === action.id 
            ? { ...rec, status: 'failed' }
            : rec
        )
      );
    } finally {
      setExecutingAction(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-400 bg-red-900/20 border-red-800';
      case 'medium': return 'text-yellow-400 bg-yellow-900/20 border-yellow-800';
      case 'low': return 'text-green-400 bg-green-900/20 border-green-800';
      default: return 'text-gray-400 bg-gray-900/20 border-gray-800';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'easy': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'hard': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const filteredRecommendations = selectedCategory === 'all' 
    ? recommendations 
    : recommendations.filter(rec => {
        // Simple categorization based on type and impact
        if (selectedCategory === 'quick-wins') return rec.effort === 'easy' && rec.impact !== 'low';
        if (selectedCategory === 'space-recovery') return rec.type === 'delete' || rec.type === 'archive';
        if (selectedCategory === 'organization') return rec.type === 'organize';
        if (selectedCategory === 'optimization') return rec.type === 'compress' || rec.type === 'analyze';
        return true;
      });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-gray-400" />;
      case 'running': return <Play className="w-4 h-4 text-blue-400 animate-pulse" />;
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Lightbulb className="w-6 h-6 text-yellow-400" />
          <div>
            <h2 className="text-xl font-semibold">Smart Recommendations</h2>
            <p className="text-sm text-gray-400">
              AI-powered actions to optimize your storage
            </p>
          </div>
        </div>

        <button
          onClick={generateSmartRecommendations}
          disabled={isGenerating}
          className="flex items-center space-x-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
        >
          <Target className="w-4 h-4" />
          <span>{isGenerating ? 'Generating...' : 'Regenerate'}</span>
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
            selectedCategory === 'all'
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span className="text-sm">All ({recommendations.length})</span>
        </button>

        {categories.map((category) => {
          const Icon = category.icon;
          const count = recommendations.filter(rec => {
            if (category.id === 'quick-wins') return rec.effort === 'easy' && rec.impact !== 'low';
            if (category.id === 'space-recovery') return rec.type === 'delete' || rec.type === 'archive';
            if (category.id === 'organization') return rec.type === 'organize';
            if (category.id === 'optimization') return rec.type === 'compress' || rec.type === 'analyze';
            return false;
          }).length;

          return (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${
                selectedCategory === category.id
                  ? 'bg-gray-800 text-white border border-gray-600'
                  : 'bg-gray-900 text-gray-300 hover:bg-gray-800'
              }`}
            >
              <Icon className={`w-4 h-4 ${category.color}`} />
              <span className="text-sm">{category.name} ({count})</span>
            </button>
          );
        })}
      </div>

      {/* Recommendations List */}
      <div className="space-y-4">
        {filteredRecommendations.map((recommendation) => (
          <div
            key={recommendation.id}
            className="bg-gray-800 border border-gray-700 rounded-lg p-6 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-medium">{recommendation.title}</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs px-2 py-1 rounded ${getImpactColor(recommendation.impact)}`}>
                      {recommendation.impact} impact
                    </span>
                    <span className={`text-xs px-2 py-1 rounded bg-gray-900 ${getEffortColor(recommendation.effort)}`}>
                      {recommendation.effort}
                    </span>
                    {recommendation.automated && (
                      <span className="text-xs px-2 py-1 rounded bg-blue-900/30 text-blue-400">
                        Automated
                      </span>
                    )}
                  </div>
                </div>
                
                <p className="text-gray-300 mb-3">{recommendation.description}</p>
                
                <div className="flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">Save {recommendation.savings}</span>
                  </div>
                  
                  {recommendation.files && (
                    <div className="flex items-center space-x-1">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span className="text-blue-400">{recommendation.files.length} files</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {getStatusIcon(recommendation.status)}
                
                {recommendation.status === 'pending' && (
                  <button
                    onClick={() => executeAction(recommendation)}
                    disabled={executingAction !== null}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors"
                  >
                    <Play className="w-4 h-4" />
                    <span>Execute</span>
                  </button>
                )}

                {recommendation.status === 'running' && (
                  <button
                    disabled
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg cursor-not-allowed"
                  >
                    <Pause className="w-4 h-4 animate-pulse" />
                    <span>Running...</span>
                  </button>
                )}

                {recommendation.status === 'completed' && (
                  <div className="text-green-400 text-sm font-medium">
                    Completed
                  </div>
                )}

                {recommendation.status === 'failed' && (
                  <button
                    onClick={() => executeAction(recommendation)}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>Retry</span>
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {recommendation.status === 'running' && recommendation.progress !== undefined && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-400">Progress</span>
                  <span className="text-sm text-gray-400">{recommendation.progress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${recommendation.progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* File List */}
            {recommendation.files && recommendation.files.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Affected Files</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {recommendation.files.slice(0, 5).map((file, index) => (
                    <div key={index} className="text-xs text-gray-400 truncate">
                      {file.path || file.name} • {formatFileSize(file.size)}
                    </div>
                  ))}
                  {recommendation.files.length > 5 && (
                    <div className="text-xs text-gray-500">
                      ... and {recommendation.files.length - 5} more files
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {filteredRecommendations.length === 0 && !isGenerating && (
          <div className="text-center py-12 text-gray-400">
            <Lightbulb className="w-16 h-16 mx-auto mb-4" />
            <h3 className="text-xl font-medium mb-2">No Recommendations Available</h3>
            <p className="text-sm mb-4">
              {recommendations.length === 0 
                ? 'Run a file analysis to get smart recommendations'
                : 'No recommendations found for the selected category'
              }
            </p>
          </div>
        )}

        {isGenerating && (
          <div className="text-center py-12 text-gray-400">
            <Target className="w-16 h-16 mx-auto mb-4 animate-pulse" />
            <h3 className="text-xl font-medium mb-2">Generating Smart Recommendations</h3>
            <p className="text-sm">AI is analyzing your file system...</p>
          </div>
        )}
      </div>
    </div>
  );
}
