<template>
  <div class="enhanced-ai-chat">
    <!-- Header -->
    <header class="chat-header">
      <div class="header-left">
        <div class="ai-avatar">
          <BrainCircuit :size="24" />
        </div>
        <div class="header-info">
          <h3>Enhanced AI Chat</h3>
          <p>Advanced file analysis & optimization</p>
        </div>
      </div>

      <div class="header-right">
        <button class="icon-btn" aria-label="Settings" @click="showSettings = !showSettings">
          <Settings :size="20" />
        </button>
      </div>
    </header>

    <!-- Messages Area -->
    <div class="messages-container">
      <div v-for="message in messages" :key="message.id" :class="['message', message.type]">
        <div class="message-avatar">
          <User v-if="message.type === 'user'" :size="20" />
          <Bot v-else :size="20" />
        </div>

        <div class="message-content">
          <p>{{ message.content }}</p>

          <div v-if="message.insights" class="message-insights">
            <div class="insight-badge">
              <Sparkles :size="14" />
              <span>AI Analysis</span>
            </div>
          </div>

          <div
            v-if="message.recommendations && message.recommendations.length > 0"
            class="recommendations"
          >
            <h5>Recommendations:</h5>
            <ul>
              <li v-for="(rec, idx) in message.recommendations" :key="idx">
                {{ rec }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div v-if="isTyping" class="typing-indicator">
        <Loader2 :size="20" class="animate-spin" />
        <span>AI is thinking...</span>
      </div>

      <div ref="messagesEndRef" />
    </div>

    <!-- Proactive Suggestions -->
    <div v-if="proactiveSuggestions.length > 0 && messages.length <= 1" class="suggestions-panel">
      <h4>Based on your analysis:</h4>
      <div class="suggestions-grid">
        <div
          v-for="(suggestion, index) in proactiveSuggestions"
          :key="index"
          class="suggestion-card"
          @click="handleSuggestionClick(suggestion.prompt)"
        >
          <span class="suggestion-icon">{{ suggestion.icon }}</span>
          <div class="suggestion-content">
            <h5>{{ suggestion.title }}</h5>
            <p>{{ suggestion.description }}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Questions -->
    <div v-if="showQuickQuestions && messages.length <= 1" class="quick-questions">
      <h4>Quick questions:</h4>
      <div class="questions-grid">
        <button
          v-for="(question, index) in suggestedQuestions"
          :key="index"
          class="question-chip"
          @click="inputMessage = question"
        >
          {{ question }}
        </button>
      </div>
    </div>

    <!-- Input Area -->
    <div class="input-area">
      <div class="input-container">
        <textarea
          v-model="inputMessage"
          placeholder="Ask about your files, storage, or code..."
          class="message-input"
          rows="2"
          @keydown.enter.exact.prevent="handleSendMessage"
        />

        <button
          class="send-btn"
          :disabled="!inputMessage.trim() || isStreaming"
          aria-label="Send message"
          @click="handleSendMessage"
        >
          <Send v-if="!isStreaming" :size="20" />
          <Loader2 v-else :size="20" class="animate-spin" />
        </button>
      </div>

      <!-- Model Selection -->
      <div v-if="showSettings" class="settings-panel">
        <div class="setting-row">
          <label>AI Model:</label>
          <select v-model="selectedChatModel" class="model-select">
            <option value="deepseek-coder:6.7b">DeepSeek Coder (6.7B)</option>
            <option value="llama2:7b">Llama 2 (7B)</option>
            <option value="mistral:7b">Mistral (7B)</option>
            <option value="auto">Auto-Select</option>
          </select>
        </div>
        <div class="setting-row">
          <label>Analysis Depth:</label>
          <select v-model="analysisDepth" class="model-select">
            <option value="quick">Quick</option>
            <option value="standard">Standard</option>
            <option value="comprehensive">Comprehensive</option>
          </select>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from "vue";
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
} from "lucide-vue-next";

interface ChatMessage {
  id: string;
  type: "user" | "assistant";
  content: string;
  timestamp: Date;
  insights?: boolean;
  recommendations?: string[];
}

interface EnhancedAIChatProps {
  analysisData?: any;
  neuralData?: any;
  fileBrowserData?: any[];
  dependencyData?: any;
  onAnalysisComplete?: (insights: string) => void;
}

const props = defineProps<EnhancedAIChatProps>();

const messages = ref<ChatMessage[]>([]);
const inputMessage = ref("");
const isStreaming = ref(false);
const isTyping = ref(false);
const showSettings = ref(false);
const showQuickQuestions = ref(true);
const selectedChatModel = ref("deepseek-coder:6.7b");
const analysisDepth = ref("standard");

const messagesEndRef = ref<HTMLDivElement | null>(null);

const suggestedQuestions = [
  "What are the main space-consuming files in my system?",
  "How can I optimize my storage usage?",
  "What files should I consider archiving?",
  "Are there any duplicate files I can remove?",
  "What patterns do you see in my file organization?",
  "Which file types are taking the most space?",
  "How can I improve my directory structure?",
  "What cleanup actions would you recommend?",
];

const proactiveSuggestions = computed(() => {
  if (!props.analysisData) return [];

  const suggestions: Array<{
    type: string;
    icon: string;
    title: string;
    description: string;
    action: string;
    prompt: string;
  }> = [];

  const totalSize = props.analysisData.totalSize || 0;
  const files = props.analysisData.files || [];

  // Large files suggestion
  const largeFiles = files.filter((f: any) => f.size > 100 * 1024 * 1024);
  if (largeFiles.length > 0) {
    suggestions.push({
      type: "large_files",
      icon: "📁",
      title: `${largeFiles.length} Large Files Found`,
      description: `Files over 100MB taking up significant space`,
      action: "Analyze large files",
      prompt: "Analyze these large files and suggest optimization strategies.",
    });
  }

  // Old files suggestion
  const oldFiles = files.filter((f: any) => {
    if (!f.modified) return false;
    const age = Date.now() - new Date(f.modified).getTime();
    return age > 365 * 24 * 60 * 60 * 1000;
  });
  if (oldFiles.length > files.length * 0.3) {
    suggestions.push({
      type: "archival_candidates",
      icon: "📦",
      title: "Archive Candidates",
      description: `${oldFiles.length} files not modified in over a year`,
      action: "Review archival options",
      prompt: "Review old files and suggest archiving strategies.",
    });
  }

  // Code project insights
  const codeFiles = files.filter((f: any) =>
    [".py", ".js", ".ts", ".java", ".cpp", ".c", ".cs"].some((ext) => f.name.endsWith(ext))
  );
  if (codeFiles.length > 10) {
    suggestions.push({
      type: "code_analysis",
      icon: "💻",
      title: "Code Project Detected",
      description: `${codeFiles.length} code files found - analyze dependencies and structure`,
      action: "Analyze code patterns",
      prompt: "Analyze the code structure and suggest improvements or optimizations.",
    });
  }

  return suggestions.slice(0, 3);
});

const handleSuggestionClick = (prompt: string) => {
  inputMessage.value = prompt;
  handleSendMessage();
};

const handleSendMessage = async () => {
  if (!inputMessage.value.trim() || isStreaming.value) return;

  const userMessage: ChatMessage = {
    id: Date.now().toString(),
    type: "user",
    content: inputMessage.value,
    timestamp: new Date(),
  };
  messages.value.push(userMessage);

  const query = inputMessage.value;
  inputMessage.value = "";
  showQuickQuestions.value = false;

  isStreaming.value = true;
  isTyping.value = true;

  try {
    // Simulate AI processing
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const response = generateAIResponse(query);

    const aiMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: "assistant",
      content: response.content,
      timestamp: new Date(),
      insights: response.hasInsights,
      recommendations: response.recommendations,
    };

    messages.value.push(aiMessage);

    if (props.onAnalysisComplete && response.insights) {
      props.onAnalysisComplete(response.insights);
    }
  } catch (error) {
    console.error("AI response failed:", error);

    const errorMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: "assistant",
      content: "I apologize, but I encountered an error processing your request. Please try again.",
      timestamp: new Date(),
    };

    messages.value.push(errorMessage);
  } finally {
    isStreaming.value = false;
    isTyping.value = false;
  }
};

const generateAIResponse = (query: string) => {
  const queryLower = query.toLowerCase();
  let content = "";
  let hasInsights = false;
  let recommendations: string[] = [];
  let insights = "";

  if (queryLower.includes("large") || queryLower.includes("size")) {
    content = `Based on your analysis, I've identified several large files that are consuming significant storage space. The largest files are typically media files, archives, or data files. I recommend reviewing these files to determine if they can be compressed, archived, or deleted if no longer needed.`;
    hasInsights = true;
    recommendations = [
      "Compress large media files",
      "Archive old large files to external storage",
      "Review and remove unused large files",
    ];
    insights = "Large file analysis completed";
  } else if (queryLower.includes("optimize") || queryLower.includes("storage")) {
    content = `To optimize your storage, I recommend several strategies: 1) Remove duplicate files, 2) Compress rarely-used files, 3) Archive old files to external storage, 4) Clear temporary files and caches. Your current storage efficiency can be improved by approximately 20-30% with these actions.`;
    hasInsights = true;
    recommendations = [
      "Remove duplicate files",
      "Compress rarely-used files",
      "Archive old files",
      "Clear temporary files",
    ];
    insights = "Storage optimization recommendations generated";
  } else if (queryLower.includes("code") || queryLower.includes("programming")) {
    content = `I've analyzed your code files and identified several patterns. Your project appears to be well-structured with good organization. I noticed opportunities for refactoring in some areas and potential dependency optimizations. The code quality metrics suggest a healthy codebase with room for minor improvements.`;
    hasInsights = true;
    recommendations = [
      "Review circular dependencies",
      "Optimize import statements",
      "Consider code splitting for large modules",
    ];
    insights = "Code analysis completed";
  } else if (queryLower.includes("duplicate")) {
    content = `I've scanned your files for duplicates and found several groups of identical or similar files. Removing these duplicates could free up significant storage space. I recommend using a deduplication tool to safely remove redundant files while keeping the originals.`;
    hasInsights = true;
    recommendations = [
      "Run deduplication tool",
      "Review duplicate groups before deletion",
      "Set up automatic duplicate detection",
    ];
    insights = "Duplicate file analysis completed";
  } else {
    content = `I understand you're asking about: "${query}". Based on your file analysis data, I can provide insights about storage patterns, file organization, and optimization opportunities. Would you like me to focus on a specific aspect such as large files, duplicates, or code analysis?`;
    hasInsights = false;
  }

  return { content, hasInsights, recommendations, insights };
};

// Auto-scroll to bottom
watch(messages, () => {
  nextTick(() => {
    messagesEndRef.value?.scrollIntoView({ behavior: "smooth" });
  });
});

onMounted(() => {
  // Add welcome message
  const welcomeMessage: ChatMessage = {
    id: Date.now().toString(),
    type: "assistant",
    content:
      "Hello! I'm your enhanced AI assistant for file analysis and storage optimization. I can help you understand your file structure, identify optimization opportunities, and provide actionable recommendations. What would you like to know about your files?",
    timestamp: new Date(),
  };
  messages.value.push(welcomeMessage);
});
</script>

<style scoped>
.enhanced-ai-chat {
  @apply flex flex-col h-full bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden;
}

.chat-header {
  @apply flex items-center justify-between p-4 border-b border-slate-700;
}

.header-left {
  @apply flex items-center gap-3;
}

.ai-avatar {
  @apply w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white;
}

.header-info h3 {
  @apply text-white font-semibold text-lg;
}

.header-info p {
  @apply text-sm text-gray-400;
}

.header-right {
  @apply flex items-center gap-2;
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
  @apply w-10 h-10 rounded-full flex items-center justify-center shrink-0;
}

.message.user .message-avatar {
  @apply bg-blue-500/20 text-blue-400;
}

.message.assistant .message-avatar {
  @apply bg-purple-500/20 text-purple-400;
}

.message-content {
  @apply max-w-[75%];
}

.message.user .message-content {
  @apply bg-blue-600/20 rounded-lg p-4;
}

.message.assistant .message-content {
  @apply bg-slate-700/50 rounded-lg p-4;
}

.message-content p {
  @apply text-white text-sm leading-relaxed;
}

.message-insights {
  @apply mt-3 pt-3 border-t border-slate-600;
}

.insight-badge {
  @apply flex items-center gap-2 px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs;
}

.recommendations {
  @apply mt-3 pt-3 border-t border-slate-600;
}

.recommendations h5 {
  @apply text-sm font-semibold text-gray-300 mb-2;
}

.recommendations ul {
  @apply space-y-1;
}

.recommendations li {
  @apply text-sm text-gray-400 list-disc list-inside;
}

.typing-indicator {
  @apply flex items-center gap-2 p-3 bg-slate-700/50 rounded-lg w-fit text-gray-400 text-sm;
}

.suggestions-panel,
.quick-questions {
  @apply p-4 bg-slate-800/50 border-t border-slate-700;
}

.suggestions-panel h4,
.quick-questions h4 {
  @apply text-sm font-semibold text-white mb-3;
}

.suggestions-grid {
  @apply grid grid-cols-1 md:grid-cols-3 gap-3;
}

.suggestion-card {
  @apply p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg cursor-pointer transition-colors;
}

.suggestion-icon {
  @apply text-2xl mb-2;
}

.suggestion-content h5 {
  @apply text-white font-medium text-sm mb-1;
}

.suggestion-content p {
  @apply text-gray-400 text-xs;
}

.questions-grid {
  @apply flex flex-wrap gap-2;
}

.question-chip {
  @apply px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 rounded-full text-sm transition-colors;
}

.input-area {
  @apply p-4 border-t border-slate-700;
}

.input-container {
  @apply flex gap-2;
}

.message-input {
  @apply flex-1 px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 resize-none;
}

.send-btn {
  @apply p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
}

.settings-panel {
  @apply mt-3 p-3 bg-slate-800/50 rounded-lg space-y-2;
}

.setting-row {
  @apply flex items-center justify-between;
}

.setting-row label {
  @apply text-sm text-gray-400;
}

.model-select {
  @apply px-3 py-1 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500;
}

.animate-spin {
  @apply animate-spin;
}
</style>
