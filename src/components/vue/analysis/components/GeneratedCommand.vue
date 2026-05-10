<!--
  Generated Command Component
  Displays the generated analysis command with copy functionality
-->
<template>
  <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
    <div class="flex items-center justify-between mb-2">
      <label class="text-sm font-medium text-gray-300">Generated Command</label>
      <div class="flex items-center gap-2">
        <button
          @click="$emit('copy')"
          class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
        >
          {{ copied ? 'Copied!' : 'Copy' }}
        </button>
        <button
          @click="$emit('execute')"
          class="text-xs px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded transition-colors"
        >
          Execute
        </button>
      </div>
    </div>
    
    <div class="relative">
      <code class="text-xs text-cyan-400 break-all font-mono">{{ command }}</code>
      
      <!-- Command Syntax Highlighting -->
      <div class="mt-2 text-xs text-gray-500">
        <span class="inline-block w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
        Command
        <span class="inline-block w-2 h-2 bg-green-500 rounded-full ml-3 mr-1"></span>
        Path
        <span class="inline-block w-2 h-2 bg-yellow-500 rounded-full ml-3 mr-1"></span>
        Options
      </div>
    </div>
    
    <!-- Command Details -->
    <div v-if="showDetails" class="mt-3 pt-3 border-t border-gray-700">
      <div class="text-xs text-gray-400 space-y-1">
        <div v-for="detail in commandDetails" :key="detail.label" class="flex justify-between">
          <span>{{ detail.label }}:</span>
          <span class="text-gray-300">{{ detail.value }}</span>
        </div>
      </div>
    </div>
    
    <!-- Toggle Details -->
    <button
      @click="toggleDetails"
      class="mt-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
    >
      {{ showDetails ? 'Hide Details' : 'Show Details' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface CommandDetail {
  label: string;
  value: string;
}

interface Props {
  command: string;
  showDetailsByDefault?: boolean;
}

interface Emits {
  (e: 'copy'): void;
  (e: 'execute'): void;
}

const props = withDefaults(defineProps<Props>(), {
  showDetailsByDefault: false,
});

const emit = defineEmits<Emits>();

// State
const showDetails = ref(props.showDetailsByDefault);
const copied = ref(false);

// Computed
const commandDetails = computed((): CommandDetail[] => {
  const parts = props.command.split(' ');
  const details: CommandDetail[] = [];
  
  // Extract command parts
  details.push({ label: 'Command', value: parts[0] || 'analyze' });
  
  // Extract path
  const pathIndex = parts.findIndex(part => !part.startsWith('--'));
  if (pathIndex > 0) {
    details.push({ label: 'Path', value: parts[pathIndex] });
  }
  
  // Extract options
  const options = parts.filter(part => part.startsWith('--'));
  if (options.length > 0) {
    details.push({ label: 'Options', value: options.length.toString() });
  }
  
  return details;
});

// Methods
const toggleDetails = () => {
  showDetails.value = !showDetails.value;
};

// Reset copied state after 2 seconds
watch(() => copied.value, (newValue) => {
  if (newValue) {
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  }
});
</script>

<style scoped>
/* Command display styles are handled by Tailwind classes */
</style>