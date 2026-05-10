<!--
  Chat Messages Component
  Displays the conversation messages with proper formatting and animations
-->
<template>
  <div class="messages-container" ref="messagesContainer">
    <!-- Messages -->
    <div 
      v-for="message in messages" 
      :key="message.id" 
      :class="['message', message.type]"
    >
      <div class="message-avatar">
        <User v-if="message.type === 'user'" :size="20" />
        <Bot v-else :size="20" />
      </div>

      <div class="message-content">
        <div class="message-header">
          <span class="message-sender">
            {{ message.type === 'user' ? 'You' : 'AI Assistant' }}
          </span>
          <span class="message-time">
            {{ formatMessageTime(message.timestamp) }}
          </span>
        </div>
        
        <div class="message-text" v-html="formatMessageContent(message.content)"></div>
        
        <!-- Insights Section -->
        <div v-if="message.insights" class="message-insights">
          <div class="insights-header">
            <Sparkles :size="16" />
            <span>Insights</span>
          </div>
          <p class="insights-content">{{ message.insights }}</p>
        </div>
        
        <!-- Recommendations Section -->
        <div v-if="message.recommendations && message.recommendations.length > 0" class="message-recommendations">
          <div class="recommendations-header">
            <Lightbulb :size="16" />
            <span>Recommendations</span>
          </div>
          <ul class="recommendations-list">
            <li v-for="(rec, index) in message.recommendations" :key="index">
              {{ rec }}
            </li>
          </ul>
        </div>
        
        <!-- Message Actions -->
        <div class="message-actions">
          <button 
            class="action-btn"
            @click="$emit('copy-message', message.content)"
            aria-label="Copy message"
          >
            <Copy :size="16" />
          </button>
          <button 
            v-if="message.type === 'assistant'"
            class="action-btn"
            @click="$emit('retry-message', message.id)"
            aria-label="Retry response"
          >
            <RefreshCw :size="16" />
          </button>
          <button 
            class="action-btn"
            @click="$emit('delete-message', message.id)"
            aria-label="Delete message"
          >
            <Trash2 :size="16" />
          </button>
        </div>
      </div>
    </div>
    
    <!-- Typing Indicator -->
    <div v-if="isTyping" class="message assistant typing">
      <div class="message-avatar">
        <Bot :size="20" />
      </div>
      <div class="message-content">
        <div class="typing-indicator">
          <div class="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span class="typing-text">AI is thinking...</span>
        </div>
      </div>
    </div>
    
    <!-- Empty State -->
    <div v-if="!hasMessages && !isTyping" class="empty-state">
      <div class="empty-icon">
        <MessageSquare :size="48" />
      </div>
      <h3>No messages yet</h3>
      <p>Start a conversation with the AI assistant to get insights about your files.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue';
import { User, Bot, Sparkles, Lightbulb, Copy, RefreshCw, Trash2, MessageSquare } from 'lucide-vue-next';
import type { ChatMessage } from '../../../services/AIChatService';

interface Props {
  messages: ChatMessage[];
  isTyping: boolean;
}

interface Emits {
  (e: 'copy-message', content: string): void;
  (e: 'retry-message', messageId: string): void;
  (e: 'delete-message', messageId: string): void;
  (e: 'scroll-to-bottom'): void;
}

const props = defineProps<Props>();
defineEmits<Emits>();

const messagesContainer = ref<HTMLElement>();

const hasMessages = computed(() => props.messages.length > 0);

const formatMessageTime = (timestamp: Date) => {
  return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatMessageContent = (content: string) => {
  // Basic formatting for code blocks and line breaks
  return content
    .replace(/\n/g, '<br>')
    .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
    .replace(/```([^`]+)```/g, '<pre class="code-block"><code>$1</code></pre>');
};

const scrollToBottom = async () => {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

// Watch for new messages and scroll to bottom
watch(() => props.messages.length, () => {
  scrollToBottom();
}, { flush: 'post' });

// Watch for typing changes
watch(() => props.isTyping, () => {
  scrollToBottom();
}, { flush: 'post' });

// Initial scroll
nextTick(() => {
  scrollToBottom();
});
</script>

<style scoped>
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  scroll-behavior: smooth;
}

.message {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  animation: fadeInUp 0.3s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message.user {
  flex-direction: row-reverse;
}

.message.user .message-content {
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: white;
  margin-left: auto;
}

.message.assistant .message-content {
  background: #1e293b;
  color: #e2e8f0;
  margin-right: auto;
}

.message-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: #334155;
  border-radius: 50%;
  color: #94a3b8;
  flex-shrink: 0;
}

.message.user .message-avatar {
  background: #3b82f6;
  color: white;
}

.message-content {
  max-width: 70%;
  padding: 0.75rem 1rem;
  border-radius: 1rem;
  position: relative;
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
  opacity: 0.8;
}

.message-time {
  font-weight: 400;
}

.message-text {
  line-height: 1.5;
  margin-bottom: 0.75rem;
}

.inline-code {
  background: rgba(59, 130, 246, 0.2);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-family: 'Courier New', monospace;
  font-size: 0.875em;
}

.code-block {
  background: #0f172a;
  padding: 0.75rem;
  border-radius: 0.5rem;
  margin: 0.5rem 0;
  overflow-x: auto;
}

.message-insights,
.message-recommendations {
  margin-top: 1rem;
  padding-top: 0.75rem;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.insights-header,
.recommendations-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #fbbf24;
}

.insights-content {
  font-style: italic;
  opacity: 0.9;
}

.recommendations-list {
  margin: 0;
  padding-left: 1.25rem;
}

.recommendations-list li {
  margin-bottom: 0.25rem;
}

.message-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message:hover .message-actions {
  opacity: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: rgba(148, 163, 184, 0.1);
  border: none;
  border-radius: 0.375rem;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: rgba(148, 163, 184, 0.2);
  color: #cbd5e1;
}

.typing-indicator {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.typing-dots {
  display: flex;
  gap: 0.25rem;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  background: #94a3b8;
  border-radius: 50%;
  animation: typingDot 1.4s infinite ease-in-out;
}

.typing-dots span:nth-child(1) { animation-delay: -0.32s; }
.typing-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes typingDot {
  0%, 80%, 100% {
    transform: scale(0.8);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.typing-text {
  font-size: 0.875rem;
  color: #94a3b8;
  font-style: italic;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  color: #64748b;
}

.empty-icon {
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  font-weight: 600;
}

.empty-state p {
  margin: 0;
  font-size: 0.875rem;
  opacity: 0.8;
}

@media (max-width: 640px) {
  .message-content {
    max-width: 85%;
  }
  
  .message-actions {
    opacity: 1;
  }
}
</style>