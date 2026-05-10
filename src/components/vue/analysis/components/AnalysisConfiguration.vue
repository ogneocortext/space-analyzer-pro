<!--
  Analysis Configuration Component
  Configuration options for analysis output and settings
-->
<template>
  <div class="space-y-4">
    <!-- Output Configuration -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">Output Format</label>
        <select
          :value="modelValue.outputFormat"
          @change="updateField('outputFormat', ($event.target as HTMLSelectElement).value)"
          class="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          title="Select output format"
        >
          <option
            v-for="format in outputFormats"
            :key="format.value"
            :value="format.value"
          >
            {{ format.label }}
          </option>
        </select>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-300 mb-2">
          Save Results (optional)
        </label>
        <div class="relative">
          <input
            :value="modelValue.saveResults"
            @input="updateField('saveResults', ($event.target as HTMLInputElement).value)"
            type="text"
            placeholder="Output file path (e.g., analysis-results.json)"
            class="w-full px-4 py-2 pr-10 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
          <button
            @click="$emit('browse-output')"
            class="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-white transition-colors"
            title="Browse for save location"
          >
            <Folder class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>

    <!-- Additional Options -->
    <div class="flex flex-wrap gap-4">
      <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
        <input
          :checked="modelValue.progress"
          @change="updateField('progress', ($event.target as HTMLInputElement).checked)"
          type="checkbox"
          class="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
        />
        <span>Show Progress</span>
      </label>
      
      <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
        <input
          :checked="modelValue.verbose"
          @change="updateField('verbose', ($event.target as HTMLInputElement).checked)"
          type="checkbox"
          class="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
        />
        <span>Verbose Output</span>
      </label>
      
      <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
        <input
          :checked="modelValue.includeRecommendations"
          @change="updateField('includeRecommendations', ($event.target as HTMLInputElement).checked)"
          type="checkbox"
          class="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
        />
        <span>Include Recommendations</span>
      </label>
      
      <label class="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
        <input
          :checked="modelValue.saveIntermediate"
          @change="updateField('saveIntermediate', ($event.target as HTMLInputElement).checked)"
          type="checkbox"
          class="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
        />
        <span>Save Intermediate Results</span>
      </label>
    </div>

    <!-- Advanced Options -->
    <div class="border-t border-gray-700 pt-4">
      <button
        @click="toggleAdvanced"
        class="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
      >
        <ChevronDown
          :class="['w-4 h-4 transition-transform', { 'rotate-180': showAdvanced }]"
        />
        <span>Advanced Options</span>
      </button>
      
      <div v-if="showAdvanced" class="mt-4 space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Max File Size (MB)
            </label>
            <input
              :value="modelValue.maxFileSize"
              @input="updateField('maxFileSize', parseInt(($event.target as HTMLInputElement).value))"
              type="number"
              min="1"
              max="1000"
              class="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Concurrency Level
            </label>
            <select
              :value="modelValue.concurrency"
              @change="updateField('concurrency', parseInt(($event.target as HTMLSelectElement).value))"
              class="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="1">Low (1 thread)</option>
              <option value="2">Medium (2 threads)</option>
              <option value="4">High (4 threads)</option>
              <option value="8">Maximum (8 threads)</option>
            </select>
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            File Extensions (comma-separated, leave empty for all)
          </label>
          <input
            :value="modelValue.fileExtensions"
            @input="updateField('fileExtensions', ($event.target as HTMLInputElement).value)"
            type="text"
            placeholder="e.g., .js,.ts,.vue,.py"
            class="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Exclude Patterns (one per line)
          </label>
          <textarea
            :value="modelValue.excludePatterns"
            @input="updateField('excludePatterns', ($event.target as HTMLTextAreaElement).value)"
            rows="3"
            placeholder="node_modules/
.git/
*.min.js"
            class="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent font-mono text-sm"
          ></textarea>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Folder, ChevronDown } from 'lucide-vue-next';

interface AnalysisConfig {
  outputFormat: 'json' | 'text';
  saveResults?: string;
  progress: boolean;
  verbose: boolean;
  includeRecommendations?: boolean;
  saveIntermediate?: boolean;
  maxFileSize?: number;
  concurrency?: number;
  fileExtensions?: string;
  excludePatterns?: string;
}

interface OutputFormat {
  value: string;
  label: string;
}

interface Props {
  modelValue: AnalysisConfig;
  outputFormats: OutputFormat[];
}

interface Emits {
  (e: 'update:modelValue', value: AnalysisConfig): void;
  (e: 'browse-output'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// State
const showAdvanced = ref(false);

// Methods
const updateField = (field: keyof AnalysisConfig, value: any) => {
  emit('update:modelValue', {
    ...props.modelValue,
    [field]: value,
  });
};

const toggleAdvanced = () => {
  showAdvanced.value = !showAdvanced.value;
};
</script>

<style scoped>
/* Configuration styles are handled by Tailwind classes */
</style>