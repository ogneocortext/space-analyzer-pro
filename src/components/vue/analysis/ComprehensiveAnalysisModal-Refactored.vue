<!--
  Comprehensive Analysis Modal - Refactored
  Main modal component that orchestrates analysis configuration
-->
<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
  >
    <div
      class="bg-gray-900 border border-gray-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
    >
      <!-- Header -->
      <AnalysisModalHeader 
        :title="modalTitle"
        :subtitle="modalSubtitle"
        :icon="modalIcon"
        @close="onClose"
      />

      <!-- Content -->
      <div class="p-6 space-y-6">
        <!-- Project Path -->
        <ProjectPathInput 
          v-model="config.projectPath"
          placeholder="Enter path to analyze (e.g., C:\MyProject or ./src)"
        />

        <!-- Analyzer Selection -->
        <AnalyzerSelection
          v-model:selected-analyzers="config.selectedAnalyzers"
          :available-analyzers="availableAnalyzers"
          @select-all="handleSelectAll"
          @select-none="handleSelectNone"
        />

        <!-- Configuration Options -->
        <AnalysisConfiguration
          v-model="config"
          :output-formats="outputFormats"
        />

        <!-- Generated Command -->
        <GeneratedCommand
          :command="generateCommand()"
          @copy="copyCommand"
        />
      </div>

      <!-- Actions -->
      <AnalysisModalActions
        :is-loading="isLoading"
        :cancel-text="'Cancel'"
        :confirm-text="isLoading ? 'Starting Analysis...' : 'Start Analysis'"
        @cancel="onClose"
        @confirm="handleStartAnalysis"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Settings, Play, Loader2 } from 'lucide-vue-next';
import { analysisService } from '../../../services/AnalysisService';
import { useAnalysis } from '../../../composables/useAnalysis';
import AnalysisModalHeader from './components/AnalysisModalHeader.vue';
import ProjectPathInput from './components/ProjectPathInput.vue';
import AnalyzerSelection from './components/AnalyzerSelection.vue';
import AnalysisConfiguration from './components/AnalysisConfiguration.vue';
import GeneratedCommand from './components/GeneratedCommand.vue';
import AnalysisModalActions from './components/AnalysisModalActions.vue';

interface AnalysisConfig {
  projectPath: string;
  selectedAnalyzers: string[];
  outputFormat: 'json' | 'text';
  saveResults?: string;
  progress: boolean;
  verbose: boolean;
}

interface Props {
  isOpen: boolean;
  isLoading?: boolean;
}

interface Emits {
  (e: 'close'): void;
  (e: 'start-analysis', config: AnalysisConfig): void;
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
});

const emit = defineEmits<Emits>();

// Composables
const { availableAnalyzers, startAnalysis } = useAnalysis();

// State
const config = ref<AnalysisConfig>({
  projectPath: '',
  selectedAnalyzers: [],
  outputFormat: 'json',
  saveResults: '',
  progress: true,
  verbose: false,
});

// Computed
const modalTitle = computed(() => 'Comprehensive Code Analysis');
const modalSubtitle = computed(() => 'Configure and run deep analysis with specialized analyzers');
const modalIcon = computed(() => Settings);

const outputFormats = computed(() => [
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Text Summary' },
]);

// Methods
const handleSelectAll = () => {
  config.value.selectedAnalyzers = availableAnalyzers.value.map(analyzer => analyzer.id);
};

const handleSelectNone = () => {
  config.value.selectedAnalyzers = [];
};

const handleStartAnalysis = async () => {
  if (!config.value.projectPath.trim()) {
    alert('Please enter a project path');
    return;
  }

  if (config.value.selectedAnalyzers.length === 0) {
    alert('Please select at least one analyzer');
    return;
  }

  try {
    await startAnalysis(config.value);
    emit('start-analysis', config.value);
  } catch (error) {
    console.error('Failed to start analysis:', error);
    alert('Failed to start analysis. Please check the console for details.');
  }
};

const generateCommand = (): string => {
  const parts = ['analyze', config.value.projectPath];
  
  if (config.value.selectedAnalyzers.length > 0) {
    parts.push('--analyzers', config.value.selectedAnalyzers.join(','));
  }
  
  parts.push('--format', config.value.outputFormat);
  
  if (config.value.saveResults) {
    parts.push('--output', config.value.saveResults);
  }
  
  if (config.value.progress) {
    parts.push('--progress');
  }
  
  if (config.value.verbose) {
    parts.push('--verbose');
  }
  
  return parts.join(' ');
};

const copyCommand = async () => {
  const command = generateCommand();
  try {
    await navigator.clipboard.writeText(command);
    // Could show a toast notification here
  } catch (error) {
    console.error('Failed to copy command:', error);
  }
};
</script>

<style scoped>
/* Modal styles are handled by the layout components */
</style>