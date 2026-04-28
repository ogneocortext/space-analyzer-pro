<template>
  <div class="relative inline-block">
    <!-- Sparkle Icon -->
    <button
      @mouseenter="isHovered = true"
      @mouseleave="handleMouseLeave"
      @click="isExpanded = !isExpanded"
      :class="[
        'group relative flex items-center justify-center rounded-lg transition-all duration-200',
        getSizeClasses(),
        isHovered
          ? 'bg-purple-500/20 scale-110 shadow-lg shadow-purple-500/25'
          : 'bg-white/5 hover:bg-purple-500/10',
        'border border-transparent hover:border-purple-500/30'
      ]"
      title="Ask AI about this"
    >
      <Sparkles
        :class="[
          'transition-all duration-200',
          size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-6 h-6' : 'w-4 h-4',
          isHovered ? 'text-purple-300 animate-pulse' : 'text-purple-400 group-hover:text-purple-300'
        ]"
      />

      <!-- Ripple effect -->
      <div v-if="isHovered" class="absolute inset-0 rounded-lg bg-purple-400/20 animate-ping"></div>
    </button>

    <!-- Context Menu -->
    <Transition name="fade">
      <div
        v-if="isExpanded"
        :class="['absolute z-50', getPositionClasses(), 'w-64 p-2 rounded-xl border backdrop-blur-md shadow-2xl bg-slate-900/95 border-white/20']"
      >
        <div class="space-y-1">
          <div class="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-white/10">
            Ask AI about {{ contextType }}
          </div>

          <button
            v-for="(prompt, index) in prompts"
            :key="index"
            @click="handlePromptClick(prompt)"
            class="w-full px-3 py-2 text-left text-sm text-gray-200 hover:bg-white/10 hover:text-white rounded-lg transition-colors flex items-center space-x-3 group"
          >
            <div class="p-1 bg-blue-500/20 rounded group-hover:bg-blue-500/30 transition-colors">
              <MessageCircle :size="12" class="text-blue-400" />
            </div>
            <span class="truncate">{{ prompt }}</span>
          </button>

          <!-- Custom prompt option -->
          <div class="pt-2 border-t border-white/10">
            <button
              @click="handleCustomPrompt"
              class="w-full px-3 py-2 text-left text-sm text-purple-300 hover:bg-purple-500/10 hover:text-purple-200 rounded-lg transition-colors flex items-center space-x-3 group"
            >
              <div class="p-1 bg-purple-500/20 rounded group-hover:bg-purple-500/30 transition-colors">
                <BrainCircuit :size="12" class="text-purple-400" />
              </div>
              <span>Custom question...</span>
            </button>
          </div>
        </div>

        <!-- Tooltip Arrow -->
        <div
          :class="[
            'absolute w-2 h-2 bg-slate-900/95 border rotate-45',
            getArrowClasses()
          ]"
        />
      </div>
    </Transition>

    <!-- Hover Tooltip -->
    <Transition name="fade">
      <div
        v-if="isHovered && !isExpanded"
        :class="[
          'absolute z-40',
          getPositionClasses(),
          'px-3 py-2 rounded-lg border backdrop-blur-md shadow-lg bg-slate-900/95 border-white/20 text-sm text-gray-200 whitespace-nowrap'
        ]"
      >
        Ask AI about {{ contextType }}
        <div
          :class="[
            'absolute w-2 h-2 bg-slate-900/95 border rotate-45',
            getArrowClasses()
          ]"
        />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Sparkles, MessageCircle, BrainCircuit } from 'lucide-vue-next';

interface ContextualAIActionProps {
  context: string;
  contextType: 'file' | 'directory' | 'anomaly' | 'metric' | 'trend';
  onAskAI: (query: string, context: string) => void;
  position?: 'top' | 'bottom' | 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
}

const props = withDefaults(defineProps<ContextualAIActionProps>(), {
  position: 'top',
  size: 'md',
});

const isHovered = ref(false);
const isExpanded = ref(false);

const prompts = computed(() => {
  switch (props.contextType) {
    case 'file':
      return [
        `Analyze this file: ${props.context}`,
        `What does this file contain? ${props.context}`,
        `Is this file optimized? ${props.context}`,
      ];
    case 'directory':
      return [
        `Analyze this directory: ${props.context}`,
        `What's the structure of ${props.context}?`,
        `Optimize storage in ${props.context}`,
      ];
    case 'anomaly':
      return [
        `Explain this anomaly: ${props.context}`,
        `Why is this happening? ${props.context}`,
        `How to fix this issue? ${props.context}`,
      ];
    case 'metric':
      return [
        `Explain this metric: ${props.context}`,
        `What does this mean? ${props.context}`,
        `How to improve this? ${props.context}`,
      ];
    case 'trend':
      return [
        `Analyze this trend: ${props.context}`,
        `What's causing this change? ${props.context}`,
        `Predict future values for ${props.context}`,
      ];
    default:
      return [
        `Tell me about: ${props.context}`,
        `Analyze: ${props.context}`,
        `What can you tell me about ${props.context}?`,
      ];
  }
});

const getSizeClasses = () => {
  switch (props.size) {
    case 'sm':
      return 'w-6 h-6';
    case 'lg':
      return 'w-10 h-10';
    default:
      return 'w-8 h-8';
  }
};

const getPositionClasses = () => {
  switch (props.position) {
    case 'top':
      return 'bottom-full mb-2 left-1/2 -translate-x-1/2';
    case 'bottom':
      return 'top-full mt-2 left-1/2 -translate-x-1/2';
    case 'left':
      return 'right-full mr-2 top-1/2 -translate-y-1/2';
    case 'right':
      return 'left-full ml-2 top-1/2 -translate-y-1/2';
    default:
      return 'bottom-full mb-2 left-1/2 -translate-x-1/2';
  }
};

const getArrowClasses = () => {
  switch (props.position) {
    case 'top':
      return 'top-full left-1/2 -translate-x-1/2 -mt-1 border-l border-t border-white/20';
    case 'bottom':
      return 'bottom-full left-1/2 -translate-x-1/2 -mb-1 border-r border-b border-white/20';
    case 'left':
      return 'left-full top-1/2 -translate-y-1/2 -ml-1 border-t border-r border-white/20';
    case 'right':
      return 'right-full top-1/2 -translate-y-1/2 -mr-1 border-b border-l border-white/20';
    default:
      return 'top-full left-1/2 -translate-x-1/2 -mt-1 border-l border-t border-white/20';
  }
};

const handleMouseLeave = () => {
  isHovered.value = false;
  isExpanded.value = false;
};

const handlePromptClick = (prompt: string) => {
  props.onAskAI(prompt, props.context);
  isExpanded.value = false;
};

const handleCustomPrompt = () => {
  const customPrompt = window.prompt(`Ask AI about ${props.context}:`, `Tell me more about ${props.context}`);
  if (customPrompt?.trim()) {
    props.onAskAI(customPrompt, props.context);
    isExpanded.value = false;
  }
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
