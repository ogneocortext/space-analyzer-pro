<template>
  <div class="glass-panel qa-container">
    <h3 class="qa-header">
      <MessageSquare :size="20" class="qa-title" />
      AI Model Q&A
      <span class="qa-subtitle">(Self-Learning Enabled)</span>
    </h3>

    <!-- Suggested Questions -->
    <div class="suggestions-description">
      <p>Suggested questions:</p>
    </div>
    <div class="suggestions-grid">
      <button
        v-for="(q, i) in suggestedQuestions"
        :key="i"
        @click="handleSuggestedQuestion(q)"
        class="suggestion-chip"
      >
        <Sparkles :size="12" />
        {{ q }}
      </button>
    </div>

    <!-- Question Input -->
    <form @submit="handleSubmit" class="qa-form">
      <input
        v-model="question"
        type="text"
        placeholder="Ask about AI models in this directory..."
        class="qa-input"
      />
      <button
        type="submit"
        class="primary-btn"
        :disabled="loading || !question.trim()"
      >
        <span v-if="loading" class="loading-spinner loading-spinner-compact" />
        <Send v-else :size="18" />
      </button>
    </form>

    <!-- Answer Display -->
    <div v-if="answer && !answer.error" class="qa-answer">
      <div class="answer-header">
        <CheckCircle :size="16" class="answer-icon-success" />
        <span>{{ answer.intent?.replace(/_/g, ' ').toUpperCase() }}</span>
        <span v-if="answer.cached" class="cached-badge">
          <Clock :size="12" /> Cached
        </span>
      </div>
      <div class="answer-content">
        <pre class="answer-content-pre">{{ answer.answer }}</pre>
      </div>
      <div v-if="answer.suggestions && answer.suggestions.length > 0" class="answer-suggestions">
        <p class="suggestions-description">Related questions:</p>
        <button
          v-for="(s, i) in answer.suggestions"
          :key="i"
          @click="handleSuggestedQuestion(s)"
          class="suggestion-link-button"
        >
          → {{ s }}
        </button>
      </div>
    </div>

    <div v-if="answer?.error" class="qa-error-message">Error: {{ answer.error }}</div>

    <!-- Q&A History -->
    <div v-if="history.length > 0" class="qa-history">
      <p class="qa-history-title">Recent questions: {{ history.length }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { MessageSquare, Send, Sparkles, Clock, CheckCircle } from 'lucide-vue-next';

interface AIModelQAProps {
  bridge: any;
  directory: string;
  analysisId: string;
}

const props = defineProps<AIModelQAProps>();

const question = ref('');
const answer = ref<any>(null);
const loading = ref(false);
const history = ref<Array<{ question: string; answer: any; timestamp: Date }>>([]);

const suggestedQuestions = [
  'How much space do AI models use?',
  'What frameworks are detected?',
  'How can I optimize these models?',
  'What is safetensors format?',
  'How do I use these AI models?',
];

const handleSubmit = async (e: Event) => {
  e.preventDefault();
  if (!question.value.trim()) return;

  loading.value = true;
  try {
    const result = await props.bridge.aiModelQA(question.value, props.directory, props.analysisId);
    answer.value = result;
    history.value.push({ question: question.value, answer: result, timestamp: new Date() });
    question.value = '';
  } catch (error) {
    console.error('Q&A error:', error);
    answer.value = { error: (error as Error).message };
  } finally {
    loading.value = false;
  }
};

const handleSuggestedQuestion = (q: string) => {
  question.value = q;
};
</script>

<style scoped>
.qa-container {
  @apply p-6 bg-slate-800/50 border border-slate-700 rounded-lg;
}

.qa-header {
  @apply flex items-center gap-3 mb-6 text-xl font-semibold text-white;
}

.qa-title {
  @apply text-blue-400;
}

.qa-subtitle {
  @apply text-sm text-gray-400 font-normal;
}

.suggestions-description {
  @apply mb-3 text-sm text-gray-400;
}

.suggestions-grid {
  @apply grid grid-cols-1 md:grid-cols-2 gap-2 mb-6;
}

.suggestion-chip {
  @apply flex items-center gap-2 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-sm text-purple-300 hover:bg-purple-500/20 transition-colors;
}

.qa-form {
  @apply flex gap-2 mb-6;
}

.qa-input {
  @apply flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500;
}

.primary-btn {
  @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed;
}

.qa-answer {
  @apply p-4 bg-green-500/10 border border-green-500/20 rounded-lg mb-4;
}

.answer-header {
  @apply flex items-center gap-2 mb-3;
}

.answer-icon-success {
  @apply text-green-400;
}

.answer-content {
  @apply mb-4;
}

.answer-content-pre {
  @apply text-sm text-gray-200 whitespace-pre-wrap;
}

.answer-suggestions {
  @apply pt-3 border-t border-green-500/20;
}

.suggestion-link-button {
  @apply block w-full text-left px-3 py-2 text-sm text-green-300 hover:bg-green-500/10 rounded transition-colors;
}

.qa-error-message {
  @apply p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 mb-4;
}

.qa-history {
  @apply p-4 bg-slate-700/50 rounded-lg;
}

.qa-history-title {
  @apply text-sm text-gray-400;
}

.loading-spinner {
  @apply w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin;
}

.loading-spinner-compact {
  @apply w-4 h-4;
}
</style>
