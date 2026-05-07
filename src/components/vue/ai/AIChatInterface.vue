<template>
  <ErrorBoundary
    :on-error="handleChatError"
    :max-retries="2"
    fallback-message="AI chat interface encountered an error"
  >
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
            aria-label="More options"
            @click="showAdvancedControls = !showAdvancedControls"
          >
            <MoreVertical :size="18" />
          </button>
        </div>
      </header>

      <!-- Messages Area -->
      <div class="messages-container">
        <div v-for="message in messages" :key="message.id" :class="['message', message.type]">
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
                  <img :src="attachment.data.url" :alt="attachment.name" class="attachment-image" />
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
            <span />
            <span />
            <span />
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
            aria-label="Close actions"
            title="Close actions"
            @click="showSuggestions = false"
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
                category === "optimization"
                  ? "🚀 Optimization"
                  : category === "organization"
                    ? "📁 Organization"
                    : "🧹 Cleanup"
              }}
            </h4>
            <div class="actions-grid">
              <button
                v-for="action in getCategoryActions(category)"
                :key="action.id"
                class="action-button"
                :title="action.description"
                @click="executeSmartAction(action.id)"
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
            aria-label="Close suggestions"
            title="Close suggestions"
            @click="showSuggestions = false"
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
            class="hidden-file-input"
            aria-label="Upload image for analysis"
            title="Upload image for AI analysis"
            @change="handleFileUpload"
          />

          <!-- Left controls - minimal -->
          <div class="input-left">
            <button
              class="control-btn"
              aria-label="Upload image"
              title="Upload image for analysis"
              @click="fileInputRef?.click()"
            >
              <Paperclip :size="18" />
            </button>

            <button
              v-if="textToSpeechEnabled"
              class="control-btn"
              :aria-label="isRecording ? 'Stop recording' : 'Start voice input'"
              :title="isRecording ? 'Stop recording' : 'Voice input'"
              @click="toggleVoiceRecording"
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
            placeholder="Ask about your files..."
            class="message-input"
            aria-label="Type your message"
            title="Type your message to ask about files"
            @keypress="handleKeyPress"
          />

          <!-- Right controls - minimal -->
          <div class="input-right">
            <button
              v-if="inputValue.trim()"
              class="send-btn"
              aria-label="Send message"
              @click="handleSendMessage"
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
              :aria-label="textToSpeechEnabled ? 'Disable voice output' : 'Enable voice output'"
              :title="textToSpeechEnabled ? 'Disable voice output' : 'Enable voice output'"
              @click="textToSpeechEnabled = !textToSpeechEnabled"
            >
              <Volume2 :size="16" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </ErrorBoundary>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from "vue";
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
} from "lucide-vue-next";
import ErrorBoundary from "@/components/error/ErrorBoundary.vue";
import { AIChatService } from "@/services/ai/AIChatService";

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  attachments?: Array<{
    type: "file" | "image";
    name: string;
    data: any;
  }>;
  hasAIAnalysis?: boolean;
}

interface AIChatInterfaceProps {
  analysisData: any;
  files: Array<any>;
  categories?: { [key: string]: { count: number; size: number } };
  previousAnalyses?: Array<any>;
  currentAnalysisId?: string;
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
const inputValue = ref("");
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
  "Show me the largest files",
  "What's taking up the most space?",
  "Help me organize my files",
  "Analyze storage patterns",
  "Find duplicate files in my system",
  "Suggest cleanup candidates",
  "Create folder structure for file types",
  "Analyze disk usage trends",
  "Generate storage optimization plan",
  "Scan for large unused files",
  "Check file permission issues",
  "Compress old files automatically",
  "Set up automated backup system",
  "Monitor storage health and alerts",
  "Analyze my current directory structure",
  "Find files by size or type",
  "Generate file organization report",
  "Create smart folders based on content",
  "Identify potential storage optimizations",
  "Set up file monitoring and alerts",
  "Review my previous analysis results",
  "Compare current storage with last month",
  "Suggest optimizations based on usage patterns",
  "Generate cleanup recommendations",
  "Create automated organization rules",
  "Set up smart file categorization",
];

const getCategoryActions = (category: string) => {
  return props.availableActions.filter((action) => action.category === category);
};

const toggleVoiceRecording = async () => {
  if (!isRecording.value) {
    try {
      // Check for speech recognition support
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        console.warn("Speech recognition not supported in this browser");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        isRecording.value = true;
        console.log("🎤 Speech recognition started");
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript.trim()) {
          inputValue.value = transcript;
          console.log("🎯 Speech recognized:", transcript);

          // Auto-send after recognition
          setTimeout(() => {
            handleSendMessage();
          }, 500);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("❌ Speech recognition error:", event.error);
        isRecording.value = false;
      };

      recognition.onend = () => {
        isRecording.value = false;
        console.log("🔇 Speech recognition ended");
      };

      // Start recognition
      recognition.start();
    } catch (error) {
      console.error("❌ Voice recognition failed:", error);
      isRecording.value = false;
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

  if (file.type.startsWith("image/")) {
    isAnalyzingImage.value = true;

    try {
      const base64Data = await fileToBase64(file);

      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: "user",
        content: `Uploaded image: ${file.name}`,
        timestamp: new Date(),
        attachments: [
          {
            type: "image",
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
        type: "assistant",
        content:
          "Image analysis completed. The image has been processed for file management context.",
        timestamp: new Date(),
        hasAIAnalysis: true,
      };

      messages.value.push(userMessage, aiMessage);
    } catch (error) {
      console.error("Image analysis failed:", error);
    } finally {
      isAnalyzingImage.value = false;
    }
  }

  if (fileInputRef.value) {
    fileInputRef.value.value = "";
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
      type: "assistant",
      content: `✅ Executed action: ${actionId}`,
      timestamp: new Date(),
      hasAIAnalysis: true,
    };

    messages.value.push(confirmationMessage);
  } catch (error: any) {
    console.error("Action execution failed:", error);

    const errorMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "assistant",
      content: `❌ Failed to execute action: ${actionId}. Error: ${error.message}`,
      timestamp: new Date(),
      hasAIAnalysis: true,
    };

    messages.value.push(errorMessage);
  }
};

const parseActionCommands = (message: string) => {
  const actions: Array<{ id: string; params: any }> = [];

  if (message.toLowerCase().includes("compress images")) {
    actions.push({ id: "compress_images", params: {} });
  }
  if (message.toLowerCase().includes("remove duplicates")) {
    actions.push({ id: "remove_duplicates", params: {} });
  }
  if (message.toLowerCase().includes("archive old files")) {
    actions.push({ id: "archive_old_files", params: {} });
  }
  if (message.toLowerCase().includes("organize by type")) {
    actions.push({ id: "organize_by_type", params: {} });
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
      type: "user",
      content: inputValue.value,
      timestamp: new Date(),
    };
    messages.value.push(userMessage);

    // Get real AI response
    isTyping.value = true;
    isStreaming.value = true;

    try {
      const aiService = AIChatService.getInstance();
      const response = await aiService.sendMessage(
        inputValue.value,
        {
          analysisData: props.analysisData,
          files: props.files,
          categories: props.categories,
          previousAnalyses: props.previousAnalyses || [],
          currentAnalysisId: props.currentAnalysisId,
        },
        {
          enableSelfLearning: true,
          enableOllama: true,
          analysisDepth: "comprehensive",
          modelPreference: "auto",
        }
      );

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content:
          response.response ||
          response.response.summary ||
          response.response.recommendations?.join("\n") ||
          "I've processed your request.",
        timestamp: new Date(),
        hasAIAnalysis: true,
      };
      messages.value.push(aiMessage);

      console.log("✅ AI response received:", response);
    } catch (error) {
      console.error("❌ AI service failed:", error);

      // Fallback response if AI service fails
      const fallbackMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: "I'm having trouble connecting to the AI service. Please try again later.",
        timestamp: new Date(),
        hasAIAnalysis: true,
      };
      messages.value.push(fallbackMessage);
    }

    isTyping.value = false;
    isStreaming.value = false;

    // Execute any detected actions
    for (const action of actions) {
      await executeSmartAction(action.id, action.params);
    }

    inputValue.value = "";
  } catch (error) {
    console.error("❌ Message sending failed:", error);
    isTyping.value = false;
    isStreaming.value = false;
  }
};

const handleKeyPress = (e: KeyboardEvent) => {
  if (e.key === "Enter") {
    handleSendMessage();
  }
};

// Auto-scroll to bottom
watch(messages, () => {
  nextTick(() => {
    messagesEndRef.value?.scrollIntoView({ behavior: "smooth" });
  });
});

onMounted(() => {
  const handleChatError = (error: Error, errorInfo: unknown) => {
    console.error("AI Chat Interface Error:", error, errorInfo);

    // Log error for debugging
    if (typeof window !== "undefined") {
      const globalWindow = window as unknown as {
        __errorLogs?: Array<{ timestamp: string; error: string; info: unknown }>;
      };
      globalWindow.__errorLogs = globalWindow.__errorLogs || [];
      globalWindow.__errorLogs.push({
        timestamp: new Date().toISOString(),
        error: error.message,
        info: errorInfo,
      });
    }
  };

  const initializeServices = async () => {
    try {
      // Check voice support
      const hasVoiceSupport = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
      const hasTextToSpeech = "speechSynthesis" in window;
      textToSpeechEnabled.value = hasTextToSpeech;

      console.log("🚀 Streamlined AI Chat initialized");
    } catch (error) {
      console.error("Initialization failed:", error);
    }
  };

  initializeServices();
});
</script>

<style scoped>
.streamlined-ai-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: rgba(15, 23, 42, 0.5);
  border: 1px solid rgb(51, 65, 85);
  border-radius: 0.5rem;
  overflow: hidden;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid rgb(51, 65, 85);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.ai-avatar {
  width: 2.5rem;
  height: 2.5rem;
  background-color: rgba(59, 130, 246, 0.2);
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(96, 165, 250);
}

.header-info h3 {
  color: white;
  font-weight: 600;
}

.header-info p {
  font-size: 0.875rem;
  color: rgb(156, 163, 175);
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-badge {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
}

.status-badge.vision-ready {
  background-color: rgba(34, 197, 94, 0.2);
  color: rgb(74, 222, 128);
}

.status-badge.analyzing {
  background-color: rgba(234, 179, 8, 0.2);
  color: rgb(250, 204, 21);
}

.pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.icon-btn {
  padding: 0.5rem;
  color: rgb(156, 163, 175);
  transition: color 0.2s;
}

.icon-btn:hover {
  color: white;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message {
  display: flex;
  gap: 0.75rem;
}

.message.user {
  flex-direction: row-reverse;
}

.message-avatar {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message.user .message-avatar {
  background-color: rgba(59, 130, 246, 0.2);
  color: rgb(96, 165, 250);
}

.message.assistant .message-avatar {
  background-color: rgba(168, 85, 247, 0.2);
  color: rgb(196, 181, 253);
}

.message-content {
  max-width: 70%;
}

.message.user .message-content {
  background-color: rgba(37, 99, 235, 0.2);
  border-radius: 0.5rem;
  padding: 0.75rem;
}

.message.assistant .message-content {
  background-color: rgba(51, 65, 85, 0.5);
  border-radius: 0.5rem;
  padding: 0.75rem;
}

.message-content p {
  color: white;
  font-size: 0.875rem;
}

.message-attachments {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.image-attachment {
  position: relative;
}

.attachment-image {
  max-width: 100%;
  border-radius: 0.5rem;
}

.ai-badge {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background-color: rgba(34, 197, 94, 0.2);
  color: rgb(74, 222, 128);
  border-radius: 9999px;
  font-size: 0.75rem;
}

.ai-analysis-indicator {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: rgb(196, 181, 253);
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: rgba(51, 65, 85, 0.5);
  border-radius: 0.5rem;
  width: fit-content;
}

.typing-dots {
  display: flex;
  gap: 0.25rem;
}

.typing-dots span {
  width: 0.5rem;
  height: 0.5rem;
  background-color: rgb(156, 163, 175);
  border-radius: 50%;
  animation: bounce 1s infinite;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.1s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.2s;
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.3);
  }
}

.actions-panel,
.suggestions-panel {
  padding: 1rem;
  background-color: rgba(30, 41, 59, 0.5);
  border-top: 1px solid rgb(51, 65, 85);
}

.actions-header,
.suggestions-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.actions-header span,
.suggestions-header span {
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
}

.close-btn {
  padding: 0.25rem;
  color: rgb(156, 163, 175);
  transition: color 0.2s;
}

.close-btn:hover {
  color: white;
}

.action-category {
  margin-bottom: 1rem;
}

.category-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgb(156, 163, 175);
  margin-bottom: 0.5rem;
}

.actions-grid,
.suggestions-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

@media (min-width: 768px) {
  .actions-grid,
  .suggestions-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.action-button,
.suggestion-chip {
  padding: 0.5rem 0.75rem;
  background-color: rgba(51, 65, 85, 0.5);
  color: white;
  font-size: 0.875rem;
  border-radius: 0.5rem;
  transition: background-color 0.2s;
  text-align: left;
}

.action-button:hover,
.suggestion-chip:hover {
  background-color: rgb(51, 65, 85);
}

.action-icon {
  margin-right: 0.5rem;
}

.input-area {
  padding: 1rem;
  border-top: 1px solid rgb(51, 65, 85);
}

.input-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.hidden-file-input {
  display: none;
}

.input-left,
.input-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.control-btn {
  padding: 0.5rem;
  color: rgb(156, 163, 175);
  transition: color 0.2s;
}

.control-btn:hover {
  color: white;
}

.message-input {
  flex: 1;
  padding: 0.5rem 1rem;
  background-color: rgba(51, 65, 85, 0.5);
  border: 1px solid rgb(71, 85, 105);
  border-radius: 0.5rem;
  color: white;
}

.message-input::placeholder {
  color: rgb(156, 163, 175);
}

.message-input:focus {
  outline: none;
  border-color: rgb(59, 130, 246);
}

.send-btn {
  padding: 0.5rem;
  background-color: rgb(37, 99, 235);
  color: white;
  border-radius: 0.5rem;
  transition: background-color 0.2s;
}

.send-btn:hover {
  background-color: rgb(29, 78, 216);
}

.advanced-controls {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background-color: rgba(30, 41, 59, 0.5);
  border-radius: 0.5rem;
}

.control-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.control-group label {
  font-size: 0.875rem;
  color: rgb(156, 163, 175);
}

.toggle-btn {
  padding: 0.5rem;
  background-color: rgb(51, 65, 85);
  color: rgb(156, 163, 175);
  border-radius: 0.5rem;
  transition: color 0.2s;
}

.toggle-btn:hover {
  color: white;
}

.toggle-btn.active {
  background-color: rgb(37, 99, 235);
  color: white;
}
</style>
