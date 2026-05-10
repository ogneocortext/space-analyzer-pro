<!--
  Enhanced AI Chat - Refactored Version
  Now uses smaller, focused components for better maintainability
-->
<template>
  <div class="enhanced-ai-chat">
    <!-- Chat Header -->
    <ChatHeader
      :current-model="currentModel"
      :show-settings="showSettings"
      :service-status="serviceStatus"
      @toggle-settings="toggleSettings"
    />

    <!-- Chat Messages -->
    <ChatMessages
      :messages="messages"
      :is-typing="isTyping"
      @copy-message="copyMessage"
      @retry-message="retryMessage"
      @delete-message="deleteMessage"
    />

    <!-- AI Suggestions -->
    <ChatSuggestions
      :suggestions="suggestions"
      :is-loading="suggestionsLoading"
      @select-suggestion="handleSuggestionSelect"
      @refresh-suggestions="refreshSuggestions"
    />

    <!-- Chat Input -->
    <ChatInput
      :input-message="inputMessage"
      :is-streaming="isStreaming"
      :show-settings="showSettings"
      :current-model="currentModel"
      :analysis-depth="analysisDepth"
      :service-status="serviceStatus"
      @send-message="sendMessage"
      @update:inputMessage="inputMessage = $event"
      @update:model="updateModel"
      @update:analysisDepth="updateAnalysisDepth"
      @check-service-status="checkServiceStatus"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import ChatHeader from './ChatHeader.vue';
import ChatMessages from './ChatMessages.vue';
import ChatInput from './ChatInput.vue';
import ChatSuggestions from './ChatSuggestions.vue';
import { useAIChat } from '../../../composables/useAIChat';
import { useAISuggestions } from '../../../composables/useAISuggestions';
import { useDebugLogger } from '../../../utils/DebugUtils';
import type { AISuggestion } from '../../../composables/useAISuggestions';

interface Props {
  analysisData?: any;
  onAnalysisComplete?: (insights: string) => void;
}

const props = defineProps<Props>();

const logger = useDebugLogger('EnhancedAIChat-Refactored');

// Use composables for state management
const chat = useAIChat({
  analysisData: props.analysisData,
  onAnalysisComplete: props.onAnalysisComplete,
  autoSave: true,
  maxMessages: 100,
});

const suggestions = useAISuggestions({
  analysisData: props.analysisData,
  maxSuggestions: 8,
  enableProactiveSuggestions: true,
});

// Extract reactive state from composables
const {
  messages,
  isStreaming,
  isTyping,
  currentModel,
  analysisDepth,
  showSettings,
  inputMessage,
  serviceStatus,
  sendMessage: sendChatMessage,
  deleteMessage: deleteChatMessage,
  updateModel: updateChatModel,
  updateAnalysisDepth: updateChatAnalysisDepth,
  toggleSettings: toggleChatSettings,
  checkServiceStatus: checkChatServiceStatus,
} = chat;

const {
  suggestions: aiSuggestions,
  isLoading: suggestionsLoading,
  refreshSuggestions: refreshAISuggestions,
} = suggestions;

// Methods
const sendMessage = () => {
  sendChatMessage();
};

const deleteMessage = (messageId: string) => {
  deleteChatMessage(messageId);
  logger.info('Message deleted', { messageId });
};

const retryMessage = async (messageId: string) => {
  // Find the user message that triggered this AI response
  const messageIndex = messages.value.findIndex(msg => msg.id === messageId);
  if (messageIndex > 0) {
    const userMessage = messages.value[messageIndex - 1];
    if (userMessage.type === 'user') {
      // Remove the current AI response
      deleteChatMessage(messageId);
      // Resend the user message
      await sendChatMessage(userMessage.content);
    }
  }
};

const copyMessage = async (content: string) => {
  try {
    await navigator.clipboard.writeText(content);
    logger.info('Message copied to clipboard');
  } catch (error) {
    logger.error('Failed to copy message', error);
  }
};

const updateModel = (model: string) => {
  updateChatModel(model);
  logger.info('Model updated', { model });
};

const updateAnalysisDepth = (depth: 'quick' | 'standard' | 'comprehensive') => {
  updateChatAnalysisDepth(depth);
  logger.info('Analysis depth updated', { depth });
};

const toggleSettings = () => {
  toggleChatSettings();
};

const checkServiceStatus = () => {
  checkChatServiceStatus();
};

const handleSuggestionSelect = (suggestion: AISuggestion) => {
  // Send the suggestion prompt as a message
  inputMessage.value = suggestion.prompt;
  logger.info('Suggestion selected', { suggestionId: suggestion.id, type: suggestion.type });
  
  // Auto-send the message after a short delay
  setTimeout(() => {
    sendMessage();
  }, 100);
};

const refreshSuggestions = () => {
  refreshAISuggestions();
  logger.info('Suggestions refreshed');
};

// Keyboard shortcuts
const handleKeyboardShortcuts = (event: KeyboardEvent) => {
  // Ctrl/Cmd + K to focus input
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault();
    // Focus the input textarea
    const textarea = document.querySelector('.message-input') as HTMLTextAreaElement;
    if (textarea) {
      textarea.focus();
    }
  }
  
  // Escape to close settings
  if (event.key === 'Escape' && showSettings.value) {
    toggleSettings();
  }
  
  // Ctrl/Cmd + / to clear chat
  if ((event.ctrlKey || event.metaKey) && event.key === '/') {
    event.preventDefault();
    if (confirm('Are you sure you want to clear all messages?')) {
      chat.clearMessages();
      logger.info('Chat cleared by keyboard shortcut');
    }
  }
};

// Lifecycle
onMounted(() => {
  logger.info('Enhanced AI Chat mounted', {
    hasAnalysisData: !!props.analysisData,
    messageCount: messages.value.length,
    suggestionsCount: aiSuggestions.length,
  });
  
  // Add keyboard event listeners
  document.addEventListener('keydown', handleKeyboardShortcuts);
  
  // Check service status
  checkServiceStatus();
});

onUnmounted(() => {
  logger.info('Enhanced AI Chat unmounted');
  
  // Remove keyboard event listeners
  document.removeEventListener('keydown', handleKeyboardShortcuts);
});

// Watch for analysis data changes
watch(() => props.analysisData, (newData) => {
  if (newData) {
    logger.info('Analysis data updated', {
      totalSize: newData.totalSize,
      fileCount: newData.files?.length,
    });
    
    // Refresh suggestions with new data
    refreshSuggestions();
  }
}, { deep: true });

// Expose methods for parent components if needed
defineExpose({
  sendMessage,
  clearMessages: chat.clearMessages,
  checkServiceStatus,
  refreshSuggestions,
  getMessages: () => messages.value,
  getSuggestions: () => aiSuggestions.value,
});
</script>

<style scoped>
.enhanced-ai-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0f172a;
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
}

/* Responsive design */
@media (max-width: 768px) {
  .enhanced-ai-chat {
    border-radius: 0;
    height: 100vh;
  }
}

/* Dark theme support */
@media (prefers-color-scheme: dark) {
  .enhanced-ai-chat {
    background: #0f172a;
  }
}

/* Animation for component transitions */
.enhanced-ai-chat > * {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Custom scrollbar for chat */
.enhanced-ai-chat ::-webkit-scrollbar {
  width: 6px;
}

.enhanced-ai-chat ::-webkit-scrollbar-track {
  background: #1e293b;
}

.enhanced-ai-chat ::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 3px;
}

.enhanced-ai-chat ::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
</style>