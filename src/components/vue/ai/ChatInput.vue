<!--
  Chat Input Component
  Handles message input, sending, and settings panel
-->
<template>
  <div class="chat-input-container">
    <!-- Input Area -->
    <div class="input-area">
      <textarea
        v-model="inputMessage"
        placeholder="Ask about your files, storage, or code..."
        class="message-input"
        rows="2"
        @keydown.enter.exact.prevent="handleSendMessage"
        @keydown.shift.enter="handleNewLine"
        :disabled="isStreaming"
        ref="textareaRef"
      ></textarea>

      <button
        class="send-btn"
        :disabled="!canSendMessage"
        aria-label="Send message"
        @click="handleSendMessage"
      >
        <Send v-if="!isStreaming" :size="20" />
        <Loader2 v-else :size="20" class="animate-spin" />
      </button>
    </div>

    <!-- Settings Panel -->
    <div v-if="showSettings" class="settings-panel">
      <div class="settings-grid">
        <!-- Model Selection -->
        <div class="setting-row">
          <label class="setting-label">AI Model:</label>
          <select 
            v-model="localModel" 
            class="setting-select"
            @change="$emit('update:model', localModel)"
          >
            <option 
              v-for="model in availableModels" 
              :key="model.id" 
              :value="model.id"
            >
              {{ model.name }} - {{ model.description }}
            </option>
          </select>
        </div>
        
        <!-- Analysis Depth -->
        <div class="setting-row">
          <label class="setting-label">Analysis Depth:</label>
          <select 
            v-model="localDepth" 
            class="setting-select"
            @change="$emit('update:analysisDepth', localDepth)"
          >
            <option value="quick">Quick - Fast overview</option>
            <option value="standard">Standard - Balanced analysis</option>
            <option value="comprehensive">Comprehensive - Deep insights</option>
          </select>
        </div>
      </div>
      
      <!-- Service Status -->
      <div class="service-status">
        <div class="status-header">
          <h4>Service Status</h4>
          <div class="status-indicator" :class="{ online: serviceStatus.available }">
            <div class="status-dot"></div>
            <span>{{ serviceStatus.available ? 'Online' : 'Offline' }}</span>
          </div>
        </div>
        
        <div v-if="serviceStatus.responseTime" class="status-metric">
          <span class="metric-label">Response Time:</span>
          <span class="metric-value">{{ serviceStatus.responseTime }}ms</span>
        </div>
        
        <div class="status-metric">
          <span class="metric-label">Available Models:</span>
          <span class="metric-value">{{ serviceStatus.models.length }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch } from 'vue';
import { Send, Loader2 } from 'lucide-vue-next';
import type { AIModel } from '../../../services/AIChatService';

interface Props {
  inputMessage: string;
  isStreaming: boolean;
  showSettings: boolean;
  currentModel: string;
  analysisDepth: 'quick' | 'standard' | 'comprehensive';
  serviceStatus: {
    available: boolean;
    models: AIModel[];
    responseTime?: number;
  };
}

interface Emits {
  (e: 'send-message'): void;
  (e: 'update:inputMessage', value: string): void;
  (e: 'update:model', value: string): void;
  (e: 'update:analysisDepth', value: 'quick' | 'standard' | 'comprehensive'): void;
  (e: 'check-service-status'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const textareaRef = ref<HTMLTextAreaElement>();
const localModel = ref(props.currentModel);
const localDepth = ref(props.analysisDepth);

const canSendMessage = computed(() => 
  props.inputMessage.trim().length > 0 && !props.isStreaming
);

const availableModels = computed(() => props.serviceStatus.models);

const handleSendMessage = () => {
  if (!canSendMessage.value) return;
  emit('send-message');
  
  // Reset textarea height
  if (textareaRef.value) {
    textareaRef.value.style.height = 'auto';
  }
};

const handleNewLine = () => {
  // Allow shift+enter for new line
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto';
      textareaRef.value.style.height = textareaRef.value.scrollHeight + 'px';
    }
  });
};

// Auto-resize textarea
watch(() => props.inputMessage, () => {
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto';
      textareaRef.value.style.height = textareaRef.value.scrollHeight + 'px';
    }
  });
});

// Watch for prop changes
watch(() => props.currentModel, (newValue) => {
  localModel.value = newValue;
});

watch(() => props.analysisDepth, (newValue) => {
  localDepth.value = newValue;
});

// Focus textarea when component mounts
nextTick(() => {
  if (textareaRef.value) {
    textareaRef.value.focus();
  }
});
</script>

<style scoped>
.chat-input-container {
  border-top: 1px solid #475569;
  background: #1e293b;
}

.input-area {
  display: flex;
  gap: 0.75rem;
  padding: 1rem;
  align-items: flex-end;
}

.message-input {
  flex: 1;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  padding: 0.75rem;
  color: #e2e8f0;
  font-family: inherit;
  font-size: 0.875rem;
  line-height: 1.5;
  resize: none;
  min-height: 44px;
  max-height: 120px;
  transition: all 0.2s ease;
}

.message-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.message-input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.message-input::placeholder {
  color: #64748b;
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  border: none;
  border-radius: 0.75rem;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.settings-panel {
  padding: 1rem;
  border-top: 1px solid #334155;
  background: #0f172a;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.setting-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.setting-label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #cbd5e1;
}

.setting-select {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  padding: 0.5rem 0.75rem;
  color: #e2e8f0;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.setting-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.setting-select option {
  background: #1e293b;
  color: #e2e8f0;
}

.service-status {
  padding: 0.75rem;
  background: #1e293b;
  border-radius: 0.5rem;
  border: 1px solid #334155;
}

.status-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.status-header h4 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #e2e8f0;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-indicator.online {
  color: #22c55e;
}

.status-indicator:not(.online) {
  color: #ef4444;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
  animation: pulse 2s infinite;
}

.status-metric {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  margin-bottom: 0.25rem;
}

.metric-label {
  color: #94a3b8;
}

.metric-value {
  color: #e2e8f0;
  font-weight: 500;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@media (max-width: 640px) {
  .input-area {
    padding: 0.75rem;
  }
  
  .settings-grid {
    grid-template-columns: 1fr;
  }
  
  .service-status {
    padding: 0.5rem;
  }
}
</style>