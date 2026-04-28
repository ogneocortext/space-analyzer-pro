<template>
  <div :class="['enhanced-dashboard', className]">
    <div class="dashboard-layout">
      <!-- Right Content Area -->
      <div class="dashboard-right">
        <!-- Accessibility Settings Page -->
        <AccessibilitySettings
          v-if="currentPage === 'accessibility'"
          @back="onNavigate('dashboard')"
        />
        <template v-else>
          <!-- Top Section - Key Metrics -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div class="data-card">
              <div class="flex items-center justify-center mb-2">
                <FolderOpen class="w-6 h-6 text-blue-400" />
              </div>
              <div class="data-value text-lg">1.5TB</div>
              <div class="data-label text-xs">Total Storage</div>
              <div class="data-change positive flex items-center justify-center gap-1 mt-1">
                <TrendingUp class="w-3 h-3" />
                12.5%
              </div>
            </div>

            <div class="data-card">
              <div class="flex items-center justify-center mb-2">
                <BarChart3 class="w-6 h-6 text-green-400" />
              </div>
              <div class="data-value text-lg">2,847</div>
              <div class="data-label text-xs">Files Analyzed</div>
              <div class="data-change positive flex items-center justify-center gap-1 mt-1">
                <TrendingUp class="w-3 h-3" />
                8.7%
              </div>
            </div>

            <div class="data-card">
              <div class="flex items-center justify-center mb-2">
                <BrainCircuit class="w-6 h-6 text-purple-400" />
              </div>
              <div class="data-value text-lg">156</div>
              <div class="data-label text-xs">AI Insights</div>
              <div class="data-change positive flex items-center justify-center gap-1 mt-1">
                <TrendingUp class="w-3 h-3" />
                23.1%
              </div>
            </div>

            <div class="data-card">
              <div class="flex items-center justify-center mb-2">
                <TrendingUp class="w-6 h-6 text-orange-400" />
              </div>
              <div class="data-value text-lg">94%</div>
              <div class="data-label text-xs">Optimization</div>
              <div class="data-change positive flex items-center justify-center gap-1 mt-1">
                <TrendingUp class="w-3 h-3" />
                5.3%
              </div>
            </div>
          </div>

          <!-- Middle Section - Charts and Analysis -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <EnhancedChart
              title="Storage Distribution"
              subtitle="By file type and category"
              :data="storageData"
              type="pie"
              :show-legend="true"
              :show-tooltip="true"
              @data-point-click="handleDataPointClick"
            />

            <EnhancedChart
              title="Performance Metrics"
              subtitle="System resource utilization"
              :data="performanceMetrics"
              type="bar"
              :show-legend="false"
              :show-tooltip="true"
              @data-point-click="handleDataPointClick"
            />
          </div>

          <!-- Bottom Section - Detailed Analysis -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <EnhancedDataGrid
              title="File Analysis"
              subtitle="Detailed breakdown of storage usage"
              :data="fileAnalysisData"
              :expandable="true"
              @item-click="handleItemClick"
            />

            <div class="content-section polished-card">
              <div class="content-section-header">
                <div>
                  <h3 class="content-section-title">AI Recommendations</h3>
                  <p class="content-section-subtitle">Smart suggestions for optimization</p>
                </div>
              </div>

              <div class="space-y-4">
                <div class="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <div class="flex items-start gap-3">
                    <BrainCircuit class="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                    <div>
                      <h4 class="font-semibold text-white mb-1">Clean up duplicates</h4>
                      <p class="text-sm text-slate-300">
                        Found 234 duplicate files totaling 234MB that can be safely removed.
                      </p>
                    </div>
                  </div>
                </div>

                <div class="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div class="flex items-start gap-3">
                    <TrendingUp class="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                    <div>
                      <h4 class="font-semibold text-white mb-1">Archive old files</h4>
                      <p class="text-sm text-slate-300">
                        45 files older than 1 year can be archived to save 456MB.
                      </p>
                    </div>
                  </div>
                </div>

                <div class="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
                  <div class="flex items-start gap-3">
                    <BarChart3 class="w-5 h-5 text-orange-400 mt-1 flex-shrink-0" />
                    <div>
                      <h4 class="font-semibold text-white mb-1">Optimize media files</h4>
                      <p class="text-sm text-slate-300">
                        Compress 89 media files to save up to 123MB of space.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="mt-6 pt-4 border-t border-slate-700">
                <button
                  class="btn-ai-insights w-full"
                  @click="onNavigate('ai-insights')"
                >
                  <BrainCircuit class="w-5 h-5" />
                  <span class="font-semibold">View All AI Insights</span>
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { BrainCircuit, BarChart3, FolderOpen, TrendingUp } from 'lucide-vue-next';
import EnhancedChart from './EnhancedChart.vue';
import EnhancedDataGrid from './EnhancedDataGrid.vue';
import AccessibilitySettings from '../accessibility/AccessibilitySettings.vue';

interface EnhancedDashboardLayoutProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  className?: string;
}

const props = withDefaults(defineProps<EnhancedDashboardLayoutProps>(), {
  className: '',
});

// Sample data for demonstration
const storageData = [
  { name: 'Documents', value: 152342345, change: 12.5, color: '#3b82f6' },
  { name: 'Media', value: 892345678, change: -3.2, color: '#10b981' },
  { name: 'Applications', value: 456789012, change: 8.7, color: '#f59e0b' },
  { name: 'System', value: 123456789, change: 2.1, color: '#ef4444' },
];

const fileAnalysisData = [
  {
    id: '1',
    name: 'Large Files',
    value: 456789012,
    change: 15.3,
    description: 'Files larger than 100MB that may impact storage performance',
  },
  {
    id: '2',
    name: 'Duplicates',
    value: 234567890,
    change: -8.2,
    description: 'Duplicate files that can be safely removed to free space',
  },
  {
    id: '3',
    name: 'Temporary Files',
    value: 123456789,
    change: 5.1,
    description: 'Temporary and cache files that can be cleaned up',
  },
  {
    id: '4',
    name: 'Archives',
    value: 98765432,
    change: 2.8,
    description: 'Compressed archives and backup files',
  },
];

const performanceMetrics = [
  { name: 'CPU Usage', value: 67, change: -5.2, color: '#8b5cf6' },
  { name: 'Memory', value: 82, change: 12.1, color: '#06b6d4' },
  { name: 'Disk I/O', value: 45, change: 8.7, color: '#84cc16' },
  { name: 'Network', value: 23, change: -2.3, color: '#f97316' },
];

const handleDataPointClick = (data: any) => {
  console.log('Data point clicked:', data);
  // Navigate to detailed view or show modal
};

const handleItemClick = (item: any) => {
  console.log('Item clicked:', item);
  // Navigate to detailed analysis
};
</script>

<style scoped>
.enhanced-dashboard {
  @apply min-h-screen bg-slate-900;
}

.dashboard-layout {
  @apply flex;
}

.dashboard-right {
  @apply flex-1 p-6;
}

.data-card {
  @apply bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-colors;
}

.data-value {
  @apply text-white font-bold;
}

.data-label {
  @apply text-slate-400;
}

.data-change {
  @apply text-xs;
}

.data-change.positive {
  @apply text-green-400;
}

.data-change.negative {
  @apply text-red-400;
}

.content-section {
  @apply bg-slate-800 rounded-lg p-6 border border-slate-700;
}

.content-section-header {
  @apply flex items-center justify-between mb-4;
}

.content-section-title {
  @apply text-lg font-semibold text-white;
}

.content-section-subtitle {
  @apply text-sm text-slate-400;
}

.btn-ai-insights {
  @apply flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all;
}

.polished-card {
  @apply bg-slate-800 rounded-lg border border-slate-700 shadow-lg;
}
</style>
