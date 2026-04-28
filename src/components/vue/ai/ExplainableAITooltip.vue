<template>
  <div class="relative inline-block">
    <div
      @mouseenter="isOpen = true"
      @mouseleave="isOpen = false"
      class="cursor-help"
    >
      <slot />
    </div>

    <Transition name="fade">
      <div
        v-if="isOpen"
        :class="['absolute z-50', getPositionClasses(), 'w-80 p-4 rounded-xl border backdrop-blur-md shadow-2xl text-sm bg-slate-900/95 border-white/20']"
      >
        <!-- Header -->
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center space-x-2">
            <HelpCircle :size="16" class="text-blue-400" />
            <span class="font-semibold text-white">AI Explanation</span>
          </div>
          <div
            :class="['px-2 py-1 rounded-full text-xs font-medium border', getConfidenceColor(reasoning.confidence)]"
          >
            {{ reasoning.confidence }}% Confidence
          </div>
        </div>

        <!-- Logic Explanation -->
        <div class="mb-4">
          <p class="text-gray-200 leading-relaxed">{{ reasoning.logic }}</p>
        </div>

        <!-- Contributing Factors -->
        <div class="mb-4">
          <h5 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Contributing Factors
          </h5>
          <div class="space-y-2">
            <div
              v-for="(factor, index) in reasoning.factors"
              :key="index"
              class="flex items-center justify-between"
            >
              <div class="flex items-center space-x-2 flex-1 min-w-0">
                <component :is="getFactorIcon(factor.type)" :size="12" :class="getFactorColor(factor.type)" />
                <span class="text-gray-300 text-xs truncate">{{ factor.label }}</span>
              </div>
              <div class="flex items-center space-x-2">
                <div class="w-16 bg-gray-700 rounded-full h-1.5">
                  <div
                    :class="['h-1.5 rounded-full transition-all duration-500', getFactorBarColor(factor.type)]"
                    :style="{ width: `${Math.abs(factor.impact)}%` }"
                  />
                </div>
                <span :class="['text-xs font-medium', getFactorColor(factor.type)]">
                  {{ factor.impact > 0 ? '+' : '' }}{{ factor.impact }}%
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Evidence -->
        <div v-if="reasoning.evidence && reasoning.evidence.length > 0" class="mb-4">
          <h5 class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Evidence
          </h5>
          <ul class="space-y-1">
            <li
              v-for="(evidence, index) in reasoning.evidence.slice(0, 3)"
              :key="index"
              class="text-gray-300 text-xs flex items-start space-x-2"
            >
              <span class="text-gray-500 mt-1">•</span>
              <span class="leading-relaxed">{{ evidence }}</span>
            </li>
          </ul>
        </div>

        <!-- Recommendation -->
        <div v-if="reasoning.recommendation" class="pt-3 border-t border-white/10">
          <div class="flex items-start space-x-2">
            <Lightbulb :size="14" class="text-yellow-400 mt-0.5 shrink-0" />
            <div>
              <span class="text-xs font-semibold text-yellow-400 uppercase tracking-wide">
                Recommendation
              </span>
              <p class="text-gray-200 text-sm mt-1">{{ reasoning.recommendation }}</p>
            </div>
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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { HelpCircle, TrendingUp, AlertTriangle, Target, Lightbulb } from 'lucide-vue-next';

interface XAIReasoning {
  logic: string;
  confidence: number;
  factors: { label: string; impact: number; type: 'positive' | 'negative' | 'neutral' }[];
  evidence: string[];
  recommendation?: string;
}

interface ExplainableAITooltipProps {
  reasoning: XAIReasoning;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const props = withDefaults(defineProps<ExplainableAITooltipProps>(), {
  position: 'top',
});

const isOpen = ref(false);

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 90) return 'text-green-400 border-green-500/30 bg-green-500/10';
  if (confidence >= 70) return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
  return 'text-red-400 border-red-500/30 bg-red-500/10';
};

const getFactorIcon = (type: string) => {
  switch (type) {
    case 'positive':
      return TrendingUp;
    case 'negative':
      return AlertTriangle;
    default:
      return Target;
  }
};

const getFactorColor = (type: string) => {
  switch (type) {
    case 'positive':
      return 'text-green-400';
    case 'negative':
      return 'text-red-400';
    default:
      return 'text-blue-400';
  }
};

const getFactorBarColor = (type: string) => {
  switch (type) {
    case 'positive':
      return 'bg-green-400';
    case 'negative':
      return 'bg-red-400';
    default:
      return 'bg-blue-400';
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
