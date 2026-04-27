import React, { useState, useEffect } from 'react';
import { 
  BrainCircuit, TrendingUp, FileText, AlertTriangle, 
  CheckCircle, Clock, Zap, Target, BarChart3,
  Loader2, RefreshCw, Download, Share
} from 'lucide-react';
import { ollamaService } from '../services/OllamaService';

interface AIAnalysisPanelProps {
  analysisData: any;
  onRecommendationsUpdate?: (recommendations: string[]) => void;
}

interface AIInsight {
  type: 'finding' | 'recommendation' | 'warning' | 'optimization';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: string;
}

export function AIAnalysisPanel({ analysisData, onRecommendationsUpdate }: AIAnalysisPanelProps) {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState<Date | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All Insights', icon: BarChart3 },
    { id: 'storage', label: 'Storage', icon: FileText },
    { id: 'performance', label: 'Performance', icon: Zap },
    { id: 'organization', label: 'Organization', icon: Target },
    { id: 'cleanup', label: 'Cleanup', icon: AlertTriangle }
  ];

  const impactColors = {
    high: 'text-red-400 bg-red-900/20 border-red-800',
    medium: 'text-yellow-400 bg-yellow-900/20 border-yellow-800',
    low: 'text-green-400 bg-green-900/20 border-green-800'
  };

  const categoryIcons = {
    storage: FileText,
    performance: Zap,
    organization: Target,
    cleanup: AlertTriangle,
    finding: CheckCircle,
    recommendation: TrendingUp,
    warning: AlertTriangle,
    optimization: BrainCircuit
  };

  useEffect(() => {
    if (analysisData) {
      performAIAnalysis();
    }
  }, [analysisData]);

  const performAIAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setAnalysisProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      // Get AI insights
      const insightsText = await ollamaService.analyzeFileStructure(analysisData);
      const aiRecommendations = await ollamaService.generateRecommendations(analysisData);

      clearInterval(progressInterval);
      setAnalysisProgress(100);

      // Parse insights into structured format
      const parsedInsights = parseInsights(insightsText);
      setInsights(parsedInsights);
      setRecommendations(aiRecommendations);
      setLastAnalysis(new Date());

      onRecommendationsUpdate?.(aiRecommendations);

      setTimeout(() => {
        setIsAnalyzing(false);
        setAnalysisProgress(0);
      }, 1000);

    } catch (error) {
      console.error('AI Analysis failed:', error);
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  };

  const parseInsights = (insightsText: string): AIInsight[] => {
    const insights: AIInsight[] = [];
    
    // Parse the AI response into structured insights
    const lines = insightsText.split('\n').filter(line => line.trim());
    
    lines.forEach((line, index) => {
      let type: AIInsight['type'] = 'finding';
      let impact: AIInsight['impact'] = 'medium';
      let category = 'storage';

      // Determine type and impact based on keywords
      if (line.toLowerCase().includes('warning') || line.toLowerCase().includes('critical')) {
        type = 'warning';
        impact = 'high';
      } else if (line.toLowerCase().includes('recommend') || line.toLowerCase().includes('suggest')) {
        type = 'recommendation';
      } else if (line.toLowerCase().includes('optimize') || line.toLowerCase().includes('improve')) {
        type = 'optimization';
      }

      // Determine category
      if (line.toLowerCase().includes('performance') || line.toLowerCase().includes('speed')) {
        category = 'performance';
      } else if (line.toLowerCase().includes('organize') || line.toLowerCase().includes('structure')) {
        category = 'organization';
      } else if (line.toLowerCase().includes('cleanup') || line.toLowerCase().includes('delete')) {
        category = 'cleanup';
      }

      insights.push({
        type,
        title: `Insight ${index + 1}`,
        description: line.trim(),
        impact,
        category
      });
    });

    return insights;
  };

  const filteredInsights = selectedCategory === 'all' 
    ? insights 
    : insights.filter(insight => insight.category === selectedCategory);

  const getImpactStats = () => {
    const stats = {
      high: insights.filter(i => i.impact === 'high').length,
      medium: insights.filter(i => i.impact === 'medium').length,
      low: insights.filter(i => i.impact === 'low').length
    };
    return stats;
  };

  const exportAnalysis = () => {
    const report = {
      timestamp: new Date().toISOString(),
      analysisData,
      insights,
      recommendations,
      summary: {
        totalInsights: insights.length,
        impactStats: getImpactStats(),
        categories: [...new Set(insights.map(i => i.category))]
      }
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-analysis-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          <BrainCircuit className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-semibold truncate">AI Analysis</h2>
            <p className="text-xs sm:text-sm text-gray-400 truncate">
              {lastAnalysis
                ? `Last analyzed: ${lastAnalysis.toLocaleString()}`
                : 'Ready to analyze your file system'
              }
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={performAIAnalysis}
            disabled={isAnalyzing || !analysisData}
            className="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {isAnalyzing ? (
              <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4" />
            )}
            <span className="hidden sm:inline">{isAnalyzing ? 'Analyzing...' : 'Re-analyze'}</span>
          </button>

          <button
            onClick={exportAnalysis}
            disabled={insights.length === 0}
            className="flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed transition-colors text-sm"
          >
            <Download className="w-3 h-3 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {isAnalyzing && (
        <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <span className="text-xs sm:text-sm text-gray-300">AI Analysis in Progress</span>
            <span className="text-xs sm:text-sm text-gray-400">{analysisProgress}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${analysisProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats Overview */}
      {insights.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-400 truncate">Total Insights</p>
                <p className="text-xl sm:text-2xl font-bold truncate">{insights.length}</p>
              </div>
              <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-blue-400 flex-shrink-0 ml-2" />
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-400 truncate">High Impact</p>
                <p className="text-xl sm:text-2xl font-bold text-red-400 truncate">{getImpactStats().high}</p>
              </div>
              <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-red-400 flex-shrink-0 ml-2" />
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-400 truncate">Recommendations</p>
                <p className="text-xl sm:text-2xl font-bold text-yellow-400 truncate">{recommendations.length}</p>
              </div>
              <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-400 flex-shrink-0 ml-2" />
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-400 truncate">Space Analyzed</p>
                <p className="text-lg sm:text-2xl font-bold text-green-400 truncate">
                  {formatFileSize(analysisData?.totalSize || 0)}
                </p>
              </div>
              <FileText className="w-6 h-6 sm:w-8 sm:h-8 text-green-400 flex-shrink-0 ml-2" />
            </div>
          </div>
        </div>
      )}

      {/* Category Filter */}
      {insights.length > 0 && (
        <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-600">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex items-center space-x-1 sm:space-x-2 px-3 sm:px-4 py-2 rounded-lg whitespace-nowrap transition-colors flex-shrink-0 ${
                  selectedCategory === category.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="text-xs sm:text-sm">{category.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Insights List */}
      <div className="space-y-2 sm:space-y-3">
        {filteredInsights.map((insight, index) => {
          const Icon = categoryIcons[insight.type as keyof typeof categoryIcons] || CheckCircle;
          return (
            <div
              key={index}
              className={`border rounded-lg p-3 sm:p-4 ${impactColors[insight.impact]}`}
            >
              <div className="flex items-start space-x-2 sm:space-x-3">
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <h3 className="font-medium text-sm sm:text-base truncate">{insight.title}</h3>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <span className="text-xs px-2 py-1 bg-gray-800 rounded truncate">
                        {insight.category}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded truncate ${
                        insight.impact === 'high' ? 'bg-red-800 text-red-200' :
                        insight.impact === 'medium' ? 'bg-yellow-800 text-yellow-200' :
                        'bg-green-800 text-green-200'
                      }`}>
                        {insight.impact}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-300 break-words">{insight.description}</p>
                </div>
              </div>
            </div>
          );
        })}

        {filteredInsights.length === 0 && !isAnalyzing && (
          <div className="text-center py-6 sm:py-8 text-gray-400">
            <BrainCircuit className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4" />
            <h3 className="text-base sm:text-lg font-medium mb-2">No Insights Yet</h3>
            <p className="text-xs sm:text-sm px-4">
              {insights.length === 0
                ? 'Run an analysis to get AI-powered insights about your file system'
                : 'No insights found for the selected category'
              }
            </p>
          </div>
        )}
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4 sm:p-6">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
            <span>AI Recommendations</span>
          </h3>
          <div className="space-y-2 sm:space-y-3">
            {recommendations.map((rec, index) => (
              <div key={index} className="flex items-start space-x-2 sm:space-x-3">
                <span className="flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6 bg-yellow-600 text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-medium">
                  {index + 1}
                </span>
                <p className="text-xs sm:text-sm text-gray-300 break-words">{rec}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
