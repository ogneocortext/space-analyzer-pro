<!--
  Chat Header Component
  Displays the AI chat header with title, model info, and settings
-->
<template>
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
      <!-- Model Status -->
      <div v-if="serviceStatus.available" class="model-status">
        <div class="status-indicator online"></div>
        <span class="model-name">{{ currentModelName }}</span>
      </div>
      
      <!-- Settings Button -->
      <button 
        class="icon-btn" 
        aria-label="Settings" 
        @click="$emit('toggle-settings')"
        :class="{ active: showSettings }"
      >
        <Settings :size="20" />
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BrainCircuit, Settings } from 'lucide-vue-next';
import type { AIModel } from '../../../services/AIChatService';

interface Props {
  currentModel: string;
  showSettings: boolean;
  serviceStatus: {
    available: boolean;
    models: AIModel[];
    responseTime?: number;
  };
}

interface Emits {
  (e: 'toggle-settings'): void;
}

const props = defineProps<Props>();
defineEmits<Emits>();

const currentModelName = computed(() => {
  const model = props.serviceStatus.models.find(m => m.id === props.currentModel);
  return model?.name || props.currentModel;
});
</script>

<style scoped>
.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
  border-bottom: 1px solid #475569;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.ai-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
  border-radius: 50%;
  color: white;
}

.header-info h3 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: white;
}

.header-info p {
  margin: 0;
  font-size: 0.875rem;
  color: #94a3b8;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.model-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 0.5rem;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-indicator.online {
  background: #22c55e;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.model-name {
  font-size: 0.875rem;
  color: #22c55e;
  font-weight: 500;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: rgba(148, 163, 184, 0.1);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 0.5rem;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
}

.icon-btn:hover {
  background: rgba(148, 163, 184, 0.2);
  border-color: rgba(148, 163, 184, 0.3);
  color: #cbd5e1;
}

.icon-btn.active {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.3);
  color: #3b82f6;
}

@media (max-width: 640px) {
  .header-info h3 {
    font-size: 1rem;
  }
  
  .header-info p {
    font-size: 0.75rem;
  }
  
  .model-status {
    display: none;
  }
}
</style>