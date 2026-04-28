<template>
  <div v-if="isOpen" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
    <div class="bg-gray-900 border border-gray-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="flex items-center justify-between p-6 border-b border-gray-700">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
            <Settings class="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 class="text-xl font-semibold text-white">Comprehensive Code Analysis</h2>
            <p class="text-gray-400 text-sm">
              Configure and run deep analysis with specialized analyzers
            </p>
          </div>
        </div>
        <button
          @click="onClose"
          class="text-gray-400 hover:text-white transition-colors"
          title="Close modal"
        >
          <X class="w-6 h-6" />
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 space-y-6">
        <!-- Project Path -->
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">Project Path</label>
          <input
            v-model="config.projectPath"
            type="text"
            placeholder="Enter path to analyze (e.g., C:\MyProject or ./src)"
            class="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
          />
        </div>

        <!-- Analyzer Selection -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <label class="block text-sm font-medium text-gray-300">
              Available Analyzers ({{ config.selectedAnalyzers.length }} selected)
            </label>
            <div class="flex gap-2">
              <button
                @click="handleSelectAll"
                class="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Select All
              </button>
              <button
                @click="handleSelectNone"
                class="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div
              v-for="analyzer in ANALYZERS"
              :key="analyzer.id"
              @click="handleAnalyzerToggle(analyzer.id)"
              :class="[
                'p-4 border rounded-lg cursor-pointer transition-all',
                config.selectedAnalyzers.includes(analyzer.id)
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-gray-600 bg-gray-800 hover:border-gray-500'
              ]"
            >
              <div class="flex items-start gap-3">
                <div
                  :class="[
                    'p-2 rounded-lg',
                    config.selectedAnalyzers.includes(analyzer.id)
                      ? 'bg-cyan-500/20'
                      : 'bg-gray-700'
                  ]"
                >
                  <component
                    :is="analyzer.icon"
                    :class="[
                      'w-4 h-4',
                      config.selectedAnalyzers.includes(analyzer.id)
                        ? 'text-cyan-400'
                        : 'text-gray-400'
                    ]"
                  />
                </div>
                <div class="flex-1">
                  <h4
                    :class="[
                      'font-medium text-sm',
                      config.selectedAnalyzers.includes(analyzer.id)
                        ? 'text-cyan-400'
                        : 'text-white'
                    ]"
                  >
                    {{ analyzer.name }}
                  </h4>
                  <p class="text-xs text-gray-400 mt-1">{{ analyzer.description }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Configuration Options -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">Output Format</label>
            <select
              v-model="config.outputFormat"
              class="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              title="Select output format"
            >
              <option value="json">JSON</option>
              <option value="text">Text Summary</option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Save Results (optional)
            </label>
            <input
              v-model="config.saveResults"
              type="text"
              placeholder="Output file path (e.g., analysis-results.json)"
              class="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>
        </div>

        <!-- Additional Options -->
        <div class="flex gap-4">
          <label class="flex items-center gap-2 text-sm text-gray-300">
            <input
              v-model="config.progress"
              type="checkbox"
              class="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
            />
            Show Progress
          </label>
          <label class="flex items-center gap-2 text-sm text-gray-300">
            <input
              v-model="config.verbose"
              type="checkbox"
              class="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
            />
            Verbose Output
          </label>
        </div>

        <!-- Generated Command -->
        <div class="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div class="flex items-center justify-between mb-2">
            <label class="text-sm font-medium text-gray-300">Generated Command</label>
            <button
              @click="copyCommand"
              class="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
            >
              Copy
            </button>
          </div>
          <code class="text-xs text-cyan-400 break-all">{{ generateCommand() }}</code>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-3 p-6 border-t border-gray-700">
        <button
          @click="onClose"
          :disabled="isLoading"
          class="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          @click="handleStartAnalysis"
          :disabled="isLoading"
          class="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <Loader2 v-if="isLoading" class="w-4 h-4 animate-spin" />
          <Play v-else class="w-4 h-4" />
          {{ isLoading ? 'Starting Analysis...' : 'Start Analysis' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  X,
  Settings,
  Code,
  Shield,
  Zap,
  FileText,
  Hammer,
  BookOpen,
  TestTube,
  Package,
  Users,
  GitBranch,
  Scale,
  Play,
  Loader2,
} from 'lucide-vue-next';

interface AnalysisConfig {
  projectPath: string;
  selectedAnalyzers: string[];
  outputFormat: 'json' | 'text';
  saveResults?: string;
  progress: boolean;
  verbose: boolean;
}

interface ComprehensiveAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartAnalysis: (config: AnalysisConfig) => void;
  isLoading?: boolean;
}

const props = withDefaults(defineProps<ComprehensiveAnalysisModalProps>(), {
  isLoading: false,
});

const config = ref<AnalysisConfig>({
  projectPath: '',
  selectedAnalyzers: ['dependency', 'quality', 'security', 'performance'],
  outputFormat: 'json',
  progress: true,
  verbose: true,
});

const ANALYZERS = [
  {
    id: 'dependency',
    name: 'Dependencies',
    icon: Package,
    description: 'Inter-file dependencies and circular dependency detection',
  },
  {
    id: 'quality',
    name: 'Code Quality',
    icon: Code,
    description: 'Technical debt markers and code smells',
  },
  {
    id: 'security',
    name: 'Security',
    icon: Shield,
    description: 'Security vulnerabilities and risk assessment',
  },
  {
    id: 'performance',
    name: 'Performance',
    icon: Zap,
    description: 'Performance bottlenecks and optimization opportunities',
  },
  {
    id: 'config',
    name: 'Configuration',
    icon: Settings,
    description: 'Config patterns and environment analysis',
  },
  {
    id: 'build',
    name: 'Build & Deploy',
    icon: Hammer,
    description: 'Build and deployment configuration analysis',
  },
  {
    id: 'docs',
    name: 'Documentation',
    icon: FileText,
    description: 'Documentation coverage and quality metrics',
  },
  {
    id: 'test',
    name: 'Testing',
    icon: TestTube,
    description: 'Test coverage and organization patterns',
  },
  {
    id: 'version',
    name: 'Version Analysis',
    icon: Package,
    description: 'Dependency versions and outdated package detection',
  },
  {
    id: 'org',
    name: 'Organization',
    icon: Users,
    description: 'Code organization patterns and architecture compliance',
  },
  {
    id: 'dev',
    name: 'Developer Activity',
    icon: GitBranch,
    description: 'Developer activity patterns and ownership information',
  },
  {
    id: 'license',
    name: 'License Analysis',
    icon: Scale,
    description: 'License detection and compliance analysis',
  },
];

const handleAnalyzerToggle = (analyzerId: string) => {
  config.value.selectedAnalyzers = config.value.selectedAnalyzers.includes(analyzerId)
    ? config.value.selectedAnalyzers.filter((id) => id !== analyzerId)
    : [...config.value.selectedAnalyzers, analyzerId];
};

const handleSelectAll = () => {
  config.value.selectedAnalyzers = ANALYZERS.map((a) => a.id);
};

const handleSelectNone = () => {
  config.value.selectedAnalyzers = [];
};

const handleStartAnalysis = () => {
  if (!config.value.projectPath.trim()) {
    alert('Please enter a project path');
    return;
  }
  if (config.value.selectedAnalyzers.length === 0) {
    alert('Please select at least one analyzer');
    return;
  }
  props.onStartAnalysis(config.value);
};

const generateCommand = () => {
  const analyzers = config.value.selectedAnalyzers.join(',');
  let command = `bin\\space-analyzer-cli.exe analyze "${config.value.projectPath}"`;
  command += ` --format ${config.value.outputFormat}`;
  if (config.value.progress) command += ' --progress';
  if (config.value.verbose) command += ' --verbose';
  if (config.value.saveResults) command += ` --output "${config.value.saveResults}"`;
  return command;
};

const copyCommand = () => {
  navigator.clipboard.writeText(generateCommand());
  alert('Command copied to clipboard!');
};
</script>

<style scoped>
/* Additional styles if needed */
</style>
