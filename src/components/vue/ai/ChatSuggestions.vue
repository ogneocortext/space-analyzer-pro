<!--
  Chat Suggestions Component
  Displays proactive AI suggestions based on analysis data
-->
<template>
  <div v-if="hasSuggestions" class="chat-suggestions">
    <div class="suggestions-header">
      <h4>
        <Lightbulb :size="16" />
        AI Suggestions
      </h4>
      <button 
        class="refresh-btn"
        @click="$emit('refresh-suggestions')"
        aria-label="Refresh suggestions"
        :disabled="isLoading"
      >
        <RefreshCw :size="16" :class="{ 'animate-spin': isLoading }" />
      </button>
    </div>
    
    <div class="suggestions-grid">
      <div 
        v-for="suggestion in suggestions" 
        :key="suggestion.id"
        :class="['suggestion-card', suggestion.priority, suggestion.category]"
        @click="$emit('select-suggestion', suggestion)"
      >
        <div class="suggestion-icon">{{ suggestion.icon }}</div>
        
        <div class="suggestion-content">
          <h5>{{ suggestion.title }}</h5>
          <p>{{ suggestion.description }}</p>
          
          <div class="suggestion-meta">
            <span :class="['priority-badge', suggestion.priority]">
              {{ suggestion.priority }}
            </span>
            <span class="category-badge">{{ suggestion.category }}</span>
          </div>
          
          <div v-if="suggestion.estimatedImpact" class="impact-estimate">
            <span class="impact-label">Potential impact:</span>
            <span class="impact-value">{{ suggestion.estimatedImpact }}</span>
          </div>
        </div>
        
        <div class="suggestion-action">
          <ChevronRight :size="16" />
        </div>
      </div>
    </div>
    
    <!-- Suggestions Summary -->
    <div class="suggestions-summary">
      <div class="summary-item">
        <span class="summary-label">Total Suggestions:</span>
        <span class="summary-value">{{ suggestionCount }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">High Priority:</span>
        <span class="summary-value high-priority">{{ highPrioritySuggestions.length }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">Categories:</span>
        <span class="summary-value">{{ Object.keys(suggestionsByCategory).length }}</span>
      </div>
    </div>
  </div>
  
  <!-- Loading State -->
  <div v-else-if="isLoading" class="suggestions-loading">
    <div class="loading-content">
      <Loader2 :size="24" class="animate-spin" />
      <p>Generating AI suggestions...</p>
    </div>
  </div>
  
  <!-- Empty State -->
  <div v-else class="suggestions-empty">
    <div class="empty-content">
      <Lightbulb :size="32" />
      <h4>No Suggestions Available</h4>
      <p>Complete a file analysis to get personalized AI suggestions.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Lightbulb, RefreshCw, ChevronRight, Loader2 } from 'lucide-vue-next';
import type { AISuggestion } from '../../../composables/useAISuggestions';

interface Props {
  suggestions: AISuggestion[];
  isLoading: boolean;
}

interface Emits {
  (e: 'select-suggestion', suggestion: AISuggestion): void;
  (e: 'refresh-suggestions'): void;
}

const props = defineProps<Props>();
defineEmits<Emits>();

const hasSuggestions = computed(() => props.suggestions.length > 0);
const suggestionCount = computed(() => props.suggestions.length);
const highPrioritySuggestions = computed(() => 
  props.suggestions.filter(s => s.priority === 'high')
);
const suggestionsByCategory = computed(() => {
  const categorized: Record<string, AISuggestion[]> = {};
  props.suggestions.forEach(suggestion => {
    if (!categorized[suggestion.category]) {
      categorized[suggestion.category] = [];
    }
    categorized[suggestion.category].push(suggestion);
  });
  return categorized;
});

const getCategoryColor = (category: string) => {
  const colors: Record<string, string> = {
    storage: '#ef4444',
    performance: '#f59e0b',
    organization: '#3b82f6',
    security: '#22c55e',
  };
  return colors[category] || '#6b7280';
};

const getPriorityColor = (priority: string) => {
  const colors: Record<string, string> = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#22c55e',
  };
  return colors[priority] || '#6b7280';
};
</script>

<style scoped>
.chat-suggestions {
  padding: 1rem;
  background: #0f172a;
  border-top: 1px solid #334155;
}

.suggestions-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.suggestions-header h4 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #e2e8f0;
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(148, 163, 184, 0.1);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 0.375rem;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
}

.refresh-btn:hover:not(:disabled) {
  background: rgba(148, 163, 184, 0.2);
  color: #cbd5e1;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.suggestions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.suggestion-card {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.75rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.suggestion-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  background: var(--category-color, #6b7280);
}

.suggestion-card:hover {
  background: #334155;
  border-color: #475569;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.suggestion-card.high {
  --category-color: #ef4444;
}

.suggestion-card.medium {
  --category-color: #f59e0b;
}

.suggestion-card.low {
  --category-color: #22c55e;
}

.suggestion-card.storage {
  --category-color: #ef4444;
}

.suggestion-card.performance {
  --category-color: #f59e0b;
}

.suggestion-card.organization {
  --category-color: #3b82f6;
}

.suggestion-card.security {
  --category-color: #22c55e;
}

.suggestion-icon {
  font-size: 1.5rem;
  line-height: 1;
  flex-shrink: 0;
}

.suggestion-content {
  flex: 1;
  min-width: 0;
}

.suggestion-content h5 {
  margin: 0 0 0.25rem 0;
  font-size: 0.875rem;
  font-weight: 600;
  color: #e2e8f0;
  line-height: 1.3;
}

.suggestion-content p {
  margin: 0 0 0.5rem 0;
  font-size: 0.75rem;
  color: #94a3b8;
  line-height: 1.4;
}

.suggestion-meta {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.priority-badge,
.category-badge {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  font-size: 0.625rem;
  font-weight: 500;
  border-radius: 0.25rem;
  text-transform: uppercase;
}

.priority-badge.high {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.priority-badge.medium {
  background: rgba(245, 158, 11, 0.2);
  color: #f59e0b;
}

.priority-badge.low {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.category-badge {
  background: rgba(59, 130, 246, 0.2);
  color: #3b82f6;
}

.impact-estimate {
  font-size: 0.75rem;
  color: #64748b;
}

.impact-label {
  font-weight: 500;
}

.impact-value {
  color: #22c55e;
  font-weight: 600;
}

.suggestion-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: #64748b;
  transition: color 0.2s ease;
  flex-shrink: 0;
}

.suggestion-card:hover .suggestion-action {
  color: #cbd5e1;
}

.suggestions-summary {
  display: flex;
  gap: 1rem;
  padding: 0.75rem;
  background: #1e293b;
  border-radius: 0.5rem;
  font-size: 0.75rem;
}

.summary-item {
  display: flex;
  gap: 0.5rem;
}

.summary-label {
  color: #64748b;
}

.summary-value {
  color: #e2e8f0;
  font-weight: 600;
}

.summary-value.high-priority {
  color: #ef4444;
}

.suggestions-loading,
.suggestions-empty {
  padding: 2rem;
  text-align: center;
  color: #64748b;
}

.loading-content,
.empty-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.loading-content p,
.empty-content p {
  margin: 0;
  font-size: 0.875rem;
}

.empty-content h4 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #94a3b8;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (max-width: 640px) {
  .suggestions-grid {
    grid-template-columns: 1fr;
  }
  
  .suggestions-summary {
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .summary-item {
    justify-content: space-between;
  }
}
</style>