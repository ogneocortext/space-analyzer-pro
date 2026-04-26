import React, { useState, useRef, useEffect, FC } from 'react';
import type { ChangeEvent } from 'react';
import {
  Send, Bot, User, Sparkles, Brain, File, Image, Paperclip,
  Mic, MicOff, Volume2, Eye, Camera, MoreVertical, X, ChevronDown,
  Search, Filter, Settings, HelpCircle
} from 'lucide-react';
// @ts-ignore - RealMLService module
import { realMLService } from '../services/RealMLService';
// @ts-ignore - OllamaService module
import { ollamaService, VisionAnalysisResult } from '../services/OllamaService';
// @ts-ignore - AIContext module
import { useStreamingChat } from '../hooks/useStreamingChat';
import { useAIContext, useAnalysisData } from '../contexts/AIContext';
import './AIChatInterface.css';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  attachments?: Array<{
    type: 'file' | 'image';
    name: string;
    data: any;
  }>;
  hasAIAnalysis?: boolean;
}

interface AIChatInterfaceProps {
  analysisData: any;
  files: Array<any>;
  categories?: { [key: string]: { count: number; size: number } };
  onExecuteAction?: (action: string, params: any) => Promise<void>;
  availableActions?: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    category: string;
  }>;
}

export const AIChatInterface: FC<AIChatInterfaceProps> = (props) => {
  const { analysisData, files, categories, onExecuteAction, availableActions = [] } = props;

  // Use the enhanced streaming chat hook
  const {
    messages,
    sendMessage,
    isStreaming,
    isTyping,
    clearMessages,
    aiStatus
    // @ts-ignore - setMessages from hook
  } = useStreamingChat() as any;

  // @ts-ignore - setMessages from hook
  const setMessages = (useStreamingChat() as any).setMessages || (() => {});

  // Get analysis data from context
  const contextAnalysisData = useAnalysisData();
  
  const [inputValue, setInputValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [textToSpeechEnabled, setTextToSpeechEnabled] = useState(false);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  // @ts-ignore - hasVisionModels state
  const [hasVisionModels, setHasVisionModels] = useState(false);
  // @ts-ignore - isAnalyzingImage state
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize services
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // @ts-ignore - realMLService scope
        await realMLService.initialize();
        // @ts-ignore - ollamaService scope
        await ollamaService.fetchModels();
        // @ts-ignore - ollamaService scope
        setHasVisionModels(ollamaService.hasVisionModels());
        
        // Check voice support
        const hasVoiceSupport = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
        const hasTextToSpeech = 'speechSynthesis' in window;
        setTextToSpeechEnabled(hasTextToSpeech);
        
        console.log('🚀 Streamlined AI Chat initialized');
      } catch (error) {
        console.error('Initialization failed:', error);
      }
    };
    
    initializeServices();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Simplified voice recording
  const toggleVoiceRecording = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        
        mediaRecorder.start();
        setIsRecording(true);
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            // Handle voice recording
            console.log('Voice recording completed');
          }
        };
        
        setTimeout(() => {
          mediaRecorder.stop();
          setIsRecording(false);
        }, 5000);
        
      } catch (error) {
        console.error('Voice recording failed:', error);
      }
    } else {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    }
  };

  // Simplified file upload
  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    
    if (file.type.startsWith('image/')) {
      setIsAnalyzingImage(true);
      
      try {
        // @ts-ignore - ollamaService scope
        const base64Data = await ollamaService.fileToBase64(file);
        // @ts-ignore - ollamaService scope
        const analysis = await ollamaService.analyzeImage(
          base64Data,
          'Analyze this image in the context of file management and storage optimization.'
        );
        
        const userMessage: ChatMessage = {
          id: Date.now().toString(),
          type: 'user',
          content: `Uploaded image: ${file.name}`,
          timestamp: new Date(),
          attachments: [{
            type: 'image',
            name: file.name,
            data: {
              url: URL.createObjectURL(file),
              analysis,
              hasAIAnalysis: true
            }
          }]
        };
        
        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: analysis.description,
          timestamp: new Date(),
          hasAIAnalysis: true
        };
        
        setMessages(prev => [...prev, userMessage, aiMessage]);
        
      } catch (error) {
        console.error('Image analysis failed:', error);
      } finally {
        setIsAnalyzingImage(false);
      }
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Enhanced smart suggestions with actions
  const quickSuggestions = [
    "Show me the largest files",
    "What's taking up the most space?",
    "Help me organize my files",
    "Analyze storage patterns"
  ];

  // Smart action execution
  const executeSmartAction = async (actionId: string, params: any = {}) => {
    if (!onExecuteAction) return;
    
    try {
      await onExecuteAction(actionId, params);
      
      // Add confirmation message
      const confirmationMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `✅ Executed action: ${actionId}`,
        timestamp: new Date(),
        hasAIAnalysis: true
      };
      
      setMessages(prev => [...prev, confirmationMessage]);
      
    } catch (error) {
      console.error('Action execution failed:', error);
      
      // Add error message
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: `❌ Failed to execute action: ${actionId}. Error: ${error.message}`,
        timestamp: new Date(),
        hasAIAnalysis: true
      };
      
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // Parse action commands from messages
  const parseActionCommands = (message: string) => {
    const actions = [];
    
    // Check for action patterns
    if (message.toLowerCase().includes('compress images')) {
      actions.push({ id: 'compress_images', params: {} });
    }
    if (message.toLowerCase().includes('remove duplicates')) {
      actions.push({ id: 'remove_duplicates', params: {} });
    }
    if (message.toLowerCase().includes('archive old files')) {
      actions.push({ id: 'archive_old_files', params: {} });
    }
    if (message.toLowerCase().includes('organize by type')) {
      actions.push({ id: 'organize_by_type', params: {} });
    }
    
    return actions;
  };

  // Enhanced message sending with action detection
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isStreaming) return;

    const actions = parseActionCommands(inputValue);
    
    try {
      // Send message through unified AI workflow with context
      // @ts-ignore - files and categories from props
      await sendMessage(inputValue, {
        // @ts-ignore - analysisData from props
        analysisData: contextAnalysisData || analysisData,
        // @ts-ignore - files from props
        files: files,
        // @ts-ignore - categories from props
        categories: categories,
        // @ts-ignore - availableActions from props
        availableActions: availableActions
      }, {
        enableSelfLearning: true,
        enableOllama: true,
        analysisDepth: 'comprehensive',
        modelPreference: 'auto'
      });

      // Execute any detected actions
      for (const action of actions) {
        await executeSmartAction(action.id, action.params);
      }

      setInputValue('');
    } catch (error) {
      console.error('❌ Message sending failed:', error);
    }
  };

  return (
    <div className="streamlined-ai-chat">
      {/* Clean Header */}
      <header className="chat-header">
        <div className="header-left">
          <div className="ai-avatar">
            <Brain size={20} />
          </div>
          <div className="header-info">
            <h3>AI Assistant</h3>
            <p>File analysis & optimization</p>
          </div>
        </div>
        
        <div className="header-right">
          {hasVisionModels && (
            <div className="status-badge vision-ready">
              <Eye size={14} />
              <span>Vision</span>
            </div>
          )}
          
          {isAnalyzingImage && (
            <div className="status-badge analyzing">
              <Camera size={14} className="pulse" />
              <span>Analyzing</span>
            </div>
          )}
          
          <button 
            className="icon-btn"
            onClick={() => setShowAdvancedControls(!showAdvancedControls)}
            aria-label="More options"
          >
            <MoreVertical size={18} />
          </button>
        </div>
      </header>

      {/* Messages Area */}
      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.type}`}>
            <div className="message-avatar">
              {message.type === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            
            <div className="message-content">
              <p>{message.content}</p>
              
              {message.attachments && (
                <div className="message-attachments">
                  {message.attachments.map((attachment, index) => (
                    <div key={index} className="attachment">
                      {attachment.type === 'image' && (
                        <div className="image-attachment">
                          <img 
                            src={attachment.data.url} 
                            alt={attachment.name}
                            className="attachment-image"
                          />
                          {attachment.data.hasAIAnalysis && (
                            <div className="ai-badge">
                              <Eye size={12} />
                              <span>AI analyzed</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {message.hasAIAnalysis && (
                <div className="ai-analysis-indicator">
                  <Sparkles size={12} />
                  <span>Vision analysis</span>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Smart Actions Panel */}
      {availableActions.length > 0 && (
        <div className="actions-panel">
          <div className="actions-header">
            <Sparkles size={16} />
            <span>Smart Actions</span>
            <button 
              className="close-btn"
              onClick={() => setShowSuggestions(false)}
              aria-label="Close actions"
              title="Close actions"
            >
              <X size={14} />
            </button>
          </div>
          
          {/* Group actions by category */}
          {['optimization', 'organization', 'cleanup'].map(category => {
            const categoryActions = availableActions.filter(action => action.category === category);
            if (categoryActions.length === 0) return null;
            
            return (
              <div key={category} className="action-category">
                <h4 className="category-title">
                  {category === 'optimization' ? '🚀 Optimization' : 
                   category === 'organization' ? '📁 Organization' : '🧹 Cleanup'}
                </h4>
                <div className="actions-grid">
                  {categoryActions.map((action) => (
                    <button
                      key={action.id}
                      className="action-button"
                      onClick={() => executeSmartAction(action.id)}
                      title={action.description}
                    >
                      <span className="action-icon">{action.icon}</span>
                      <span className="action-name">{action.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Smart Suggestions */}
      {showSuggestions && messages.length === 1 && (
        <div className="suggestions-panel">
          <div className="suggestions-header">
            <Sparkles size={16} />
            <span>Quick questions</span>
            <button 
              className="close-btn"
              onClick={() => setShowSuggestions(false)}
              aria-label="Close suggestions"
              title="Close suggestions"
            >
              <X size={14} />
            </button>
          </div>
          <div className="suggestions-grid">
            {quickSuggestions.map((suggestion, index) => (
              <button
                key={index}
                className="suggestion-chip"
                onClick={() => setInputValue(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Clean Input Area */}
      <div className="input-area">
        <div className="input-container">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden-file-input"
            aria-label="Upload image for analysis"
            title="Upload image for AI analysis"
          />
          
          {/* Left controls - minimal */}
          <div className="input-left">
            <button
              className="control-btn"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload image"
              title="Upload image for analysis"
            >
              <Paperclip size={18} />
            </button>
            
            {textToSpeechEnabled && (
              <button
                className="control-btn"
                onClick={toggleVoiceRecording}
                aria-label={isRecording ? "Stop recording" : "Start voice input"}
                title={isRecording ? "Stop recording" : "Voice input"}
              >
                {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
          </div>
          
          {/* Main input */}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask about your files..."
            className="message-input"
            aria-label="Type your message"
            title="Type your message to ask about files"
          />
          
          {/* Right controls - minimal */}
          <div className="input-right">
            {inputValue.trim() && (
              <button
                className="send-btn"
                onClick={handleSendMessage}
                aria-label="Send message"
              >
                <Send size={18} />
              </button>
            )}
          </div>
        </div>
        
        {/* Advanced controls - collapsible */}
        {showAdvancedControls && (
          <div className="advanced-controls">
            <div className="control-group">
              <label htmlFor="voice-output">Voice Output</label>
              <button
                className={`toggle-btn ${textToSpeechEnabled ? 'active' : ''}`}
                onClick={() => setTextToSpeechEnabled(!textToSpeechEnabled)}
                aria-label={textToSpeechEnabled ? "Disable voice output" : "Enable voice output"}
                title={textToSpeechEnabled ? "Disable voice output" : "Enable voice output"}
              >
                <Volume2 size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
