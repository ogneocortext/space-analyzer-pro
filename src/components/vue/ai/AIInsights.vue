<template>
  <div class="p-6 max-w-7xl mx-auto">
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-white mb-2 flex items-center gap-3">
        <Brain class="w-8 h-8 text-blue-400" />
        AI Insights
      </h1>
      <p class="text-slate-400 text-lg">
        ML-generated insights and recommendations powered by advanced analytics
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
      <!-- ML Confidence Score -->
      <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <Brain class="w-6 h-6 text-blue-400" />
          <h3 class="text-lg font-semibold text-white">ML Confidence</h3>
        </div>
        <div class="text-3xl font-bold text-blue-400 mb-2">98%</div>
        <p class="text-slate-400 text-sm">High confidence in analysis results</p>
        <div class="mt-4 bg-slate-700 rounded-full h-2">
          <div class="bg-blue-400 h-2 rounded-full" style="width: 98%"></div>
        </div>
      </div>

      <!-- Pattern Recognition -->
      <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <TrendingUp class="w-6 h-6 text-green-400" />
          <h3 class="text-lg font-semibold text-white">Pattern Recognition</h3>
        </div>
        <div class="text-3xl font-bold text-green-400 mb-2">24</div>
        <p class="text-slate-400 text-sm">Usage patterns identified</p>
        <div class="mt-4 bg-slate-700 rounded-full h-2">
          <div class="bg-green-400 h-2 rounded-full" style="width: 85%"></div>
        </div>
      </div>

      <!-- Anomaly Detection -->
      <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div class="flex items-center gap-3 mb-4">
          <AlertTriangle class="w-6 h-6 text-orange-400" />
          <h3 class="text-lg font-semibold text-white">Anomaly Detection</h3>
        </div>
        <div class="text-3xl font-bold text-orange-400 mb-2">3</div>
        <p class="text-slate-400 text-sm">Potential issues flagged</p>
        <div class="mt-4 bg-slate-700 rounded-full h-2">
          <div class="bg-orange-400 h-2 rounded-full" style="width: 60%"></div>
        </div>
      </div>
    </div>

    <!-- AI Recommendations -->
    <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6 mb-6">
      <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
        <Sparkles class="w-5 h-5 text-purple-400" />
        AI Recommendations
      </h2>

      <div class="space-y-4">
        <div class="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <div class="w-2 h-2 bg-green-400 rounded-full mt-2 shrink-0"></div>
            <div>
              <h4 class="text-green-400 font-medium mb-1">Storage Optimization</h4>
              <p class="text-slate-300 text-sm">
                Based on your usage patterns, consolidating small files could save approximately
                2.3 GB of storage space.
              </p>
            </div>
          </div>
        </div>

        <div class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <div class="w-2 h-2 bg-blue-400 rounded-full mt-2 shrink-0"></div>
            <div>
              <h4 class="text-blue-400 font-medium mb-1">Backup Strategy</h4>
              <p class="text-slate-300 text-sm">
                Your backup frequency analysis suggests optimizing to weekly incremental backups
                for critical project files.
              </p>
            </div>
          </div>
        </div>

        <div class="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <div class="w-2 h-2 bg-purple-400 rounded-full mt-2 shrink-0"></div>
            <div>
              <h4 class="text-purple-400 font-medium mb-1">Performance Insights</h4>
              <p class="text-slate-300 text-sm">
                Large media files are impacting load times. Consider moving them to external
                storage or implementing lazy loading.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Learning Status -->
    <div class="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <h2 class="text-xl font-semibold text-white mb-4">Self-Learning Progress</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-400 mb-1">1,247</div>
          <div class="text-sm text-slate-400">Queries Analyzed</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-green-400 mb-1">89%</div>
          <div class="text-sm text-slate-400">Accuracy Rate</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-purple-400 mb-1">47</div>
          <div class="text-sm text-slate-400">Patterns Learned</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Brain, Sparkles, TrendingUp, AlertTriangle } from 'lucide-vue-next';

interface AIInsightsProps {
  analysisData?: any;
}

defineProps<AIInsightsProps>();
</script>
