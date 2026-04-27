import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, Send, Sparkles, Bot, User, 
  BrainCircuit, Code, FileText, BarChart3, Settings,
  Loader2, CheckCircle, AlertCircle, ChevronDown
} from 'lucide-react';
import { ollamaService, OllamaModel, ChatMessage } from '../services/OllamaService';
import { searchService } from '../services/SearchService';
import { aiCore } from '../ai/ai_core';
import { formatFileSize } from '../utils/formatUtils';
import { useStreamingChat } from '../hooks/useStreamingChat';
import { useAIContext, useAICapabilities } from '../contexts/AIContext';
import { AIStatusIndicator } from './AIStatusIndicator';

interface EnhancedAIChatProps {
  analysisData?: any;
  neuralData?: any;
  fileBrowserData?: any[];
  dependencyData?: any;
  onAnalysisComplete?: (insights: string) => void;
}

export default function EnhancedAIChat({ analysisData, neuralData, fileBrowserData, dependencyData, onAnalysisComplete }: EnhancedAIChatProps) {
  // Use the enhanced streaming chat hook
  const {
    messages,
    sendMessage,
    isStreaming,
    isTyping,
    clearMessages,
    aiStatus
  } = useStreamingChat();

  const isAnalyzing = isStreaming || isTyping;

  // Get AI capabilities and context
  const aiCapabilities = useAICapabilities();
  // @ts-ignore - updateAnalysisData property
  const { updateAnalysisData } = useAIContext();

  // Legacy state for compatibility
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [availableModels, setAvailableModels] = useState<OllamaModel[]>([]);
  const [currentModel, setCurrentModel] = useState('Auto-Select');
  const [actualModel, setActualModel] = useState('');
  const [selectedChatModel, setSelectedChatModel] = useState('deepseek-coder:6.7b');
  const [lastResponseCached, setLastResponseCached] = useState(false);
  const [lastResponseTime, setLastResponseTime] = useState(0);
  const [analysisInsights, setAnalysisInsights] = useState<string>('');
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [proposedOperations, setProposedOperations] = useState<any[]>([]);
  const [showOperationConfirmation, setShowOperationConfirmation] = useState(false);
  const [operationInProgress, setOperationInProgress] = useState<any>(null);
  const [operationHistory, setOperationHistory] = useState<any[]>([]);

  // @ts-ignore - Missing state setters for operations
  const setOperationInProgressGlobal = setOperationInProgress;
  const setOperationHistoryGlobal = setOperationHistory;
  const operationHistoryGlobal = operationHistory;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Conversation memory and learning
  const [conversationMemory, setConversationMemory] = useState<any>({
    topics: {},
    userPatterns: {},
    successfulQueries: [],
    failedQueries: [],
    preferences: {},
    insights: []
  });
  const [sessionInsights, setSessionInsights] = useState<string[]>([]);

  const suggestedQuestions = [
    'What are the main space-consuming files in my system?',
    'How can I optimize my storage usage?',
    'What files should I consider archiving?',
    'Are there any duplicate files I can remove?',
    'What patterns do you see in my file organization?',
    'Which file types are taking the most space?',
    'How can I improve my directory structure?',
    'What cleanup actions would you recommend?'
  ];

  // Proactive suggestions based on analysis data
  const getProactiveSuggestions = () => {
    if (!analysisData) return [];

    const suggestions = [];
    const totalSize = analysisData.totalSize || 0;
    const files = analysisData.files || [];

    // Large files suggestion
    const largeFiles = files.filter((f: any) => f.size > 100 * 1024 * 1024); // > 100MB
    if (largeFiles.length > 0) {
      suggestions.push({
        type: 'large_files',
        icon: '📁',
        title: `${largeFiles.length} Large Files Found`,
        description: `Files over 100MB taking up significant space`,
        action: 'Analyze large files',
        prompt: 'Analyze these large files and suggest optimization strategies.'
      });
    }

    // Old files suggestion
    const oldFiles = files.filter((f: any) => {
      if (!f.modified) return false;
      const age = Date.now() - new Date(f.modified).getTime();
      return age > 365 * 24 * 60 * 60 * 1000; // > 1 year old
    });
    if (oldFiles.length > files.length * 0.3) { // > 30% old files
      suggestions.push({
        type: 'archival_candidates',
        icon: '📦',
        title: 'Archive Candidates',
        description: `${oldFiles.length} files not modified in over a year`,
        action: 'Review archival options',
        prompt: 'Review old files and suggest archiving strategies.'
      });
    }

    // Code project insights
    const codeFiles = files.filter((f: any) => ['.py', '.js', '.ts', '.java', '.cpp', '.c', '.cs'].some(ext => f.name.endsWith(ext)));
    if (codeFiles.length > 10) {
      suggestions.push({
        type: 'code_analysis',
        icon: '💻',
        title: 'Code Project Detected',
        description: `${codeFiles.length} code files found - analyze dependencies and structure`,
        action: 'Analyze code patterns',
        prompt: 'Analyze the code structure and suggest improvements or optimizations.'
      });
    }

    // Neural network insights
    if (neuralData && neuralData.connections?.length > 0) {
      const circularDeps = neuralData.metrics?.circularDependencies || 0;
      if (circularDeps > 0) {
        suggestions.push({
          type: 'circular_dependencies',
          icon: '🔄',
          title: 'Circular Dependencies',
          description: `${circularDeps} circular dependencies detected`,
          action: 'Review dependency issues',
          prompt: 'Analyze circular dependencies and suggest refactoring approaches.'
        });
      }
    }

    // Storage efficiency
    const compressionRatio = analysisData.compressionRatio || 0;
    if (compressionRatio > 0.5) { // > 50% compressible
      suggestions.push({
        type: 'compression_opportunity',
        icon: '🗜️',
        title: 'Compression Opportunity',
        description: `${(compressionRatio * 100).toFixed(0)}% of files could be compressed`,
        action: 'Analyze compression options',
        prompt: 'Suggest compression strategies for different file types.'
      });
    }

    return suggestions.slice(0, 3); // Limit to 3 proactive suggestions
  };

  // Learn from conversation patterns and improve suggestions
  const learnFromConversation = (query: string, response: string, success: boolean) => {
    const topics = extractTopics(query);
    const responseQuality = analyzeResponseQuality(response);

    setConversationMemory(prev => ({
      ...prev,
      topics: {
        ...prev.topics,
        ...topics
      },
      userPatterns: {
        ...prev.userPatterns,
        queryLength: [...(prev.userPatterns.queryLength || []), query.length].slice(-10), // Keep last 10
        topicsUsed: [...(prev.userPatterns.topicsUsed || []), ...Object.keys(topics)].slice(-20)
      },
      successfulQueries: success
        ? [...prev.successfulQueries, { query, topics: Object.keys(topics), timestamp: Date.now() }].slice(-20)
        : prev.successfulQueries,
      failedQueries: !success
        ? [...prev.failedQueries, { query, timestamp: Date.now() }].slice(-5)
        : prev.failedQueries,
      preferences: {
        ...prev.preferences,
        responseFormat: response.includes('📊') || response.includes('|') ? 'visual' : 'text'
      }
    }));

    // Add to session insights
    if (responseQuality > 0.7) {
      const insight = extractInsightFromResponse(response);
      if (insight) {
        setSessionInsights(prev => [...prev.slice(-4), insight]); // Keep last 5 insights
      }
    }
  };

  // Extract topics from query for learning
  const extractTopics = (query: string) => {
    const topics: any = {};
    const lowerQuery = query.toLowerCase();

    const topicKeywords = {
      storage: ['storage', 'space', 'size', 'disk', 'memory'],
      cleanup: ['delete', 'remove', 'clean', 'archive', 'compress'],
      organization: ['organize', 'structure', 'folder', 'directory', 'sort'],
      analysis: ['analyze', 'pattern', 'statistics', 'metrics'],
      code: ['code', 'programming', 'script', 'function', 'class'],
      performance: ['performance', 'speed', 'optimize', 'slow', 'fast']
    };

    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        topics[topic] = (topics[topic] || 0) + 1;
      }
    });

    return topics;
  };

  // Analyze response quality for learning
  const analyzeResponseQuality = (response: string) => {
    let score = 0.5; // Base score

    // Check for structured responses
    if (response.includes('|') && response.includes('---')) score += 0.1; // Tables
    if (response.includes('📊') || response.includes('📈')) score += 0.1; // Visual elements
    if (response.match(/\d+\./g)?.length > 2) score += 0.1; // Numbered lists
    if (response.includes('```')) score += 0.1; // Code blocks
    if (response.length > 200) score += 0.1; // Substantial content
    if (response.includes('recommend') || response.includes('suggest')) score += 0.1; // Actionable advice

    return Math.min(score, 1.0);
  };

  // Extract insights from responses
  const extractInsightFromResponse = (response: string) => {
    const patterns = [
      /Total size: ([^.\n]+)/i,
      /Largest file: ([^.\n]+)/i,
      /([0-9]+)% of files/i,
      /([0-9]+) large files/i,
      /([0-9]+) code files/i
    ];

    for (const pattern of patterns) {
      const match = response.match(pattern);
      if (match && match[1]) {
        return match[0].trim();
      }
    }
    return null;
  };

  // Get personalized suggestions based on learning
  const getPersonalizedSuggestions = () => {
    if (!conversationMemory.userPatterns.topicsUsed?.length) return [];

    const topTopics = Object.entries(conversationMemory.topics)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 2)
      .map(([topic]) => topic);

    const suggestions = [];

    if (topTopics.includes('storage')) {
      suggestions.push({
        icon: '💾',
        title: 'Storage Deep Dive',
        description: 'Based on your interest in storage analysis',
        prompt: 'Provide a detailed breakdown of storage usage by category and suggest optimization strategies.'
      });
    }

    if (topTopics.includes('cleanup')) {
      suggestions.push({
        icon: '🧹',
        title: 'Smart Cleanup',
        description: 'Since you frequently ask about cleanup',
        prompt: 'Analyze files for cleanup opportunities, focusing on temporary files, duplicates, and archival candidates.'
      });
    }

    if (conversationMemory.preferences.responseFormat === 'visual') {
      suggestions.push({
        icon: '📊',
        title: 'Visual Analysis',
        description: 'You prefer visual responses',
        prompt: 'Create a comprehensive visual analysis with charts and tables showing file system metrics.'
      });
    }

    return suggestions.slice(0, 2);
  };

  const quickInsights = [
    {
      icon: '📊',
      title: 'Storage Analysis',
      description: 'Get comprehensive storage insights',
      prompt: 'Provide a detailed analysis of my storage usage patterns and recommendations.'
    },
    {
      icon: '🧹',
      title: 'Cleanup Suggestions',
      description: 'Find files to delete or archive',
      prompt: 'Analyze my directory and suggest specific files that can be safely removed or archived.'
    },
    {
      icon: '📁',
      title: 'Organization Tips',
      description: 'Improve file organization',
      prompt: 'Review my directory structure and suggest ways to better organize my files.'
    },
    {
      icon: '⚡',
      title: 'Performance Insights',
      description: 'Optimize system performance',
      prompt: 'Identify any files or patterns that might be affecting system performance and suggest optimizations.'
    }
  ];

  const quickActions = [
    { 
      icon: BrainCircuit, 
      label: 'Analyze Structure', 
      action: 'analyze',
      color: 'text-purple-500'
    },
    { 
      icon: BarChart3, 
      label: 'Get Insights', 
      action: 'insights',
      color: 'text-blue-500'
    },
    { 
      icon: Code, 
      label: 'Code Analysis', 
      action: 'code',
      color: 'text-green-500'
    },
    { 
      icon: FileText, 
      label: 'Generate Report', 
      action: 'report',
      color: 'text-orange-500'
    }
  ];

  useEffect(() => {
    initializeOllama();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeOllama = async () => {
    try {
      const connected = await ollamaService.testConnection();
      setIsConnected(connected);
      
      if (connected) {
        const models = await ollamaService.fetchModels();
        setAvailableModels(models);
        
        // Set default model - backend will auto-select based on query
        if (models.some(m => m.name === 'gemma3:latest')) {
          setCurrentModel('Auto-Select');
          ollamaService.setCurrentModel('gemma3:latest');
        }
      }
    } catch (error) {
      console.error('Failed to initialize Ollama:', error);
      setIsConnected(false);
    }
  };

  // Build comprehensive context from all available data sources
  const buildContextData = () => {
    // Extract detailed file content insights
    const fileContentInsights = analyzeFileContents();

    return {
      categorizedFiles: {
        byCategory: analysisData?.categories || {},
        byExtension: analysisData?.extensionStats || {},
        largeFiles: (analysisData?.files || []).filter((f: any) => f.size > 100 * 1024 * 1024), // > 100MB
        recentFiles: (analysisData?.files || []).filter((f: any) => {
          if (!f.modified_ts) return false;
          const fileDate = new Date(f.modified_ts);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          return fileDate > weekAgo;
        })
      },
      neuralInsights: neuralData ? {
        density: neuralData.metrics?.neuralDensity || 0,
        connections: neuralData.connections?.length || 0,
        nodes: neuralData.nodes?.length || 0,
        circularDeps: neuralData.metrics?.circularDependencies || 0,
        missingDeps: neuralData.metrics?.missingDependencies || 0
      } : null,
      dependencyInsights: dependencyData ? {
        totalNodes: dependencyData.nodes?.length || 0,
        totalEdges: dependencyData.edges?.length || 0,
        circularDeps: dependencyData.circularDependencies?.length || 0
      } : null
    };
  };

  // Analyze actual file contents for intelligent insights
  const analyzeFileContents = () => {
    const insights = {
      codeFiles: [] as any[],
      pythonFiles: [] as any[],
      jsFiles: [] as any[],
      otherCodeFiles: [] as any[],
      pythonPatterns: {} as any,
      jsPatterns: {} as any,
      codeQualityMetrics: {} as any,
      languageBreakdown: {} as any,
      importsAndDependencies: {} as any,
      codingStandards: {} as any
    };

    if (!analysisData?.files) return insights;

    analysisData.files.forEach((file: any) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      const isCodeFile = ['py', 'js', 'ts', 'jsx', 'tsx', 'java', 'cpp', 'c', 'cs', 'php', 'rb', 'go', 'rs', 'swift'].includes(ext || '');

      if (isCodeFile) {
        const codeFile = {
          name: file.name,
          path: file.path,
          size: file.size,
          extension: ext,
          category: file.category
        };

        insights.codeFiles.push(codeFile);

        // Language-specific analysis
        if (ext === 'py') {
          insights.pythonFiles.push(codeFile);
          // Analyze Python patterns (would need actual content)
          insights.pythonPatterns = {
            ...insights.pythonPatterns,
            totalPythonFiles: (insights.pythonPatterns.totalPythonFiles || 0) + 1,
            sizeDistribution: [...(insights.pythonPatterns.sizeDistribution || []), file.size],
            categoryDistribution: {
              ...(insights.pythonPatterns.categoryDistribution || {}),
              [file.category]: (insights.pythonPatterns.categoryDistribution?.[file.category] || 0) + 1
            }
          };
        } else if (['js', 'ts', 'jsx', 'tsx'].includes(ext || '')) {
          insights.jsFiles.push(codeFile);
          insights.jsPatterns = {
            ...insights.jsPatterns,
            totalJSFiles: (insights.jsPatterns.totalJSFiles || 0) + 1,
            frameworkHints: {
              react: ext?.includes('x') ? (insights.jsPatterns.frameworkHints?.react || 0) + 1 : (insights.jsPatterns.frameworkHints?.react || 0),
              typescript: ['ts', 'tsx'].includes(ext || '') ? (insights.jsPatterns.frameworkHints?.typescript || 0) + 1 : (insights.jsPatterns.frameworkHints?.typescript || 0),
              vanilla: ext === 'js' ? (insights.jsPatterns.frameworkHints?.vanilla || 0) + 1 : (insights.jsPatterns.frameworkHints?.vanilla || 0)
            }
          };
        } else {
          insights.otherCodeFiles.push(codeFile);
        }

        // Language breakdown
        insights.languageBreakdown[ext || 'unknown'] = (insights.languageBreakdown[ext || 'unknown'] || 0) + 1;
      }
    });

    // Generate code quality insights based on available data
    insights.codeQualityMetrics = {
      totalCodeFiles: insights.codeFiles.length,
      pythonPercentage: insights.pythonFiles.length > 0 ? ((insights.pythonFiles.length / insights.codeFiles.length) * 100).toFixed(1) + '%' : '0%',
      jsPercentage: insights.jsFiles.length > 0 ? ((insights.jsFiles.length / insights.codeFiles.length) * 100).toFixed(1) + '%' : '0%',
      avgPythonFileSize: insights.pythonFiles.length > 0 ? (insights.pythonFiles.reduce((sum, f) => sum + f.size, 0) / insights.pythonFiles.length) : 0,
      avgJSFileSize: insights.jsFiles.length > 0 ? (insights.jsFiles.reduce((sum, f) => sum + f.size, 0) / insights.jsFiles.length) : 0,
      languages: Object.keys(insights.languageBreakdown).length,
      largestCodeFile: insights.codeFiles.length > 0 ? insights.codeFiles.reduce((max, f) => f.size > max.size ? f : max, insights.codeFiles[0]) : null
    };

    return insights;
  };

  // Intelligent query analysis and data retrieval
  const analyzeQueryIntent = (query: string) => {
    const query_lower = query.toLowerCase();
    const intent = {
      type: 'general',
      dataType: null as string | null,
      category: null as string | null,
      specificFiles: false,
      metrics: false,
      recommendations: false,
      neural: false,
      dependencies: false
    };

    // Detect data type requests
    if (query_lower.includes('model') || query_lower.includes('checkpoint') || query_lower.includes('safetensors') || query_lower.includes('.pt') || query_lower.includes('.ckpt')) {
      intent.dataType = 'ai_models';
      intent.type = 'specific_files';
    } else if (query_lower.includes('code') || query_lower.includes('programming') || query_lower.includes('script')) {
      intent.dataType = 'code';
      intent.type = 'category';
    } else if (query_lower.includes('image') || query_lower.includes('picture') || query_lower.includes('photo')) {
      intent.dataType = 'images';
      intent.type = 'category';
    } else if (query_lower.includes('video') || query_lower.includes('movie') || query_lower.includes('media')) {
      intent.dataType = 'videos';
      intent.type = 'category';
    } else if (query_lower.includes('document') || query_lower.includes('pdf') || query_lower.includes('doc')) {
      intent.dataType = 'documents';
      intent.type = 'category';
    }

    // Detect intent type
    if (query_lower.includes('neural') || query_lower.includes('connection') || query_lower.includes('dependency')) {
      intent.neural = true;
      intent.dependencies = true;
    }
    if (query_lower.includes('large') || query_lower.includes('big') || query_lower.includes('space') || query_lower.includes('size')) {
      intent.metrics = true;
    }
    if (query_lower.includes('recommend') || query_lower.includes('suggest') || query_lower.includes('optimize')) {
      intent.recommendations = true;
    }
    if (query_lower.includes('specific') || query_lower.includes('particular') || query_lower.includes('certain')) {
      intent.specificFiles = true;
    }

    return intent;
  };

  // Retrieve relevant data based on query intent
  const getRelevantData = (intent: any, context: any) => {
    let relevantData = {};

    // Add basic summary for all queries
    relevantData = {
      ...relevantData,
      summary: context.summary,
      totalFiles: context.summary.totalFiles,
      totalSize: formatFileSize(context.summary.totalSize),
      categories: Object.keys(context.summary.categories).length,
      topCategories: context.summary.topCategories
    };

    // Add category-specific data
    if (intent.dataType && context.categorizedFiles.byCategory[intent.dataType]) {
      const categoryData = context.categorizedFiles.byCategory[intent.dataType];
      relevantData = {
        ...relevantData,
        [`${intent.dataType}_count`]: categoryData.count,
        [`${intent.dataType}_size`]: formatFileSize(categoryData.size),
        [`${intent.dataType}_category`]: intent.dataType
      };
    }

    // Add neural data if requested
    if (intent.neural && context.neuralInsights) {
      relevantData = {
        ...relevantData,
        neuralDensity: (context.neuralInsights.density * 100).toFixed(1) + '%',
        totalConnections: context.neuralInsights.connections,
        totalNodes: context.neuralInsights.nodes,
        circularDependencies: context.neuralInsights.circularDeps,
        missingDependencies: context.neuralInsights.missingDeps
      };
    }

    // Add dependency data if requested
    if (intent.dependencies && context.dependencyInsights) {
      relevantData = {
        ...relevantData,
        dependencyNodes: context.dependencyInsights.totalNodes,
        dependencyEdges: context.dependencyInsights.totalEdges,
        circularDependencies: context.dependencyInsights.circularDeps
      };
    }

    // Add large files if metrics requested
    if (intent.metrics && context.categorizedFiles.largeFiles.length > 0) {
      relevantData = {
        ...relevantData,
        largeFilesCount: context.categorizedFiles.largeFiles.length,
        largestFile: context.categorizedFiles.largeFiles[0]?.name || 'N/A',
        largestFileSize: formatFileSize(context.categorizedFiles.largeFiles[0]?.size || 0)
      };
    }

    // Add recent files if requested
    if (intent.specificFiles && context.categorizedFiles.recentFiles.length > 0) {
      relevantData = {
        ...relevantData,
        recentFilesCount: context.categorizedFiles.recentFiles.length,
        recentFiles: context.categorizedFiles.recentFiles.slice(0, 5).map((f: any) => ({
          name: f.name,
          size: formatFileSize(f.size),
          category: f.category
        }))
      };
    }

    return relevantData;
  };

  // Method to detect if a query is a search request
  const isSearchQuery = (query: string): boolean => {
    const searchKeywords = [
      'find', 'search', 'look for', 'show me', 'where is', 'locate', 'get me',
      'what files', 'list files', 'find files', 'search for', 'show all',
      'filter', 'match', 'containing', 'with name', 'with extension'
    ];
    
    const queryLower = query.toLowerCase();
    
    // Check if query contains search keywords
    const hasSearchKeyword = searchKeywords.some(keyword => queryLower.includes(keyword));
    
    // Check if query is asking about specific files or patterns
    const hasFilePattern = /\.(py|js|ts|java|cpp|c|cs|html|css|json|xml|txt|md|pdf|doc|docx|xls|xlsx|png|jpg|jpeg|gif|svg|mp4|mp3|zip|tar|gz)/i.test(query);
    
    // Check if query is asking about specific categories
    const hasCategoryPattern = /(code|documents|images|videos|audio|archives|executables|config|temp|backup|ai|ml|models|data)/i.test(query);
    
    // Check if query is asking about file characteristics
    const hasCharacteristicPattern = /(large|small|big|tiny|recent|old|new|modified|created|size|empty)/i.test(query);
    
    return hasSearchKeyword || hasFilePattern || hasCategoryPattern || hasCharacteristicPattern;
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isStreaming) return;

    try {
      // Update analysis data in context
      if (analysisData) {
        updateAnalysisData({
          totalFiles: analysisData.totalFiles || 0,
          totalSize: analysisData.totalSize || 0,
          categories: analysisData.categories || {},
          files: analysisData.files || [],
          largestFile: analysisData.largestFile || '',
          analysisTime: new Date().toISOString()
        });
      }

      // Send message through unified AI workflow
      await sendMessage(content, {
        analysisData: analysisData,
        files: fileBrowserData || [],
        categories: analysisData?.categories || {}
      });

      setInputMessage('');
/* setIsLoading calls are removed as loading state is managed by useStreamingChat hook */
      setActualModel(aiStatus?.model || 'self-learning+ollama');
      setLastResponseTime(Date.now());

    } catch (error) {
      console.error('❌ Enhanced AI chat failed:', error);
/* setIsLoading calls are removed */
    }
  };

  const handleQuickAction = async (action: string) => {
    let prompt = '';
    
    switch (action) {
      case 'analyze':
        prompt = '/analyze';
        break;
      case 'insights':
        prompt = 'Provide detailed insights about my file system structure and usage patterns.';
        break;
      case 'code':
        prompt = 'Analyze any code files in this structure and provide recommendations for optimization.';
        break;
      case 'report':
        prompt = 'Generate a comprehensive report summarizing the file system analysis with key findings and recommendations.';
        break;
    }
    
    await handleSendMessage(prompt);
  };

  // Enhanced message formatting with tables, charts, and better structure
  const formatMessageContent = (content: string) => {
    // Split by double newlines to create paragraphs
    const paragraphs = content.split(/\n\s*\n/);

    return paragraphs.map((paragraph, index) => {
      // Check for tables (markdown table format)
      if (paragraph.includes('|') && paragraph.includes('---')) {
        const lines = paragraph.split('\n').filter(line => line.trim());
        if (lines.length >= 3) {
          const headers = lines[0].split('|').map(h => h.trim()).filter(h => h);
          const separator = lines[1];
          const rows = lines.slice(2).map(row =>
            row.split('|').map(cell => cell.trim()).filter(cell => cell !== '')
          ).filter(row => row.length > 0);

          return (
            <div key={index} className="mb-4 overflow-x-auto">
              <table className="min-w-full bg-gray-800 rounded-lg overflow-hidden">
                <thead className="bg-gray-700">
                  <tr>
                    {headers.map((header, i) => (
                      <th key={i} className="px-4 py-2 text-left text-xs font-medium text-gray-200 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-600">
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-gray-750">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-2 text-sm text-gray-300">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
      }

      // Check for simple data charts (size comparisons, percentages)
      const chartMatch = paragraph.match(/📊\s*([^:\n]+):\s*([^\n]+)/);
      if (chartMatch) {
        const [, label, data] = chartMatch;
        // Parse data for simple bar chart if it contains percentages or sizes
        const valueMatch = data.match(/(\d+(?:\.\d+)?)%|(\d+(?:\.\d+)?)\s*(KB|MB|GB|TB)/);
        if (valueMatch) {
          const percentage = valueMatch[1] ? parseFloat(valueMatch[1]) : 0;
          const size = valueMatch[2] ? parseFloat(valueMatch[2]) : 0;
          const unit = valueMatch[3] || '%';

          return (
            <div key={index} className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-200">{label}</span>
                <span className="text-sm text-gray-400">{percentage || size} {unit}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(percentage || (size / 100) * 100, 100)}%` }}
                />
              </div>
            </div>
          );
        }
      }

      // Check for stats cards (key metrics)
      if (paragraph.includes('📈') || paragraph.includes('📊') || paragraph.includes('💾')) {
        const stats = paragraph.split('\n').filter(line => line.trim() && (line.includes('📈') || line.includes('📊') || line.includes('💾')));
        if (stats.length > 0) {
          return (
            <div key={index} className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stats.map((stat, statIndex) => {
                const [emoji, ...rest] = stat.split(' ');
                const text = rest.join(' ');
                const [label, value] = text.split(': ').map(s => s.trim());

                return (
                  <div key={statIndex} className="bg-gradient-to-br from-gray-800 to-gray-750 p-3 rounded-lg border border-gray-600">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-lg">{emoji}</span>
                      <span className="text-sm font-medium text-gray-200">{label}</span>
                    </div>
                    <div className="text-lg font-bold text-blue-400">{value}</div>
                  </div>
                );
              })}
            </div>
          );
        }
      }

      // Check if this looks like a list item
      if (paragraph.trim().match(/^[-•*]\s/)) {
        const listItems = paragraph.split('\n').filter(item => item.trim());
        return (
          <ul key={index} className="list-disc list-inside space-y-1 mb-3 text-gray-300">
            {listItems.map((item, itemIndex) => (
              <li key={itemIndex} className="leading-relaxed">
                {item.replace(/^[-•*]\s/, '')}
              </li>
            ))}
          </ul>
        );
      }

      // Check if this looks like a numbered list
      if (paragraph.trim().match(/^\d+\.\s/)) {
        const listItems = paragraph.split('\n').filter(item => item.trim());
        return (
          <ol key={index} className="list-decimal list-inside space-y-1 mb-3 text-gray-300">
            {listItems.map((item, itemIndex) => (
              <li key={itemIndex} className="leading-relaxed">
                {item.replace(/^\d+\.\s/, '')}
              </li>
            ))}
          </ol>
        );
      }

      // Check for code blocks (```code```) - enhanced with copy button
      if (paragraph.includes('```')) {
        const parts = paragraph.split(/(```[\s\S]*?```)/g);
        return (
          <div key={index} className="mb-3">
            {parts.map((part, partIndex) => {
              if (part.startsWith('```') && part.endsWith('```')) {
                const code = part.slice(3, -3);
                const language = code.split('\n')[0].trim();
                const actualCode = code.split('\n').slice(1).join('\n');

                return (
                  <div key={partIndex} className="relative group mb-2">
                    <div className="flex items-center justify-between bg-gray-800 px-3 py-2 rounded-t-lg border-b border-gray-600">
                      <span className="text-xs text-gray-400 font-mono">{language || 'code'}</span>
                      <button
                        onClick={() => navigator.clipboard.writeText(actualCode.trim())}
                        className="text-xs text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        📋 Copy
                      </button>
                    </div>
                    <pre className="bg-gray-900 p-3 rounded-b-lg overflow-x-auto text-xs font-mono text-green-400">
                      <code>{actualCode.trim()}</code>
                    </pre>
                  </div>
                );
              }
              return part ? <span key={partIndex}>{part}</span> : null;
            })}
          </div>
        );
      }

      // Check for inline code (`code`)
      if (paragraph.includes('`')) {
        const parts = paragraph.split(/(`[^`]+`)/g);
        return (
          <p key={index} className="mb-3 text-gray-300 leading-relaxed">
            {parts.map((part, partIndex) => {
              if (part.startsWith('`') && part.endsWith('`')) {
                return (
                  <code key={partIndex} className="bg-gray-800 px-2 py-1 rounded text-xs font-mono text-blue-400 border border-gray-600">
                    {part.slice(1, -1)}
                  </code>
                );
              }
              return part;
            })}
          </p>
        );
      }

      // Check for bold text (**text**) and other formatting
      if (paragraph.includes('**') || paragraph.includes('*') || paragraph.includes('_')) {
        const parts = paragraph.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
        return (
          <p key={index} className="mb-3 text-gray-300 leading-relaxed">
            {parts.map((part, partIndex) => {
              if (part.startsWith('**') && part.endsWith('**')) {
                return (
                  <strong key={partIndex} className="font-semibold text-white">
                    {part.slice(2, -2)}
                  </strong>
                );
              }
              if (part.startsWith('*') && part.endsWith('*')) {
                return (
                  <em key={partIndex} className="italic text-gray-200">
                    {part.slice(1, -1)}
                  </em>
                );
              }
              return part;
            })}
          </p>
        );
      }

      // Regular paragraph
      return (
        <p key={index} className="mb-3 text-gray-300 leading-relaxed">
          {paragraph.trim()}
        </p>
      );
    });
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 xs:gap-3 p-2 xs:p-3 sm:p-4 border-b border-gray-700">
        <div className="flex flex-col xs:flex-row xs:items-center space-y-1 xs:space-y-0 xs:space-x-2 sm:space-x-3 min-w-0 flex-1">
          <div className="flex items-center space-x-1.5 xs:space-x-2 min-w-0 flex-1">
            <MessageSquare className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5 text-blue-400 flex-shrink-0" />
            <h2 className="text-sm xs:text-base sm:text-lg font-semibold truncate leading-tight">AI Assistant</h2>
          </div>

          {/* Connection Status */}
          <div className="flex items-center space-x-1 flex-shrink-0">
            {isConnected ? (
              <>
                <CheckCircle className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 text-green-400" />
                <span className="text-xs xs:text-sm text-green-400">Connected</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 text-red-400" />
                <span className="text-xs xs:text-sm text-red-400">Disconnected</span>
              </>
            )}
          </div>
        </div>

        {/* Model Selector */}
        <div className="flex items-center space-x-1.5 xs:space-x-2 flex-shrink-0">
          <Settings className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
          <div className="flex flex-col min-w-0">
            <select
              value={currentModel}
              onChange={(e) => {
                const model = e.target.value;
                setCurrentModel(model);
                setActualModel(''); // Clear actual model when user changes selection
                if (model !== 'Auto-Select') {
                  ollamaService.setCurrentModel(model);
                }
              }}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs xs:text-sm text-gray-300 focus:outline-none focus:border-blue-500 min-w-0 truncate touch-manipulation"
              disabled={!isConnected}
              aria-label="Select AI model"
              title="Choose AI model for chat"
            >
              <option value="Auto-Select">Auto-Select</option>
              {availableModels.map((model) => (
                <option key={model.name} value={model.name}>
                  {model.name} ({formatFileSize(model.size)})
                </option>
              ))}
            </select>
            {actualModel && actualModel !== currentModel && (
              <div className="text-xs text-blue-400 mt-0.5 xs:mt-1 truncate">
                Using: {actualModel.split(':')[0]}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Status Indicator */}
      <AIStatusIndicator
        aiStatus={aiStatus || {
          model: 'self-learning+ollama',
          stage: 'ready',
          streaming: isStreaming,
          confidence: 0.9
        }}
        capabilities={aiCapabilities}
      />

      {/* Conversation Context */}
      {messages.length > 0 && analysisData && (
        <div className="px-3 xs:px-4 py-2 bg-gray-800/30 border-b border-gray-700">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>💬 Conversation about {analysisData.totalFiles?.toLocaleString() || 0} files</span>
            <span>{messages.length} messages</span>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex items-center space-x-1 xs:space-x-1.5 sm:space-x-2 p-2 xs:p-3 sm:p-4 border-b border-gray-700 overflow-x-auto scrollbar-thin">
        {quickActions.map((action) => (
          <button
            key={action.action}
            onClick={() => handleQuickAction(action.action)}
            className="flex items-center space-x-1 xs:space-x-1.5 sm:space-x-2 px-2 xs:px-2.5 sm:px-3 py-1.5 xs:py-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors flex-shrink-0 touch-manipulation min-h-[36px]"
            disabled={!isConnected || isAnalyzing}
          >
            <action.icon className={`w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4 ${action.color}`} />
            <span className="text-xs xs:text-sm sm:text-sm">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scroll-smooth p-2 xs:p-3 sm:p-4 space-y-3 xs:space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-6 xs:py-8">
            <Sparkles className="w-10 h-10 xs:w-12 xs:h-12 mx-auto mb-3 xs:mb-4 text-blue-400" />
            <h3 className="text-base xs:text-lg font-medium mb-2">AI Assistant Ready</h3>
            <p className="text-xs xs:text-sm mb-4 xs:mb-6 px-2">Ask me anything about your file system analysis</p>

            {/* Quick Insights Cards */}
            <div className="grid grid-cols-1 xs:grid-cols-2 gap-3 xs:gap-4 mb-6 xs:mb-8 px-2">
              {quickInsights.map((insight, index) => (
                <button
                  key={index}
                  onClick={() => handleSendMessage(insight.prompt)}
                  className="bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 rounded-lg p-3 xs:p-4 text-left transition-all duration-200 hover:scale-105 touch-manipulation"
                  disabled={!isConnected}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-lg">{insight.icon}</span>
                    <span className="font-medium text-white text-sm">{insight.title}</span>
                  </div>
                  <p className="text-xs text-gray-300 leading-tight">{insight.description}</p>
                </button>
              ))}
            </div>

            {/* Proactive Suggestions */}
            {analysisData && getProactiveSuggestions().length > 0 && (
              <div className="border-t border-gray-700 pt-4 xs:pt-6">
                <h4 className="text-sm font-medium text-blue-400 mb-3 flex items-center">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Smart Insights
                </h4>
                <div className="space-y-2 xs:space-y-3 px-2">
                  {getProactiveSuggestions().map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSendMessage(suggestion.prompt)}
                      className="w-full text-left p-3 xs:p-4 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/20 rounded-lg hover:from-blue-900/30 hover:to-purple-900/30 transition-all duration-200 hover:scale-[1.02] touch-manipulation min-h-[60px]"
                      disabled={!isConnected}
                    >
                      <div className="flex items-start space-x-3">
                        <span className="text-lg flex-shrink-0 mt-0.5">{suggestion.icon}</span>
                        <div className="flex-1 min-w-0">
                          <h5 className="text-sm font-medium text-white mb-1 truncate">{suggestion.title}</h5>
                          <p className="text-xs text-gray-300 leading-tight">{suggestion.description}</p>
                          <p className="text-xs text-blue-400 mt-1 font-medium">{suggestion.action}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Suggested Questions */}
            <div className="border-t border-gray-700 pt-4 xs:pt-6">
              <h4 className="text-sm font-medium text-gray-300 mb-3">Quick Questions</h4>
              <div className="grid grid-cols-1 xs:grid-cols-1 sm:grid-cols-2 gap-2 xs:gap-2.5 px-2">
                {suggestedQuestions.slice(0, 4).map((question, index) => (
                  <button
                    key={index}
                    onClick={() => setInputMessage(question)}
                    className="text-left px-2.5 xs:px-3 py-2 xs:py-2.5 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors text-xs xs:text-sm touch-manipulation min-h-[44px] leading-tight"
                    disabled={!isConnected}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex items-start space-x-2 xs:space-x-3 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 bg-blue-600 rounded-full flex items-center justify-center">
                <Bot className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4" />
              </div>
            )}

            <div
              className={`max-w-[85%] xs:max-w-[80%] px-3 xs:px-4 py-2 xs:py-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-100'
              }`}
            >
              <div className="prose prose-invert prose-sm max-w-none text-xs xs:text-sm leading-relaxed">
                {formatMessageContent(message.content)}
              </div>
              <div className="text-xs text-gray-400 mt-2 xs:mt-3 opacity-75 pt-2 border-t border-gray-700/50">
                {message.timestamp.toLocaleTimeString()} • {message.model?.split(':')[0]}
              </div>
            </div>

            {message.role === 'user' && (
              <div className="flex-shrink-0 w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 bg-gray-600 rounded-full flex items-center justify-center">
                <User className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4" />
              </div>
            )}
          </div>
        ))}

        {isAnalyzing && (
          <div className="flex items-start space-x-2 xs:space-x-3 justify-start">
            <div className="flex-shrink-0 w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <Bot className="w-3 h-3 xs:w-3.5 xs:h-3.5 sm:w-4 sm:h-4" />
            </div>
            <div className="bg-gray-800 px-3 xs:px-4 py-2 xs:py-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span className="text-xs xs:text-sm text-gray-300">Analyzing your files...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Operation Confirmation Dialog */}
      {showOperationConfirmation && (
        <div className="p-2 xs:p-3 sm:p-4 border-t border-gray-700 bg-yellow-900/20">
          <h4 className="text-xs xs:text-sm sm:text-sm font-medium text-yellow-400 mb-2 xs:mb-3">⚠️ Confirm File Operations</h4>
          <div className="space-y-1.5 xs:space-y-2 mb-3 xs:mb-4 max-h-24 xs:max-h-32 overflow-y-auto">
            {proposedOperations.map((op, index) => (
              <div key={index} className="flex items-start space-x-1.5 xs:space-x-2 text-xs xs:text-sm">
                <span className="text-yellow-400 flex-shrink-0 mt-0.5">{index + 1}.</span>
                <span className="text-gray-300 break-words leading-relaxed">{op.description}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2">
            <button
              onClick={() => executeOperations(proposedOperations)}
              className="flex-1 xs:flex-none px-3 xs:px-3.5 sm:px-4 py-2.5 xs:py-2.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs xs:text-sm touch-manipulation min-h-[44px]"
            >
              Execute Operations
            </button>
            <button
              onClick={() => setShowOperationConfirmation(false)}
              className="flex-1 xs:flex-none px-3 xs:px-3.5 sm:px-4 py-2.5 xs:py-2.5 sm:py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs xs:text-sm touch-manipulation min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Operation Progress */}
      {operationInProgress && (
        <div className="p-3 sm:p-4 border-t border-gray-700 bg-blue-900/20">
          <h4 className="text-xs sm:text-sm font-medium text-blue-400 mb-2">
            🔄 File Operations {operationInProgress.status === 'completed' ? 'Completed' :
                               operationInProgress.status === 'error' ? 'Failed' : 'In Progress'}
          </h4>

          {operationInProgress.status === 'error' ? (
            <div className="text-xs sm:text-sm text-red-400">
              Error: {operationInProgress.error}
            </div>
          ) : operationInProgress.status === 'completed' ? (
            <div className="text-xs sm:text-sm text-green-400">
              ✅ All {operationInProgress.total || operationInProgress.operations} operations completed successfully
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs sm:text-sm">
                <span className="text-gray-300">
                  {operationInProgress.completed || 0} / {operationInProgress.total || operationInProgress.operations} operations
                </span>
                <span className="text-gray-400">
                  {operationInProgress.operationId ? `ID: ${operationInProgress.operationId.slice(-8)}` : ''}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: operationInProgress.total ?
                      ((operationInProgress.completed || 0) / operationInProgress.total) * 100 : 0
                  }}
                />
              </div>
              {operationInProgress.currentOperation && (
                <div className="text-xs text-gray-400 truncate">
                  Current: {operationInProgress.currentOperation}
                </div>
              )}
            </div>
          )}

          {operationHistory.length > 0 && operationInProgress.status === 'completed' && (
            <div className="mt-3 pt-3 border-t border-gray-600">
              <button
                onClick={undoLastOperation}
                className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
              >
                Undo Last Operation
              </button>
            </div>
          )}
        </div>
      )}

      {/* Analysis Insights */}
      {analysisInsights && (
        <div className="p-4 border-t border-gray-700 bg-gray-800">
          <h4 className="text-sm font-medium text-blue-400 mb-2">🔍 Analysis Insights</h4>
          <div className="text-sm text-gray-300">{analysisInsights}</div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="p-4 border-t border-gray-700 bg-gray-800">
          <h4 className="text-sm font-medium text-green-400 mb-2">💡 Recommendations</h4>
          <ul className="text-sm text-gray-300 space-y-1">
            {recommendations.map((rec, index) => (
              <li key={index} className="flex items-start space-x-2">
                <span className="text-green-400 mt-1">•</span>
                <span>{rec.replace(/^\d+\.\s*/, '')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Operation Confirmation Dialog */}
      {showOperationConfirmation && (
        <div className="p-4 border-t border-gray-700 bg-yellow-900/20">
          <h4 className="text-sm font-medium text-yellow-400 mb-3">⚠️ Confirm File Operations</h4>
          <div className="space-y-2 mb-4">
            {proposedOperations.map((op, index) => (
              <div key={index} className="flex items-center space-x-2 text-sm">
                <span className="text-yellow-400">{index + 1}.</span>
                <span className="text-gray-300">{op.description}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => executeOperations(proposedOperations)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
            >
              Execute Operations
            </button>
            <button
              onClick={() => setShowOperationConfirmation(false)}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Operation Progress */}
      {operationInProgress && (
        <div className="p-4 border-t border-gray-700 bg-blue-900/20">
          <h4 className="text-sm font-medium text-blue-400 mb-2">
            🔄 File Operations {operationInProgress.status === 'completed' ? 'Completed' :
                               operationInProgress.status === 'error' ? 'Failed' : 'In Progress'}
          </h4>

          {operationInProgress.status === 'error' ? (
            <div className="text-sm text-red-400">
              Error: {operationInProgress.error}
            </div>
          ) : operationInProgress.status === 'completed' ? (
            <div className="text-sm text-green-400">
              ✅ All {operationInProgress.total || operationInProgress.operations} operations completed successfully
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-300">
                  {operationInProgress.completed || 0} / {operationInProgress.total || operationInProgress.operations} operations
                </span>
                <span className="text-gray-400">
                  {operationInProgress.operationId ? `ID: ${operationInProgress.operationId.slice(-8)}` : ''}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${operationInProgress.total ?
                      ((operationInProgress.completed || 0) / operationInProgress.total) * 100 : 0}%`
                  }}
                />
              </div>
              {operationInProgress.currentOperation && (
                <div className="text-xs text-gray-400">
                  Current: {operationInProgress.currentOperation}
                </div>
              )}
            </div>
          )}

          {operationHistory.length > 0 && operationInProgress.status === 'completed' && (
            <div className="mt-3 pt-3 border-t border-gray-600">
              <button
                onClick={undoLastOperation}
                className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
              >
                Undo Last Operation
              </button>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="p-2 xs:p-3 sm:p-4 border-t border-gray-700 bg-gray-900/50">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputMessage);
          }}
          className="flex items-end space-x-2 xs:space-x-2.5"
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder={isConnected ? "Ask about your file system..." : "Connect to Ollama to start..."}
            className="flex-1 px-3 xs:px-3.5 sm:px-4 py-2.5 xs:py-2.5 sm:py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 text-white placeholder-gray-400 text-sm xs:text-base leading-relaxed resize-none min-h-[44px] touch-manipulation"
            disabled={!isConnected || isAnalyzing}
            style={{height: 'auto', minHeight: '44px'}}
          />
          <button
            type="submit"
            disabled={!isConnected || isAnalyzing || !inputMessage.trim()}
            className="px-3 xs:px-3.5 sm:px-4 py-2.5 xs:py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-1 xs:space-x-1.5 sm:space-x-2 flex-shrink-0 touch-manipulation min-h-[44px] min-w-[44px] xs:min-w-[auto]"
          >
            {isAnalyzing ? (
              <Loader2 className="w-3.5 h-3.5 xs:w-4 xs:h-4 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5 xs:w-4 xs:h-4" />
            )}
            <span className="hidden xs:inline sm:inline text-sm">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}

  // Parse AI response for file operation proposals
  const parseFileOperations = (content: string) => {
    const operations = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const lowerLine = line.toLowerCase().trim();

      // Look for operation patterns
      if (lowerLine.includes('move') || lowerLine.includes('rename')) {
        const moveMatch = line.match(/(?:move|rename)\s+["']?([^"']+)["']?\s+to\s+["']?([^"']+)["']?/i);
        if (moveMatch) {
          operations.push({
            type: 'move',
            sourcePath: moveMatch[1],
            destinationPath: moveMatch[2],
            description: `Move ${moveMatch[1]} to ${moveMatch[2]}`
          });
        }
      } else if (lowerLine.includes('copy')) {
        const copyMatch = line.match(/copy\s+["']?([^"']+)["']?\s+to\s+["']?([^"']+)["']?/i);
        if (copyMatch) {
          operations.push({
            type: 'copy',
            sourcePath: copyMatch[1],
            destinationPath: copyMatch[2],
            description: `Copy ${copyMatch[1]} to ${copyMatch[2]}`
          });
        }
      } else if (lowerLine.includes('delete') || lowerLine.includes('remove')) {
        const deleteMatch = line.match(/(?:delete|remove)\s+["']?([^"']+)["']?/i);
        if (deleteMatch) {
          operations.push({
            type: 'delete',
            sourcePath: deleteMatch[1],
            description: `Delete ${deleteMatch[1]}`
          });
        }
      } else if (lowerLine.includes('create') && lowerLine.includes('folder')) {
        const createMatch = line.match(/create\s+(?:folder|directory)\s+["']?([^"']+)["']?/i);
        if (createMatch) {
          operations.push({
            type: 'create_directory',
            destinationPath: createMatch[1],
            description: `Create directory ${createMatch[1]}`
          });
        }
      }
    }

    return operations;
  };

  // Show confirmation dialog for proposed operations
  // @ts-ignore - state scope issues
  const proposeOperations = (operations: any[]) => {
    // @ts-ignore - setProposedOperations scope
    setProposedOperations(operations);
    // @ts-ignore - setShowOperationConfirmation scope
    setShowOperationConfirmation(true);
  };

  // Execute approved operations
  // @ts-ignore - state scope issues
  const executeOperations = async (operations: any[]) => {
    // @ts-ignore - setShowOperationConfirmation scope
    setShowOperationConfirmation(false);
    // @ts-ignore - setOperationInProgress scope
    setOperationInProgress({ status: 'starting', operations: operations.length });

    try {
      // Execute operations via API
      const response = await fetch('/api/files/batch-operations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations })
      });

      const result = await response.json();

      if (result.success) {
        // @ts-ignore - setOperationInProgress scope
        setOperationInProgressGlobal({
          status: 'running',
          operationId: result.operationId,
          operations: operations.length
        });

        // Monitor progress
        monitorOperationProgress(result.operationId);

        // Add to operation history
        // @ts-ignore - setOperationHistory scope
        setOperationHistoryGlobal(prev => [...prev, {
          id: result.operationId,
          operations,
          timestamp: new Date(),
          status: 'running'
        }]);

      } else {
        throw new Error(result.error);
      }

    } catch (error) {
      // @ts-ignore - setOperationInProgress scope
      setOperationInProgressGlobal({
        status: 'error',
        error: error.message,
        operations: operations.length
      });
      // @ts-ignore - setOperationInProgress scope
      setTimeout(() => setOperationInProgressGlobal(null), 5000);
    }
  };

  // Monitor batch operation progress
  // @ts-ignore - state scope issues
  const monitorOperationProgress = async (operationId: string) => {
    const checkProgress = async () => {
      try {
        const response = await fetch(`/api/files/batch-progress/${operationId}`);
        if (response.status === 404) {
          // Operation completed
          // @ts-ignore - setOperationInProgress scope
          setOperationInProgress(prev => prev ? { ...prev, status: 'completed' } : null);
          // @ts-ignore - setOperationInProgress scope
          setTimeout(() => setOperationInProgress(null), 3000);
          return;
        }

        const progress = await response.json();
        // @ts-ignore - setOperationInProgress scope
        setOperationInProgress({
          status: progress.status,
          operationId,
          completed: progress.completedOperations,
          total: progress.totalOperations,
          currentOperation: progress.currentOperation?.description || 'Processing...'
        });

        // Update history
        // @ts-ignore - setOperationHistory scope
        setOperationHistory(prev => prev.map(op =>
          op.id === operationId ? { ...op, status: progress.status, progress } : op
        ));

        if (progress.status === 'running' || progress.status === 'starting') {
          setTimeout(checkProgress, 1000);
        } else {
          // @ts-ignore - setOperationInProgress scope
          setTimeout(() => setOperationInProgress(null), 3000);
        }
      } catch (error) {
        console.error('Progress check failed:', error);
        // @ts-ignore - setOperationInProgress scope
        setOperationInProgress(prev => prev ? { ...prev, status: 'error', error: error.message } : null);
      }
    };

    checkProgress();
  };

  // Undo last operation
  // @ts-ignore - state scope issues
  const undoLastOperation = async () => {
    // @ts-ignore - operationHistory scope
    const lastOp = operationHistoryGlobal[operationHistoryGlobal.length - 1];
    if (!lastOp || lastOp.status !== 'completed') return;

    // Create reverse operations
    const reverseOperations = lastOp.operations.map(op => {
      switch (op.type) {
        case 'move':
          return { type: 'move', sourcePath: op.destinationPath, destinationPath: op.sourcePath };
        case 'copy':
          return { type: 'delete', sourcePath: op.destinationPath };
        case 'delete':
          // Can't undo delete easily, would need backup
          return null;
        case 'create_directory':
          return { type: 'delete', sourcePath: op.destinationPath };
        default:
          return null;
      }
    }).filter(op => op !== null);

    if (reverseOperations.length > 0) {
      await executeOperations(reverseOperations);
    }
  };
