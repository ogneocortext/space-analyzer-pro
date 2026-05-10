/**
 * AI Chat Composable - Manages chat state and message handling
 * Extracted from EnhancedAIChat.vue for better state management
 */

import { ref, computed, watch, nextTick } from 'vue';
import { aiChatService, type ChatMessage, type AIChatOptions, type AnalysisData } from '../services/AIChatService';
import { useDebugLogger } from '../utils/DebugUtils';
import { useDataPersistence } from '../utils/DataPersistence';

const logger = useDebugLogger('useAIChat');
const dataPersistence = useDataPersistence();

export interface UseAIChatOptions {
  analysisData?: AnalysisData;
  onAnalysisComplete?: (insights: string) => void;
  autoSave?: boolean;
  maxMessages?: number;
}

export interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  isTyping: boolean;
  currentModel: string;
  analysisDepth: 'quick' | 'standard' | 'comprehensive';
  showSettings: boolean;
  inputMessage: string;
  serviceStatus: {
    available: boolean;
    models: any[];
    responseTime?: number;
  };
}

/**
 * AI Chat Composable
 */
export function useAIChat(options: UseAIChatOptions = {}) {
  // State
  const messages = ref<ChatMessage[]>([]);
  const isStreaming = ref(false);
  const isTyping = ref(false);
  const currentModel = ref('auto');
  const analysisDepth = ref<'quick' | 'standard' | 'comprehensive'>('standard');
  const showSettings = ref(false);
  const inputMessage = ref('');
  const serviceStatus = ref({
    available: false,
    models: [],
    responseTime: undefined as number | undefined,
  });

  // Configuration
  const maxMessages = options.maxMessages || 100;
  const autoSave = options.autoSave !== false;

  // Computed properties
  const lastMessage = computed(() => messages.value[messages.value.length - 1] || null);
  const messageCount = computed(() => messages.value.length);
  const hasMessages = computed(() => messages.value.length > 0);
  const canSendMessage = computed(() => 
    inputMessage.value.trim().length > 0 && !isStreaming.value
  );
  const availableModels = computed(() => serviceStatus.value.models);

  // Actions
  const addMessage = (message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const newMessage: ChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    
    messages.value.push(newMessage);
    
    // Limit message count
    if (messages.value.length > maxMessages) {
      messages.value = messages.value.slice(-maxMessages);
    }
    
    // Auto-save if enabled
    if (autoSave) {
      saveChatHistory();
    }
    
    logger.debug('Message added', { type: message.type, contentLength: message.content.length });
  };

  const sendMessage = async (content?: string) => {
    const messageContent = content || inputMessage.value.trim();
    if (!messageContent || isStreaming.value) return;

    // Add user message
    addMessage({
      type: 'user',
      content: messageContent,
    });

    // Clear input
    inputMessage.value = '';
    
    // Start streaming
    isStreaming.value = true;
    isTyping.value = true;

    try {
      logger.info('Sending message to AI', { content: messageContent.substring(0, 100) });

      // Process with AI service
      const response = await aiChatService.processQuery(messageContent, options.analysisData, {
        model: currentModel.value,
        analysisDepth: analysisDepth.value,
        temperature: 0.7,
        maxTokens: 2048,
        includeContext: true,
      });

      // Add AI response
      addMessage({
        type: 'assistant',
        content: response.content,
        insights: response.insights,
        recommendations: response.recommendations,
        analysis: response.analysis,
      });

      // Call completion callback if provided
      if (options.onAnalysisComplete && response.insights) {
        options.onAnalysisComplete(response.insights);
      }

      logger.info('AI response received', { 
        model: response.model, 
        processingTime: response.processingTime,
        hasInsights: !!response.insights,
        hasRecommendations: !!response.recommendations?.length,
      });

    } catch (error) {
      logger.error('Failed to send message', error);

      // Add error message
      addMessage({
        type: 'assistant',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
      });

    } finally {
      isStreaming.value = false;
      isTyping.value = false;
      
      // Scroll to bottom
      await nextTick();
      scrollToBottom();
    }
  };

  const clearMessages = () => {
    messages.value = [];
    logger.info('Chat messages cleared');
    
    if (autoSave) {
      saveChatHistory();
    }
  };

  const deleteMessage = (messageId: string) => {
    const index = messages.value.findIndex(msg => msg.id === messageId);
    if (index !== -1) {
      messages.value.splice(index, 1);
      logger.debug('Message deleted', { messageId });
      
      if (autoSave) {
        saveChatHistory();
      }
    }
  };

  const updateModel = (modelId: string) => {
    currentModel.value = modelId;
    logger.info('Model updated', { model: modelId });
    
    if (autoSave) {
      saveChatSettings();
    }
  };

  const updateAnalysisDepth = (depth: 'quick' | 'standard' | 'comprehensive') => {
    analysisDepth.value = depth;
    logger.info('Analysis depth updated', { depth });
    
    if (autoSave) {
      saveChatSettings();
    }
  };

  const toggleSettings = () => {
    showSettings.value = !showSettings.value;
  };

  const retryLastMessage = async () => {
    const lastUserMessage = messages.value
      .slice()
      .reverse()
      .find(msg => msg.type === 'user');
    
    if (lastUserMessage) {
      // Remove the last AI response if it exists
      const lastAIMessage = messages.value[messages.value.length - 1];
      if (lastAIMessage?.type === 'assistant') {
        deleteMessage(lastAIMessage.id);
      }
      
      // Resend the user message
      await sendMessage(lastUserMessage.content);
    }
  };

  // Persistence
  const saveChatHistory = () => {
    try {
      dataPersistence.save('ai-chat-history', {
        messages: messages.value,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('Failed to save chat history', error);
    }
  };

  const loadChatHistory = () => {
    try {
      const saved = dataPersistence.load('ai-chat-history');
      if (saved?.messages && Array.isArray(saved.messages)) {
        messages.value = saved.messages;
        logger.info('Chat history loaded', { messageCount: messages.value.length });
      }
    } catch (error) {
      logger.error('Failed to load chat history', error);
    }
  };

  const saveChatSettings = () => {
    try {
      dataPersistence.save('ai-chat-settings', {
        model: currentModel.value,
        analysisDepth: analysisDepth.value,
        showSettings: showSettings.value,
      });
    } catch (error) {
      logger.error('Failed to save chat settings', error);
    }
  };

  const loadChatSettings = () => {
    try {
      const saved = dataPersistence.load('ai-chat-settings');
      if (saved) {
        currentModel.value = saved.model || 'auto';
        analysisDepth.value = saved.analysisDepth || 'standard';
        showSettings.value = saved.showSettings || false;
        logger.info('Chat settings loaded', saved);
      }
    } catch (error) {
      logger.error('Failed to load chat settings', error);
    }
  };

  // Service status
  const checkServiceStatus = async () => {
    try {
      const status = await aiChatService.getStatus();
      serviceStatus.value = status;
      logger.info('Service status checked', status);
    } catch (error) {
      logger.error('Failed to check service status', error);
      serviceStatus.value = {
        available: false,
        models: [],
      };
    }
  };

  // Utility functions
  const scrollToBottom = () => {
    // This will be implemented by the component using this composable
    // The component should call this method and scroll to the bottom
  };

  const formatMessageTime = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getMessageIcon = (type: 'user' | 'assistant') => {
    return type === 'user' ? 'User' : 'Bot';
  };

  const isMessageFromToday = (timestamp: Date) => {
    const today = new Date();
    return timestamp.toDateString() === today.toDateString();
  };

  // Initialize
  const initialize = async () => {
    logger.info('Initializing AI chat composable');
    
    // Load saved data
    loadChatHistory();
    loadChatSettings();
    
    // Check service status
    await checkServiceStatus();
    
    logger.info('AI chat composable initialized', {
      messageCount: messages.value.length,
      model: currentModel.value,
      serviceAvailable: serviceStatus.value.available,
    });
  };

  // Watchers
  watch(messages, () => {
    if (autoSave) {
      saveChatHistory();
    }
  }, { deep: true });

  watch([currentModel, analysisDepth, showSettings], () => {
    if (autoSave) {
      saveChatSettings();
    }
  });

  // Auto-initialize
  initialize();

  // Return reactive state and methods
  return {
    // State
    messages,
    isStreaming,
    isTyping,
    currentModel,
    analysisDepth,
    showSettings,
    inputMessage,
    serviceStatus,
    
    // Computed
    lastMessage,
    messageCount,
    hasMessages,
    canSendMessage,
    availableModels,
    
    // Methods
    addMessage,
    sendMessage,
    clearMessages,
    deleteMessage,
    updateModel,
    updateAnalysisDepth,
    toggleSettings,
    retryLastMessage,
    checkServiceStatus,
    
    // Utilities
    formatMessageTime,
    getMessageIcon,
    isMessageFromToday,
    scrollToBottom,
    
    // Persistence
    saveChatHistory,
    loadChatHistory,
    saveChatSettings,
    loadChatSettings,
  };
}