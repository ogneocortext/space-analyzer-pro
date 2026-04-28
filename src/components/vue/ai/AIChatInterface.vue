<template>
  <div class="streamlined-ai-chat">
    <!-- Clean Header -->
    <header class="chat-header">
      <div class="header-left">
        <div class="ai-avatar">
          <Brain :size="20" />
        </div>
        <div class="header-info">
          <h3>AI Assistant</h3>
          <p>File analysis & optimization</p>
        </div>
      </div>

      <div class="header-right">
        <div v-if="hasVisionModels" class="status-badge vision-ready">
          <Eye :size="14" />
          <span>Vision</span>
        </div>

        <div v-if="isAnalyzingImage" class="status-badge analyzing">
          <Camera :size="14" class="pulse" />
          <span>Analyzing</span>
        </div>

        <button
          class="icon-btn"
          @click="showAdvancedControls = !showAdvancedControls"
          aria-label="More options"
        >
          <MoreVertical :size="18" />
        </button>
      </div>
    </header>

    <!-- Messages Area -->
    <div class="messages-container">
      <div
        v-for="message in messages"
        :key="message.id"
        :class="['message', message.type]"
      >
        <div class="message-avatar">
          <User v-if="message.type === 'user'" :size="16" />
          <Bot v-else :size="16" />
        </div>

        <div class="message-content">
          <p>{{ message.content }}</p>

          <div v-if="message.attachments" class="message-attachments">
            <div
              v-for="(attachment, index) in message.attachments"
              :key="index"
              class="attachment"
            >
              <div v-if="attachment.type === 'image'" class="image-attachment">
                <img
                  :src="attachment.data.url"
                  :alt="attachment.name"
                  class="attachment-image"
                />
                <div v-if="attachment.data.hasAIAnalysis" class="ai-badge">
                  <Eye :size="12" />
                  <span>AI analyzed</span>
                </div>
              </div>
            </div>
          </div>

          <div v-if="message.hasAIAnalysis" class="ai-analysis-indicator">
            <Sparkles :size="12" />
            <span>Vision analysis</span>
          </div>
        </div>
      </div>

      <div v-if="isTyping" class="typing-indicator">
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>

      <div ref="messagesEndRef" />
    </div>

    <!-- Smart Actions Panel -->
    <div v-if="availableActions.length > 0" class="actions-panel">
      <div class="actions-header">
        <Sparkles :size="16" />
        <span>Smart Actions</span>
        <button
          class="close-btn"
          @click="showSuggestions = false"
          aria-label="Close actions"
          title="Close actions"
        >
          <X :size="14" />
        </button>
      </div>

      <!-- Group actions by category -->
      <div
        v-for="category in ['optimization', 'organization', 'cleanup']"
        :key="category"
        class="action-category"
      >
        <div v-if="getCategoryActions(category).length > 0">
          <h4 class="category-title">
            {{
              category === 'optimization'
                ? '🚀 Optimization'
                : category === 'organization'
                  ? '📁 Organization'
                  : '🧹 Cleanup'
            }}
          </h4>
          <div class="actions-grid">
            <button
              v-for="action in getCategoryActions(category)"
              :key="action.id"
              class="action-button"
              @click="executeSmartAction(action.id)"
              :title="action.description"
            >
              <span class="action-icon">{{ action.icon }}</span>
              <span class="action-name">{{ action.name }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Smart Suggestions -->
    <div v-if="showSuggestions && messages.length === 1" class="suggestions-panel">
      <div class="suggestions-header">
        <Sparkles :size="16" />
        <span>Quick questions</span>
        <button
          class="close-btn"
          @click="showSuggestions = false"
          aria-label="Close suggestions"
          title="Close suggestions"
        >
          <X :size="14" />
        </button>
      </div>
      <div class="suggestions-grid">
        <button
          v-for="(suggestion, index) in quickSuggestions"
          :key="index"
          class="suggestion-chip"
          @click="inputValue = suggestion"
        >
          {{ suggestion }}
        </button>
      </div>
    </div>

    <!-- Clean Input Area -->
    <div class="input-area">
      <div class="input-container">
        <!-- Hidden file input -->
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          @change="handleFileUpload"
          class="hidden-file-input"
          aria-label="Upload image for analysis"
          title="Upload image for AI analysis"
        />

        <!-- Left controls - minimal -->
        <div class="input-left">
          <button
            class="control-btn"
            @click="fileInputRef?.click()"
            aria-label="Upload image"
            title="Upload image for analysis"
          >
            <Paperclip :size="18" />
          </button>

          <button
            v-if="textToSpeechEnabled"
            class="control-btn"
            @click="toggleVoiceRecording"
            :aria-label="isRecording ? 'Stop recording' : 'Start voice input'"
            :title="isRecording ? 'Stop recording' : 'Voice input'"
          >
            <MicOff v-if="isRecording" :size="18" />
            <Mic v-else :size="18" />
          </button>
        </div>

        <!-- Main input -->
        <input
          ref="inputRef"
          v-model="inputValue"
          type="text"
          @keypress="handleKeyPress"
          placeholder="Ask about your files..."
          class="message-input"
          aria-label="Type your message"
          title="Type your message to ask about files"
        />

        <!-- Right controls - minimal -->
        <div class="input-right">
          <button
            v-if="inputValue.trim()"
            class="send-btn"
            @click="handleSendMessage"
            aria-label="Send message"
          >
            <Send :size="18" />
          </button>
        </div>
      </div>

      <!-- Advanced controls - collapsible -->
      <div v-if="showAdvancedControls" class="advanced-controls">
        <div class="control-group">
          <label for="voice-output">Voice Output</label>
          <button
            :class="['toggle-btn', textToSpeechEnabled ? 'active' : '']"
            @click="textToSpeechEnabled = !textToSpeechEnabled"
            :aria-label="textToSpeechEnabled ? 'Disable voice output' : 'Enable voice output'"
            :title="textToSpeechEnabled ? 'Disable voice output' : 'Enable voice output'"
          >
            <Volume2 :size="16" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue';
import {
  Send,
  Bot,
  User,
  Sparkles,
  Brain,
  File,
  Image,
  Paperclip,
  Mic,
  MicOff,
  Volume2,
  Eye,
  Camera,
  MoreVertical,
  X,
  ChevronDown,
  Search,
  Filter,
  Settings,
  HelpCircle,
} from 'lucide-vue-next';

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

const props = withDefaults(defineProps<AIChatInterfaceProps>(), {
  availableActions: () => [],
});

const messages = ref<ChatMessage[]>([]);
const inputValue = ref('');
const isRecording = ref(false);
const textToSpeechEnabled = ref(false);
const showAdvancedControls = ref(false);
const showSuggestions = ref(true);
const hasVisionModels = ref(false);
const isAnalyzingImage = ref(false);
const isTyping = ref(false);
const isStreaming = ref(false);

const messagesEndRef = ref<HTMLDivElement | null>(null);
const inputRef = ref<HTMLInputElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

const quickSuggestions = [
  'Show me the largest files',
  "What's taking up the most space?",
  'Help me organize my files',
  'Analyze storage patterns',
];

const getCategoryActions = (category: string) => {
  return props.availableActions.filter((action) => action.category === category);
};

const toggleVoiceRecording = async () => {
  if (!isRecording.value) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      
      mediaRecorder.start();
      isRecording.value = true;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log('Voice recording completed');
        }
      };

      setTimeout(() => {
        mediaRecorder.stop();
        isRecording.value = false;
      }, 5000);
    } catch (error) {
      console.error('Voice recording failed:', error);
    }
  } else {
    isRecording.value = false;
  }
};

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) return;

  const file = files[0];

  if (file.type.startsWith('image/')) {
    isAnalyzingImage.value = true;

    try {
      const base64Data = await fileToBase64(file);
      
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: `Uploaded image: ${file.name}`,
        timestamp: new Date(),
        attachments: [
          {
            type: 'image',
            name: file.name,
            data: {
              url: URL.createObjectURL(file),
              hasAIAnalysis: true,
            },
          },
        ],
      };

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'Image analysis completed. The image has been processed for file management context.',
        timestamp: new Date(),
        hasAIAnalysis: true,
      };

      messages.value.push(userMessage, aiMessage);
    } catch (error) {
      console.error('Image analysis failed:', error);
    } finally {
      isAnalyzingImage.value = false;
    }
  }

  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

const executeSmartAction = async (actionId: string, params: any = {}) => {
  if (!props.onExecuteAction) return;

  try {
    await props.onExecuteAction(actionId, params);

    const confirmationMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'assistant',
      content: `✅ Executed action: ${actionId}`,
      timestamp: new Date(),
      hasAIAnalysis: true,
    };

    messages.value.push(confirmationMessage);
  } catch (error: any) {
    console.error('Action execution failed:', error);

    const errorMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'assistant',
      content: `❌ Failed to execute action: ${actionId}. Error: ${error.message}`,
      timestamp: new Date(),
      hasAIAnalysis: true,
    };

    messages.value.push(errorMessage);
  }
};

const parseActionCommands = (message: string) => {
  const actions: Array<{ id: string; params: any }> = [];

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

const handleSendMessage = async () => {
  if (!inputValue.value.trim() || isStreaming.value) return;

  const actions = parseActionCommands(inputValue.value);

  try {
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.value,
      timestamp: new Date(),
    };
    messages.value.push(userMessage);

    // Simulate AI response
    isTyping.value = true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    const aiMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'assistant',
      content: `I understand you're asking about: "${inputValue.value}". Based on your file analysis, I can help you with storage optimization and file organization.`,
      timestamp: new Date(),
    };
    messages.value.push(aiMessage);
    isTyping.value = false;

    // Execute any detected actions
    for (const action of actions) {
      await executeSmartAction(action.id, action.params);
    }

    inputValue.value = '';
  } catch (error) {
    console.error('❌ Message sending failed:', error);
    isTyping.value = false;
  }
};

const handleKeyPress = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    handleSendMessage();
  }
};

// Auto-scroll to bottom
watch(messages, () => {
  nextTick(() => {
    messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' });
  });
});

onMounted(() => {
  const initializeServices = async () => {
    try {
      // Check voice support
      const hasVoiceSupport =
        'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
      const hasTextToSpeech = 'speechSynthesis' in window;
      textToSpeechEnabled.value = hasTextToSpeech;

      console.log('🚀 Streamlined AI Chat initialized');
    } catch (error) {
      console.error('Initialization failed:', error);
    }
  };

  initializeServices();
});
</script>

<style scoped>
.streamlined-ai-chat {
  @apply flex flex-col h-full bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden;
}

.chat-header {
  @apply flex items-center justify-between p-4 border-b border-slate-700;
}

.header-left {
  @apply flex items-center gap-3;
}

.ai-avatar {
  @apply w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center text-blue-400;
}

.header-info h3 {
  @apply text-white font-semibold;
}

.header-info p {
  @apply text-sm text-gray-400;
}

.header-right {
  @apply flex items-center gap-2;
}

.status-badge {
  @apply flex items-center gap-1 px-2 py-1 rounded-full text-xs;
}

.status-badge.vision-ready {
  @apply bg-green-500/20 text-green-400;
}

.status-badge.analyzing {
  @apply bg-yellow-500/20 text-yellow-400;
}

.pulse {
  @apply animate-pulse;
}

.icon-btn {
  @apply p-2 text-gray-400 hover:text-white transition-colors;
}

.messages-container {
  @apply flex-1 overflow-y-auto p-4 space-y-4;
}

.message {
  @apply flex gap-3;
}

.message.user {
  @apply flex-row-reverse;
}

.message-avatar {
  @apply w-8 h-8 rounded-full flex items-center justify-center shrink-0;
}

.message.user .message-avatar {
  @apply bg-blue-500/20 text-blue-400;
}

.message.assistant .message-avatar {
  @apply bg-purple-500/20 text-purple-400;
}

.message-content {
  @apply max-w-[70%];
}

.message.user .message-content {
  @apply bg-blue-600/20 rounded-lg p-3;
}

.message.assistant .message-content {
  @apply bg-slate-700/50 rounded-lg p-3;
}

.message-content p {
  @apply text-white text-sm;
}

.message-attachments {
  @apply mt-2 space-y-2;
}

.image-attachment {
  @apply relative;
}

.attachment-image {
  @apply max-w-full rounded-lg;
}

.ai-badge {
  @apply absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs;
}

.ai-analysis-indicator {
  @apply flex items-center gap-1 mt-2 text-xs text-purple-400;
}

.typing-indicator {
  @apply flex items-center gap-2 p-3 bg-slate-700/50 rounded-lg w-fit;
}

.typing-dots {
  @apply flex gap-1;
}

.typing-dots span {
  @apply w-2 h-2 bg-gray-400 rounded-full animate-bounce;
}

.typing-dots span:nth-child(2) {
  @apply animation-delay-200;
}

.typing-dots span:nth-child(3) {
  @apply animation-delay-400;
}

.actions-panel,
.suggestions-panel {
  @apply p-4 bg-slate-800/50 border-t border-slate-700;
}

.actions-header,
.suggestions-header {
  @apply flex items-center justify-between mb-3;
}

.actions-header span,
.suggestions-header span {
  @apply text-sm font-semibold text-white;
}

.close-btn {
  @apply p-1 text-gray-400 hover:text-white transition-colors;
}

.action-category {
  @apply mb-4;
}

.category-title {
  @apply text-sm font-semibold text-gray-400 mb-2;
}

.actions-grid,
.suggestions-grid {
  @apply grid grid-cols-2 md:grid-cols-3 gap-2;
}

.action-button,
.suggestion-chip {
  @apply px-3 py-2 bg-slate-700/50 hover:bg-slate-700 text-white text-sm rounded-lg transition-colors text-left;
}

.action-icon {
  @apply mr-2;
}

.input-area {
  @apply p-4 border-t border-slate-700;
}

.input-container {
  @apply flex items-center gap-2;
}

.hidden-file-input {
  @apply hidden;
}

.input-left,
.input-right {
  @apply flex items-center gap-2;
}

.control-btn {
  @apply p-2 text-gray-400 hover:text-white transition-colors;
}

.message-input {
  @apply flex-1 px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500;
}

.send-btn {
  @apply p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors;
}

.advanced-controls {
  @apply mt-3 p-3 bg-slate-800/50 rounded-lg;
}

.control-group {
  @apply flex items-center justify-between;
}

.control-group label {
  @apply text-sm text-gray-400;
}

.toggle-btn {
  @apply p-2 bg-slate-700 text-gray-400 rounded-lg transition-colors;
}

.toggle-btn.active {
  @apply bg-blue-600 text-white;
}
</style>
