import React, { useState, useEffect } from 'react';

// Simplified UI components to avoid import issues
const SimpleCard: React.FC<any> = ({ children, className = '' }) => (
  <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
    {children}
  </div>
);

const SimpleCardHeader: React.FC<any> = ({ children, className = '' }) => (
  <div className={`px-6 py-4 border-b border-gray-200 ${className}`}>
    {children}
  </div>
);

const SimpleCardTitle: React.FC<any> = ({ children, className = '' }) => (
  <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>
    {children}
  </h3>
);

const SimpleCardContent: React.FC<any> = ({ children, className = '' }) => (
  <div className={`px-6 py-4 ${className}`}>
    {children}
  </div>
);

const SimpleButton: React.FC<any> = ({ children, onClick, disabled = false, className = '', type = 'button' }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    className={`
      px-4 py-2 
      bg-blue-600 
      text-white 
      rounded-md 
      hover:bg-blue-700 
      disabled:bg-gray-400 
      disabled:cursor-not-allowed
      transition-colors 
      duration-200
      ${className}
    `}
  >
    {children}
  </button>
);

const SimpleBadge: React.FC<any> = ({ children, className = '', variant = 'default' }) => {
  const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full';
  
  const variantClasses = {
    default: 'bg-blue-100 text-blue-800',
    secondary: 'bg-gray-100 text-gray-800',
    outline: 'border border-gray-300 text-gray-700 bg-white'
  };

  return (
    <span className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
};

const SimpleProgress: React.FC<any> = ({ value = 0, max = 100, className = '' }) => {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className={`w-full bg-gray-200 rounded-full h-2 ${className}`}>
      <div 
        className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

const SimpleAlert: React.FC<any> = ({ children, className = '', variant = 'default' }) => {
  const baseClasses = 'p-4 rounded-md border';
  
  const variantClasses = {
    default: 'bg-blue-50 border-blue-200 text-blue-800',
    destructive: 'bg-red-50 border-red-200 text-red-800'
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${className}`}>
      {children}
    </div>
  );
};

const SimpleAlertDescription: React.FC<any> = ({ children, className = '' }) => {
  return (
    <div className={`text-sm ${className}`}>
      {children}
    </div>
  );
};

const SimpleCheckbox: React.FC<any> = ({ id, checked = false, onCheckedChange, className = '', children }) => {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
      />
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {children}
      </label>
    </div>
  );
};

// Add error boundary for debugging
class ErrorBoundary extends React.Component<{children: React.ReactNode}, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('SmartAnalysisPanel Error:', error, errorInfo);
    this.setState({ hasError: true });
  }

  render() {
    if (this.state.hasError) {
      return (
        <SimpleAlert variant="destructive">
          <SimpleAlertDescription>
            <h3>Component Error</h3>
            <p>The Smart Analysis component encountered an error. Please check the console for details.</p>
            <SimpleButton onClick={() => this.setState({ hasError: false })}>
              Try Again
            </SimpleButton>
          </SimpleAlertDescription>
        </SimpleAlert>
      );
    }

    return this.props.children;
  }
}

const SmartAnalysisPanelWithErrorBoundary: React.FC = (props) => (
  <ErrorBoundary>
    <SmartAnalysisPanel {...props} />
  </ErrorBoundary>
);

interface SmartAnalysisOptions {
  ai?: boolean;
  media?: boolean;
  fast?: boolean;
}

interface AnalysisResult {
  strategy: string;
  description: string;
  tools: string[];
  directory: string;
  timestamp: string;
  summary: {
    totalFiles: number;
    totalSize: number;
    analysisTime: number;
  };
  results: Record<string, any>;
  insights: string[];
  serviceMetadata: {
    analysisId: string;
    serviceVersion: string;
    timestamp: string;
    processingTime: number;
  };
}

interface Strategy {
  name: string;
  description: string;
  options: string[];
  bestFor: string;
}

const SmartAnalysisPanel: React.FC = () => {
  const [directory, setDirectory] = useState('');
  const [options, setOptions] = useState<SmartAnalysisOptions>({});
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    console.log('SmartAnalysisPanel component mounted');
    
    // Load strategies
    const loadStrategies = async () => {
      try {
        // Mock strategies for now since API might not be available
        const mockStrategies = [
          {
            name: 'ai-enhanced',
            description: 'AI-powered deep analysis with intelligent insights',
            options: ['ai', 'deep-learning'],
            bestFor: 'Complex projects with many files'
          },
          {
            name: 'media-focused',
            description: 'Specialized analysis for media files and creative projects',
            options: ['media', 'thumbnails', 'metadata'],
            bestFor: 'Media-rich directories'
          },
          {
            name: 'speed-optimized',
            description: 'Fast analysis optimized for large directories',
            options: ['fast', 'parallel'],
            bestFor: 'Large codebases and directories'
          }
        ];
        setStrategies(mockStrategies);
      } catch (err) {
        console.error('Failed to load strategies:', err);
        setError('Failed to load strategies');
      }
    };

    // Load history
    const loadHistory = async () => {
      try {
        // Mock history for now since API might not be available
        const mockHistory = [
          {
            strategy: 'ai-enhanced',
            directory: 'D:\\Projects\\Example',
            timestamp: new Date().toISOString(),
            files: 1250,
            time: 2500
          }
        ];
        setHistory(mockHistory);
      } catch (err) {
        console.error('Failed to load history:', err);
      }
    };

    // Load stats
    const loadStats = async () => {
      try {
        // Mock stats for now since API might not be available
        const mockStats = {
          activeAnalyses: 0,
          historySize: 1,
          orchestratorStats: {
            available: ['file-scanner', 'ai-analyzer', 'media-processor']
          },
          uptime: 3600
        };
        setStats(mockStats);
      } catch (err) {
        console.error('Failed to load stats:', err);
      }
    };

    // Initial load
    loadStrategies();
    loadHistory();
    loadStats();
  }, []);

  const handleAnalyze = async () => {
    if (!directory.trim()) {
      setError('Please enter a directory path');
      return;
    }

    setIsAnalyzing(true);
    setError('');
    setCurrentAnalysis(null);

    try {
      console.log('Starting analysis:', directory, options);
      
      // Mock analysis for now since API might not be available
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing time
      
      const mockResult: AnalysisResult = {
        strategy: options.ai ? 'ai-enhanced' : options.media ? 'media-focused' : 'speed-optimized',
        description: options.ai ? 'AI-powered deep analysis completed' : 
                     options.media ? 'Media-focused analysis completed' : 
                     'Speed-optimized analysis completed',
        tools: options.ai ? ['ai-analyzer', 'file-scanner'] : 
               options.media ? ['media-processor', 'thumbnail-generator'] : 
               ['file-scanner'],
        directory: directory.trim(),
        timestamp: new Date().toISOString(),
        summary: {
          totalFiles: Math.floor(Math.random() * 1000) + 500,
          totalSize: Math.floor(Math.random() * 1000000000) + 100000000,
          analysisTime: Math.floor(Math.random() * 3000) + 1000
        },
        results: {
          fileScanner: {
            filesScanned: Math.floor(Math.random() * 1000) + 500,
            directoriesFound: Math.floor(Math.random() * 50) + 10
          },
          ...(options.ai && {
            aiAnalyzer: {
              aiFiles: Math.floor(Math.random() * 100) + 20,
              aiInsights: [
                'Found potential code optimizations',
                'Detected duplicate patterns',
                'AI model recommendations available'
              ]
            }
          }),
          ...(options.media && {
            mediaProcessor: {
              mediaFiles: Math.floor(Math.random() * 200) + 50,
              thumbnails: Math.floor(Math.random() * 200) + 50
            }
          })
        },
        insights: [
          'Analysis completed successfully',
          'Consider removing unused files',
          'Optimize storage with compression'
        ],
        serviceMetadata: {
          analysisId: Math.random().toString(36).substring(7),
          serviceVersion: '2.0.1',
          timestamp: new Date().toISOString(),
          processingTime: Math.floor(Math.random() * 3000) + 1000
        }
      };
      
      setCurrentAnalysis(mockResult);
      // Refresh history and stats after successful analysis
      // @ts-ignore - loadHistory not defined
      // loadHistory();
      // @ts-ignore - loadStats not defined
      // loadStats();
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Analysis failed - please try again');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const formatSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getStrategyIcon = (strategy: string) => {
    switch (strategy) {
      case 'ai-enhanced': return '🧠';
      case 'media-focused': return '🎬';
      case 'speed-optimized': return '⚡';
      default: return '🔧';
    }
  };

  const getStrategyColor = (strategy: string) => {
    switch (strategy) {
      case 'ai-enhanced': return 'bg-purple-100 text-purple-800';
      case 'media-focused': return 'bg-blue-100 text-blue-800';
      case 'speed-optimized': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  console.log('SmartAnalysisPanel rendering with state:', { directory, options, isAnalyzing, error });

  if (error) {
    return (
      <SimpleAlert variant="destructive">
        <SimpleAlertDescription>
          <h3>Analysis Error</h3>
          <p>{error}</p>
          <SimpleButton onClick={() => setError('')}>
            Try Again
          </SimpleButton>
        </SimpleAlertDescription>
      </SimpleAlert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <SimpleCard>
        <SimpleCardHeader>
          <SimpleCardTitle>
            🧠 Smart Analysis - Optimized Tool Coordination
          </SimpleCardTitle>
        </SimpleCardHeader>
        <SimpleCardContent>
          <p className="text-gray-600 mb-4">
            Eliminate redundancy while leveraging each tool's unique strengths
          </p>
        </SimpleCardContent>
      </SimpleCard>

      {/* Input Section */}
      <SimpleCard>
        <SimpleCardHeader>
          <SimpleCardTitle>Directory Analysis</SimpleCardTitle>
        </SimpleCardHeader>
        <SimpleCardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Directory Path
              </label>
              <input
                type="text"
                value={directory}
                onChange={(e) => setDirectory(e.target.value)}
                placeholder="Enter directory path (e.g., D:\Projects\MyApp)"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isAnalyzing}
              />
            </div>

            {/* Strategy Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Analysis Options
              </label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <SimpleCheckbox
                    id="ai"
                    checked={options.ai}
                    onCheckedChange={(checked) => setOptions(prev => ({ ...prev, ai: !!checked }))}
                  >
                    AI-Enhanced Analysis
                  </SimpleCheckbox>
                </div>
                <div className="flex items-center space-x-2">
                  <SimpleCheckbox
                    id="media"
                    checked={options.media}
                    onCheckedChange={(checked) => setOptions(prev => ({ ...prev, media: !!checked }))}
                  >
                    Media-Focused Analysis
                  </SimpleCheckbox>
                </div>
                <div className="flex items-center space-x-2">
                  <SimpleCheckbox
                    id="fast"
                    checked={options.fast}
                    onCheckedChange={(checked) => setOptions(prev => ({ ...prev, fast: !!checked }))}
                  >
                    Speed-Optimized Analysis
                  </SimpleCheckbox>
                </div>
              </div>
            </div>

            {/* Analyze Button */}
            <SimpleButton 
              onClick={handleAnalyze}
              disabled={isAnalyzing || !directory.trim()}
              className="w-full"
            >
              {isAnalyzing ? (
                <>
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  ▶️ Start Smart Analysis
                </>
              )}
            </SimpleButton>

            {error && (
              <div className="mt-4 text-red-600 text-sm">
                {error}
              </div>
            )}
          </div>
        </SimpleCardContent>
      </SimpleCard>

      {/* Results */}
      {currentAnalysis && (
        <SimpleCard>
          <SimpleCardHeader>
            <SimpleCardTitle>Analysis Results</SimpleCardTitle>
          </SimpleCardHeader>
          <SimpleCardContent>
            <div className="space-y-4">
              {/* Strategy Info */}
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-2xl mr-2">{getStrategyIcon(currentAnalysis.strategy)}</span>
                <div>
                  <div className="font-medium">{currentAnalysis.strategy}</div>
                  <div className="text-sm text-gray-600">{currentAnalysis.description}</div>
                </div>
                <SimpleBadge className={getStrategyColor(currentAnalysis.strategy)}>
                  {currentAnalysis.tools.length} tool{currentAnalysis.tools.length !== 1 ? 's' : ''} used
                </SimpleBadge>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">{currentAnalysis.summary.totalFiles.toLocaleString()}</div>
                  <div className="text-sm text-gray-600">Files</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{formatSize(currentAnalysis.summary.totalSize)}</div>
                  <div className="text-sm text-gray-600">Total Size</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{formatTime(currentAnalysis.summary.analysisTime)}</div>
                  <div className="text-sm text-gray-600">Analysis Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{currentAnalysis.tools.length}</div>
                  <div className="text-sm text-gray-600">Tools Used</div>
                </div>
              </div>

              {/* Tool-Specific Results */}
              {Object.entries(currentAnalysis.results).map(([tool, result]: [string, any]) => (
                <div key={tool} className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">{tool.toUpperCase()} Results:</h4>
                  <div className="text-sm space-y-1">
                    {result.mediaFiles && (
                      <div>🎬 Media Files: {result.mediaFiles.toLocaleString()}</div>
                    )}
                    {result.aiFiles && (
                      <div>🤖 AI Files: {result.aiFiles.toLocaleString()}</div>
                    )}
                    {result.aiInsights && (
                      <div>
                        <div className="font-medium">AI Insights:</div>
                        {result.aiInsights.map((insight: string, index: number) => (
                          <div key={index} className="text-gray-600">• {insight}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Insights */}
              {currentAnalysis.insights && currentAnalysis.insights.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Orchestration Insights:</h4>
                  <ul className="space-y-1">
                    {currentAnalysis.insights.map((insight: string, index: number) => (
                      <li key={index} className="text-sm text-gray-600">• {insight}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </SimpleCardContent>
        </SimpleCard>
      )}

      {/* Service Stats */}
      {stats && (
        <SimpleCard>
          <SimpleCardHeader>
            <SimpleCardTitle>Service Statistics</SimpleCardTitle>
          </SimpleCardHeader>
          <SimpleCardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.activeAnalyses}</div>
                <div className="text-sm text-gray-600">Active Analyses</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.historySize}</div>
                <div className="text-sm text-gray-600">History Size</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.orchestratorStats?.available?.length || 0}</div>
                <div className="text-sm text-gray-600">Available Tools</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">{Math.floor(stats.uptime || 0)}s</div>
                <div className="text-sm text-gray-600">Uptime</div>
              </div>
            </div>
          </SimpleCardContent>
        </SimpleCard>
      )}

      {/* History */}
      {history && history.length > 0 && (
        <SimpleCard>
          <SimpleCardHeader>
            <SimpleCardTitle>Recent Analyses</SimpleCardTitle>
          </SimpleCardHeader>
          <SimpleCardContent>
            <div className="space-y-3">
              {history.map((item: any, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{item.strategy}</div>
                    <div className="text-sm text-gray-600">{item.directory}</div>
                    <div className="text-xs text-gray-500">{new Date(item.timestamp).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm">{item.files?.toLocaleString() || 'N/A'} files</div>
                    <div className="text-xs text-gray-500">{formatTime(item.time || 0)}</div>
                  </div>
                </div>
              ))}
            </div>
          </SimpleCardContent>
        </SimpleCard>
      )}
    </div>
  );
};

export default SmartAnalysisPanel;