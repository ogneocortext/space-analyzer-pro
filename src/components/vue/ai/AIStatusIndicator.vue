<template>
  <div class="bg-gray-800 border border-gray-700 rounded-lg p-3">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <Brain class="h-4 w-4 text-blue-500" />
        <div>
          <h3 class="font-semibold text-white text-sm">AI Assistant</h3>
          <p class="text-xs text-gray-400">Enhanced workflow active</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <div
          :class="[
            'flex items-center gap-1 px-2 py-1 rounded text-xs',
            capabilities.vision ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300',
          ]"
        >
          <Activity v-if="capabilities.vision" class="h-3 w-3" />
          <WifiOff v-else class="h-3 w-3" />
          <span>{{ capabilities.vision ? "Vision" : "Text Only" }}</span>
        </div>

        <div
          :class="[
            'flex items-center gap-1 px-2 py-1 rounded text-xs',
            capabilities.selfLearning ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300',
          ]"
        >
          <Brain v-if="capabilities.selfLearning" class="h-3 w-3" />
          <WifiOff v-else class="h-3 w-3" />
          <span>{{ capabilities.selfLearning ? "Learning" : "Static" }}</span>
        </div>

        <div
          :class="[
            'px-2 py-1 rounded text-xs',
            capabilities.enhancedWorkflow
              ? 'bg-purple-600 text-white'
              : 'bg-gray-600 text-gray-300',
          ]"
        >
          {{ capabilities.enhancedWorkflow ? "Enhanced" : "Basic" }}
        </div>
      </div>

      <div class="flex items-center gap-2">
        <div
          :class="[
            'flex items-center gap-1 px-2 py-1 rounded text-xs',
            aiStatus?.error
              ? 'bg-red-600 text-white'
              : aiStatus?.streaming
                ? 'bg-blue-600 text-white'
                : 'bg-gray-600 text-gray-300',
          ]"
        >
          <Activity v-if="aiStatus?.streaming" class="h-3 w-3 animate-pulse" />
          <span>{{ getStatusText() }}</span>
        </div>

        <span v-if="aiStatus?.confidence" class="text-xs text-gray-400 ml-2">
          {{ Math.round(aiStatus.confidence * 100) }}% confidence
        </span>
      </div>

      <button
        class="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded border border-gray-600"
        @click="openSettings"
      >
        Settings
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Brain, Activity, WifiOff } from "lucide-vue-next";

interface AIStatusIndicatorProps {
  aiStatus: {
    model?: string;
    stage?: string;
    streaming?: boolean;
    confidence?: number;
    error?: string;
  };
  capabilities: {
    vision: boolean;
    codeAnalysis: boolean;
    selfLearning: boolean;
    ollamaAvailable: boolean;
    enhancedWorkflow: boolean;
    streaming: boolean;
    toolCalling: boolean;
  };
}

const props = defineProps<AIStatusIndicatorProps>();

const getStatusText = () => {
  if (props.aiStatus?.error) return `Error: ${props.aiStatus.error}`;
  if (props.aiStatus?.streaming) return `Streaming with ${props.aiStatus.model || "AI"}`;
  if (props.aiStatus?.stage) return `${props.aiStatus.stage} (${props.aiStatus.model})`;
  return `Ready (${props.aiStatus.model || "AI"})`;
};

const openSettings = () => {
  window.open("/api/health", "_blank");
};
</script>
