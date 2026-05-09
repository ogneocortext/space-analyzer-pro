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
            <div
              v-if="message.type === 'assistant'"
              class="formatted-message"
              v-html="formatMessage(message.content)"
            />
            <p v-else class="user-message">
              {{ message.content }}
            </p>

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
      <div v-if="showSuggestions && messages.length <= 1" class="suggestions-panel">
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
            @click="handleQuickSuggestion(suggestion)"
          >
            {{ suggestion }}
          </button>
        </div>
      </div>

      <!-- Scanner Control Panel -->
      <div class="scanner-control-panel">
        <div class="scanner-header">
          <div class="scanner-title">
            <Brain :size="20" />
            <span>Scanner Control</span>
          </div>
          <div class="scanner-status" :class="getScannerStatusClass()">
            <div class="status-indicator" />
            <span>{{ getScannerStatusText() }}</span>
          </div>
        </div>

        <div class="scanner-options">
          <div class="scanner-modes">
            <button
              :class="['scanner-btn', { active: currentScannerMode === 'auto' }]"
              title="Automatically choose the best scanner"
              @click="setScannerMode('auto')"
            >
              <Sparkles :size="16" />
              <span>Smart Auto</span>
            </button>
            <button
              :class="[
                'scanner-btn',
                { active: currentScannerMode === 'tauri', disabled: !isTauriAvailable },
              ]"
              :disabled="!isTauriAvailable"
              title="Use native Rust scanner (Tauri required)"
              @click="setScannerMode('tauri')"
            >
              <HardDrive :size="16" />
              <span>Native Scanner</span>
            </button>
            <button
              :class="['scanner-btn', { active: currentScannerMode === 'web' }]"
              title="Use browser-based scanner"
              @click="setScannerMode('web')"
            >
              <Search :size="16" />
              <span>Web Scanner</span>
            </button>
          </div>
        </div>

        <div class="quick-actions">
          <button
            class="action-btn primary"
            title="Start a new scan with current settings"
            @click="executeQuickScan"
          >
            <Send :size="16" />
            <span>Quick Scan</span>
          </button>
          <button
            class="action-btn secondary"
            title="Show detailed scanner information"
            @click="showScannerInfo"
          >
            <Eye :size="16" />
            <span>Details</span>
          </button>
        </div>
      </div>

      <!-- Tools Toggle Button -->
      <div class="tools-toggle">
        <button
          class="tools-toggle-btn"
          :class="{ active: showTools }"
          @click="showTools = !showTools"
        >
          <Bot :size="16" />
          <span>Tools</span>
        </button>
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
  Paperclip,
  Mic,
  MicOff,
  Volume2,
  Eye,
  Camera,
  MoreVertical,
  X,
  Search,
  FileText,
  Download,
  GitCompare,
  Copy,
  Archive,
  HardDrive,
} from "lucide-vue-next";
import ErrorBoundary from "@/components/error/ErrorBoundary.vue";
import { AIChatService } from "@/services/ai/AIChatService";
import { AIBackendService } from "@/services/ai/AIBackendService";
import { ActionExecutor } from "@/services/ai/ActionExecutor";

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
  analysisData: null,
  files: () => [],
  categories: () => ({}),
  previousAnalyses: () => [],
  currentAnalysisId: "",
  onExecuteAction: () => Promise.resolve(),
  availableActions: () => [],
});

const messages = ref<ChatMessage[]>([]);
const inputValue = ref("");
const isRecording = ref(false);
const textToSpeechEnabled = ref(false);
const showAdvancedControls = ref(false);
const showSuggestions = ref(true);
const showTools = ref(false);

const hasVisionModels = ref(false);
const isAnalyzingImage = ref(false);
const isTyping = ref(false);
const isStreaming = ref(false);

const localAnalysisData = ref(null);
const localFiles = ref([]);
const localCategories = ref({});
const localPreviousAnalyses = ref([]);

const currentScannerMode = ref<"auto" | "tauri" | "web">("auto");
const isTauriAvailable = ref(false);

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
];

const availableTools = [
  {
    id: "scan",
    name: "Run Scan",
    description: "Scan directory for file analysis",
    icon: "Search",
    command: "run new scan",
  },
  {
    id: "report",
    name: "Generate Report",
    description: "Create detailed analysis report",
    icon: "FileText",
    command: "generate detailed report",
  },
  {
    id: "compare",
    name: "Compare Scans",
    description: "Compare with previous analyses",
    icon: "GitCompare",
    command: "compare scans",
  },
  {
    id: "export",
    name: "Export Data",
    description: "Export analysis in various formats",
    icon: "Download",
    command: "export data",
  },
  {
    id: "largest",
    name: "Largest Files",
    description: "Show the largest files",
    icon: "File",
    command: "show me the largest files",
  },
  {
    id: "compress",
    name: "Compress Images",
    description: "Compress large image files",
    icon: "File",
    command: "compress images",
  },
  {
    id: "duplicates",
    name: "Remove Duplicates",
    description: "Find and remove duplicate files",
    icon: "Copy",
    command: "remove duplicates",
  },
  {
    id: "archive",
    name: "Archive Old Files",
    description: "Archive old or unused files",
    icon: "Archive",
    command: "archive old files",
  },
  {
    id: "storage",
    name: "Storage Usage",
    description: "View storage usage summary",
    icon: "HardDrive",
    command: "show me storage usage",
  },
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
      await fileToBase64(file);

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

const formatMessage = (content: string): string => {
  if (!content) return "";

  // Convert markdown-like formatting to HTML
  let formatted = content
    // Convert **bold** to <strong>
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Convert *italic* to <em>
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    // Convert line breaks to paragraphs
    .replace(/\n\n/g, "</p><p>")
    // Convert single line breaks to <br>
    .replace(/\n/g, "<br>")
    // Convert bullet points (lines starting with - or *)
    .replace(/^[\s]*[-*]\s+(.+)$/gm, "<li>$1</li>")
    // Convert numbered lists (lines starting with 1., 2., etc.)
    .replace(/^[\s]*\d+\.\s+(.+)$/gm, "<li>$1</li>")
    // Wrap lists in <ul> or <ol> tags
    .replace(/(<li>.*?<\/li>)/s, "<ul>$1</ul>")
    // Convert code blocks with ```
    .replace(/```(.*?)```/gs, "<pre><code>$1</code></pre>")
    // Convert inline code with `
    .replace(/`(.*?)`/g, "<code>$1</code>")
    // Convert headers (# ## ###)
    .replace(/^###\s+(.+)$/gm, "<h3>$1</h3>")
    .replace(/^##\s+(.+)$/gm, "<h2>$1</h2>")
    .replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  // Wrap in paragraph tags if not already wrapped
  if (!formatted.startsWith("<")) {
    formatted = `<p>${formatted}</p>`;
  }

  return formatted;
};

const handleQuickSuggestion = (suggestion: string) => {
  // Set the input value and immediately send the message
  inputValue.value = suggestion;
  // Use nextTick to ensure the input value is set before sending
  nextTick(() => {
    handleSendMessage();
  });
  // Hide suggestions after clicking one
  showSuggestions.value = false;
};

const handleToolClick = (tool: any) => {
  // Hide tools panel after selection
  showTools.value = false;

  // Execute the tool command
  inputValue.value = tool.command;
  nextTick(() => {
    handleSendMessage();
  });
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

const formatBytes = (bytes: number): string => {
  if (bytes === 0 || !bytes || isNaN(bytes) || bytes < 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const startScanProgress = (directory: string) => {
  let progressStage = 0;
  let progressMessageId: string | null = null;
  const scanStages = [
    { stage: "Initializing scan...", progress: 5, duration: 1000 },
    { stage: "Discovering directories...", progress: 15, duration: 2000 },
    { stage: "Scanning file system...", progress: 30, duration: 3000 },
    { stage: "Analyzing file sizes...", progress: 50, duration: 2000 },
    { stage: "Categorizing files...", progress: 70, duration: 2000 },
    { stage: "Detecting duplicates...", progress: 85, duration: 1500 },
    { stage: "Finalizing analysis...", progress: 95, duration: 1000 },
    { stage: "Generating report...", progress: 99, duration: 500 },
  ];

  const updateProgress = () => {
    if (progressStage < scanStages.length) {
      const currentStage = scanStages[progressStage];

      // Create progress bar
      const progressBar =
        "█".repeat(Math.floor(currentStage.progress / 5)) +
        "░".repeat(20 - Math.floor(currentStage.progress / 5));

      let progressContent = `## 🔍 Scan Progress\n\n`;
      progressContent += `**Target:** ${directory}\n\n`;
      progressContent += `**Progress:** ${currentStage.progress}%\n`;
      progressContent += `${progressBar}\n\n`;
      progressContent += `**Current Stage:** ${currentStage.stage}\n\n`;

      // Add contextual information based on stage
      if (progressStage === 2) {
        progressContent += `📁 Found initial directory structure...\n`;
      } else if (progressStage === 3) {
        progressContent += `📊 Processing file metadata...\n`;
      } else if (progressStage === 4) {
        progressContent += `🏷️ Organizing files by type...\n`;
      } else if (progressStage === 5) {
        progressContent += `🔍 Identifying duplicate content...\n`;
      }

      if (progressMessageId === null) {
        // Create initial progress message
        const progressMessage: ChatMessage = {
          id: Date.now().toString(),
          type: "assistant",
          content: progressContent,
          timestamp: new Date(),
          hasAIAnalysis: true,
        };
        messages.value.push(progressMessage);
        progressMessageId = progressMessage.id;
      } else {
        // Update existing progress message
        const messageIndex = messages.value.findIndex((msg) => msg.id === progressMessageId);
        if (messageIndex !== -1) {
          messages.value[messageIndex].content = progressContent;
          messages.value[messageIndex].timestamp = new Date();
        }
      }

      progressStage++;

      // Schedule next update
      if (progressStage < scanStages.length) {
        setTimeout(updateProgress, currentStage.duration);
      } else {
        // Final completion message - update the same message
        setTimeout(() => {
          const completionContent =
            `## ✅ Scan Complete!\n\n**Target:** ${directory}\n\n**Progress:** 100%\n` +
            `████████████████████\n\n` +
            `**Scan Results:**\n` +
            `- 📊 Analysis complete\n` +
            `- 📁 Files categorized\n` +
            `- 🔍 Duplicates identified\n` +
            `- 📈 Report generated\n\n` +
            `**Ready for analysis!** You can now ask me to:\n` +
            `- Show you the largest files\n` +
            `- Generate a detailed report\n` +
            `- Compare with previous scans\n` +
            `- Export the data`;

          const messageIndex = messages.value.findIndex((msg) => msg.id === progressMessageId);
          if (messageIndex !== -1) {
            messages.value[messageIndex].content = completionContent;
            messages.value[messageIndex].timestamp = new Date();
          }
        }, currentStage.duration);
      }
    }
  };

  // Start progress updates
  setTimeout(updateProgress, 500);
};

const handleDirectCommand = (message: string): string | null => {
  const lowerMessage = message.toLowerCase().trim();

  // Handle "show me the largest files" command
  if (
    lowerMessage.includes("largest files") ||
    lowerMessage.includes("show largest") ||
    lowerMessage.includes("biggest files")
  ) {
    // Use local data store first, then fallback to props
    const files = localFiles.value.length > 0 ? localFiles.value : props.files;

    if (!files || files.length === 0) {
      return "I don't have access to file data. Please run a scan first to see the largest files.";
    }

    // Sort files by size and get top 10
    const sortedFiles = files
      .map((file: any) => ({
        name: file.name || file.path || "Unknown",
        size: file.size?.bytes || file.size || 0,
        path: file.path || file.name || "",
        category: file.category || "Unknown",
      }))
      .sort((a: any, b: any) => b.size - a.size)
      .slice(0, 10);

    if (sortedFiles.length === 0) {
      return "No file data available to display.";
    }

    // Format the response
    let response = `## 📊 Top ${sortedFiles.length} Largest Files\n\n`;

    sortedFiles.forEach((file: any, index: number) => {
      const sizeFormatted = formatBytes(file.size);
      const fileName = file.name.length > 50 ? file.name.substring(0, 47) + "..." : file.name;
      response += `**${index + 1}.** ${fileName}\n`;
      response += `- **Size:** ${sizeFormatted}\n`;
      response += `- **Path:** ${file.path}\n`;
      response += `- **Category:** ${file.category}\n\n`;
    });

    const totalSize = sortedFiles.reduce((sum: number, file: any) => sum + file.size, 0);
    const totalFormatted = formatBytes(totalSize);
    response += `**Total size of top files:** ${totalFormatted}\n\n`;
    response += `Would you like me to help you analyze these files further or suggest optimization strategies?`;

    return response;
  }

  // Handle "show me storage usage" command
  if (
    lowerMessage.includes("storage usage") ||
    lowerMessage.includes("disk usage") ||
    lowerMessage.includes("how much space")
  ) {
    // Use local data store first, then fallback to props
    const analysisData = localAnalysisData.value || props.analysisData;
    const files = localFiles.value.length > 0 ? localFiles.value : props.files;

    if (!analysisData) {
      return "No analysis data available. Please run a scan first.";
    }

    const totalSize = analysisData.totalSize || 0;
    const totalFormatted = formatBytes(totalSize);
    const fileCount = files?.length || 0;

    let response = `## 💾 Storage Usage Summary\n\n`;
    response += `- **Total Size:** ${totalFormatted}\n`;
    response += `- **Total Files:** ${fileCount.toLocaleString()}\n`;

    // Use local categories first, then fallback to props
    const categories = localCategories.value || props.categories;
    response += `- **Categories:** ${Object.keys(categories || {}).length}\n\n`;

    if (categories && Object.keys(categories).length > 0) {
      response += `### 📂 Category Breakdown\n\n`;
      const sortedCategories = Object.entries(categories)
        .sort(([, a]: any, [, b]: any) => (b as any).size - (a as any).size)
        .slice(0, 5);

      sortedCategories.forEach(([name, data]: [string, any]) => {
        const size = formatBytes(data.size || 0);
        const percentage = totalSize > 0 ? ((data.size / totalSize) * 100).toFixed(1) : "0";
        response += `- **${name}:** ${size} (${percentage}%)\n`;
      });
    }

    return response;
  }

  // Handle scanner configuration commands
  if (lowerMessage.includes("use tauri scanner") || lowerMessage.includes("use native scanner")) {
    const actionExecutor = ActionExecutor.getInstance();
    actionExecutor.setScannerConfig({ type: "tauri" });
    return "🔧 Scanner configuration updated. Now using Tauri native Rust scanner. Run a scan to use the native scanner.";
  }

  if (lowerMessage.includes("use web scanner") || lowerMessage.includes("use browser scanner")) {
    const actionExecutor = ActionExecutor.getInstance();
    actionExecutor.setScannerConfig({ type: "web" });
    return "🔧 Scanner configuration updated. Now using web browser scanner. Run a scan to use the web scanner.";
  }

  if (lowerMessage.includes("auto scanner") || lowerMessage.includes("automatic scanner")) {
    const actionExecutor = ActionExecutor.getInstance();
    actionExecutor.setScannerConfig({ type: "auto" });
    return "🔧 Scanner configuration updated. Now using automatic scanner selection (will prefer native scanner when available).";
  }

  if (lowerMessage.includes("scanner status") || lowerMessage.includes("current scanner")) {
    const actionExecutor = ActionExecutor.getInstance();
    const config = actionExecutor.getScannerConfig();
    const isTauriAvailable = !!(window as any).__TAURI__;

    let response = `## 🔍 Scanner Status\n\n`;
    response += `**Current Configuration:** ${config.type}\n`;
    response += `**Prefer Native:** ${config.preferNative ? "Yes" : "No"}\n`;
    response += `**Fallback to Web:** ${config.fallbackToWeb ? "Yes" : "No"}\n`;
    response += `**Tauri Available:** ${isTauriAvailable ? "Yes" : "No"}\n\n`;

    const effectiveType =
      config.type === "auto"
        ? config.preferNative && isTauriAvailable
          ? "Tauri"
          : "Web"
        : config.type;

    response += `**Effective Scanner:** ${effectiveType}\n\n`;

    response += `**Available Commands:**\n`;
    response += `- "use tauri scanner" - Force native Rust scanner\n`;
    response += `- "use web scanner" - Force browser scanner\n`;
    response += `- "auto scanner" - Automatic selection\n`;
    response += `- "run tauri scan" - Run with native scanner\n`;
    response += `- "run web scan" - Run with web scanner\n`;

    return response;
  }

  // Handle specific scanner commands
  if (lowerMessage.includes("run tauri scan") || lowerMessage.includes("run native scan")) {
    return this.executeScanCommand("run_tauri_scan", "Tauri native Rust scanner");
  }

  if (lowerMessage.includes("run web scan") || lowerMessage.includes("run browser scan")) {
    return this.executeScanCommand("run_web_scan", "Web browser scanner");
  }

  // Handle "run new scan" command
  if (
    lowerMessage.includes("run scan") ||
    lowerMessage.includes("new scan") ||
    lowerMessage.includes("scan directory")
  ) {
    // Extract directory path if mentioned
    let targetDirectory = "";
    if (lowerMessage.includes("in") || lowerMessage.includes("of")) {
      const match = message.match(/(?:in|of)\s+([^\s]+)/i);
      if (match) targetDirectory = match[1];
    }

    let response = `## 🔍 Starting New Scan\n\n`;

    if (targetDirectory) {
      response += `**Target Directory:** ${targetDirectory}\n\n`;
      response += `I'll initiate a scan of the specified directory. This may take a few moments depending on the directory size.\n\n`;
    } else {
      response += `**Target:** Current working directory\n\n`;
      response += `I'll initiate a new scan of the current directory. This may take a few moments depending on the directory size.\n\n`;
    }

    response += `**Scan Options:**\n`;
    response += `- ✅ File size analysis\n`;
    response += `- ✅ File type categorization\n`;
    response += `- ✅ Duplicate file detection\n`;
    response += `- ✅ Large file identification\n\n`;

    response += `⏳ **Initializing scan...**\n\n`;
    response += `I'll show you real-time progress as the scan continues.`;

    // Add initial scan message
    const scanMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "assistant",
      content: response,
      timestamp: new Date(),
      hasAIAnalysis: true,
    };
    messages.value.push(scanMessage);

    // Start progressive scan updates
    startScanProgress(targetDirectory || "current");

    // Execute scan and update local data store
    const actionExecutor = ActionExecutor.getInstance();

    // Execute scan and handle results
    actionExecutor.executeAction(
      "run_scan",
      { directory: targetDirectory || "current" },
      {
        analysisData: props.analysisData,
        files: props.files,
        categories: props.categories,
        previousAnalyses: props.previousAnalyses,
        currentAnalysisId: props.currentAnalysisId,
        onProgress: (_message: string) => {
          // Progress is already handled by startScanProgress
        },
        onComplete: (result: any) => {
          console.log("Scan completed with results:", result);
          console.log("Files found:", result.files?.length || 0);
          console.log("Total size:", result.totalSize);
          console.log("Directory scanned:", result.directory);

          // Update local data store with scan results
          localAnalysisData.value = {
            totalSize: result.totalSize,
            fileCount: result.fileCount,
            timestamp: result.timestamp,
            directory: result.directory,
            scanDuration: result.scanDuration,
          };

          localFiles.value = result.files;
          localCategories.value = result.categories;

          // Add to previous analyses
          if (result.id) {
            localPreviousAnalyses.value.unshift({
              id: result.id,
              timestamp: result.timestamp,
              totalSize: result.totalSize,
              fileCount: result.fileCount,
            });

            // Keep only last 5 analyses
            localPreviousAnalyses.value = localPreviousAnalyses.value.slice(0, 5);
          }

          console.log("Local data updated:");
          console.log("- localAnalysisData:", localAnalysisData.value);
          console.log("- localFiles:", localFiles.value?.length || 0);
          console.log("- localCategories:", Object.keys(localCategories.value || {}).length);
        },
        onError: (error: string) => {
          console.error("Scan failed:", error);
        },
      }
    );

    // Return a response to prevent API call
    return response;
  }

  // Handle "generate report" command
  if (
    lowerMessage.includes("generate report") ||
    lowerMessage.includes("create report") ||
    lowerMessage.includes("detailed report") ||
    lowerMessage.includes("show me the report") ||
    lowerMessage.includes("show report") ||
    lowerMessage.includes("report")
  ) {
    // Use local data store first, then fallback to props
    const analysisData = localAnalysisData.value || props.analysisData;
    const files = localFiles.value.length > 0 ? localFiles.value : props.files;
    const categories = localCategories.value || props.categories;

    console.log("Report generation - Data check:");
    console.log("- localAnalysisData:", localAnalysisData.value);
    console.log("- localFiles:", localFiles.value?.length || 0);
    console.log("- localCategories:", Object.keys(localCategories.value || {}).length);
    console.log("- props.analysisData:", props.analysisData);
    console.log("- props.files:", props.files?.length || 0);
    console.log("- props.categories:", Object.keys(props.categories || {}).length);
    console.log("- Final analysisData:", analysisData);
    console.log("- Final files:", files?.length || 0);
    console.log("- Final categories:", Object.keys(categories || {}).length);

    if (!analysisData) {
      return "No analysis data available. Please run a scan first to generate a report.";
    }

    let response = `## 📊 Analysis Report\n\n`;
    response += `**Generated:** ${new Date().toLocaleString()}\n`;
    response += `**Analysis ID:** ${props.currentAnalysisId || "N/A"}\n\n`;

    // Executive Summary
    response += `### 📋 Executive Summary\n\n`;
    const totalSize = analysisData.totalSize || 0;
    const fileCount = files?.length || 0;
    response += `- **Total Storage Used:** ${formatBytes(totalSize)}\n`;
    response += `- **Total Files Analyzed:** ${fileCount.toLocaleString()}\n`;
    response += `- **File Categories:** ${Object.keys(categories || {}).length}\n`;
    response += `- **Average File Size:** ${formatBytes(totalSize / Math.max(fileCount, 1))}\n\n`;

    // Category Analysis
    if (categories && Object.keys(categories).length > 0) {
      response += `### 📂 Category Analysis\n\n`;
      const sortedCategories = Object.entries(categories).sort(
        ([, a]: any, [, b]: any) => (b as any).size - (a as any).size
      );

      sortedCategories.forEach(([name, data]: [string, any], index: number) => {
        const size = formatBytes(data.size || 0);
        const count = (data as any).count || 0;
        const percentage = totalSize > 0 ? ((data.size / totalSize) * 100).toFixed(1) : "0";
        response += `**${index + 1}. ${name}**\n`;
        response += `- Size: ${size} (${percentage}%)\n`;
        response += `- Files: ${count.toLocaleString()}\n`;
        response += `- Avg Size: ${formatBytes((data.size || 0) / Math.max(count, 1))}\n\n`;
      });
    }

    // Largest Files
    if (props.files && props.files.length > 0) {
      response += `### 📈 Top 10 Largest Files\n\n`;
      const largestFiles = props.files
        .map((file: any) => ({
          name: file.name || file.path || "Unknown",
          size: file.size?.bytes || file.size || 0,
          path: file.path || file.name || "",
        }))
        .sort((a: any, b: any) => b.size - a.size)
        .slice(0, 10);

      largestFiles.forEach((file: any, index: number) => {
        response += `**${index + 1}.** ${file.name}\n`;
        response += `- Size: ${formatBytes(file.size)}\n`;
        response += `- Path: ${file.path}\n\n`;
      });
    }

    response += `---\n\n`;
    response += `**Report completed.** Would you like me to export this data or perform any specific analysis on these results?`;

    return response;
  }

  // Handle "compare scans" command
  if (
    lowerMessage.includes("compare scans") ||
    lowerMessage.includes("compare analysis") ||
    lowerMessage.includes("previous scan")
  ) {
    // Use local data store first, then fallback to props
    const previousAnalyses =
      localPreviousAnalyses.value.length > 0
        ? localPreviousAnalyses.value
        : props.previousAnalyses || [];

    const analysisData = localAnalysisData.value || props.analysisData;
    const files = localFiles.value.length > 0 ? localFiles.value : props.files;

    if (previousAnalyses.length === 0) {
      return "No previous analyses available for comparison. Please run multiple scans to enable comparison features.";
    }

    const recentAnalyses = previousAnalyses.slice(-3); // Get last 3 analyses
    let response = `## 📊 Scan Comparison\n\n`;
    response += `**Current Analysis:** ${props.currentAnalysisId || "Latest"}\n`;
    response += `**Previous Analyses:** ${recentAnalyses.length} available\n\n`;

    // Compare with most recent previous analysis
    const mostRecent = recentAnalyses[recentAnalyses.length - 1];
    if (mostRecent && analysisData) {
      response += `### 🔄 Comparison with Previous Scan\n\n`;
      response += `**Previous Scan ID:** ${mostRecent.id || "Unknown"}\n`;
      response += `**Previous Scan Date:** ${mostRecent.timestamp ? new Date(mostRecent.timestamp).toLocaleString() : "Unknown"}\n\n`;

      const currentSize = analysisData.totalSize || 0;
      const previousSize = mostRecent.totalSize || 0;
      const sizeChange = currentSize - previousSize;
      const sizeChangePercent =
        previousSize > 0 ? ((sizeChange / previousSize) * 100).toFixed(1) : "0";

      response += `**Storage Changes:**\n`;
      response += `- Previous: ${formatBytes(previousSize)}\n`;
      response += `- Current: ${formatBytes(currentSize)}\n`;
      response += `- Change: ${sizeChange >= 0 ? "+" : ""}${formatBytes(sizeChange)} (${sizeChange >= 0 ? "+" : ""}${sizeChangePercent}%)\n\n`;

      // File count comparison
      const currentFileCount = files?.length || 0;
      const previousFileCount = mostRecent.fileCount || 0;
      const fileChange = currentFileCount - previousFileCount;
      const fileChangePercent =
        previousFileCount > 0 ? ((fileChange / previousFileCount) * 100).toFixed(1) : "0";

      response += `**File Count Changes:**\n`;
      response += `- Previous: ${previousFileCount.toLocaleString()}\n`;
      response += `- Current: ${currentFileCount.toLocaleString()}\n`;
      response += `- Change: ${fileChange >= 0 ? "+" : ""}${fileChange.toLocaleString()} (${fileChange >= 0 ? "+" : ""}${fileChangePercent}%)\n\n`;

      response += `### 📈 Trend Analysis\n\n`;
      if (sizeChange > 0) {
        response += `⚠️ **Storage Increased**: Your storage usage has grown by ${formatBytes(sizeChange)}. Consider reviewing new large files.\n`;
      } else if (sizeChange < 0) {
        response += `✅ **Storage Reduced**: Great job! You've freed up ${formatBytes(Math.abs(sizeChange))} of space.\n`;
      } else {
        response += `➡️ **No Change**: Storage usage remains the same.\n`;
      }
    }

    response += `\nWould you like me to show a detailed trend analysis or export the comparison data?`;

    return response;
  }

  // Handle "export data" command
  if (
    lowerMessage.includes("export data") ||
    lowerMessage.includes("export analysis") ||
    lowerMessage.includes("save data")
  ) {
    // Use local data store first, then fallback to props
    const analysisData = localAnalysisData.value || props.analysisData;
    const files = localFiles.value.length > 0 ? localFiles.value : props.files;
    const categories = localCategories.value || props.categories;

    if (!analysisData) {
      return "No analysis data available to export. Please run a scan first.";
    }

    let format = "json"; // default format
    if (lowerMessage.includes("csv")) format = "csv";
    if (lowerMessage.includes("excel") || lowerMessage.includes("xlsx")) format = "xlsx";
    if (lowerMessage.includes("pdf")) format = "pdf";
    if (lowerMessage.includes("txt") || lowerMessage.includes("text")) format = "txt";

    let response = `## 📤 Exporting Analysis Data\n\n`;
    response += `**Format:** ${format.toUpperCase()}\n`;
    response += `**Analysis ID:** ${props.currentAnalysisId || "Latest"}\n`;
    response += `**Export Time:** ${new Date().toLocaleString()}\n\n`;

    response += `### 📋 Data to Export:\n\n`;
    response += `- ✅ File listings with sizes and paths\n`;
    response += `- ✅ Category breakdown\n`;
    response += `- ✅ Storage usage statistics\n`;
    response += `- ✅ Large file analysis\n`;
    response += `- ✅ Timestamps and metadata\n\n`;

    // Execute export using ActionExecutor
    const actionExecutor = ActionExecutor.getInstance();

    actionExecutor.executeAction(
      "export_data",
      {
        format: format,
        analysisData: analysisData,
        files: files,
        categories: categories,
      },
      {
        analysisData: analysisData,
        files: files,
        categories: categories,
        previousAnalyses: localPreviousAnalyses.value || props.previousAnalyses,
        currentAnalysisId: props.currentAnalysisId,
        onProgress: (message: string) => {
          // Could add progress updates to chat here
          console.log("Export progress:", message);
        },
        onComplete: (result: any) => {
          console.log("Export completed:", result);
        },
        onError: (error: string) => {
          console.error("Export failed:", error);
        },
      }
    );

    response += `⏳ **Preparing export...**\n\n`;
    response += `Your ${format.toUpperCase()} file will be downloaded automatically once ready.\n\n`;
    response += `**Note:** Large datasets may take a few moments to process.`;

    return response;
  }

  return null;
};

const handleSendMessage = async () => {
  if (!inputValue.value.trim() || isStreaming.value) return;

  const actions = parseActionCommands(inputValue.value);
  const aiBackend = AIBackendService.getInstance();

  try {
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: inputValue.value,
      timestamp: new Date(),
    };
    messages.value.push(userMessage);

    // Check for direct commands first
    const directResponse = handleDirectCommand(inputValue.value);
    if (directResponse) {
      // Add direct response immediately
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: directResponse,
        timestamp: new Date(),
        hasAIAnalysis: true,
      };
      messages.value.push(aiMessage);
      inputValue.value = "";
      return;
    }

    // Execute parsed actions
    if (actions.length > 0 && props.onExecuteAction) {
      for (const action of actions) {
        await props.onExecuteAction(action.id, action.params);
      }
    }

    // Try to get response from local AI backend first
    isStreaming.value = true;
    let response: string;

    try {
      const aiResponse = await aiBackend.processMessage(inputValue.value, {
        analysisData: props.analysisData,
        files: props.files,
        categories: props.categories,
        previousAnalyses: props.previousAnalyses,
        currentAnalysisId: props.currentAnalysisId,
      });

      if (aiResponse.success) {
        response = aiResponse.response;
      } else {
        throw new Error(aiResponse.response);
      }
    } catch (localError) {
      // Fallback to original AI service
      console.warn("Local AI failed, falling back to backend:", localError);
      const aiChatService = AIChatService.getInstance();
      const backendResponse = await aiChatService.sendMessage(inputValue.value, {
        analysisData: props.analysisData,
        files: props.files,
        categories: props.categories,
        previousAnalyses: props.previousAnalyses,
        currentAnalysisId: props.currentAnalysisId,
      });
      response = (backendResponse as any).content || backendResponse;
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

// Error handler for template
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

// Auto-scroll to bottom
watch(messages, () => {
  nextTick(() => {
    messagesEndRef.value?.scrollIntoView({ behavior: "smooth" });
  });
});

// Scanner control methods
const getScannerStatusClass = (): string => {
  if (!isTauriAvailable.value && currentScannerMode.value === "tauri") {
    return "status-unavailable";
  }
  return currentScannerMode.value === "auto"
    ? "status-auto"
    : currentScannerMode.value === "tauri"
      ? "status-tauri"
      : "status-web";
};

const getScannerStatusText = (): string => {
  if (!isTauriAvailable.value && currentScannerMode.value === "tauri") {
    return "Native Unavailable";
  }
  return currentScannerMode.value === "auto"
    ? "Smart Auto"
    : currentScannerMode.value === "tauri"
      ? "Native Scanner"
      : "Web Scanner";
};

const setScannerMode = (mode: "auto" | "tauri" | "web") => {
  currentScannerMode.value = mode;

  // Update ActionExecutor configuration
  const actionExecutor = ActionExecutor.getInstance();
  actionExecutor.setScannerConfig({
    type: mode,
    preferNative: mode === "auto" ? true : mode === "tauri",
    fallbackToWeb: true,
  });

  // Add status message
  const statusMessage: ChatMessage = {
    id: Date.now().toString(),
    type: "assistant",
    content: `🔧 Scanner mode changed to: ${getScannerStatusText()}`,
    timestamp: new Date(),
  };
  messages.value.push(statusMessage);
};

const executeQuickScan = async () => {
  const scannerName =
    currentScannerMode.value === "tauri"
      ? "Native Rust scanner"
      : currentScannerMode.value === "web"
        ? "Web browser scanner"
        : "Smart scanner";

  // Show confirmation message
  const confirmMessage: ChatMessage = {
    id: Date.now().toString(),
    type: "assistant",
    content: `🔍 **Ready to scan with ${scannerName}**\n\nPlease select a directory to scan. The scan will analyze file properties without moving any files.`,
    timestamp: new Date(),
  };
  messages.value.push(confirmMessage);

  // Request directory selection
  const actionExecutor = ActionExecutor.getInstance();

  try {
    // First, let user select directory
    const selectedPath = await actionExecutor.executeAction("select_directory", {}, {});

    if (!selectedPath || selectedPath.error) {
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: `❌ Directory selection cancelled or failed. Please try again.`,
        timestamp: new Date(),
      };
      messages.value.push(errorMessage);
      return "Directory selection cancelled";
    }

    // Show directory confirmation and start scan
    const displayName =
      typeof selectedPath === "string" ? selectedPath : selectedPath.path || "Unknown";
    const startMessage: ChatMessage = {
      id: (Date.now() + 2).toString(),
      type: "assistant",
      content: `📁 **Selected Directory:** ${displayName}\n\n🚀 Starting scan with ${scannerName}...`,
      timestamp: new Date(),
    };
    messages.value.push(startMessage);

    // Add progress tracking message
    const progressMessage: ChatMessage = {
      id: (Date.now() + 3).toString(),
      type: "assistant",
      content: `⏳ **Initializing scan...**\n\nThis may take a few moments for large directories.`,
      timestamp: new Date(),
    };
    messages.value.push(progressMessage);

    // Determine the correct action ID
    const actionId =
      currentScannerMode.value === "tauri"
        ? "run_tauri_scan"
        : currentScannerMode.value === "web"
          ? "run_web_scan"
          : "run_scan";

    // Execute scan with the selected path
    const directoryPath =
      typeof selectedPath === "string" ? selectedPath : selectedPath.path || "current";
    return executeScanCommandWithPath(actionId, scannerName, directoryPath);
  } catch (error) {
    const errorMessage: ChatMessage = {
      id: (Date.now() + 4).toString(),
      type: "assistant",
      content: `❌ **Scan failed:** ${error instanceof Error ? error.message : "Unknown error"}\n\nPlease try again or check the directory permissions.`,
      timestamp: new Date(),
    };
    messages.value.push(errorMessage);
    return `Scan failed: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
};

const showScannerInfo = () => {
  const actionExecutor = ActionExecutor.getInstance();
  const config = actionExecutor.getScannerConfig();

  let response = `## 🔍 Scanner Information\n\n`;
  response += `**Current Mode:** ${getScannerStatusText()}\n`;
  response += `**Configuration Type:** ${config.type}\n`;
  response += `**Tauri Available:** ${isTauriAvailable.value ? "Yes" : "No"}\n`;
  response += `**Prefer Native:** ${config.preferNative ? "Yes" : "No"}\n`;
  response += `**Fallback to Web:** ${config.fallbackToWeb ? "Yes" : "No"}\n\n`;

  response += `**Scanner Capabilities:**\n`;
  if (isTauriAvailable.value) {
    response += `- ✅ Native Rust scanner - High performance, real file system access\n`;
    response += `- ✅ Web scanner - Browser-based, limited to user-selected directories\n`;
  } else {
    response += `- ❌ Native scanner - Requires Tauri desktop environment\n`;
    response += `- ✅ Web scanner - Browser-based, limited to user-selected directories\n`;
  }

  response += `\n**Quick Actions:**\n`;
  response += `- Click the scanner mode buttons to switch between scanners\n`;
  response += `- Use "Quick Scan" to start scanning with current settings\n`;
  response += `- Type commands like "use tauri scanner" or "run web scan" in chat\n`;

  const infoMessage: ChatMessage = {
    id: Date.now().toString(),
    type: "assistant",
    content: response,
    timestamp: new Date(),
  };
  messages.value.push(infoMessage);
};

const executeScanCommandWithPath = (
  actionId: string,
  scannerName: string,
  directoryPath: string
): string => {
  // Execute scan and handle results with specific directory
  const actionExecutor = ActionExecutor.getInstance();

  // Add real-time progress tracking
  let progressMessageId = (Date.now() + 10).toString();
  let isScanning = true;

  actionExecutor.executeAction(
    actionId,
    { directory: directoryPath },
    {
      analysisData: props.analysisData,
      files: props.files,
      categories: props.categories,
      previousAnalyses: props.previousAnalyses,
      currentAnalysisId: props.currentAnalysisId,
      onProgress: (progress: any) => {
        if (!isScanning) return;

        // Update progress message in real-time
        const progressText =
          `⏳ **Scanning in progress...**\n\n` +
          `📁 Directory: ${directoryPath}\n` +
          `🔧 Scanner: ${scannerName}\n` +
          `📊 Stage: ${progress.stage || "Initializing"}\n` +
          `📈 Progress: ${progress.progress || 0}%\n` +
          `📁 Files processed: ${progress.filesProcessed || 0}${progress.totalFiles ? ` / ${progress.totalFiles}` : ""}\n` +
          `${progress.currentFile ? `🔍 Current: ${progress.currentFile}` : ""}\n\n` +
          `⏱️ This may take a few moments for large directories...`;

        // Update or create progress message
        const existingMessageIndex = messages.value.findIndex(
          (msg) => msg.id === progressMessageId
        );
        if (existingMessageIndex >= 0) {
          messages.value[existingMessageIndex] = {
            id: progressMessageId,
            type: "assistant",
            content: progressText,
            timestamp: new Date(),
          };
        } else {
          const progressMessage: ChatMessage = {
            id: progressMessageId,
            type: "assistant",
            content: progressText,
            timestamp: new Date(),
          };
          messages.value.push(progressMessage);
        }
      },
      onComplete: (result: any) => {
        isScanning = false;
        console.log("Scan completed with results:", result);
        console.log("Files found:", result.files?.length || 0);
        console.log("Total size:", result.totalSize);
        console.log("Directory scanned:", result.directory);

        // Update local data store with scan results
        localAnalysisData.value = {
          id: result.id || Date.now().toString(),
          timestamp: result.timestamp || new Date(),
          directory: result.directory || directoryPath,
          totalSize: result.totalSize || 0,
          fileCount: result.fileCount || 0,
          categories: result.categories || {},
          files: result.files || [],
          scanDuration: result.scanDuration || 0,
        };

        localFiles.value = result.files || [];
        localCategories.value = result.categories || {};

        // Remove progress message and add completion message
        messages.value = messages.value.filter((msg) => msg.id !== progressMessageId);

        const completionMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: "assistant",
          content: buildCompletionMessage(scannerName, directoryPath, result),
          timestamp: new Date(),
        };
        messages.value.push(completionMessage);
      },
      onError: (error: string) => {
        isScanning = false;
        console.error("Scan failed:", error);

        // Remove progress message and add error message
        messages.value = messages.value.filter((msg) => msg.id !== progressMessageId);

        const errorMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          type: "assistant",
          content:
            `❌ **Scan failed**\n\n` +
            `📁 Directory: ${directoryPath}\n` +
            `🔧 Scanner: ${scannerName}\n` +
            `⚠️ Error: ${error}\n\n` +
            `💡 Please check:\n` +
            `• Directory permissions\n` +
            `• Directory exists and is accessible\n` +
            `• Try running as administrator if needed`,
          timestamp: new Date(),
        };
        messages.value.push(errorMessage);
      },
    }
  );

  return `🚀 Starting scan with ${scannerName}...`;
};

const buildCompletionMessage = (
  scannerName: string,
  directoryPath: string,
  result: any
): string => {
  const avgFileSize =
    result.fileCount > 0
      ? formatBytes(Math.round((result.totalSize || 0) / result.fileCount))
      : "N/A";
  const filesPerSecond =
    result.scanDuration && result.scanDuration > 0
      ? Math.round((result.fileCount || 0) / (result.scanDuration / 1000))
      : "N/A";
  const mbPerSecond =
    result.scanDuration && result.scanDuration > 0
      ? formatBytes(Math.round((result.totalSize || 0) / (result.scanDuration / 1000)))
      : "N/A";

  const categories = result.categories
    ? Object.entries(result.categories)
        .map(([cat, data]) => `• ${cat}: ${data.count} files (${formatBytes(data.size)})`)
        .join("\n")
    : "• No categories found";
  const largestFiles = result.files
    ? result.files
        .filter((f: any) => f.size > 0)
        .sort((a: any, b: any) => b.size - a.size)
        .slice(0, 5)
        .map((f: any) => `• ${f.name} (${formatBytes(f.size)})`)
        .join("\n")
    : "• No files found";
  const duplicateCount = result.files ? result.files.filter((f: any) => f.isDuplicate).length : 0;
  const emptyDirCount = result.emptyDirectories ? result.emptyDirectories.length : 0;

  return (
    `✅ **${scannerName} scan complete!**\n\n` +
    `📁 **Directory:** ${directoryPath}\n\n` +
    `📊 **Scan Summary:**\n` +
    `• Files found: ${result.fileCount || 0}\n` +
    `• Total size: ${formatBytes(result.totalSize || 0)}\n` +
    `• Scan duration: ${Math.round((result.scanDuration || 0) / 1000)}s\n` +
    `• Average file size: ${avgFileSize}\n\n` +
    `📂 **File Categories:**\n` +
    `${categories}\n\n` +
    `🔍 **Analysis Details:**\n` +
    `${largestFiles}\n` +
    `• Duplicate files: ${duplicateCount}\n` +
    `• Empty directories: ${emptyDirCount}\n\n` +
    `⚡ **Performance Metrics:**\n` +
    `• Files/second: ${filesPerSecond}\n` +
    `• MB/second: ${mbPerSecond}\n\n` +
    `🎉 **Scan completed successfully!**\n\n` +
    `💡 You can now ask questions about:\n` +
    `• File analysis and categorization\n` +
    `• Duplicate file detection\n` +
    `• Storage optimization suggestions\n` +
    `• Large file identification`
  );
};

const executeScanCommand = (actionId: string, scannerName: string): string => {
  // Legacy function - redirects to path-based version
  return executeScanCommandWithPath(actionId, scannerName, "current");
};

onMounted(() => {
  const initializeServices = async () => {
    try {
      // Check voice support
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

/* Formatted message styles */
.formatted-message {
  color: rgb(243, 244, 246);
  font-size: 0.875rem;
  line-height: 1.7;
}

.formatted-message p {
  margin-bottom: 0.875rem;
  color: rgb(243, 244, 246);
}

.formatted-message p:last-child {
  margin-bottom: 0;
}

.formatted-message h1,
.formatted-message h2,
.formatted-message h3 {
  font-weight: 700;
  margin-top: 1.5rem;
  margin-bottom: 0.75rem;
  background: linear-gradient(135deg, rgb(96, 165, 250), rgb(167, 139, 250));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-fill-color: transparent;
}

.formatted-message h1 {
  font-size: 1.375rem;
  border-bottom: 2px solid rgba(96, 165, 250, 0.3);
  padding-bottom: 0.5rem;
}

.formatted-message h2 {
  font-size: 1.25rem;
  border-bottom: 1px solid rgba(167, 139, 250, 0.3);
  padding-bottom: 0.25rem;
}

.formatted-message h3 {
  font-size: 1.125rem;
  color: rgb(196, 181, 253);
  background: none;
  -webkit-text-fill-color: rgb(196, 181, 253);
}

.formatted-message ul,
.formatted-message ol {
  margin: 1rem 0;
  padding-left: 2rem;
}

.formatted-message li {
  margin-bottom: 0.5rem;
  color: rgb(229, 231, 235);
  position: relative;
}

.formatted-message li::marker {
  color: rgb(96, 165, 250);
  font-weight: bold;
}

.formatted-message code {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(51, 65, 85, 0.9));
  color: rgb(251, 207, 232);
  padding: 0.25rem 0.5rem;
  border-radius: 0.375rem;
  font-family: "Fira Code", "Courier New", monospace;
  font-size: 0.875rem;
  border: 1px solid rgba(96, 165, 250, 0.2);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.formatted-message pre {
  background: linear-gradient(135deg, rgba(17, 24, 39, 0.95), rgba(31, 41, 55, 0.95));
  border: 1px solid rgba(96, 165, 250, 0.3);
  border-radius: 0.5rem;
  padding: 1rem;
  margin: 1rem 0;
  overflow-x: auto;
  box-shadow:
    0 4px 6px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.formatted-message pre code {
  background: transparent;
  padding: 0;
  color: rgb(251, 207, 232);
  font-size: 0.875rem;
  border: none;
  box-shadow: none;
}

.formatted-message strong {
  color: rgb(96, 165, 250);
  font-weight: 700;
  text-shadow: 0 0 10px rgba(96, 165, 250, 0.3);
}

.formatted-message em {
  color: rgb(251, 191, 36);
  font-style: italic;
  font-weight: 500;
}

.user-message {
  color: white;
  font-size: 0.875rem;
  margin: 0;
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

/* Scanner Control Panel Styles */
.scanner-control-panel {
  margin: 12px 0;
  padding: 16px;
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(51, 65, 85, 0.5);
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(12px);
}

.scanner-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.scanner-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #f8fafc;
  font-size: 14px;
}

.scanner-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.2s ease;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.scanner-status.status-auto {
  background: rgba(59, 130, 246, 0.2);
  color: #93c5fd;
  border-color: rgba(59, 130, 246, 0.3);
}

.scanner-status.status-tauri {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
  border-color: rgba(34, 197, 94, 0.3);
}

.scanner-status.status-web {
  background: rgba(251, 191, 36, 0.2);
  color: #fcd34d;
  border-color: rgba(251, 191, 36, 0.3);
}

.scanner-status.status-unavailable {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  border-color: rgba(239, 68, 68, 0.3);
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.scanner-options {
  margin-bottom: 16px;
}

.scanner-modes {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.scanner-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid rgba(51, 65, 85, 0.5);
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.3);
  color: #cbd5e1;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
  min-width: 0;
  justify-content: center;
  backdrop-filter: blur(8px);
}

.scanner-btn:hover:not(.disabled) {
  background: rgba(51, 65, 85, 0.5);
  border-color: rgba(100, 116, 139, 0.5);
  transform: translateY(-1px);
  color: #f1f5f9;
}

.scanner-btn.active {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.3) 100%);
  border-color: rgba(59, 130, 246, 0.5);
  color: #93c5fd;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}

.scanner-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: rgba(30, 41, 59, 0.2);
  color: #64748b;
}

.quick-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
  justify-content: center;
  backdrop-filter: blur(8px);
}

.action-btn.primary {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(5, 150, 105, 0.3) 100%);
  color: #86efac;
  border: 1px solid rgba(16, 185, 129, 0.3);
  box-shadow: 0 2px 8px rgba(16, 185, 129, 0.2);
}

.action-btn.primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.4) 0%, rgba(5, 150, 105, 0.4) 100%);
}

.action-btn.secondary {
  background: rgba(30, 41, 59, 0.3);
  color: #94a3b8;
  border: 1px solid rgba(51, 65, 85, 0.5);
}

.action-btn.secondary:hover {
  background: rgba(51, 65, 85, 0.5);
  border-color: rgba(100, 116, 139, 0.5);
  transform: translateY(-1px);
  color: #cbd5e1;
}

/* Tools Panel Styles */
.tools-panel {
  margin-bottom: 1rem;
  background-color: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(51, 65, 85, 0.5);
  border-radius: 0.75rem;
  overflow: hidden;
}

.tools-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background-color: rgba(37, 99, 235, 0.1);
  border-bottom: 1px solid rgba(51, 65, 85, 0.5);
}

.tools-header span {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: rgb(196, 181, 253);
}

.tools-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
  padding: 0.75rem;
}

.tool-card {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background-color: rgba(51, 65, 85, 0.3);
  border: 1px solid rgba(75, 85, 99, 0.3);
  border-radius: 0.5rem;
  transition: all 0.2s;
  cursor: pointer;
}

.tool-card:hover {
  background-color: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
  transform: translateY(-1px);
}

.tool-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  background-color: rgba(37, 99, 235, 0.2);
  border-radius: 0.5rem;
  color: rgb(96, 165, 250);
  flex-shrink: 0;
}

.tool-content {
  flex: 1;
  min-width: 0;
}

.tool-name {
  font-weight: 600;
  color: rgb(229, 231, 235);
  margin-bottom: 0.25rem;
}

.tool-description {
  font-size: 0.875rem;
  color: rgb(156, 163, 175);
  line-height: 1.4;
}

.tool-action {
  display: flex;
  align-items: center;
  color: rgb(156, 163, 175);
  transition: color 0.2s;
}

.tool-card:hover .tool-action {
  color: rgb(96, 165, 250);
}

.tools-toggle {
  margin-bottom: 1rem;
}

.tools-toggle-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background-color: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(51, 65, 85, 0.5);
  border-radius: 0.5rem;
  color: rgb(156, 163, 175);
  transition: all 0.2s;
  cursor: pointer;
  width: 100%;
}

.tools-toggle-btn:hover {
  background-color: rgba(51, 65, 85, 0.5);
  color: rgb(229, 231, 235);
}

.tools-toggle-btn.active {
  background-color: rgba(37, 99, 235, 0.2);
  border-color: rgba(59, 130, 246, 0.3);
  color: rgb(96, 165, 250);
}
</style>
