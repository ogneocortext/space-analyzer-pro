import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  Send,
  Sparkles,
  Bot,
  User,
  BrainCircuit,
  Code,
  FileText,
  BarChart3,
  Settings,
  Loader2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Upload,
  Download,
  Search,
  Filter,
  Clock,
  Star,
  History,
  Pin,
  Copy,
  Share2,
  Mic,
  MicOff,
  Paperclip,
  X,
  Menu,
  Maximize2,
  Minimize2,
  HelpCircle,
  Zap,
  Shield,
  Activity,
  Globe,
  Database
} from 'lucide-react';
import { ollamaService, OllamaModel, ChatMessage } from '../../services/OllamaService';
import { searchService } from '../../services/SearchService';
import { formatFileSize } from '../../utils/formatUtils';
import { useStreamingChat } from '../../hooks/useStreamingChat';
import { useAIContext, useAICapabilities } from '../../contexts/AIContext';
import { AIStatusIndicator } from '../AIStatusIndicator';
import styles from './EnhancedAIChat.module.css';

interface EnhancedAIChatProps {
  analysisData?: any;
  neuralData?: any;
  fileBrowserData?: any[];
  dependencyData?: any;
  onAnalysisComplete?: (insights: string) => void;
}

interface ConversationThread {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: Date;
  isPinned: boolean;
  category: 'general' | 'analysis' | 'troubleshooting' | 'optimization';
}

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  prompt: string;
  category: string;
}

interface FileAnalysisResult {
  file: File;
  analysis: string;
  insights: string[];
  recommendations: string[];
  processingTime: number;
}

export default function EnhancedAIChat({ 
  analysisData, 
  neuralData, 
  fileBrowserData, 
  dependencyData, 
  onAnalysisComplete 
}: EnhancedAIChatProps) {
  // AI capabilities
  const aiCapabilities = useAICapabilities();
  
  // Enhanced streaming chat with conversation management
  const {
    messages,
    sendMessage,
    isStreaming,
    isTyping,
    clearMessages,
    aiStatus
  } = useStreamingChat();

  // Enhanced state management
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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedFiles, setDraggedFiles] = useState<File[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Enhanced conversation management
  const [conversations, setConversations] = useState<ConversationThread[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string>('main');
  const [showConversationHistory, setShowConversationHistory] = useState(false);
  const [pinnedConversations, setPinnedConversations] = useState<Set<string>>(new Set());

  // Enhanced conversation memory and learning
  const [conversationMemory, setConversationMemory] = useState<any>({
    topics: {},
    userPatterns: {},
    successfulQueries: [],
    failedQueries: [],
    preferences: {},
    insights: [],
    quickActions: []
  });
  const [sessionInsights, setSessionInsights] = useState<string[]>([]);
  const [fileAnalysisResults, setFileAnalysisResults] = useState<FileAnalysisResult[]>([]);

  // Enhanced quick actions with categorization
  const quickActions: QuickAction[] = [
    {
      icon: <Database size={16} />,
      label: 'Storage Analysis',
      prompt: 'Provide a comprehensive analysis of my storage usage patterns and recommendations.',
      category: 'analysis'
    },
    {
      icon: <Zap size={16} />,
      label: 'Performance Optimization',
      prompt: 'Analyze system performance and suggest optimization strategies.',
      category: 'optimization'
    },
    {
      icon: <Shield size={16} />,
      label: 'Security Audit',
      prompt: 'Perform a security audit of my file system and identify potential vulnerabilities.',
      category: 'troubleshooting'
    },
    {
      icon: <FileText size={16} />,
      label: 'File Organization',
      prompt: 'Suggest improvements for my file organization and directory structure.',
      category: 'general'
    },
    {
      icon: <BarChart3 size={16} />,
      label: 'Usage Statistics',
      prompt: 'Show detailed statistics about my file usage patterns.',
      category: 'analysis'
    },
    {
      icon: <Activity size={16} />,
      label: 'System Health',
      prompt: 'Check system health and identify any issues that need attention.',
      category: 'troubleshooting'
    }
  ];

  // Enhanced suggested questions based on analysis data
  const suggestedQuestions = useMemo(() => {
    if (!analysisData) return [];

    const questions = [];
    const totalSize = analysisData.totalSize || 0;
    const files = analysisData.files || [];

    // Large files suggestion
    const largeFiles = files.filter((f: any) => f.size > 100 * 1024 * 1024);
    if (largeFiles.length > 0) {
      questions.push(`What are the ${largeFiles.length} largest files taking up space?`);
    }

    // Old files suggestion
    const oldFiles = files.filter((f: any) => {
      if (!f.modified) return false;
      const daysSinceModified = (Date.now() - new Date(f.modified).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceModified > 365;
    });
    if (oldFiles.length > 0) {
      questions.push(`Which ${oldFiles.length} files haven't been accessed in over a year?`);
    }

    // Duplicate files suggestion
    questions.push('Are there any duplicate files I can remove?');
    questions.push('What patterns do you see in my file organization?');
    questions.push('Which file types are taking the most space?');

    return questions.slice(0, 6);
  }, [analysisData]);

  // Enhanced proactive suggestions
  const getProactiveSuggestions = useCallback(() => {
    if (!analysisData) return [];

    const suggestions = [];
    const totalSize = analysisData.totalSize || 0;
    const files = analysisData.files || [];

    // Storage usage analysis
    if (totalSize > 10 * 1024 * 1024 * 1024) { // > 10GB
      suggestions.push({
        type: 'storage_warning',
        icon: <AlertCircle size={16} />,
        title: 'High Storage Usage Detected',
        description: `Your system is using ${formatFileSize(totalSize)} of storage`,
        action: 'Analyze storage usage',
        prompt: 'Provide a detailed analysis of storage usage and cleanup recommendations.'
      });
    }

    // File organization analysis
    const categoryAnalysis = Object.entries(analysisData.categories || {});
    if (categoryAnalysis.length > 10) {
      suggestions.push({
        type: 'organization',
        icon: <FileText size={16} />,
        title: 'Complex File Structure',
        description: `${categoryAnalysis.length} different categories detected`,
        action: 'Optimize organization',
        prompt: 'Analyze file organization and suggest structural improvements.'
      });
    }

    return suggestions.slice(0, 3);
  }, [analysisData]);

  // Enhanced conversation management
  const createNewConversation = useCallback((title: string, category: ConversationThread['category'] = 'general') => {
    const newConversation: ConversationThread = {
      id: Date.now().toString(),
      title: title || 'New Conversation',
      messages: [],
      timestamp: new Date(),
      isPinned: false,
      category
    };
    
    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversationId(newConversation.id);
    clearMessages();
  }, [clearMessages]);

  const pinConversation = useCallback((conversationId: string) => {
    setPinnedConversations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(conversationId)) {
        newSet.delete(conversationId);
      } else {
        newSet.add(conversationId);
      }
      return newSet;
    });
  }, []);

  const deleteConversation = useCallback((conversationId: string) => {
    setConversations(prev => prev.filter(conv => conv.id !== conversationId));
    if (currentConversationId === conversationId) {
      setCurrentConversationId('main');
    }
    setPinnedConversations(prev => {
      const newSet = new Set(prev);
      newSet.delete(conversationId);
      return newSet;
    });
  }, [currentConversationId]);

  // Enhanced file analysis
  const analyzeFiles = useCallback(async (files: File[]) => {
    setOperationInProgress({ type: 'analysis', progress: 0 });
    
    const results: FileAnalysisResult[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const startTime = Date.now();
      
      try {
        // Simulate file analysis
        const analysis = await simulateFileAnalysis(file);
        const processingTime = Date.now() - startTime;
        
        results.push({
          file,
          analysis,
          insights: [`File size: ${formatFileSize(file.size)}`, `Type: ${file.type || 'Unknown'}`],
          recommendations: ['Consider organizing similar files together'],
          processingTime
        });
        
        setOperationInProgress({ type: 'analysis', progress: ((i + 1) / files.length) * 100 });
      } catch (error) {
        console.error('Error analyzing file:', error);
        results.push({
          file,
          analysis: 'Analysis failed',
          insights: [],
          recommendations: [],
          processingTime: Date.now() - startTime
        });
      }
    }
    
    setFileAnalysisResults(results);
    setOperationInProgress(null);
    
    // Add analysis insights to conversation
    const totalInsights = results.flatMap(r => r.insights);
    if (totalInsights.length > 0) {
      const insightsText = `File Analysis Complete:\n${totalInsights.join('\n')}`;
      setAnalysisInsights(insightsText);
      sendMessage(insightsText, 'system');
    }
  }, [sendMessage]);

  const simulateFileAnalysis = async (file: File): Promise<string> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const insights = [];
    insights.push(`File: ${file.name}`);
    insights.push(`Size: ${formatFileSize(file.size)}`);
    insights.push(`Type: ${file.type || 'Unknown'}`);
    insights.push(`Last Modified: ${file.lastModified ? new Date(file.lastModified).toLocaleDateString() : 'Unknown'}`);
    
    if (file.size > 100 * 1024 * 1024) {
      insights.push('This is a large file that may impact storage performance');
    }
    
    if (file.type?.startsWith('image/')) {
      insights.push('This is an image file that could be optimized');
    }
    
    return insights.join('\n');
  };

  const analyzeTopics = (message: string) => {
    const topics: { [key: string]: number } = {};
    const topicKeywords = {
      storage: ['storage', 'space', 'size', 'disk', 'memory'],
      cleanup: ['delete', 'remove', 'clean', 'archive', 'compress'],
      organization: ['organize', 'structure', 'folder', 'directory', 'sort'],
      analysis: ['analyze', 'pattern', 'statistics', 'metrics'],
      code: ['code', 'programming', 'script', 'function', 'class'],
      performance: ['performance', 'speed', 'optimize', 'slow', 'fast']
    };

    const lowerQuery = message.toLowerCase();
    Object.entries(topicKeywords).forEach(([topic, keywords]) => {
      if (keywords.some(keyword => lowerQuery.includes(keyword))) {
        topics[topic] = (topics[topic] || 0) + 1;
      }
    });

    return topics;
  };

  // Enhanced message handling
  const handleSendMessage = useCallback(async (message: string, type: 'user' | 'system' = 'user') => {
    if (!message.trim()) return;
    
    // Add to conversation memory
    const topics = analyzeTopics(message);
    setConversationMemory(prev => ({
      ...prev,
      topics: {
        ...prev.topics,
        ...Object.entries(topics).reduce((acc, [topic, count]) => ({
          ...acc,
          [topic]: (acc[topic] || 0) + count
        }), {})
      }
    }));
    
    // Send message
    await sendMessage(message, type);
    
    // Clear input
    setInputMessage('');
  }, [sendMessage]);

  // Enhanced file handling
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      setDraggedFiles(files);
      analyzeFiles(files);
    }
  }, [analyzeFiles]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(event.dataTransfer.files || []);
    if (files.length > 0) {
      setDraggedFiles(files);
      analyzeFiles(files);
    }
  }, [analyzeFiles]);

  // Enhanced voice recording
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      setIsRecording(false);
      // Stop recording and process
    } else {
      setIsRecording(true);
      // Start recording
    }
  }, [isRecording]);

  // Enhanced search and filtering
  const filteredConversations = useMemo(() => {
    let filtered = conversations;
    
    if (searchQuery) {
      filtered = filtered.filter(conv => 
        conv.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.messages.some(msg => 
          msg.content.toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(conv => conv.category === selectedCategory);
    }
    
    return filtered.sort((a, b) => {
      // Pinned conversations first
      if (pinnedConversations.has(a.id) && !pinnedConversations.has(b.id)) return -1;
      if (!pinnedConversations.has(a.id) && pinnedConversations.has(b.id)) return 1;
      
      // Then by timestamp (newest first)
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }, [conversations, searchQuery, selectedCategory, pinnedConversations]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 'k':
            event.preventDefault();
            setShowSidebar(prev => !prev);
            break;
          case 'f':
            event.preventDefault();
            setIsFullscreen(prev => !prev);
            break;
          case '/':
            event.preventDefault();
            document.getElementById('chat-input')?.focus();
            break;
          case 'n':
            event.preventDefault();
            createNewConversation('New Conversation');
            break;
          case 'h':
            event.preventDefault();
            setShowConversationHistory(prev => !prev);
            break;
        }
      }
      
      switch (event.key) {
        case 'Escape':
          setShowHelp(false);
          setShowConversationHistory(false);
          setShowModelSelector(false);
          break;
        case 'F11':
          event.preventDefault();
          setIsFullscreen(prev => !prev);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [createNewConversation, setShowSidebar, setIsFullscreen]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Initialize main conversation
  useEffect(() => {
    if (conversations.length === 0) {
      createNewConversation('Main Conversation', 'general');
    }
  }, [conversations.length, createNewConversation]);

  // Fullscreen handler
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      chatContainerRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  return (
    <div className={`${styles.enhancedAIChat} ${isFullscreen ? styles.fullscreen : ''}`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerTitle}>
            <BrainCircuit className={styles.headerIcon} />
            <h1>AI Assistant</h1>
            <div className={styles.headerSubtitle}>Get help analyzing your files</div>
          </div>
          
          <div className={styles.statusIndicator}>
            <AIStatusIndicator aiStatus={aiStatus} capabilities={aiCapabilities} />
          </div>
        </div>
        
        <div className={styles.headerRight}>
          <div className={styles.headerControls}>
            <button
              onClick={() => setShowConversationHistory(!showConversationHistory)}
              className={styles.controlButton}
              title="Conversation History"
            >
              <History size={16} />
            </button>
            
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className={styles.controlButton}
              title="Toggle Sidebar"
            >
              <Menu size={16} />
            </button>
            
            <button
              onClick={toggleFullscreen}
              className={styles.controlButton}
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            
            <button
              onClick={() => setShowHelp(!showHelp)}
              className={styles.controlButton}
              title="Help"
            >
              <HelpCircle size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className={styles.chatContainer} ref={chatContainerRef}>
        {/* Sidebar */}
        <AnimatePresence>
          {showSidebar && (
            <motion.div
              className={styles.sidebar}
              initial={{ x: -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
            >
              <div className={styles.sidebarHeader}>
                <h3>Conversations</h3>
                <button
                  onClick={() => createNewConversation('New Conversation')}
                  className={styles.newConversationButton}
                >
                  <MessageSquare size={16} />
                  New Chat
                </button>
              </div>
              
              <div className={styles.searchContainer}>
                <Search size={16} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>
              
              <div className={styles.categoryFilter}>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={styles.categorySelect}
                >
                  <option value="all">All Categories</option>
                  <option value="general">General</option>
                  <option value="analysis">Analysis</option>
                  <option value="troubleshooting">Troubleshooting</option>
                  <option value="optimization">Optimization</option>
                </select>
              </div>
              
              <div className={styles.conversationList}>
                {filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`${styles.conversationItem} ${currentConversationId === conversation.id ? styles.active : ''}`}
                    onClick={() => setCurrentConversationId(conversation.id)}
                  >
                    <div className={styles.conversationHeader}>
                      <div className={styles.conversationTitle}>
                        {conversation.title}
                      </div>
                      <div className={styles.conversationActions}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            pinConversation(conversation.id);
                          }}
                          className={`${styles.pinButton} ${pinnedConversations.has(conversation.id) ? styles.pinned : ''}`}
                          title="Pin Conversation"
                        >
                          <Pin size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                          deleteConversation(conversation.id);
                          }}
                          className={styles.deleteButton}
                          title="Delete Conversation"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    <div className={styles.conversationMeta}>
                      <Clock size={12} />
                      <span>{conversation.timestamp.toLocaleDateString()}</span>
                      <span className={styles.messageCount}>
                        {conversation.messages.length} messages
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Messages */}
        <div className={styles.messagesContainer}>
          <div className={styles.messages}>
            {messages.map((message, index) => (
              <motion.div
                key={index}
                className={`${styles.message} ${message.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className={styles.messageHeader}>
                  <div className={styles.messageAvatar}>
                    {message.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className={styles.messageMeta}>
                    <span className={styles.messageRole}>
                      {message.role === 'user' ? 'You' : 'AI Assistant'}
                    </span>
                    <span className={styles.messageTime}>
                      {message.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
                <div className={styles.messageContent}>
                  {message.content}
                </div>
              </motion.div>
            ))}
            
            {isTyping && (
              <motion.div
                className={styles.typingIndicator}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div className={styles.typingAvatar}>
                  <Bot size={16} />
                </div>
                <div className={styles.typingContent}>
                  <div className={styles.typingDots}>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </motion.div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className={styles.inputContainer}>
          {/* Quick Actions */}
          <div className={styles.quickActions}>
            {quickActions.slice(0, 4).map((action, index) => (
              <button
                key={index}
                onClick={() => handleSendMessage(action.prompt, 'system')}
                className={styles.quickActionButton}
                title={action.label}
              >
                <div className={styles.quickActionIcon}>
                  {action.icon}
                </div>
                <span>{action.label}</span>
              </button>
            ))}
          </div>
          
          {/* File Upload */}
          <div className={styles.fileUpload}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className={styles.fileInput}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className={styles.uploadButton}
              title="Upload Files"
            >
              <Paperclip size={16} />
            </button>
          </div>
          
          {/* Voice Recording */}
          <button
            onClick={toggleRecording}
            className={`${styles.voiceButton} ${isRecording ? styles.recording : ''}`}
            title={isRecording ? 'Stop Recording' : 'Start Voice Recording'}
          >
            {isRecording ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          
          {/* Message Input */}
          <div className={styles.messageInput}>
            <textarea
              id="chat-input"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(inputMessage);
                }
              }}
              placeholder="Type your message..."
              className={styles.textarea}
              rows={1}
            />
            <button
              onClick={() => handleSendMessage(inputMessage)}
              disabled={!inputMessage.trim() || isStreaming}
              className={styles.sendButton}
              title="Send Message"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Drag and Drop Overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            className={styles.dragOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className={styles.dragContent}>
              <Upload size={48} />
              <h3>Drop files here</h3>
              <p>Analyze your files with AI assistance</p>
              <div className={styles.dragFiles}>
                {draggedFiles.map((file, index) => (
                  <div key={index} className={styles.dragFile}>
                    <FileText size={16} />
                    <span>{file.name}</span>
                    <span>{formatFileSize(file.size)}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversation History Modal */}
      <AnimatePresence>
        {showConversationHistory && (
          <motion.div
            className={styles.historyOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={styles.historyContent}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className={styles.historyHeader}>
                <h3>Conversation History</h3>
                <button
                  onClick={() => setShowConversationHistory(false)}
                  className={styles.closeButton}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className={styles.historyContent}>
                {filteredConversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={styles.historyItem}
                    onClick={() => {
                      setCurrentConversationId(conversation.id);
                      setShowConversationHistory(false);
                    }}
                  >
                    <div className={styles.historyItemHeader}>
                      <div className={styles.historyItemTitle}>
                        {conversation.title}
                      </div>
                      <div className={styles.historyItemMeta}>
                        <span>{conversation.timestamp.toLocaleDateString()}</span>
                        <span>{conversation.messages.length} messages</span>
                        {pinnedConversations.has(conversation.id) && (
                          <Pin size={14} className={styles.pinnedIcon} />
                        )}
                      </div>
                    </div>
                    <div className={styles.historyItemPreview}>
                      {conversation.messages.slice(-2).map((msg, index) => (
                        <div key={index} className={styles.previewMessage}>
                          <span className={styles.previewRole}>
                            {msg.role === 'user' ? 'You:' : 'AI:'}
                          </span>
                          <span className={styles.previewText}>
                            {msg.content.substring(0, 50)}
                            {msg.content.length > 50 && '...'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help Overlay */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            className={styles.helpOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className={styles.helpContent}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className={styles.helpHeader}>
                <h3>AI Assistant Help</h3>
                <button
                  onClick={() => setShowHelp(false)}
                  className={styles.closeButton}
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className={styles.helpSections}>
                <div className="mb-4">
                  <h4>Keyboard Shortcuts</h4>
                  <ul>
                    <li><kbd>Ctrl+K</kbd> - Toggle sidebar</li>
                    <li><kbd>Ctrl+F</kbd> - Fullscreen</li>
                    <li><kbd>Ctrl+/</kbd> - Focus input</li>
                    <li><kbd>Ctrl+N</kbd> - New conversation</li>
                    <li><kbd>Ctrl+H</kbd> - Conversation history</li>
                  </ul>
                </div>
                
                <div className={styles.helpSection}>
                  <h4>Features</h4>
                  <ul>
                    <li><strong>Smart Conversations:</strong> AI learns from your patterns</li>
                    <li><strong>File Analysis:</strong> Drag and drop files for analysis</li>
                    <li><strong>Voice Input:</strong> Use voice commands for hands-free operation</li>
                    <li><strong>Quick Actions:</strong> Pre-defined prompts for common tasks</li>
                    <li><strong>Conversation History:</strong> Save and organize your chats</li>
                  </ul>
                </div>
                
                <div className="mb-4">
                  <h4>Tips</h4>
                  <ul>
                    <li>Use specific questions for better results</li>
                    <li>Upload files for detailed analysis</li>
                    <li>Pin important conversations for easy access</li>
                    <li>Use voice input for hands-free operation</li>
                  </ul>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Operation Progress */}
      <AnimatePresence>
        {operationInProgress && (
          <motion.div
            className={styles.progressOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className={styles.progressContent}>
              <div className={styles.progressHeader}>
                <Loader2 className={styles.progressSpinner} />
                <h3>Processing...</h3>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${operationInProgress.progress}%` }}
                />
              </div>
              <div className={styles.progressText}>
                {operationInProgress.type === 'analysis' && 'Analyzing files...'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
